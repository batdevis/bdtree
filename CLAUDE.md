# bdtree

Link-in-bio page for bands: Eleventy 3 (Nunjucks), static output, deployed to Firebase Hosting. Public, MIT.

## Commands

- `npm start`: dev server on http://localhost:8080 with live reload (also on content edits)
- `npm run build`: wipes `_site/`, then builds
- `npm run deploy`: build + `firebase-tools deploy --project <band.json firebaseProject>` (`scripts/deploy.js`; refuses with `example/` content). `firebase-tools` is an exact devDependency, so `npx firebase-tools` uses the local copy; bump it with `npm install --save-dev --save-exact firebase-tools@<version>`. Since 15.34 the deploy account also needs `roles/serviceusage.serviceUsageConsumer` (it checks that the Hosting API is enabled)
- `npm run deploy:functions`: copies `<content>/functions.env` to `functions/.env.<project>` (gitignored), installs `functions/` deps, deploys only the functions (`scripts/deploy-functions.js`). Manual: CI deploys Hosting only
- `KIT_DIR=/path npm run presskit`: zips a folder into `<content>/press/<Name>-press-kit.zip`, JPEGs shrunk to 2400px (`scripts/presskit.sh`)

## Code vs content

Code and band content are strictly separate.

- Content dir = `$CONTENT_DIR`, else `content/`, else `example/` (`contentDir` in `eleventy.config.js`). `content/` is gitignored (`/content`, which also matches a symlink): each band keeps it in its own, usually private, repo.
- Content format: `band.json` (optional `analytics` flag), `gigs.json`, `i18n.json`, `bio/{it,en}.md`, `img/`, `press/`, optional `theme.css` and `functions.env` (admin editor params). `example/` is the reference for this format: keep it complete and working whenever the format changes. The public template content repo `batdevis/bdtree-the-placeholders` is a copy of `example/` plus a deploy workflow and setup README: after changing `example/`, run `scripts/sync-template.sh <template clone>` and commit there too.
- **Never put real band data in this repo**, i.e. no names, contacts, photos or PDFs of an actual band. `example/` is the fictional "The Placeholders". Its images are generated (ImageMagick plasma), and its tech rider PDF comes from headless Chrome.
- Templates read content only through global data (`band`, `gigs`, `i18n`, `bio`, `hasTheme`) and the `svg` shortcode. Assets are passthrough-copied from `<content>/img|press` to `/assets/img|press`.

## Architecture notes

- Bilingual: each page is paginated over `langs: ["it", "en"]`. Italian is at `/`, English at `/en/`. Each page declares `path:` (e.g. `/bio/`), and the `localUrl` filter builds the URL for either language (used by the language switch and hreflang).
- Bio: `src/bio.njk` renders `bio[lang]` with `renderContent("md")` (Eleventy RenderPlugin). There's no front matter in the `.md` files; the page description is in `i18n.json` as `bioDescription`.
- Gigs: the `upcoming` filter drops past dates **at build time**, so a redeploy is needed after a show.
- Links in `band.json`: `url` (external) or `page` (internal, localized), optional `featured`, `newTab`. The `id` picks the icon in `src/_includes/icons.njk`.
- `setUseGitIgnore(false)` is required: otherwise the watcher ignores the gitignored `content/` and live reload breaks.
- Footer (`src/_includes/footer.njk`, shared by all pages): the GitHub "source" link comes from `repository.url` in `package.json` (global data `repoUrl`); it's hidden if that's missing.
- Zero client-side JS on the public pages, except `src/assets/js/analytics.js` when `band.json` has `"analytics": true`: consent banner (`src/_includes/consent.njk`, texts `consent*` in `i18n.json`, choice in localStorage `bdtree-consent`), Firebase Analytics SDK (gstatic, same pinned version as admin) loaded only after Accept, measurement ID from `/__/firebase/init.json`. Mobile-first single column; the design tokens are at the top of `src/assets/css/style.css`. The stepped `clip-path` corners are the visual motif.
- Admin editor (`/admin/`, `src/admin/`): the only page with JS beyond the optional analytics, plain ES module with the Firebase SDK from gstatic (pinned) and config from Hosting's reserved `/__/firebase/init.json`, so nothing project-specific is in the code. On localhost it connects to the Auth (9099) and Functions (5001) emulators. Callables `getContent`/`saveContent` (`functions/`, europe-west1) check the Google email against the `ADMIN_EMAILS` param, then read/commit `band.json`, `gigs.json`, `i18n.json`, `bio/*.md` in `GITHUB_REPO` via the GitHub API (PAT in the `GITHUB_TOKEN` secret). One atomic commit per save (Git Data API, non-forced ref update); a stale `baseSha` → `failed-precondition`. `functions/validate.js` validates and re-serializes in the hand-written format (gigs one per line), so unchanged files aren't committed. band.json: only genre, tagline, email, links are editable; i18n: values only, keys fixed by the current file.

## Conventions

- Pin dependency versions exactly. Avoid adding dependencies: Eleventy already bundles markdown-it and the Render plugin. The only other one is `firebase-tools` (plus `firebase-functions`/`firebase-admin` in `functions/`), pinned so that a CLI release can't change deploy behaviour unnoticed.
- Check UI changes at ~400px and desktop width, and on both languages, with `content/` and with `CONTENT_DIR=example`.
