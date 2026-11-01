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
| `src/routes/+page.svelte` | Homepage — two search fields, a YouTube button, a link to the plate |
| `src/routes/plate/+page.svelte` | Plate — the dithering studio (load, tune, save) |
| `src/routes/running/+page.svelte` | Marathon page — countdown, weekly bars, gates, table |
| `src/lib/plan.ts` | The 26-week plan: weeks, gates, totals, race. Generated — see below |
| `src/lib/format.ts` | Date helpers (all dates parsed at 12:00 local to dodge DST) |
| `src/lib/plate/` | The plate engine: masks, inks, samples, worker, compositing |
| `src/lib/dither/` | Ordered/blue-noise dither and the ink palettes |
| `src/lib/components/` | `Slider`, `Segmented`, `InkStack` — the studio's controls |
| `src/lib/decode.ts` | File/paste decoding for dropped images |
| `static/fonts/` | Fraunces (variable) and Space Mono, self-hosted |

### The plate

`/plate` is the dithering studio ported from
[unwalled-garden](https://github.com/bittanaycha/unwalled-garden): a photograph or
a drawing is cover-fitted, tone-mapped, then dithered through the chosen screen
and printed in the ink ramp. Marks are sewn on in a worker thread, so dragging a
slider only costs a 620px draft; the full 1400px print lands once the hand stops.

The engine (`src/lib/plate/`, `src/lib/dither/`) is unchanged from the garden; the
page and the three controls were rewritten in this repo's own CSS, since the
homepage has no Tailwind. Drop or paste an image, or start from the generated
stones.

### YouTube

The YouTube button opens `youtube.com`. Channels on one Google account cannot be
linked individually: YouTube's switcher is client-side, and the only URL that
selects a brand channel carries a per-channel `pageid` that is not exposed
anywhere public. Switch channels from the avatar menu.

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
