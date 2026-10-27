// fix.js: the words and links Twenny shows for a parsed fix.
// Pure functions (no DOM), tested in test/fix.test.js.

import {LANDMARKS, distNm, bearing, compass, fmtDist, nearestLandmarks, toDDM, toDMS} from './twenny-core.js';

// Further than this from every landmark and the fix is probably a misheard
// direction or digit, not a real call on this stretch of coast.
export const FAR_NM = 20;

// "640 yd WSW of Imperial Beach Pier"
export function relTo(from, fix, name) {
  const d = fmtDist(distNm(from, fix));
  if (d === '0 yd') return 'At ' + name;
  return d + ' ' + compass(bearing(from, fix)) + ' of ' + name;
}

export function nearest(fix, list = LANDMARKS) {
  const l = nearestLandmarks(fix, list)[0];
  return l ? {...l, line: relTo(l, fix, l.name)} : null;
}

export const fromYou = (me, fix) => relTo(me, fix, 'you');

// null when the fix is plausibly local, otherwise a warning that says which
// direction to double-check when flipping it would bring the fix home.
export function farWarning(fix, list = LANDMARKS) {
  const closest = p => Math.min(...list.map(l => distNm(l, p)));
  const nm = closest(fix);
  if (nm <= FAR_NM) return null;
  const miles = Math.round(nm).toLocaleString('en-US') + ' nm';
  const tries = [
    [{lat: -fix.lat, lon: fix.lon}, 'It came out south. Did they say north?'],
    [{lat: fix.lat, lon: -fix.lon}, 'It came out east. Did they say west?'],
    [{lat: -fix.lat, lon: -fix.lon}, 'It came out south and east. Did they say north and west?']
  ];
  const hit = tries.find(([p]) => closest(p) <= FAR_NM);
  return `${miles} from the nearest landmark. ` + (hit ? hit[1] : 'Check the numbers.');
}

export function formats(fix) {
  return {
    ddm: toDDM(fix.lat, true) + '  ' + toDDM(fix.lon, false),
    dms: toDMS(fix.lat, true) + '  ' + toDMS(fix.lon, false),
    dd: fix.lat.toFixed(5) + ', ' + fix.lon.toFixed(5)
  };
}

export function copyText(fix) {
  const f = formats(fix);
  return f.ddm.replace('  ', ' ') + ' (' + f.dd + ')';
}

export function mapLinks(fix) {
  const ll = fix.lat.toFixed(6) + ',' + fix.lon.toFixed(6);
  return {
    apple: 'https://maps.apple.com/?ll=' + ll + '&q=' + encodeURIComponent('Twenny fix'),
    google: 'https://www.google.com/maps/search/?api=1&query=' + ll
  };
}

// Newest first, no back-to-back duplicates, capped.
export function addRecent(list, entry, max = 25) {
  const key = e => e.lat.toFixed(5) + ',' + e.lon.toFixed(5);
  if (list[0] && key(list[0]) === key(entry)) return [entry, ...list.slice(1)];
  return [entry, ...list].slice(0, max);
}
