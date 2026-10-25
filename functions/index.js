// Backend of the /admin/ editor. The band content lives in a GitHub repo:
// getContent reads it, saveContent commits the edits, and that push triggers
// the content repo's deploy workflow as usual.
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineList, defineSecret, defineString } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { github, GitHubError } from "./github.js";
import * as validate from "./validate.js";

const GITHUB_TOKEN = defineSecret("GITHUB_TOKEN"); // fine-grained PAT: content repo only, Contents read/write
const GITHUB_REPO = defineString("GITHUB_REPO"); // owner/name
const GITHUB_BRANCH = defineString("GITHUB_BRANCH", { default: "main" });
const ADMIN_EMAILS = defineList("ADMIN_EMAILS"); // Google accounts allowed to edit

const options = { region: "europe-west1", secrets: [GITHUB_TOKEN], maxInstances: 2 };

const PATHS = {
  band: "band.json",
  gigs: "gigs.json",
  i18n: "i18n.json",
  bioIt: "bio/it.md",
  bioEn: "bio/en.md",
};

function requireAdmin(auth) {
  if (!auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const email = auth.token.email?.toLowerCase();
  const allowed = ADMIN_EMAILS.value().map((e) => e.trim().toLowerCase());
  if (!email || !auth.token.email_verified || !allowed.includes(email)) {
    throw new HttpsError("permission-denied", `${auth.token.email || "This account"} is not allowed to edit.`);
  }
  return { name: auth.token.name || email, email };
}

const repo = () => github(GITHUB_TOKEN.value(), GITHUB_REPO.value());

// Turn GitHub failures into messages the page can show (an uncaught error
// reaches the client as a bare "INTERNAL").
function explainGitHubErrors(handler) {
  return async (request) => {
    try {
      return await handler(request);
    } catch (err) {
      if (!(err instanceof GitHubError)) throw err;
      logger.error(err);
      if (err.status === 401) {
        throw new HttpsError("unavailable", "The GitHub token is invalid or expired: renew the GITHUB_TOKEN secret.");
      }
      if (err.status === 403 || err.status === 404) {
        throw new HttpsError(
          "unavailable",
          `The GitHub token can't access ${GITHUB_REPO.value()}: check its repository access and Contents permission.`,
        );
      }
      throw new HttpsError("unavailable", `GitHub error ${err.status}: try again in a moment.`);
    }
  };
}

async function readContent(gh, sha) {
  const [band, gigs, i18n, bioIt, bioEn] = await Promise.all(Object.values(PATHS).map((p) => gh.readFile(p, sha)));
  return {
    band: JSON.parse(band),
    gigs: JSON.parse(gigs),
    i18n: JSON.parse(i18n),
    bio: { it: bioIt, en: bioEn },
  };
}

export const getContent = onCall(
  options,
  explainGitHubErrors(async ({ auth }) => {
    requireAdmin(auth);
    const gh = repo();
    const baseSha = await gh.headSha(GITHUB_BRANCH.value());
    return { baseSha, ...(await readContent(gh, baseSha)) };
  }),
);

const conflict = () =>
  new HttpsError("failed-precondition", "Someone else saved in the meantime: reload the page and redo your changes.");

// data: { baseSha, band?, gigs?, i18n?, bio? }, only the parts that changed.
export const saveContent = onCall(
  options,
  explainGitHubErrors(async ({ auth, data }) => {
    const author = requireAdmin(auth);
    const gh = repo();
    const branch = GITHUB_BRANCH.value();
    const parent = await gh.headSha(branch);
    if (data?.baseSha !== parent) throw conflict();

    const current = await readContent(gh, parent);
    const files = {};
    if (data.band) files[PATHS.band] = validate.jsonFile(validate.band(data.band, current.band));
    if (data.gigs) files[PATHS.gigs] = validate.gigsFile(validate.gigs(data.gigs));
    if (data.i18n) files[PATHS.i18n] = validate.jsonFile(validate.i18n(data.i18n, current.i18n));
    if (data.bio) {
      const bio = validate.bio(data.bio);
      files[PATHS.bioIt] = bio.it;
      files[PATHS.bioEn] = bio.en;
    }

    // Drop files whose content didn't change (compared in the same serialization,
    // so hand-written formatting alone doesn't count as a change).
    const before = {
      [PATHS.band]: validate.jsonFile(current.band),
      [PATHS.gigs]: validate.gigsFile(current.gigs),
      [PATHS.i18n]: validate.jsonFile(current.i18n),
      [PATHS.bioIt]: current.bio.it,
      [PATHS.bioEn]: current.bio.en,
    };
    for (const [path, text] of Object.entries(files)) {
      if (text === before[path]) delete files[path];
    }
    const changed = Object.keys(files);
    if (!changed.length) return { baseSha: parent, changed };

    try {
      const sha = await gh.commit({
        branch,
        parent,
        files,
        message: `admin: update ${changed.join(", ")}`,
        author: { ...author, date: new Date().toISOString() },
      });
      logger.info("content saved", { by: author.email, changed, sha });
      return { baseSha: sha, changed };
    } catch (err) {
      if (err instanceof GitHubError && err.status === 422) throw conflict();
      throw err;
    }
  }),
);
