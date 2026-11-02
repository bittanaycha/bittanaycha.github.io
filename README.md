# homepage

A personal homepage, a marathon training page and a dithering studio. SvelteKit,
fully prerendered, served as static files from GitHub Pages at
<https://bittanaycha.github.io>. The homepage is a dark sea with the day's
almanac floating on it as separate islands; a pixel ship sails to whichever
island the pointer is over.

There is deliberately no copy on the site: the only words are labels (`index`,
`dither`, `running`, `google`, `wikipedia`, units) and the marathon plan's own data.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # prerenders into build/
npm run preview    # serve the production build
npm run check      # type + a11y diagnostics
npm run sync       # regenerate the day table and run log from the vault
```

## Where things live

| File | What it controls |
| --- | --- |
| `src/lib/styles/app.css` | The whole design system: sea, island, ink and ultramarine tokens, type, grid, wake |
| `static/background.webp` | The leaf photograph, held down to a dark ground behind the islands |
| `static/strips/` | The dithered coast and forest strips in the almanac |
| `static/animals/` | The five engraved plates (deer, falcon, hare, horse, swift) |
| `src/routes/+layout.svelte` | The sea layer, the deck, the nav, page titles, icons, the ship |
| `src/lib/components/Ship.svelte` | The pixel sailboat: docking, tacking, wake |
| `src/routes/+page.svelte` | Homepage — three search fields, the almanac, the outer links |
| `src/routes/dither/+page.svelte` | Dither — the dithering studio (load, tune, save) |
| `src/routes/running/+page.svelte` | Marathon page — today's session, plan/log/pace tabs, gates, table, vault links |
| `src/lib/plan.ts` | The 26-week plan: weeks, gates, totals, race. Edited by hand |
| `src/lib/days.ts` | One row per plan day, from the week notes. Generated — see below |
| `src/lib/log.ts` | Every run in the training log. Generated — see below |
| `src/lib/sun.ts` | NOAA sunrise/sunset and the moon phase behind the almanac |
| `src/lib/pace.ts` | VDOT, threshold pace and rep ranges |
| `scripts/sync-vault.mjs` | Reads the vault and writes `days.ts` and `log.ts` |
| `src/lib/format.ts` | Date helpers (all dates parsed at 12:00 local to dodge DST) |
| `src/lib/studio/` | The dither engine: masks, inks, samples, worker, compositing |
| `src/lib/dither/` | Ordered/blue-noise dither and the ink palettes |
| `src/lib/components/` | `Slider`, `Segmented`, `InkStack` (studio controls), `AlmanacIcon` (sun and moon), `Ship` |
| `src/lib/decode.ts` | File/paste decoding for dropped images |
| `static/fonts/` | Geist Mono (variable 100–900), self-hosted |

### The dither studio

`/dither` is the dithering studio ported from
[unwalled-garden](https://github.com/bittanaycha/unwalled-garden): a photograph or
a drawing is cover-fitted, tone-mapped, then dithered through the chosen screen
and printed in the ink ramp. Marks are sewn on in a worker thread, so dragging a
slider only costs a 620px draft; the full 1400px print lands once the hand stops.

The engine (`src/lib/studio/`, `src/lib/dither/`) is unchanged from the garden; the
page and the three controls were rewritten in this repo's own CSS, since the
homepage has no Tailwind. Drop or paste an image, or start from the generated
stones.

### DeepSeek

The third field posts to `https://chat.deepseek.com/?q=…`. DeepSeek reads `q` (or
`prompt`) from the URL, stashes it in `sessionStorage` and drops it into the chat
box once signed in, so the field hands the prompt over and opens the chat in a new
tab. There is no submit endpoint to post to.

The field is a textarea that grows to its content (up to `42dvh`, then it
scrolls), because prompts run to several lines. Enter submits, Shift+Enter starts
a new line. `grow()` measures again after `document.fonts.ready`, since the
fallback face and Geist Mono do not share metrics and the empty field would
otherwise be a line short.

### YouTube

The YouTube button opens `youtube.com`. Channels on one Google account cannot be
linked individually: YouTube's switcher is client-side, and the only URL that
selects a brand channel carries a per-channel `pageid` that is not exposed
anywhere public. Switch channels from the avatar menu.

### The vault

The marathon plan and the training log live in the Obsidian vault at
`~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Yggdrasil/Marathon/`.

`src/lib/plan.ts` is copied across from `plan.json` by hand. The day-by-day table
and the run log are generated from the vault:

```bash
npm run sync
```

That reads `plan.json`, the day table in each `Weeks/Week NN.md`, and
`Training Log.md`, then writes `src/lib/days.ts` and `src/lib/log.ts`. Set
`YGDRASIL_VAULT` to read a different vault. The script exits non-zero on a
weekday that does not match its date, a plan week with no note, or a run dated
outside the plan weeks, so a broken table fails instead of quietly dropping rows.

The training log is the source of truth: week 3 planned 28.0 km and logged 4.3 km,
and the bars, the table and the totals all take the logged number from
`Training Log.md`.

The `/running` footer opens `plan.json`, the current week's note, the log and the
gate weeks through `obsidian://` links, so the page is a way into the vault rather
than a copy of it.

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
- The sea is `#04060d`; the photograph in `static/background.webp` is painted on
  it behind the islands, filtered down to a dark ground, and the chart dots and
  ultramarine wash sit on top. Ink is `#f1f4ff`, the interactive colour
  `#3452ff`.
- Islands are the only surfaces: `#0a1020` with a 1px rule, registration ticks
  just outside each corner, and an ultramarine glow on hover.
- The deck is full width with an asymmetric gutter (narrow left, wide right), so
  the composition leans and the sea stays open on the right. Both pages place
  every island on a 12-column chart with explicit column and row numbers rather
  than stacking them.
- `Ship.svelte` docks at the top-right of whichever island the pointer is over,
  gliding in 900 ms, then tacks a few pixels against the current while it is
  moored and drops fading pixels of wake behind it. `prefers-reduced-motion`
  drops the glide, the tack and the bob.
- The sun and moon are inline SVG (`AlmanacIcon.svelte`): a halftone dot pattern
  fills the disc and the crescent, so they read as printed woodcuts rather than
  icons. The moon sits in its own island below the two place strips.
- Each place is an island whose background is its dithered photograph: the name
  sits top-left, rise/set/day bottom-right.
- The moon island reads the next full and new moon from Meeus's syzygy series
  (`sun.ts`), and names the full moon: harvest for the one nearest the autumn
  equinox, hunter's for the one after it, otherwise the month's farm name.
- The engraved plates from the vault lie in the page margins, fixed to the
  viewport: deer and swift on the index, hare on running, horse on dither. They
  are hidden under 62rem, where there is no margin to spare.
- The almanac and today's session are computed in the browser (`onMount`), not at
  build time: a prerendered page would freeze the day it was built.
- No runtime dependencies, no server, no remote fonts or assets.
