# homepage

A personal homepage, a marathon training page, a year of blocks and a dithering
studio. SvelteKit on Cloudflare Workers, at <https://bittanaycha.github.io>: every
route except the season plan is prerendered, and the plan is read from D1 per
request. The page is printed on a photograph of leaves,
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
npm run pull       # copy the plan out of the database into the vault
npm run push       # send a vault edit back to the database
```

`npm run dev` needs the D1 binding, which `vite dev` emulates from
`wrangler.jsonc`; copy `.dev.vars.example` to `.dev.vars` and put the same
passphrase there. Migrations run against the local database with
`npx wrangler d1 migrations apply seasons --local`.

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
| `src/routes/seasons/+page.svelte` | The ring, the bars, the language roles |
| `src/routes/seasons/edit/+page.svelte` | The editor: pick the dates on the ring, set the lengths, save to the database |
| `src/lib/components/Ring.svelte` | The year as a circle: seasons on the rim, blocks as concentric arcs, today as a hand |
| `src/lib/calendar.ts` | Quarter days from the sun's longitude, the Celtic and meteorological dates, sekki and kō |
| `src/lib/sekki.ts` | The 24 sekki and the 72 kō: names, romaji, glosses and solar longitudes |
| `src/lib/plan-rules.ts` | What a valid plan is: kinds, slots, one language per slot at a time |
| `src/lib/server/` | Drizzle schema, D1 reads and writes, the passphrase session |
| `scripts/plan-sync.mjs` | `npm run pull` and `npm run push`: the plan between the vault and the database |
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
`Training Log.md`, then writes `src/lib/days.ts` and `src/lib/log.ts`. Set `YGDRASIL_VAULT`
to read a different vault. The script exits non-zero on a weekday that does not
match its date, a plan week with no note, or a run dated outside the plan weeks,
so a broken table fails instead of quietly dropping rows.

The training log is the source of truth: week 3 planned 28.0 km and logged 4.3 km,
and the bars, the table and the totals all take the logged number from
`Training Log.md`.

The `/running` footer opens `plan.json`, the current week's note, the log and the
gate weeks through `obsidian://` links, so the page is a way into the vault rather
than a copy of it.

### The seasons

`~/Vaults/Yggdrasil/Seasons/` holds the plan: `plan.json` (a mirror of the
database), `Seasons Index.md` (the rules), `Next.md` (the parking lot) and
`Reviews.md` (the Sunday log).

Two shapes, because the year holds two kinds of thing. The six languages are a
fixed set with three slots — one primary, one secondary, one tertiary — and what
changes is which language holds which slot, over dates. Everything else
(running, music, study) is a season: a kind, a glyph, a name, two dates. Every
language and every season carries a short glyph. A season's emoji is flattened to
a silhouette so it takes the theme's ink; a language's glyph is a letter from
that language (中, Ñ, Ç, È, あ, Ŵ) and keeps its own colour, so a flag would too.

The **database owns the plan**. `/seasons` reads it per request, `/seasons/edit`
writes it, and `plan.json` follows along. Cloudflare D1 holds four tables:
`languages`, `assignments`, `blocks` and `meta`. The browser proves it may write with
a cookie signed by `PLAN_SECRET` after `POST /api/login` matches
`PLAN_PASSPHRASE`; a script proves it with an `x-plan-key` header instead.

```bash
npm run pull   # database -> Seasons/plan.json
npm run push   # Seasons/plan.json -> database
```

Both directions keep a receipt in `Seasons/.plan-sync.json`: the hash of the file
as it was pulled and the `updated` stamp the database had. If the file changed
*and* the database changed since that receipt, `push` refuses and asks for a pull
first, because choosing a winner silently would lose an edit.

`PLAN_URL` and `PLAN_PASSPHRASE` come from `.env` (see `.env.example`); the passphrase
must match the Worker's secret.

### The ring and the dates

The ring is one turn of the year, never more, and puts the winter solstice at
its leftmost point. The year runs clockwise from 9 o'clock: spring at the top,
summer at the right, autumn at the bottom. A bar that runs past the window is
clipped at the rim, not carried round into the wrong year. Everything on the
wheel — season bands, blocks, kō ticks, today's hand — is placed by that same
mapping. The strip stacks seasons above languages under dotted rules, and the
ring opens a wider gap at the same boundary; every bar is the one ink colour, so
the groups, not the colours, say which is which.

`src/lib/calendar.ts` computes the quarter days from the sun's apparent
longitude (Meeus, low precision — the instants land within a minute or so of the
published ones) and converts them to local dates in `Europe/Paris`. The four
season bands therefore start on the real equinox and solstice instants, not on 1
March or 21 December.

Four calendars are available when picking a date:

- **astronomical** — equinoxes and solstices
- **meteorological** — 1 March, 1 June, 1 September, 1 December
- **Celtic** — Samhain, Imbolc, Beltane, Lughnasadh on the folk dates 1 Nov, 1 Feb,
  1 May, 1 Aug, plus the four quarter days
- **sekki and kō** — the 24 Japanese solar terms and the 72 micro-seasons, from
  315° in 15° and 5° steps

Sekki names in `src/lib/sekki.ts` follow the 略本暦 calendar (Japanese Wikipedia,
Nippon.com glosses, NAOJ 暦Wiki), which is what `src/lib/calendar.ts` computes.

`/seasons` sets the Nothing 5x7 dot font (`static/fonts/nothing-font-5x7.otf`,
from fontstruct.com, installed by hand). Its cmap covers ASCII printable only, so
every string on that page has to be ASCII: a hyphen where an en dash would read
better, `-` for a middot, no arrows. `dateRange()` from `#lib/format` returns an
en dash and must not be used there.

### Deploying

Live at <https://bittanaycha.bittanaycha.workers.dev>; the database is `seasons` in
D1, id `bc4254b5-6fdd-4606-8873-ec917a803c35`.

`/seasons` reads D1 on every request, so the site runs as a Worker with the
prerendered build as static assets: `@sveltejs/adapter-cloudflare` builds it and
`wrangler.jsonc` binds `ASSETS` and `DB`. Cloudflare calls this Workers with
static assets; the old Pages product cannot bind D1 to a static build the same
way, so the Worker is the target.

```bash
npx wrangler login          # once, in a terminal
scripts/deploy.sh           # creates D1, migrates, sets secrets, builds, deploys
```

The script generates `PLAN_PASSPHRASE` and `PLAN_SECRET` if you do not pass them,
prints the worker URL and writes nothing to disk beyond `wrangler.jsonc`'s
`database_id`. Then put `PLAN_URL` and `PLAN_PASSPHRASE` in `.env` and run
`npm run push` once to send the vault's plan up.

Two things to do by hand the first time:

- the custom domain, under Workers & Pages → the worker → Settings → Domains;
- retire the GitHub Pages workflow (`.github/workflows/deploy.yml`), because a
  push would otherwise publish a static build where `/seasons` and `/api` do not
  exist. Do it after the Worker answers, or `bittanaycha.github.io/seasons` 404s
  in the meantime and the nav link on the live site goes nowhere.

`PLAN_PASSPHRASE` is the password the editor asks for. To change it:
`wrangler secret put PLAN_PASSPHRASE`, then update `.env` and `npm run push` once
so the receipt matches the new database stamp.

Local runs need the binding too: `npm run dev` emulates D1 from `wrangler.jsonc`
and reads `.dev.vars`, which is `.dev.vars.example` copied and filled in.
Migrations against the local database run with
`npx wrangler d1 migrations apply seasons --local`.
