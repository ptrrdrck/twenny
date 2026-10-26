# Twenny

"Check Twenny." Say a GPS fix (any format, digits or words) and see it on the map,
with distance and bearing from the nearest landmark and from you.

## Using it
- Open the GitHub Pages link on your phone, then Share → **Add to Home Screen**.
- Tap **Tap and talk** and read the fix out: "32 34.5 north, 117 8.4 west",
  "thirty two thirty seven point two, one seventeen oh nine point one", "32.6795, -117.184".
- If you stop after the latitude, tap again and say the longitude; it carries on.
- No voice (some home-screen apps)? Tap the box and use the keyboard's mic.
- **Assume N & W** (on by default) treats a fix with no directions as north/west.
- Works offline except the map tiles. After a deploy you'll see
  "New version, tap to refresh".

## Fixing landmark positions
Edit `data/landmarks.js` (decimal degrees, west is negative) and push.
`npm test` checks every landmark is near San Diego.

## Development
`npm test` runs the tests. `node scripts/build.mjs` builds `_site/`.
Pushes to `master` deploy via GitHub Actions; in repo Settings → Pages set the
source to **GitHub Actions** once.
