# Twenny

Phone PWA for San Diego ocean lifeguards: say or type a GPS fix in any format,
see it on a map with the nearest landmark. Plain HTML/CSS/ES modules, no framework,
no build step for development, no npm dependencies.

## Read first
- **STYLE.md** is the design system (Nado Waves family). Use its fonts, tokens and
  components as written. All tokens live in `css/theme.css`; `css/app.css` only uses them.
  `--pin` is for the fix pin and the listening talk button only.
- **Parser tests**: `test/parser.test.js`. The `CASES` table is the known-good list from
  the prototype. Any change to `js/twenny-core.js` must keep `npm test` green; add a case
  for every new way of saying a fix.

## Layout
- `js/twenny-core.js`: parser + geo helpers (behavior is locked by tests)
- `js/fix.js`: pure display logic (landmark line, far warning, formats, links); tested
- `js/app.js` (UI wiring), `map.js` (Leaflet), `speech.js`, `pwa.js` (update prompt)
- `data/landmarks.js`: landmark positions, approximate; the user edits these by hand
- `sw.js`: service worker. `scripts/build.mjs` stamps VERSION + ASSETS into `_site/`
- `vendor/leaflet`, `fonts/`: self-hosted so the app works offline

## Commands
- `npm test`: all tests (node --test)
- `node scripts/build.mjs`: build `_site/`; serve it to test the service worker
  (unbuilt `sw.js` runs in network-first "dev" mode)

## Rules
- A new runtime file or folder must be added to `SITE` in `scripts/build.mjs`;
  `test/build.test.js` fails if the page loads something that isn't precached.
- Never `skipWaiting()` on install: new versions wait for the "tap to refresh" prompt.
- Deploys: `.github/workflows/pages.yml` on push to master.
- Pull requests: never add Claude/AI credit lines (no "Generated with Claude Code",
  no session links) to PR titles or descriptions.
