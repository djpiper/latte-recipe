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

Per shot: beans, roast, grind setting, grind time, dose, yield (ml), shot time, milk type, milk volume, milk temp, foam depth, a 1–10 rating, and tasting notes.

Dose in grams is optional — machines that grind by time have no scale in the loop, so grind time is the field you'll actually set. Leave dose blank and the log stays honest about what you measured.

Derived for you as you type: **flow rate** (ml/s), **milk:espresso** ratio, and — only when you've entered a weighed dose — **brew ratio** (yield ÷ dose).

## How it's meant to be used

Change one variable at a time. Hit **Again** on any past shot to copy its settings into the form with the notes cleared — the grind field is focused and selected, since that's usually the thing you're changing. Log the result, then compare.

Each row draws the drink to scale: dark bar is espresso, light bar is steamed milk, hatched bar is foam, and the total width is proportional to the largest drink you've logged. Scanning the log shows you at a glance which proportions you've been rating highly.

Sort by **Best** to see what's working, or by **Ratio** to see whether your ratings track extraction.

## Your data

Shots live in your browser's `localStorage` under `latte.shots.v1` — they stay on this machine, in this browser profile.

- **Export JSON** — full backup, re-importable.
- **Export CSV** — for spreadsheets and charts; includes a computed `brew_ratio` column.
- **Import JSON** — merges a backup in, skipping shots already present.
- **Clear all** — downloads a backup file first, then empties the log.

Clearing your browser's site data for this page deletes the log, so export a backup now and then.

## Tests

The app's behavior is covered by a jsdom harness (form math, persistence, sorting, edit/delete, escaping, corrupt-storage recovery). It lives outside the repo in the scratchpad; to re-run it, `npm i jsdom` somewhere and point `test.mjs` at `index.html`.
