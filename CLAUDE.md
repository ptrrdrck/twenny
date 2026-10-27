# Twenny

Phone PWA for San Diego ocean lifeguards: say or type a GPS fix in any format,
see it on a map with the nearest landmark. Plain HTML/CSS/ES modules, no framework,
no build step, no npm dependencies. The repo root is the site.

## Read first
- **STYLE.md** is the design system (Nado Waves family). Use its fonts, tokens and
  components as written. All tokens live in `css/theme.css`; `css/app.css` only uses them.
  `--pin` is for the fix pin and the entry button while it says Done only.
- **Parser tests**: `test/parser.test.js`. The `CASES` table is the known-good list from
  the prototype. Any change to `js/twenny-core.js` must keep `npm test` green; add a case
  for every new way of saying a fix.

## Layout
- `js/twenny-core.js`: parser + geo helpers (behavior is locked by tests)
- `js/fix.js`: pure display logic (landmark line, far warning, formats, links); tested
- `js/app.js` (UI wiring), `map.js` (Leaflet), `pwa.js` (update prompt)
- `js/reread.js`: the second look at a transcript that didn't parse (speech-to-text slips); tested
- `data/landmarks.js`: landmark positions, approximate; the user edits these by hand
- `sw.js`: service worker. Precaches ASSETS; detects new versions by re-downloading
  and comparing files, then waits for the "tap to refresh" prompt
- `vendor/leaflet`, `fonts/`: self-hosted so the app works offline

## Commands
- `npm test`: all tests (node --test)
- To try it locally, serve the repo root over http (e.g. `python3 -m http.server`)

## Rules
- A new file the page loads must be added to `ASSETS` in `sw.js`;
  `test/offline.test.js` fails if it's missing.
- Never `skipWaiting()` on install: new versions wait for the "tap to refresh" prompt.
- Voice is the phone keyboard's dictation mic, the same on every phone: the big button opens
  the Heard box with the keyboard up, and Twenny reads whatever text arrives. Don't bring back
  the browser's Web Speech API (it went deaf on iPhones, Oct 2026), and don't tailor behavior
  to particular devices or browsers: the app works the same everywhere.
- Deploys: classic GitHub Pages, "Deploy from a branch", `master` / root. Whatever is on
  master is live at https://ptrrdrck.github.io/twenny/. No build or deploy workflow
  (`.github/workflows/test.yml` only runs tests). The user works on master with regular
  PRs and merges; keep it that way.
- Pull requests: never add Claude/AI credit lines (no "Generated with Claude Code",
  no session links) to PR titles or descriptions.
