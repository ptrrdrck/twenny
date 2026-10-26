// twenny-core.js
// Coordinate parser and geo helpers carried over from the Fix Finder prototype.
// parseFix(text, assumeNW) turns spoken or typed coordinates in DD, DDM or DMS
// (digits or English number words) into {state:'ok', lat, lon, fmt, notes}.
// Other states: 'empty', 'partial' (only one coordinate heard), 'error' (with msg).
// Tests live in test/parser.test.js.

import {LANDMARKS} from '../data/landmarks.js';
export {LANDMARKS};

const UNIT = {zero:0,oh:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9};
const TEEN = {ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19};
const TENS = {twenty:20,thirty:30,forty:40,fourty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
const WORDMAP = {
  degrees:{t:'deg'}, degree:{t:'deg'}, deg:{t:'deg'}, degs:{t:'deg'}, d:{t:'deg'},
  minutes:{t:'min'}, minute:{t:'min'}, min:{t:'min'}, mins:{t:'min'}, m:{t:'min'},
  seconds:{t:'sec'}, second:{t:'sec'}, sec:{t:'sec'}, secs:{t:'sec'},
  north:{t:'hemi',v:'N'}, n:{t:'hemi',v:'N'}, south:{t:'hemi',v:'S'}, s:{t:'hemi',v:'S'},
  east:{t:'hemi',v:'E'}, e:{t:'hemi',v:'E'}, west:{t:'hemi',v:'W'}, w:{t:'hemi',v:'W'},
  lat:{t:'axis',v:'lat'}, latitude:{t:'axis',v:'lat'},
  lon:{t:'axis',v:'lon'}, long:{t:'axis',v:'lon'}, lng:{t:'axis',v:'lon'}, longitude:{t:'axis',v:'lon'},
  minus:{t:'minus'}, negative:{t:'minus'}, neg:{t:'minus'},
  comma:{t:'sep'}
};

function readNumber(ws, i) {
  let j = i, val = 0, got = false;
  const w = ws[j];
  if ((w === 'oh' || w === 'zero') && UNIT[ws[j + 1]] > 0) return {val: UNIT[ws[j + 1]], j: j + 2};
  let hundreds = false;
  if (UNIT[w] !== undefined && w !== 'oh' && ws[j + 1] === 'hundred') {
    val = UNIT[w] * 100; j += 2; got = true; hundreds = true;
    if (ws[j] === 'and') j++;
  }
  const x = ws[j];
  if (TEEN[x] !== undefined) { val += TEEN[x]; j++; got = true; }
  else if (TENS[x] !== undefined) { val += TENS[x]; j++; got = true; if (UNIT[ws[j]] > 0) { val += UNIT[ws[j]]; j++; } }
  else if (UNIT[x] !== undefined && x !== 'oh') {
    val += UNIT[x]; j++; got = true;
    // "one seventeen" = 117
    if (!hundreds && val === 1 && (TEEN[ws[j]] !== undefined || TENS[ws[j]] !== undefined)) {
      const r = readNumber(ws, j);
      if (r && r.val >= 10 && r.val < 100) { val = 100 + r.val; j = r.j; }
    }
  }
  return got ? {val, j} : null;
}

export function numTok(raw) { return {t: 'num', v: parseFloat(raw), raw, dec: raw.includes('.'), unit: null}; }

export function tokenize(input) {
  let s = ' ' + String(input).toLowerCase() + ' ';
  s = s.replace(/[−–—]/g, '-');
  s = s.replace(/''|’’|′′/g, ' sec ');
  s = s.replace(/[″"“”]/g, ' sec ');
  s = s.replace(/[′'’‘`´]/g, ' min ');
  s = s.replace(/[°º˚]/g, ' deg ');
  s = s.replace(/(^|[^\d])1:(\d{2})(?![\d:])/g, '$11$2');          // dictation writes "one seventeen" as "1:17"
  s = s.replace(/(\d)[:\/-](?=\d)/g, '$1 ');                        // 32-40-52, 32:40:52
  s = s.replace(/(\d)([a-z])/g, '$1 $2').replace(/([a-z])(\d)/g, '$1 $2');
  s = s.replace(/([a-z])-(?=[a-z])/g, '$1 ');
  s = s.replace(/[,;|]/g, ' , ');
  s = s.replace(/(^|\s)\.(\d)/g, '$1 0\u0001$2');
  s = s.replace(/(\d)\.(\d)/g, '$1\u0001$2');
  s = s.replace(/-\s+(?=\d)/g, ' -');
  s = s.replace(/[^a-z0-9\u0001\-, ]/g, ' ').replace(/\u0001/g, '.');
  const ws = s.split(/\s+/).filter(Boolean);
  const toks = [];
  for (let i = 0; i < ws.length;) {
    const w = ws[i];
    if (/^-?\d+(\.\d+)?$/.test(w)) {
      if (w[0] === '-') { toks.push({t: 'minus'}); toks.push(numTok(w.slice(1))); }
      else toks.push(numTok(w));
      i++; continue;
    }
    if (/^\d+(\.\d+){2,}$/.test(w)) { toks.push(...splitRunOn(w).map(numTok)); i++; continue; }
    if (w === '-') { toks.push({t: 'minus'}); i++; continue; }
    if (w === ',') { toks.push({t: 'sep'}); i++; continue; }
    if (w === 'point' || w === 'dot' || w === 'decimal') {
      let d = '', j = i + 1;
      while (j < ws.length) {
        const x = ws[j];
        if (UNIT[x] !== undefined) { d += UNIT[x]; j++; }
        else if (TEEN[x] !== undefined || TENS[x] !== undefined) { const r = readNumber(ws, j); d += String(r.val); j = r.j; }
        else if (/^\d+$/.test(x)) { d += x; j++; }
        else break;
      }
      if (d) {
        const prev = toks[toks.length - 1];
        if (prev && prev.t === 'num' && !prev.dec) { prev.raw = prev.raw + '.' + d; prev.v = parseFloat(prev.raw); prev.dec = true; }
        else toks.push(numTok('0.' + d));
      }
      i = j; continue;
    }
    const r = readNumber(ws, i);
    if (r) { toks.push(numTok(String(r.val))); i = r.j; continue; }
    if (WORDMAP[w]) toks.push(Object.assign({}, WORDMAP[w]));
    i++;
  }
  return toks;
}

function groupTokens(toks) {
  const firstHemi = toks.findIndex(t => t.t === 'hemi');
  const firstNum = toks.findIndex(t => t.t === 'num');
  const mode = firstHemi >= 0 && firstHemi < firstNum ? 'prefix' : 'suffix';
  const groups = [];
  let cur = {nums: [], hemi: null, axis: null, neg: false};
  const flush = () => {
    if (cur.nums.length || cur.hemi || cur.axis || cur.neg) groups.push(cur);
    cur = {nums: [], hemi: null, axis: null, neg: false};
  };
  for (const t of toks) {
    if (t.t === 'num') { cur.nums.push({v: t.v, dec: t.dec, unit: null}); continue; }
    if (t.t === 'deg' || t.t === 'min' || t.t === 'sec') {
      const last = cur.nums[cur.nums.length - 1];
      if (!last) continue;
      last.unit = t.t;
      if (t.t === 'deg' && cur.nums.length > 1) {  // a new "degrees" starts a new coordinate
        cur.nums.pop();
        flush();
        cur.nums.push(last);
      }
      continue;
    }
    if (t.t === 'hemi') {
      if (mode === 'prefix') { if (cur.nums.length || cur.hemi) flush(); cur.hemi = t.v; }
      else if (!cur.nums.length) cur.hemi = t.v;
      else { cur.hemi = t.v; flush(); }
      continue;
    }
    if (t.t === 'axis') { if (cur.nums.length || cur.axis) flush(); cur.axis = t.v; continue; }
    if (t.t === 'minus') { if (cur.nums.length) flush(); cur.neg = true; continue; }
    if (t.t === 'sep') { if (cur.nums.length) flush(); continue; }
  }
  flush();
  return {groups: groups.filter(g => g.nums.length), mode};
}

function compVal(nums) {
  if (!nums.length) return {ok: false, err: 'No numbers'};
  if (nums.length > 3) return {ok: false, err: 'Too many numbers in one coordinate'};
  let d, m = 0, s = 0;
  if (nums.every(n => n.unit)) {
    for (const n of nums) { if (n.unit === 'deg') d = n.v; else if (n.unit === 'min') m = n.v; else s = n.v; }
    if (d === undefined) d = 0;
  } else {
    d = nums[0].v; m = nums[1] ? nums[1].v : 0; s = nums[2] ? nums[2].v : 0;
  }
  if (nums.length > 1 && nums[0].dec) return {ok: false, err: 'Degrees can only have a decimal when nothing follows'};
  if (nums.length === 3 && nums[1].dec) return {ok: false, err: 'Minutes can only have a decimal when no seconds follow'};
  if (m >= 60) return {ok: false, err: 'Minutes must be under 60'};
  if (s >= 60) return {ok: false, err: 'Seconds must be under 60'};
  return {ok: true, val: d + m / 60 + s / 3600, fmt: ['DD', 'DDM', 'DMS'][nums.length - 1]};
}

// Split an unlabeled run of numbers into latitude and longitude by trying cut points
// in order of preference and keeping the first one where both halves are valid.
function splitRun(nums) {
  const n = nums.length;
  if (n < 2) return null;
  const prefs = [];
  const degIdx = nums.findIndex((x, i) => i > 0 && x.unit === 'deg');
  if (degIdx > 0) prefs.push(degIdx);
  const decIdx = nums.findIndex(x => x.dec);
  if (decIdx >= 0 && decIdx < n - 1) prefs.push(decIdx + 1);
  if (n % 2 === 0) prefs.push(n / 2);
  for (let k = 1; k < n; k++) prefs.push(k);
  for (const k of prefs) {
    const a = nums.slice(0, k), b = nums.slice(k);
    if (a.length > 3 || b.length > 3) continue;
    const va = compVal(a), vb = compVal(b);
    if (!va.ok || !vb.ok) continue;
    if (Math.min(va.val, vb.val) > 90 || Math.max(va.val, vb.val) > 180) continue;
    return [a, b];
  }
  return null;
}

// Dictation often packs degrees and minutes into one number, the way NMEA
// writes them: "3234.5" for 32 34.5, "11708.4" for 117 08.4. Nothing over 180
// can be a single degree, minute or second value, so a number like that with
// 4 to 7 digits before the point is read as DDMM, DDDMM, DDMMSS or DDDMMSS
// (when the minutes and seconds come out under 60).
const PACKED = {4: [2], 5: [3], 6: [2, 4], 7: [3, 5]};
// "11708" -> ["117", "08"], or null when it doesn't come apart that way.
function packedParts(digits) {
  if (!PACKED[digits.length]) return null;
  const cuts = [0, ...PACKED[digits.length], digits.length];
  const parts = cuts.slice(1).map((c, i) => digits.slice(cuts[i], c));
  return parts.slice(1).some(p => +p >= 60) ? null : parts;
}
function unpack(toks) {
  return toks.flatMap(t => {
    const m = t.t === 'num' && t.v > 180 && /^(\d{4,7})(\.\d+)?$/.exec(t.raw);
    const parts = m && packedParts(m[1]);
    if (!parts) return [t];
    parts[parts.length - 1] += m[2] || '';
    return parts.map(p => numTok(p));
  });
}

// Two numbers run together with no space: "39.613" and "11708.168" heard as
// "39.61311708.168". The second number's whole part is the end of the middle
// digits; take the split that leaves it a believable degrees value, packed
// (DDDMM, DDMM, ...) or plain, trying 5 digits, then 3, then the rest.
// reread.js can still move the boundary if this guess lands far away.
function splitRunOn(w) {
  const [first, mid, ...rest] = w.split('.');
  const ok = d => (d.length <= 3 ? +d <= 180 : !!packedParts(d) && +packedParts(d)[0] <= 180);
  const k = [5, 3, 4, 2, 6, 7, 1].find(n => n < mid.length && ok(mid.slice(-n))) || 1;
  const tail = mid.slice(-k) + '.' + rest.join('.');
  return [first + '.' + mid.slice(0, -k), ...(rest.length > 1 ? splitRunOn(tail) : [tail])];
}

export function parseFix(input, assumeNW = true) {
  return parseTokens(tokenize(input), assumeNW);
}

// parseFix on tokens that are already split (reread.js edits them and parses again).
export function parseTokens(tokens, assumeNW = true) {
  const toks = unpack(tokens);
  if (!toks.some(t => t.t === 'num')) return {state: 'empty'};
  const {groups, mode} = groupTokens(toks);
  let comps = [];
  const splitGroup = (g) => {
    const sp = splitRun(g.nums);
    if (!sp) return null;
    const a = {nums: sp[0], hemi: null, axis: null, neg: g.neg};
    const b = {nums: sp[1], hemi: null, axis: null, neg: false};
    if (mode === 'prefix') { a.hemi = g.hemi; a.axis = g.axis; } else { b.hemi = g.hemi; b.axis = g.axis; }
    if (g.axis && mode !== 'prefix') { a.axis = g.axis; b.axis = null; } // axis labels always lead
    return [a, b];
  };
  if (groups.length === 1) {
    const g = groups[0];
    const single = g.nums.length <= 3 && compVal(g.nums).ok;
    if ((g.hemi || g.axis) && single) comps = [g];
    else {
      const sp = splitGroup(g);
      if (sp) comps = sp;
      else if (single) comps = [g];
      else return {state: 'error', msg: "Couldn't tell where the latitude ends. Say “north” and “west”, or “degrees”."};
    }
  } else {
    for (const g of groups) {
      if (g.nums.length > 3) {
        const sp = splitGroup(g);
        if (!sp) return {state: 'error', msg: 'Too many numbers in one coordinate.'};
        comps.push(...sp);
      } else comps.push(g);
    }
  }
  if (comps.length > 2) return {state: 'error', msg: 'Heard more than two coordinates. Clear the box and say it again.'};
  const vals = comps.map(c => compVal(c.nums));
  const bad = vals.find(v => !v.ok);
  if (bad) return {state: 'error', msg: bad.err + '.'};
  comps.forEach((c, i) => { c.val = vals[i].val; c.fmt = vals[i].fmt; });

  const axisOf = c => c.axis || (c.hemi === 'N' || c.hemi === 'S' ? 'lat' : c.hemi === 'E' || c.hemi === 'W' ? 'lon' : null);
  if (comps.length === 1) {
    const ax = axisOf(comps[0]);
    return {state: 'partial', msg: ax === 'lon' ? 'Heard the longitude. Now say the latitude.' : 'Heard the latitude. Keep going with the longitude.'};
  }
  const [c1, c2] = comps;
  let a1 = axisOf(c1), a2 = axisOf(c2);
  const notes = [];
  if (a1 && a2 && a1 === a2) return {state: 'error', msg: 'Heard two ' + (a1 === 'lat' ? 'latitudes' : 'longitudes') + '. Check the directions.'};
  if (!a1 && !a2) {
    if (c1.val > 90 && c2.val <= 90) { a1 = 'lon'; a2 = 'lat'; notes.push('Longitude was said first'); }
    else { a1 = 'lat'; a2 = 'lon'; }
  } else if (!a1) a1 = a2 === 'lat' ? 'lon' : 'lat';
  else if (!a2) a2 = a1 === 'lat' ? 'lon' : 'lat';
  const latC = a1 === 'lat' ? c1 : c2, lonC = a1 === 'lat' ? c2 : c1;
  let lat = latC.val, lon = lonC.val;
  if (latC.hemi === 'S' || latC.neg) lat = -lat;
  if (lonC.hemi === 'W' || lonC.neg) lon = -lon;
  if (!lonC.hemi && !lonC.neg && assumeNW) { lon = -lon; notes.push('Assumed west'); }
  if (Math.abs(lat) > 90) return {state: 'error', msg: 'Latitude has to be 90 or less.'};
  if (Math.abs(lon) > 180) return {state: 'error', msg: 'Longitude has to be 180 or less.'};
  const fmtName = {DD: 'Decimal degrees', DDM: 'Degrees, decimal minutes', DMS: 'Degrees, minutes, seconds'};
  const fmt = latC.fmt === lonC.fmt ? fmtName[latC.fmt] : 'Mixed formats';
  return {state: 'ok', lat, lon, fmt, notes};
}

/* ---------- geo helpers ---------- */

const RAD = Math.PI / 180;

export function distNm(a, b) {
  const dLat = (b.lat - a.lat) * RAD, dLon = (b.lon - a.lon) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * 3440.065 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearing(a, b) {
  const y = Math.sin((b.lon - a.lon) * RAD) * Math.cos(b.lat * RAD);
  const x = Math.cos(a.lat * RAD) * Math.sin(b.lat * RAD) - Math.sin(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos((b.lon - a.lon) * RAD);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

const POINTS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
export const compass = deg => POINTS[Math.round(deg / 22.5) % 16];

export function fmtDist(nm) {
  if (nm < 0.5) return Math.round(nm * 2025.37 / 10) * 10 + ' yd';
  return (nm < 10 ? nm.toFixed(1) : Math.round(nm)) + ' nm';
}

export function nearestLandmarks(fix, list = LANDMARKS) {
  return list.map(l => ({...l, d: distNm(l, fix)})).sort((a, b) => a.d - b.d);
}

const pad = (v, w) => String(v).padStart(w, '0');

export function toDDM(v, isLat) {
  const h = isLat ? (v < 0 ? 'S' : 'N') : (v < 0 ? 'W' : 'E');
  const a = Math.abs(v); let d = Math.floor(a); let m = +((a - d) * 60).toFixed(3);
  if (m >= 60) { d += 1; m = 0; }
  return d + '° ' + pad(m.toFixed(3), 6) + '′ ' + h;
}

export function toDMS(v, isLat) {
  const h = isLat ? (v < 0 ? 'S' : 'N') : (v < 0 ? 'W' : 'E');
  const a = Math.abs(v); let d = Math.floor(a); const mf = (a - d) * 60; let m = Math.floor(mf); let s = +((mf - m) * 60).toFixed(1);
  if (s >= 60) { s = 0; m += 1; } if (m >= 60) { m = 0; d += 1; }
  return d + '° ' + pad(m, 2) + '′ ' + pad(s.toFixed(1), 4) + '″ ' + h;
}

