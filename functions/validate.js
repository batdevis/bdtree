// Validate what the admin page sends and serialize it the way the content
// files are written by hand, so commits produce clean diffs.
import { HttpsError } from "firebase-functions/v2/https";

const LANGS = ["it", "en"];

const fail = (message) => {
  throw new HttpsError("invalid-argument", message);
};

function str(value, field, { max = 500, required = false } = {}) {
  if (value == null) value = "";
  if (typeof value !== "string") fail(`${field}: not a string`);
  value = value.trim();
  if (required && !value) fail(`${field}: required`);
  if (value.length > max) fail(`${field}: too long (max ${max})`);
  return value;
}

function localized(value, field, opts) {
  if (!value || typeof value !== "object") fail(`${field}: missing`);
  return Object.fromEntries(LANGS.map((lang) => [lang, str(value[lang], `${field}.${lang}`, opts)]));
}

const isUrl = (s) => /^https?:\/\/\S+$/.test(s);

function list(value, field, max) {
  if (!Array.isArray(value)) fail(`${field}: not a list`);
  if (value.length > max) fail(`${field}: too many items (max ${max})`);
  return value;
}

export function gigs(value) {
  return list(value, "gigs", 200)
    .map((g, i) => {
      const f = `gig ${i + 1}`;
      const date = str(g?.date, `${f} date`, { required: true });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) fail(`${f}: invalid date "${date}"`);
      const gig = {
        date,
        city: str(g.city, `${f} city`, { required: true }),
        venue: str(g.venue, `${f} venue`, { required: true }),
      };
      const url = str(g.url, `${f} url`);
      if (url && !isUrl(url)) fail(`${f}: the link must start with http:// or https://`);
      if (url) gig.url = url;
      return gig;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

// One gig per line, as in the hand-written file.
export function gigsFile(list) {
  if (!list.length) return "[]\n";
  const line = (g) => `  { ${Object.entries(g).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(", ")} }`;
  return `[\n${list.map(line).join(",\n")}\n]\n`;
}

function links(value) {
  return list(value, "links", 30).map((l, i) => {
    const f = `link ${i + 1}`;
    const id = str(l?.id, `${f} id`, { required: true, max: 40 });
    if (!/^[a-z0-9-]+$/.test(id)) fail(`${f}: id may only contain a-z, 0-9 and -`);
    const link = { id, label: localized(l.label, `${f} label`, { required: true, max: 80 }) };
    const url = str(l.url, `${f} url`);
    const page = str(l.page, `${f} page`);
    if (!url === !page) fail(`${f}: set either an external url or a page of the site`);
    if (url && !isUrl(url) && !url.startsWith("/")) fail(`${f}: url must start with http(s):// or /`);
    if (page && !page.startsWith("/")) fail(`${f}: page must start with /`);
    if (url) link.url = url;
    else link.page = page;
    if (l.featured === true) link.featured = true;
    if (l.newTab === true) link.newTab = true;
    return link;
  });
}

// Only the editable fields change; name, siteUrl, firebaseProject and anything
// else stay as they are in the repo.
export function band(value, current) {
  if (!value || typeof value !== "object") fail("band: missing");
  const email = str(value.email, "email", { required: true, max: 200 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(`email: invalid "${email}"`);
  return {
    ...current,
    genre: localized(value.genre, "genre", { max: 120 }),
    tagline: localized(value.tagline, "tagline", { max: 200 }),
    email,
    links: links(value.links),
  };
}

// Same languages and keys as the current file: texts can change, the set of
// keys is decided by the templates.
export function i18n(value, current) {
  if (!value || typeof value !== "object") fail("texts: missing");
  return Object.fromEntries(
    Object.entries(current).map(([lang, texts]) => [
      lang,
      Object.fromEntries(
        Object.keys(texts).map((key) => {
          if (typeof value[lang]?.[key] !== "string") fail(`${lang}.${key}: missing`);
          return [key, str(value[lang][key], `${lang}.${key}`)];
        }),
      ),
    ]),
  );
}

export function bio(value) {
  if (!value || typeof value !== "object") fail("bio: missing");
  return Object.fromEntries(
    LANGS.map((lang) => [lang, `${str(value[lang]?.replace(/\r\n?/g, "\n"), `bio ${lang}`, { max: 20000 })}\n`]),
  );
}

export const jsonFile = (data) => `${JSON.stringify(data, null, 2)}\n`;
