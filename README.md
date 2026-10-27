# Twenny

"Check Twenny." Say a GPS fix (any format, digits or words) and see it on the map,
with distance and bearing from the nearest landmark and from you.

## Using it
- Open the GitHub Pages link on your phone, then Share → **Add to Home Screen**.
- Tap **Say or type a fix**. The keyboard opens: tap its mic and read the fix out
  ("32 34.5 north, 117 8.4 west", "thirty two thirty seven point two, one seventeen oh nine
  point one", "32 39 613 117 08 168"), or type it. Then tap **Done**.
- A whole fix near San Diego shows on the map as soon as it's in. Anything else gets a
  second look when you tap Done, which untangles the way dictation runs numbers together.
- Stopped after the latitude? Tap the button again and say the rest; it's added on.
- **Assume N & W** (on by default) treats a fix with no directions as north/west.
- Works offline except the map tiles. After a deploy you'll see
  "New version, tap to refresh".

## Fixing landmark positions
Edit `data/landmarks.js` (decimal degrees, west is negative) and push.
`npm test` checks every landmark is near San Diego.

## Development
The repo is the site: no build step. `npm test` runs the tests; to try it locally,
serve the repo root (`python3 -m http.server`) and open http://localhost:8000.
GitHub Pages serves `master` (Settings → Pages → Deploy from a branch → `master`, `/ (root)`),
so merging to master is deploying. Phones notice the change and offer the update.
If you add a file the page loads, list it in `ASSETS` in `sw.js` (the tests check).
