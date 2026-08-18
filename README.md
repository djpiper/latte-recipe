# Shot Log

A web app for recording latte experiments, shared by everyone who uses it. The frontend is still a single file with no build step and no dependencies; behind it sits a small Cloudflare Worker and a D1 database holding one shared log.

## Use it

It's live at **https://latte-recipe.dpipesster.workers.dev** — bookmark it, or add it to your phone's home screen.

Set a brewer name in the header on your first visit. Every shot you log is attributed to that name and goes into the shared log, so your shots follow you between devices and everyone sees the same list.

To run it locally you need Wrangler, since the log lives behind an API:

```sh
npx wrangler d1 execute latte-shots --local --file=./schema.sql   # once
npx wrangler dev                                                  # http://localhost:8787
```

Opening `public/index.html` straight from the filesystem no longer works — there's no API to talk to.

Every pull request gets its own preview deployment, linked in a comment on the PR. Note that previews share the production database, so shots logged from a preview URL land in the real log.

## What it records

Every shot: who brewed it, beans, roast, grind setting, grind time, dose, yield (ml), shot time, milk type, milk volume, frothing time, water, any number of add-ins, a 1–10 rating, and tasting notes.

**Hot** or **iced** is the first thing you pick, and the form follows:

| | Hot | Iced |
|---|---|---|
| Milk | temp (°F) + foam depth (mm) | prep: cold / frothed / cold foam |
| Espresso | — | over ice / chilled / poured on top |

Frothing time is on both, because it's the variable that changes most between milks — oat barista and whole milk don't want the same twelve seconds.

Milk type **none** is a straight espresso, and the milk fields disappear with it — volume, froth, temp, foam and prep have nothing to describe.

Dose in grams is optional — machines that grind by time have no scale in the loop, so grind time is the field you'll actually set. Leave dose blank and the log stays honest about what you measured.

Derived for you as you type: **flow rate** (ml/s), **milk:espresso** ratio, and — only when you've entered a weighed dose — **brew ratio** (yield ÷ dose).

## Water

**Add water** is a separate question from milk, and it starts at **no** — most drinks here don't have any. Switch it to **yes** and you get volume (ml) and temperature (°F), the two things that make an americano one drink or another: 150 ml at 198°F is not the same cup as 60 ml at 175°F. It's on hot and iced alike, since an iced americano's water temperature is as much a variable as a hot one's.

Temperature is optional even when there is water — pour from the kettle without measuring and the field can stay blank. Volume isn't, because it's the whole point of the dilution.

Water and milk are independent: a drink can have both, either, or neither. Turn water off and its fields disappear, and nothing they were holding is saved — a shot logged with **no** stores a zero volume and no temperature, however long the boxes sat there filled in.

## Add-ins

The ingredient list varies drink to drink, so it's a list, not a fixed set of fields. **+ add ingredient** gives you a row of name, amount, and unit (g, ml, tsp, tbsp, pinch, pod, drop, ea) — add as many as the drink had, remove the ones it didn't.

The name box suggests the usual suspects (vanilla bean, vanilla extract, vanilla paste, honey, maple syrup, salt, cinnamon, cocoa, brown sugar) and learns every other name you type, so your own regulars show up in the list from then on. Vanilla bean and vanilla extract are separate entries on purpose — a quarter pod and four drops are not the same drink.

Rows with a blank name are dropped on save, so an accidental empty row costs nothing.

## How it's meant to be used

Change one variable at a time. Hit **Again** on any past shot to copy its settings into the form — style, milk prep, and every add-in row come with it — with the notes cleared. The grind field is focused and selected, since that's usually the thing you're changing. Log the result, then compare.

Each row draws the drink to scale: dark bar is espresso, dim bar is water, light bar is milk, hatched bar is foam, and the total width is proportional to the largest drink you've logged. Water counts toward the total, so an americano reads as the long drink it is. Iced drinks are drawn in cool blue with an ice hatch through the milk, so hot and iced are distinguishable at a glance.

Filter the log with **All / Hot / Iced**, sort by **Best** to see what's working, or by **Ratio** to see whether your ratings track extraction. Bar widths stay on the same scale when you filter, so proportions remain comparable.

## The shared log

Shots live in a Cloudflare D1 database and are served by the Worker in `src/api.js`. Everyone using the app reads and writes the same log. The only thing kept in your browser is your brewer name, under `latte.brewer.v1`.

Shots logged before this — the ones under `latte.shots.v1` and `latte.shots.v2` — were never uploaded. Those keys are left untouched, so an older build still opens that data if you need it back.

Records are normalized to the v2 shape on the way in and out, so a pre-iced export still imports cleanly: every old shot becomes a hot latte with no add-ins and no water.

Adding water added three columns. A database created from `schema.sql` has them already; one that predates them needs:

```sh
npx wrangler d1 execute latte-shots --remote --command "\
  ALTER TABLE shots ADD COLUMN water     TEXT NOT NULL DEFAULT 'none'; \
  ALTER TABLE shots ADD COLUMN waterVol  REAL NOT NULL DEFAULT 0; \
  ALTER TABLE shots ADD COLUMN waterTemp REAL;"
```

which leaves every shot logged before it as a drink with no water.

- **Export JSON** — full backup of the whole shared log.
- **Export CSV** — for spreadsheets and charts; the whole log in the current sort order, with `brewer`, `style`, `grindTime`, `frothTime`, `milkPrep`, `espPrep`, `water`, `waterVol`, `waterTemp`, a flattened `addins` column (`vanilla bean 0.25pod; salt 1pinch`), and a `brew_ratio` computed for the shots that have a weighed dose.
- **Import JSON** — uploads shots from a file into the shared log under your name, skipping ids already present.
- **Refresh** — re-reads the log. It also refreshes on its own whenever you return to the tab.

Edit and Delete only appear on shots logged under your own name. That's a courtesy, not a security boundary: names are self-asserted, and the server can't tell one brewer from another. Don't put anything private in here.

There's no undo in the app. To wipe the log:

```sh
npx wrangler d1 execute latte-shots --remote --command "DELETE FROM shots"
```

D1's Time Travel can restore the database to a point in time if that goes wrong.

## The API

Same-origin JSON under `/api/`, all unauthenticated:

| | |
|---|---|
| `GET /api/shots` | the whole log, newest first |
| `POST /api/shots` | add a shot |
| `PUT /api/shots/:id` | replace a shot |
| `DELETE /api/shots/:id` | remove a shot |

Writes are whitelisted field by field, capped at 4 KB, rejected cross-origin, rate limited to 20 per minute per IP, and refused once the log passes 5,000 rows.

## Tests

A jsdom harness drives the real `public/index.html` against a running `wrangler dev`, with two simulated brewers on separate windows: hot and iced round-trips through the API, grinding by time with no weighed dose, add-in rows surviving the trip to the database and back, attribution and Edit/Delete gating, optimistic rollback on both failed and rejected saves, filtering with sorting, empty states, **Again**, escaping, and CSV columns. Water has its own pass over the same ground: fields hiding and showing, a wet and a dry shot round-tripping, the bar scaling to include the water, **Again** carrying it over, the CSV columns, and the API refusing an unknown water value, an out-of-range volume, and accepting a body from a client that predates the field.

It lives outside the repo in the scratchpad; to re-run it, start `npx wrangler dev`, then `npm i jsdom` somewhere and `node test.mjs`.
