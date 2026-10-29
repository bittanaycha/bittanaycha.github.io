# homepage

A personal homepage and a marathon training page. SvelteKit, fully prerendered,
served as static files from GitHub Pages at <https://bittanaycha.github.io>.

There is deliberately no copy on the site: the only words are labels (`index`,
`running`, `google`, `wikipedia`, units) and the marathon plan's own data.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # prerenders into build/
npm run preview    # serve the production build
npm run check      # type + a11y diagnostics
```

## Where things live

| File | What it controls |
| --- | --- |
| `src/lib/styles/app.css` | The whole design system: kraft/ink tokens, type, grain, layout |
| `src/routes/+layout.svelte` | Running head (nav), page titles, icons |
| `src/routes/+page.svelte` | Homepage — the plate plus the two search fields |
| `src/routes/running/+page.svelte` | Marathon page — countdown, weekly bars, gates, table |
| `src/lib/plan.ts` | The 26-week plan: weeks, gates, totals, race. Generated — see below |
| `src/lib/format.ts` | Date helpers (all dates parsed at 12:00 local to dodge DST) |
| `src/lib/plate/` | The pebble plate engine: masks, inks, compositing, screen noise |
| `src/lib/dither/` | Ordered/blue-noise dither and the ink palettes |
| `static/photos/` | The seven photographs the plate is cut from |
| `static/fonts/` | Fraunces (variable) and Space Mono, self-hosted |

### The plate

`src/lib/plate/` is ported from [unwalled-garden](https://github.com/bittanaycha/unwalled-garden):
each photo is dithered and clipped to a hand-cut pebble mask, composited onto a
black plate, then the plate is dithered again with outlines and connectors drawn
on top. `+page.svelte` passes the polygons, photo list and link targets; the
component does the rest at the container's size, so the plate is resolution
independent.

If a photo changes, keep the same order in the `photos` array — the polygons and
the links are indexed to it.

### The plan

`src/lib/plan.ts` is generated from the Obsidian vault at
`~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Yggdrasil/Marathon/plan.json`.
Edit the plan in the vault, then regenerate:

```bash
node -e '
const fs = require("fs");
const plan = JSON.parse(fs.readFileSync(process.env.HOME + "/Library/Mobile Documents/iCloud~md~obsidian/Documents/Yggdrasil/Marathon/plan.json", "utf8"));
console.log(JSON.stringify({ weeks: plan.weeks.length, race: plan.race_date, start: plan.start_date }));
'
```

The counts on the page (training km, peak week) are derived from that data, so
they follow the vault automatically.

## Deploying

`.github/workflows/deploy.yml` builds on every push to `main` and publishes to
Pages through `actions/deploy-pages`.

- **User site** — this repo is `bittanaycha.github.io`, so `BASE_PATH` stays unset
  and the site lives at the root.
- **Project site** — set the repo variable `BASE_PATH` to `/<repo>`.

Note: creating a `<user>.github.io` repo makes GitHub provision Pages in *legacy*
(branch) mode. Set it to Actions mode once:

```bash
gh api -X PUT repos/bittanaycha/bittanaycha.github.io/pages -f build_type=workflow
```

## Notes

- SvelteKit 3 removed the `$lib` alias — internal imports use `#lib` (see
  `imports` in `package.json`). `$app/paths` now exports `asset()` and `resolve()`
  instead of a `base` string, so links are `resolve('/running')` and assets are
  `asset('/photos/…')`.
- `/` focuses the google field.
- No runtime dependencies, no server, no remote fonts or assets.
