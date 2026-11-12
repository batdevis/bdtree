// Run the site with the /admin/ editor on http://localhost:5000, on the Firebase
// emulators: Hosting (serves _site/ and /__/firebase/init.json), Auth and Functions.
// The functions still talk to the real GitHub repo, so Save makes a real commit.
// To try saving safely, point them at another branch of the content repo:
//   GITHUB_BRANCH=admin-test npm run emulators
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { contentDir } from "../eleventy.config.js";

const { firebaseProject } = JSON.parse(readFileSync(`${contentDir}/band.json`, "utf8"));
if (!firebaseProject || !existsSync(`${contentDir}/functions.env`)) {
  console.error(`The emulators need "firebaseProject" in band.json and a functions.env (using ./${contentDir}).`);
  process.exit(1);
}

copyFileSync(`${contentDir}/functions.env`, `functions/.env.${firebaseProject}`);

// Emulator-only overrides (functions/.env.local, generated here). A deploy turns
// the comma-separated ADMIN_EMAILS into a list, the emulator wants JSON.
const adminEmails = readFileSync(`${contentDir}/functions.env`, "utf8").match(/^ADMIN_EMAILS=(.*)$/m)?.[1] ?? "";
const overrides = [`ADMIN_EMAILS=${JSON.stringify(adminEmails.split(",").map((e) => e.trim()))}`];
if (process.env.GITHUB_BRANCH) overrides.push(`GITHUB_BRANCH=${process.env.GITHUB_BRANCH}`);
writeFileSync("functions/.env.local", `${overrides.join("\n")}\n`);

const run = (cmd) => execSync(cmd, { stdio: "inherit" });
if (!existsSync("functions/node_modules")) run("npm ci --prefix functions");
run("npm run build");
run(`npx firebase-tools emulators:start --only hosting,auth,functions --project ${firebaseProject}`);
