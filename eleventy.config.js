import { existsSync, readFileSync } from "node:fs";
import { RenderPlugin } from "@11ty/eleventy";

// Band content lives outside the code: $CONTENT_DIR, else ./content (your own,
// usually a private repo), else ./example (the demo band shipped with the code).
export const contentDir = process.env.CONTENT_DIR || (existsSync("content") ? "content" : "example");

const read = (file) => readFileSync(`${contentDir}/${file}`, "utf8");
const readJson = (file) => JSON.parse(read(file));

export default function (eleventyConfig) {
  console.log(`[bdtree] content from ./${contentDir}`);

  eleventyConfig.addPlugin(RenderPlugin);

  // Read on every build so `npm start` picks up content edits.
  eleventyConfig.addGlobalData("band", () => readJson("band.json"));
  eleventyConfig.addGlobalData("gigs", () => readJson("gigs.json"));
  eleventyConfig.addGlobalData("i18n", () => readJson("i18n.json"));
  eleventyConfig.addGlobalData("bio", () => ({ it: read("bio/it.md"), en: read("bio/en.md") }));
  // Footer "source code" link: package.json `repository` (forks: point it at your fork).
  eleventyConfig.addGlobalData("repoUrl", () => JSON.parse(readFileSync("package.json", "utf8")).repository?.url);
  eleventyConfig.addGlobalData("hasTheme", () => existsSync(`${contentDir}/theme.css`));
  eleventyConfig.addWatchTarget(contentDir);
  // content/ is gitignored (it's a separate repo); don't let that stop the watcher.
  eleventyConfig.setUseGitIgnore(false);

  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy({
    [`${contentDir}/img`]: "assets/img",
    [`${contentDir}/press`]: "assets/press",
  });
  if (existsSync(`${contentDir}/theme.css`)) {
    eleventyConfig.addPassthroughCopy({ [`${contentDir}/theme.css`]: "assets/css/theme.css" });
  }

  // Inline SVGs (logo) so they can take currentColor.
  eleventyConfig.addShortcode("svg", (path) => read(`img/${path}`));

  // Same page in a given language: Italian lives at the root, English under /en/.
  eleventyConfig.addFilter("localUrl", (path, lang) => (lang === "it" ? path : `/${lang}${path}`));

  // Gigs from today on, sorted by date. Evaluated at build time:
  // rebuild + redeploy to drop past dates.
  eleventyConfig.addFilter("upcoming", (gigs) => {
    const today = new Date().toISOString().slice(0, 10);
    return gigs
      .filter((g) => g.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
  });

  eleventyConfig.addFilter("gigDate", (iso, lang) => {
    const d = new Date(`${iso}T12:00:00`);
    const locale = lang === "it" ? "it-IT" : "en-GB";
    return {
      day: d.toLocaleDateString(locale, { day: "2-digit" }),
      month: d.toLocaleDateString(locale, { month: "short" }).replace(".", ""),
      weekday: d.toLocaleDateString(locale, { weekday: "short" }).replace(".", ""),
    };
  });

  return {
    dir: { input: "src", output: "_site" },
  };
}
