# Shot Log

A single-file web app for recording latte experiments. No server, no build step, no dependencies.

## Use it

It's live at **https://latte-recipe.dpipesster.workers.dev** — bookmark it, or add it to your phone's home screen.

To run it locally instead, open `index.html` in a browser. On a Mac:

```sh
open index.html
```

You can also serve the folder over your local network with `python3 -m http.server`.

Every pull request gets its own preview deployment, linked in a comment on the PR.

## What it records

Every shot: beans, roast, grind setting, grind time, dose, yield (ml), shot time, milk type, milk volume, frothing time, any number of add-ins, a 1–10 rating, and tasting notes.

**Hot** or **iced** is the first thing you pick, and the form follows:

| | Hot | Iced |
|---|---|---|
| Milk | temp (°F) + foam depth (mm) | prep: cold / frothed / cold foam |
| Espresso | — | over ice / chilled / poured on top |

Frothing time is on both, because it's the variable that changes most between milks — oat barista and whole milk don't want the same twelve seconds.

Dose in grams is optional — machines that grind by time have no scale in the loop, so grind time is the field you'll actually set. Leave dose blank and the log stays honest about what you measured.

Derived for you as you type: **flow rate** (ml/s), **milk:espresso** ratio, and — only when you've entered a weighed dose — **brew ratio** (yield ÷ dose).

## Add-ins

The ingredient list varies drink to drink, so it's a list, not a fixed set of fields. **+ add ingredient** gives you a row of name, amount, and unit (g, ml, tsp, tbsp, pinch, pod, drop, ea) — add as many as the drink had, remove the ones it didn't.

The name box suggests the usual suspects (vanilla bean, vanilla extract, vanilla paste, honey, maple syrup, salt, cinnamon, cocoa, brown sugar) and learns every other name you type, so your own regulars show up in the list from then on. Vanilla bean and vanilla extract are separate entries on purpose — a quarter pod and four drops are not the same drink.

Rows with a blank name are dropped on save, so an accidental empty row costs nothing.

## How it's meant to be used

Change one variable at a time. Hit **Again** on any past shot to copy its settings into the form — style, milk prep, and every add-in row come with it — with the notes cleared. The grind field is focused and selected, since that's usually the thing you're changing. Log the result, then compare.

Each row draws the drink to scale: dark bar is espresso, light bar is milk, hatched bar is foam, and the total width is proportional to the largest drink you've logged. Iced drinks are drawn in cool blue with an ice hatch through the milk, so hot and iced are distinguishable at a glance.

Filter the log with **All / Hot / Iced**, sort by **Best** to see what's working, or by **Ratio** to see whether your ratings track extraction. Bar widths stay on the same scale when you filter, so proportions remain comparable.

## Your data

Shots live in your browser's `localStorage` under `latte.shots.v2` — they stay on this machine, in this browser profile.

Logs written before iced drinks existed lived under `latte.shots.v1`. They're migrated on first load — every old shot becomes a hot latte with no add-ins — and the `v1` key is left in place untouched, so the old app still opens the old data if you ever need it.

- **Export JSON** — full backup, re-importable.
- **Export CSV** — for spreadsheets and charts; the whole log in the current sort order, with `style`, `grindTime`, `frothTime`, `milkPrep`, `espPrep`, a flattened `addins` column (`vanilla bean 0.25pod; salt 1pinch`), and a `brew_ratio` computed for the shots that have a weighed dose.
- **Import JSON** — merges a backup in, skipping shots already present. Pre-iced exports are normalized on the way in.
- **Clear all** — downloads a backup file first, then empties the log.

Clearing your browser's site data for this page deletes the log, so export a backup now and then.

## Tests

The app's behavior is covered by a jsdom harness — 101 assertions over v1→v2 migration, hot and iced round-trips, grinding by time with no weighed dose, add-in rows (adding, removing, blank-row dropping, suggestions), filtering with sorting, empty states, **Again**, escaping, CSV columns, JSON import, and corrupt-storage recovery. It lives outside the repo in the scratchpad; to re-run it, `npm i jsdom` somewhere and `node test.mjs /path/to/index.html`.
