# Shot Log

A single-file web app for recording latte experiments. No server, no build step, no dependencies.

## Use it

Open `index.html` in a browser. On a Mac:

```sh
open index.html
```

Bookmark it, or add it to your phone's home screen if you serve the folder over your local network (`python3 -m http.server`).

## What it records

Per shot: beans, roast, grind setting, dose, yield, shot time, milk type, milk volume, milk temp, foam depth, a 1–10 rating, and tasting notes.

Derived for you as you type: **brew ratio** (yield ÷ dose), **flow rate** (g/s), and **milk:espresso** ratio.

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
