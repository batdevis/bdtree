// Build, then deploy to the Firebase project named in the content's band.json.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { contentDir } from "../eleventy.config.js";

const { firebaseProject } = JSON.parse(readFileSync(`${contentDir}/band.json`, "utf8"));
if (!firebaseProject || contentDir === "example") {
  console.error(`Refusing to deploy: set "firebaseProject" in your own content/band.json (using ./${contentDir}).`);
  process.exit(1);
}

const run = (cmd) => execSync(cmd, { stdio: "inherit" });
run("npm run build");
run(`npx firebase-tools deploy --only hosting --project ${firebaseProject}`);
