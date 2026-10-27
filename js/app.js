// app.js: wires the one Twenny screen together.

import {parseFix, LANDMARKS} from './twenny-core.js';
import {nearest, fromYou, farWarning, formats, copyText, mapLinks, addRecent} from './fix.js';
import {createMap} from './map.js';
import {registerSW} from './pwa.js';
import {reread} from './reread.js';

const $ = id => document.getElementById(id);

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode: keep going */ }
  }
};

const S = {
  assumeNW: store.get('twenny.nw', true),
  fix: null,            // {lat, lon, fmt, notes, text}
  me: null,             // {lat, lon, acc} in metres
  recents: store.get('twenny.recent', []),
  entering: false,      // the Heard box is open (dictating or typing)
  prefix: ''            // kept text when continuing a partial fix
};

const map = createMap($('map'), LANDMARKS);
const heard = $('heard');

/* ---------- parsing and the fix card ---------- */

// kind: '' (no dot), 'on' (green), 'pend' (green, blinking), 'off' (red).
function setDot(el, kind) {
  el.hidden = !kind;
  el.className = 'status' + (kind === 'pend' ? ' due' : kind === 'off' ? ' over' : '');
}

function setStatus(kind, text) {
  setDot($('parseDot'), kind);
  $('parseStatus').classList.toggle('err', kind === 'off');
  $('parseText').textContent = text;
}

// Provenance pills: the first a pill, the rest grow out of it.
function setPills(el, texts) {
  el.replaceChildren(...texts.map((t, i) => Object.assign(document.createElement('span'), {className: i ? 'pill-tail' : 'pill', textContent: t})));
}

function update(text) {
  const r = parseFix(text, S.assumeNW);
  const whole = r.state === 'ok' && !farWarning(r);
  // While the box is open, a whole fix near San Diego shows at once; anything
  // short of that waits for Done. Mid-sentence, "32 34" is a valid fix in the
  // Atlantic, and the second look shouldn't guess at half a fix.
  if (S.entering && !whole) {
    if (r.state === 'empty') setStatus('', 'Tap the mic on your keyboard and say the fix, or type it.');
    else if (r.state === 'partial') setStatus('pend', r.msg);
    else setStatus('pend', 'Keep going. Tap Done when the whole fix is in.');
    S.fix = null;
    renderFix(false);
    return;
  }
  // Not a whole fix near San Diego: take the second look at the whole thing.
  if (r.state !== 'empty' && !whole && recheck()) return;
  if (r.state === 'ok') {
    setStatus('on', 'Fix: ' + r.fmt.toLowerCase());
    const moved = !S.fix || S.fix.lat !== r.lat || S.fix.lon !== r.lon;
    S.fix = {lat: r.lat, lon: r.lon, fmt: r.fmt, notes: r.notes, text: text.trim()};
    renderFix(moved);
    return;
  }
  if (r.state === 'empty') setStatus('', 'Waiting for a fix');
  else if (r.state === 'partial') setStatus('pend', r.msg);
  else setStatus('off', r.msg);
  S.fix = null;
  renderFix(false);
}

function renderFix(pan) {
  const fix = S.fix;
  $('fixCard').hidden = !fix;
  if (!fix) { map.clearFix(); return; }
  const near = nearest(fix);
  const warn = farWarning(fix);
  $('whereLm').textContent = near.line;
  $('whereLm').hidden = !!warn;
  $('farWarn').hidden = !warn;
  if (warn) $('farWarn').replaceChildren(Object.assign(document.createElement('b'), {textContent: 'Far from San Diego. '}), warn);
  $('whereYou').hidden = !S.me;
  if (S.me) $('whereYou').textContent = fromYou(S.me, fix);
  const f = formats(fix);
  const cell = (id, s) => { $(id).replaceChildren(...s.split('  ').map(t => Object.assign(document.createElement('span'), {textContent: t}))); };
  cell('fDDM', f.ddm); cell('fDMS', f.dms); $('fDD').textContent = f.dd;
  setPills($('fixPills'), [fix.fmt, ...fix.notes]);
  const links = mapLinks(fix);
  $('appleBtn').href = links.apple;
  $('googleBtn').href = links.google;
  if (pan) map.showFix(fix, near, !!warn);
}

// The second look (reread.js) at the whole text: the usual speech-to-text
// slips, kept only if one lands near San Diego. True if it found a reading.
function recheck() {
  const rr = reread(heard.value, S.assumeNW);
  if (!rr) return false;
  const moved = !S.fix || S.fix.lat !== rr.lat || S.fix.lon !== rr.lon;
  S.fix = {lat: rr.lat, lon: rr.lon, fmt: rr.fmt, notes: [...rr.notes, 'Re-read'], text: heard.value.trim()};
  setStatus('on', rr.unsure ? 'Re-read, but it could be read more than one way. Check the fix.' : 'Re-read the whole thing. Check the fix.');
  renderFix(moved);
  return true;
}

/* ---------- recent fixes ---------- */

function commit() {
  if (!S.fix) return;
  S.recents = addRecent(S.recents, {...S.fix, t: Date.now()});
  store.set('twenny.recent', S.recents);
  renderRecents();
  // Make sure the answer (and the line from you) isn't hidden under the talk button.
  const answer = !$('whereYou').hidden ? $('whereYou') : $('farWarn').hidden ? $('whereLm') : $('farWarn');
  answer.scrollIntoView({block: 'nearest', behavior: 'smooth'});
}

function when(t) {
  const d = new Date(t), now = new Date();
  const time = d.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});
  return d.toDateString() === now.toDateString() ? time : d.toLocaleDateString([], {month: 'short', day: 'numeric'}) + ' ' + time;
}

const el = (tag, className, textContent) => Object.assign(document.createElement(tag), {className, textContent});

function renderRecents() {
  $('recentSec').hidden = !S.recents.length;
  $('recentCount').textContent = S.recents.length;
  $('recentList').replaceChildren(...S.recents.map(e => {
    const b = el('button', 'row rec');
    b.type = 'button';
    const who = el('span', 'who');
    who.append(el('span', 'fixline', formats(e).ddm), el('span', 'meta', farWarning(e) ? 'Far from San Diego' : nearest(e).line));
    b.append(who, el('span', 'amt', when(e.t)));
    b.addEventListener('click', () => {
      heard.value = e.text;
      S.fix = {lat: e.lat, lon: e.lon, fmt: e.fmt, notes: e.notes || [], text: e.text};
      setStatus('on', 'From recent fixes, ' + when(e.t));
      renderFix(true);
      window.scrollTo({top: 0, behavior: 'smooth'});
    });
    return b;
  }));
}

function setRecentOpen(open) {
  $('recentToggle').setAttribute('aria-expanded', String(open));
  $('recentBody').hidden = !open;
  store.set('twenny.recentOpen', open);
}
$('recentHead').addEventListener('click', () => setRecentOpen($('recentBody').hidden));
$('recentClear').addEventListener('click', () => {
  if (!confirm('Clear all recent fixes on this phone?')) return;
  S.recents = [];
  store.set('twenny.recent', S.recents);
  renderRecents();
});

/* ---------- entering a fix ---------- */

// Voice comes from the dictation mic on the phone's keyboard, the same on every
// phone: the big button opens the Heard box with the keyboard up, the guard
// taps the keyboard's mic (or types), then taps Done. Twenny doesn't use the
// browser's speech API: on iPhones it went deaf too often (Oct 2026).
const talk = $('talk');
let openAtPress = false;   // was the box open when the finger came down on the button?

function setEntering(on) {
  S.entering = on;
  talk.setAttribute('aria-pressed', String(on));
  talk.textContent = on ? 'Done' : 'Say or type a fix';
}

// Tapping Done closes the keyboard before the tap lands (the box loses focus
// first), so whether this is Done is decided when the finger comes down.
talk.addEventListener('pointerdown', () => { openAtPress = S.entering; });
talk.addEventListener('click', () => {
  const done = S.entering || openAtPress;
  openAtPress = false;
  if (done) { heard.blur(); return; }
  // A new fix: clear the last one, unless only half of one is in ("heard the
  // latitude", no fix on screen); then keep it and add the rest.
  if (!S.fix && parseFix(heard.value, S.assumeNW).state === 'partial') heard.value = heard.value.trimEnd() + ' ';
  else heard.value = '';
  heard.focus();   // inside the tap, so the keyboard opens
  heard.setSelectionRange(heard.value.length, heard.value.length);
});

/* ---------- typing ---------- */

heard.addEventListener('input', () => update(heard.value));
heard.addEventListener('focus', () => { setEntering(true); update(heard.value); });
// Done, Enter, or tapping elsewhere: read the whole thing and save it.
heard.addEventListener('blur', () => {
  setEntering(false);
  update(heard.value);
  commit();
});
heard.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); heard.blur(); }
});

$('clearBtn').addEventListener('click', () => {
  heard.value = '';
  update('');
});

const nwBox = $('nwBox');
const renderNW = () => { nwBox.checked = S.assumeNW; };
nwBox.addEventListener('change', () => {
  S.assumeNW = nwBox.checked;
  store.set('twenny.nw', S.assumeNW);
  renderNW();
  update(heard.value);
});

/* ---------- actions ---------- */

let toastTimer = 0;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

$('copyBtn').addEventListener('click', async () => {
  if (!S.fix) return;
  const text = copyText(S.fix);
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const t = Object.assign(document.createElement('textarea'), {value: text});
    document.body.append(t);
    t.select();
    document.execCommand('copy');
    t.remove();
  }
  toast('Copied ' + text);
});

/* ---------- my location ---------- */

let watchId = null;   // tracking the guard's position
let asking = false;   // waiting on the first request (and the phone's prompt)

// The header's location pill: "GPS" with its dot, then what it's doing.
function setLoc(kind, text) {
  $('locName').firstChild.textContent = kind ? 'GPS ' : 'Location off';
  setDot($('locDot'), kind);
  $('locText').hidden = !kind;
  $('locText').textContent = text;
  $('locBtn').textContent = watchId === null && !asking ? 'Use my location' : 'Stop';
}

// 'granted' | 'prompt' | 'denied', or 'unknown' where the browser can't say.
async function permissionState() {
  try { return (await navigator.permissions.query({name: 'geolocation'})).state; } catch (e) { return 'unknown'; }
}

const GEO = {enableHighAccuracy: true, maximumAge: 10000, timeout: 30000};

function gotPosition(p) {
  S.me = {lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy};
  store.set('twenny.loc', true);
  setLoc('on', '±' + Math.round(p.coords.accuracy * 1.0936) + ' yd');
  map.showMe(S.me);
  renderFix(false);
}

function locError(err) {
  if (err.code === err.PERMISSION_DENIED) { stopLoc(); setLoc('off', 'Blocked'); }
  else if (!S.me) setLoc(err.code === err.POSITION_UNAVAILABLE ? 'off' : 'pend', err.code === err.POSITION_UNAVAILABLE ? 'No position' : 'Still looking…');
}

const track = () => { watchId = navigator.geolocation.watchPosition(gotPosition, locError, GEO); };

// The tap's first act is a one-off location request: if Twenny hasn't been
// allowed yet, that's what makes the phone show its own "use your current
// location" prompt. Tracking starts once the guard has answered it.
function startLoc() {
  if (!('geolocation' in navigator)) { setLoc('off', 'Not available'); return; }
  asking = true;
  navigator.geolocation.getCurrentPosition(p => {
    if (!asking) return;           // stopped while the prompt was up
    asking = false;
    track();
    gotPosition(p);
  }, err => {
    if (!asking) return;
    asking = false;
    if (err.code === err.PERMISSION_DENIED) return locError(err);
    track();                       // allowed, just no position yet: keep trying
    locError(err);
  }, GEO);
  setLoc('pend', 'Finding you…');
  permissionState().then(state => { if (state === 'prompt' && asking) setLoc('pend', 'Allow location when asked'); });
}

function stopLoc() {
  asking = false;
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  S.me = null;
  store.set('twenny.loc', false);
  map.hideMe();
  setLoc('', '');
  renderFix(false);
}

$('locBtn').addEventListener('click', () => (watchId === null && !asking ? startLoc() : stopLoc()));

/* ---------- theme, version, offline, updates ---------- */

function applyTheme(t) {
  const root = document.documentElement;
  if (t === 'light' || t === 'dark') root.dataset.theme = t; else delete root.dataset.theme;
  store.set('twenny.theme', t);
  $('themeSel').value = t;
  syncThemeColor();
}
function syncThemeColor() {
  const paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
  document.querySelector('meta[name="theme-color"]').content = paper;
}
$('themeSel').addEventListener('change', e => applyTheme(e.target.value));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncThemeColor);

registerSW(apply => {
  const b = $('updateBtn');
  b.hidden = false;
  b.onclick = () => { b.textContent = 'Refreshing…'; apply(); };
}, v => { $('ver').textContent = v; });

/* ---------- start ---------- */

applyTheme(store.get('twenny.theme', 'auto'));
renderNW();
setEntering(false);
renderRecents();
setRecentOpen(store.get('twenny.recentOpen', false));
update('');
// Location was on last time (the guard tapped Use my location and didn't Stop):
// turn it back on. If the browser still remembers the Allow this is silent;
// if it doesn't, its own prompt shows. A refusal is respected: nothing is asked.
if (store.get('twenny.loc', false)) {
  permissionState().then(state => { if (state !== 'denied') startLoc(); });
}
addEventListener('load', () => map.resize());
