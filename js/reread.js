// reread.js: a second, harder look at everything that was heard, once the guard
// has stopped talking (or pressed Enter). The live reading is careful: when it
// can't split the numbers it says so. Here Twenny tries the slips speech-to-text
// makes when no direction is said between the two coordinates:
//   - one number written as two ("1 17" = 117)  "32 34.5 1 17 8.4"
//   - a decimal run into the next number        "32 34.5117 8.4"
//   - two whole numbers run together            "32 3911708" (39, 117 08)
//   - digits read one at a time                 "3 2 3 4.5 1 1 7 0 8.4"
//   - a fix said as digits, no "point"          "323961311708168", "32 39 613 117 08 168"
//                                               (Safari on an iPhone, for 32 39.613 117 08.168)
// along with a break between the coordinates where the live reading didn't
// put one, and keeps a reading only if it lands near San Diego. Fewest changes
// win; then readings that give both coordinates in the same format; then the
// one nearest a landmark. It's marked unsure when another reading is nearly as
// close. Tested in test/reread.test.js.

import {tokenize, parseTokens, numTok} from './twenny-core.js';
import {farWarning, nearest} from './fix.js';

const MAX_CHANGES = 2;
const UNSURE_NM = 3;   // a different reading within this much of the best one: unsure
const isNum = t => t.t === 'num';
const key = toks => toks.map(t => (isNum(t) ? t.raw : t.t + (t.v || ''))).join(' ');
const swap = (toks, i, n, ...put) => [...toks.slice(0, i), ...put, ...toks.slice(i + n)];

// One coordinate from a digit string with its points dropped: degrees (degLen
// digits), then 2 of minutes, maybe 2 of seconds, the rest decimals. Each form
// is a list of number strings: decimal degrees, degrees + decimal minutes, DMS.
function coordForms(d, degLen) {
  const deg = d.slice(0, degLen), rest = d.slice(degLen);
  if (deg.length < degLen || +deg > 180) return [];
  if (!rest) return [[deg]];
  const forms = [[deg + '.' + rest]];
  const min = rest.slice(0, 2), afterMin = rest.slice(2);
  if (min.length === 2 && +min < 60) {
    forms.push([deg, afterMin ? min + '.' + afterMin : min]);
    const sec = afterMin.slice(0, 2), afterSec = afterMin.slice(2);
    if (sec.length === 2 && +sec < 60) forms.push([deg, min, afterSec ? sec + '.' + afterSec : sec]);
  }
  return forms;
}

// Both coordinates from one digit string: latitude with 2-digit degrees, then
// longitude with 3 (San Diego's 117), split at every point in between.
function digitReadings(d) {
  const out = [];
  for (let p = 2; p <= d.length - 3; p++) {
    for (const lat of coordForms(d.slice(0, p), 2)) {
      for (const lon of coordForms(d.slice(p), 3)) out.push([...lat.map(numTok), {t: 'sep'}, ...lon.map(numTok)]);
    }
  }
  return out;
}

// Every reading one change away.
function changes(toks) {
  const out = [];
  toks.forEach((t, i) => {
    const next = toks[i + 1];
    if (isNum(t) && next && isNum(next)) {
      out.push(swap(toks, i + 1, 0, {t: 'sep'}));                           // a break here
      if (!t.dec) out.push(swap(toks, i, 2, numTok(t.raw + next.raw)));      // one number, not two
    }
    if (isNum(t) && t.dec) {                                                 // decimal ran on
      const [whole, frac] = t.raw.split('.');
      for (let j = 1; j < frac.length; j++) {
        out.push(swap(toks, i, 1, numTok(whole + '.' + frac.slice(0, j)), numTok(frac.slice(j))));
      }
    }
    if (isNum(t) && !t.dec && t.raw.length >= 7) {                          // points and spaces dropped
      for (const r of digitReadings(t.raw)) out.push(swap(toks, i, 1, ...r));
    }
    if (isNum(t) && t.v > 180) {                                             // whole numbers ran on
      const [whole, frac] = t.raw.split('.');
      for (let j = 1; j < whole.length; j++) {
        out.push(swap(toks, i, 1, numTok(whole.slice(0, j)), numTok(whole.slice(j) + (frac ? '.' + frac : ''))));
      }
    }
  });
  // A fix said as digits with no "point" can come back in any grouping
  // ("32 39 613 117 08 168"): join each run of whole numbers and read the digits.
  let from = 0;
  for (let i = 0; i <= toks.length; i++) {
    if (i < toks.length && isNum(toks[i]) && !toks[i].dec) continue;
    const run = toks.slice(from, i), digits = run.map(t => t.raw).join('');
    if (run.length >= 2 && digits.length >= 7) {
      for (const r of digitReadings(digits)) out.push(swap(toks, from, run.length, ...r));
    }
    from = i + 1;
  }
  // Single digits read one at a time: join each run (up to and including a
  // number with a decimal) and let the parser unpack it.
  const joined = [];
  let run = [];
  const flush = () => {
    if (run.length >= 3) joined.push(numTok(run.map(t => t.raw).join('')));
    else joined.push(...run);
    run = [];
  };
  for (const t of toks) {
    if (isNum(t) && (t.raw.length === 1 || (run.length && t.dec))) {
      run.push(t);
      if (t.dec) flush();
    } else { flush(); joined.push(t); }
  }
  flush();
  if (joined.length !== toks.length) out.push(joined);
  return out;
}

// {lat, lon, fmt, notes, changes, unsure} or null when nothing nearby fits.
export function reread(text, assumeNW = true) {
  const start = tokenize(text);
  if (!start.some(isNum)) return null;
  const seen = new Set([key(start)]);
  let frontier = [start];
  for (let n = 1; n <= MAX_CHANGES; n++) {
    const found = [], next = [];
    for (const toks of frontier) {
      for (const c of changes(toks)) {
        const k = key(c);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push(c);
        const r = parseTokens(c, assumeNW);
        if (r.state === 'ok' && !farWarning(r)) found.push({...r, d: nearest(r).d});
      }
    }
    if (found.length) {
      const mixed = r => r.fmt === 'Mixed formats';
      found.sort((a, b) => mixed(a) - mixed(b) || a.d - b.d);
      const best = found[0];
      const unsure = found.some(r => mixed(r) === mixed(best) && r.d < best.d + UNSURE_NM &&
        (Math.abs(r.lat - best.lat) > 1e-6 || Math.abs(r.lon - best.lon) > 1e-6));
      return {lat: best.lat, lon: best.lon, fmt: best.fmt, notes: best.notes, changes: n, unsure};
    }
    frontier = next;
  }
  return null;
}
