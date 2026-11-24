# homepage

A personal homepage, a marathon training page, a language and season wheel and a
dithering studio. SvelteKit, fully prerendered, served as static files from GitHub
Pages at <https://bittanaycha.github.io>. The page is printed on a photograph of leaves,
with the day's almanac laid on it as separate blue cards; a pixel ship sails to
whichever card the pointer is over.

There is deliberately no copy on the site: the only words are labels (`index`,
`dither`, `running`, `seasons`, `google`, `wikipedia`, units) and the data the
vault already holds.

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
| `src/lib/styles/app.css` | The whole design system: paper, card, ink and accent tokens, type, grid, wake |
| `static/background.png` | The leaf photograph: the paper the whole page is printed on |
| `static/strips/` | The dithered coast and forest strips in the almanac |
| `static/dithers/` | The sun and moon plates: `sun.webp` behind the sun tag, `moon.webp` in the moon island |
| `static/animals/` | The five engraved plates (deer, falcon, hare, horse, swift) |
| `src/routes/+layout.svelte` | The sea layer, the deck, the nav, page titles, icons, the ship |
| `src/lib/components/Ship.svelte` | The pixel sailboat: docking, tacking, wake |
| `src/routes/+page.svelte` | Homepage — three search fields, the almanac, the outer links |
| `src/routes/dither/+page.svelte` | Dither — the dithering studio (load, tune, save) |
| `src/routes/running/+page.svelte` | Marathon page — today's session, plan/log/pace tabs, gates, table, vault links |
| `src/routes/seasons/+page.svelte` | Blocks as bars: running, music, languages and study, and the language roles |
| `src/lib/seasons.ts` | The blocks, the languages and the anchors, from `Seasons/plan.json`. Generated — see below |
| `src/lib/plan.ts` | The 26-week plan: weeks, gates, totals, race. Edited by hand |
| `src/lib/days.ts` | One row per plan day, from the week notes. Generated — see below |
| `src/lib/log.ts` | Every run in the training log. Generated — see below |
| `src/lib/sun.ts` | NOAA sunrise/sunset and the moon phase behind the almanac |
| `src/lib/pace.ts` | VDOT, threshold pace and rep ranges |
| `scripts/sync-vault.mjs` | Reads the vault and writes `days.ts`, `log.ts` and `seasons.ts` |
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

The third field posts to
`https://chat.deepseek.com/?q=…&autosend=1&source=landing`, the URL DeepSeek's own
landing page uses when it hands a prompt over. DeepSeek reads `q`, stashes it in
`sessionStorage` and drops it into the chat box once signed in; `autosend=1` makes
the chat app send it as soon as it lands, so there is no second Enter to press.
There is no submit endpoint to post to.

The field is a textarea that grows to its content (up to `42dvh`, then it
scrolls), because prompts run to several lines. Enter sends, Shift+Enter starts a
new line. `grow()` measures again after `document.fonts.ready`, since the
fallback face and Geist Mono do not share metrics and the empty field would
otherwise be a line short.

### YouTube

The YouTube button opens `youtube.com`. Channels on one Google account cannot be
linked individually: YouTube's switcher is client-side, and the only URL that
selects a brand channel carries a per-channel `pageid` that is not exposed
anywhere public. Switch channels from the avatar menu.

### The vault

The marathon plan and the training log live in the Obsidian vault at
`~/Vaults/Yggdrasil/Marathon/`. The vault used to sit in iCloud Drive; Obsidian on
Android cannot read that, so it is synced with Syncthing instead and lives outside
any cloud folder. `YGDRASIL_VAULT` overrides the location.

`src/lib/plan.ts` is copied across from `plan.json` by hand. The day-by-day table
and the run log are generated from the vault:

```bash
npm run sync
```

That reads `plan.json`, the day table in each `Weeks/Week NN.md`, and
`Training Log.md`, then writes `src/lib/days.ts` and `src/lib/log.ts`. It also
reads `Seasons/plan.json` and writes `src/lib/seasons.ts`. Set `YGDRASIL_VAULT`
to read a different vault. The script exits non-zero on a weekday that does not
match its date, a plan week with no note, a run dated outside the plan weeks, a
season whose role names an unknown language, more than one active language or
more than two anchors, or two seasons that overlap, so a broken table fails
instead of quietly dropping rows.

The training log is the source of truth: week 3 planned 28.0 km and logged 4.3 km,
and the bars, the table and the totals all take the logged number from
`Training Log.md`.

The `/running` footer opens `plan.json`, the current week's note, the log and the
gate weeks through `obsidian://` links, so the page is a way into the vault rather
than a copy of it.

### The seasons

`~/Vaults/Yggdrasil/Seasons/` holds the plan: `plan.json` (blocks, languages,
anchors), `Seasons Index.md` (the rules), `Next.md` (the parking lot) and
`Reviews.md` (the Sunday log).

A **block** is a title, a start date and a number of weeks. Blocks of different
kinds run at the same time — running, music, one language, one study subject —
and two blocks of the same kind may not overlap. Only one language is ever
active; the rest are anchors (a fixed small dose) or dormant. The end date is
never stored: `to` is `from + weeks * 7 - 1`, so a block is one number to change.

The four seasons are only the backdrop on the strip, named Spring, Summer, Autumn
and Winter. Their boundaries are the astronomical instants for `Europe/Paris`,
not the calendar date in general: 21 Dec 2026 at 21:20 local, 20 Mar 2027 at
21:32, and so on.

`/seasons` sets the Nothing 5x7 dot font (`static/fonts/nothing-font-5x7.otf`,
from fontstruct.com, installed by hand). Its cmap covers ASCII printable only, so
every string on that page has to be ASCII: a hyphen where an en dash would read
better, `-` for a middot, no arrows. `dateRange()` from `#lib/format` returns an
en dash and must not be used there.
