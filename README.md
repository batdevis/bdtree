# Band link page

A link-in-bio page for bands, an open-source alternative to Linktree that you host yourself for free.
Built with [Eleventy](https://www.11ty.dev/) and deployed to Firebase Hosting.

- Italian at `/`, English at `/en/`, with a language switch on every page
- Link buttons (streaming, socials, downloads), one of them highlighted
- Upcoming gigs: past dates disappear automatically at build time
- Booking contact
- Bio page written in Markdown
- Downloadable tech rider and press kit
- Share previews (Open Graph) for Instagram, WhatsApp and similar apps; no client-side JavaScript; about 150 KB per page

Live example: [BrokenSlide](https://brokenslideband.web.app), the psych garage blues band this was built for.

## How it works

The code and the band content are kept apart:

```
.
├── src/          templates, CSS (the code)
├── example/      a fictional demo band, used when there is no content/
├── content/      YOUR band (gitignored, keep it in its own private repo)
└── scripts/      deploy + press kit helpers
```

The build reads content from `$CONTENT_DIR`, else `content/`, else `example/`.

## Make it yours

```sh
git clone <this-repo> my-band-page
cd my-band-page
npm install
cp -r example content      # start from the demo band
npm start                  # http://localhost:8080, live reload
```

Then edit `content/`:

| File | What |
| --- | --- |
| `band.json` | name, `siteUrl`, `firebaseProject`, genre, tagline, booking email, link buttons |
| `gigs.json` | live dates: `{ "date": "YYYY-MM-DD", "city", "venue", "url" }` (`url` is optional and opens in a new tab) |
| `i18n.json` | page texts in both languages |
| `bio/it.md`, `bio/en.md` | biography in Markdown: quotes (`>`), **bold**, lists, links |
| `img/` | `logo.svg` (inlined; use `fill="currentColor"` so it takes the text color), `favicon.svg`, `band.jpg/.webp` (home photo), `bio.jpg/.webp`, `og.jpg` (1200×630 share image) |
| `press/` | any files to link, e.g. the tech rider |
| `theme.css` | optional: override the colors (see the `:root` variables at the top of `src/assets/css/style.css`) |

Link buttons in `band.json` take `label` (`it`/`en`), plus `url` for external links or `page` for a page of this site (e.g. `/bio/`).
Optional flags: `featured: true` highlights the button, `newTab: true` opens it in a new tab.
The `id` picks the icon (`bandcamp`, `instagram`, `presskit`; anything else gets a document icon). Icons live in `src/_includes/icons.njk`.

To keep your content versioned without making it public, turn `content/` into its own private git repository:

```sh
cd content && git init && git add . && git commit -m "Band content"
```

### Press kit

Zip a folder of press material into `content/press/<BandName>-press-kit.zip`. JPEG photos are shrunk to 2400 px on the longest side:

```sh
KIT_DIR=/path/to/press/folder npm run presskit
```

## Deploy (Firebase Hosting, free Spark plan)

First time only:

```sh
npx firebase-tools login
npx firebase-tools projects:create <project-id>     # or create one in the Firebase console
```

Set `firebaseProject` to `<project-id>` and `siteUrl` to `https://<project-id>.web.app` (or your custom domain) in `content/band.json`. Then, each time:

```sh
npm run deploy
```

Gigs are filtered when the site is built, so redeploy after a show to remove it from the list.
To add a custom domain: Firebase console → Hosting → Add custom domain.

## License

The code and the `example/` demo band are licensed under [MIT](LICENSE).
Your own `content/` stays yours: it isn't part of this repository.
