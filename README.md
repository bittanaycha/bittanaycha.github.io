# homepage

Tom's personal site. SvelteKit, fully prerendered, served as static files from GitHub Pages.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # prerenders the site into build/
npm run preview    # serve the production build locally
npm run check      # type + a11y diagnostics
```

## Where things live

| File | What it controls |
| --- | --- |
| `src/lib/site.ts` | Name, tagline, intro, email, GitHub handle, page title and description |
| `src/lib/projects.ts` | The project cards — title, description, link, tag, extra note |
| `src/lib/styles/app.css` | The whole design system: one stylesheet, colours as CSS custom properties |
| `src/routes/+page.svelte` | The homepage sections (hero, projects, about) |
| `src/routes/+layout.svelte` | Header, footer, meta tags |
| `static/` | `favicon.svg`, `robots.txt`, `404.html`, `.nojekyll` |

Colours are declared once with `light-dark()`, so each token covers both themes
instead of duplicating a dark block. The theme is set in `src/app.html` before
first paint (stored choice, else the OS preference), so there is no flash.

## Deploying to GitHub Pages

The workflow in `.github/workflows/deploy.yml` builds the site and publishes it on
every push to `main`. It works for both kinds of Pages site:

- **User site** — `https://<user>.github.io`. The repo must be named `<user>.github.io`.
  Leave `BASE_PATH` unset.
- **Project site** — `https://<user>.github.io/<repo>`. Set the `BASE_PATH` repo
  variable to `/<repo>` so asset and link URLs get the right prefix.

Setup, once per repo:

1. Create the repo and push.

   ```bash
   gh repo create <user>.github.io --public --source=. --remote=origin --push
   ```

2. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Project site only: **Settings → Secrets and variables → Actions → Variables →
   New repository variable**, name `BASE_PATH`, value `/<repo>`.
4. Push to `main`. The first workflow run publishes the site; the URL appears in the
   run summary and under Settings → Pages.

Local production check with a base path:

```bash
BASE_PATH=/homepage npm run build && BASE_PATH=/homepage npm run preview
```

## Notes

- SvelteKit 3 removed the `$lib` alias — internal imports use `#lib` (see `imports`
  in `package.json`). `$app/paths` now exports `asset()` and `resolve()` instead of
  a `base` string, so links are written as `resolve('/#projects')` and assets as
  `asset('/favicon.svg')`.
- No runtime dependencies, no server, no remote fonts or assets: the whole page is
  HTML, one CSS file and a little JS.
