// Deploy the Cloud Functions behind /admin/ to the Firebase project named in the
// content's band.json. Their params come from <content>/functions.env.
// Run it by hand when functions/ changes: CI only deploys Hosting.
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { contentDir } from "../eleventy.config.js";

const { firebaseProject } = JSON.parse(readFileSync(`${contentDir}/band.json`, "utf8"));
if (!firebaseProject || contentDir === "example") {
  console.error(`Refusing to deploy: set "firebaseProject" in your own content/band.json (using ./${contentDir}).`);
  process.exit(1);
}
if (!existsSync(`${contentDir}/functions.env`)) {
  console.error(`Missing ${contentDir}/functions.env: start from example/functions.env.`);
  process.exit(1);
}

copyFileSync(`${contentDir}/functions.env`, `functions/.env.${firebaseProject}`);
const run = (cmd) => execSync(cmd, { stdio: "inherit" });
run("npm ci --prefix functions");
run(`npx firebase-tools deploy --only functions --project ${firebaseProject}`);
