// app.js: wires the one Twenny screen together.

import {parseFix, LANDMARKS} from './twenny-core.js';
import {nearest, fromYou, farWarning, formats, copyText, mapLinks, addRecent} from './fix.js';
import {speechSupported, createListener} from './speech.js';
import {createMap} from './map.js';
import {registerSW} from './pwa.js';

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
  listening: false,
  voice: speechSupported,
  prefix: '',           // kept text when continuing a partial fix
  voiceErr: ''          // last speech error, shown if nothing was heard
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
  // Mid-sentence, "32 34" is a valid fix in the Atlantic. Don't fly there
  // while the guard is still talking; the warning shows once they stop.
  if (r.state === 'ok' && S.listening && farWarning(r)) {
    setStatus('pend', 'Listening…');
    S.fix = null;
    renderFix(false);
    return;
  }
  if (r.state === 'ok') {
    setStatus('on', 'Fix: ' + r.fmt.toLowerCase());
    const moved = !S.fix || S.fix.lat !== r.lat || S.fix.lon !== r.lon;
    S.fix = {lat: r.lat, lon: r.lon, fmt: r.fmt, notes: r.notes, text: text.trim()};
    renderFix(moved);
    return;
  }
  if (r.state === 'empty') setStatus('', S.listening ? 'Listening…' : 'Waiting for a fix');
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
      stopListening();
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

/* ---------- talking ---------- */

const talk = $('talk');
let listener = null;

function setListening(on) {
  S.listening = on;
  talk.setAttribute('aria-pressed', String(on));
  talk.textContent = on ? 'Listening · tap to stop' : S.voice ? 'Tap and talk' : 'Type or dictate';
}

function useFallback(note) {
  S.voice = false;
  setListening(false);
  $('fallbackText').textContent = note;
  $('fallbackNote').hidden = false;
}

// Cancel without saving (Clear, picking a recent fix). Tapping the talk button
// instead ends normally and saves the fix.
function stopListening() {
  if (!S.listening) return;
  setListening(false);
  listener.stop();
}

if (S.voice) {
  listener = createListener({
    onText(t) {
      heard.value = S.prefix ? S.prefix + ' ' + t : t;
      update(heard.value);
    },
    onEnd() {
      if (!S.listening) return;
      setListening(false);
      update(heard.value);
      if (S.voiceErr && !heard.value.trim()) setStatus('off', S.voiceErr);
      commit();
    },
    onError(code) {
      if (code === 'no-speech' || code === 'aborted') return;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        useFallback('Voice is blocked here. Tap the box and use the mic on the keyboard, or allow the microphone for this site.');
        return;
      }
      S.voiceErr = code === 'network' ? 'Voice needs a connection. Tap the box and use the keyboard mic.'
        : code === 'audio-capture' ? 'No microphone found.'
        : 'Voice stopped (' + code + '). Tap to try again.';
      setStatus('off', S.voiceErr);
    }
  });
} else {
  useFallback('Voice input isn’t available in this browser. Tap the box, then the mic on the keyboard.');
}

talk.addEventListener('click', () => {
  if (!S.voice) { heard.focus(); return; }
  if (S.listening) { listener.stop(); return; }
  // Halfway through a fix ("heard the latitude"): keep it and listen for the rest.
  const keep = parseFix(heard.value, S.assumeNW).state === 'partial';
  S.prefix = keep ? heard.value.trim() : '';
  if (!keep) heard.value = '';
  S.voiceErr = '';
  try { listener.start(); } catch (e) { return; }
  setListening(true);
  update(heard.value);
});

/* ---------- typing ---------- */

heard.addEventListener('input', () => update(heard.value));
heard.addEventListener('change', commit);
heard.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); heard.blur(); }
});

$('clearBtn').addEventListener('click', () => {
  stopListening();
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
setListening(false);
renderRecents();
setRecentOpen(store.get('twenny.recentOpen', false));
update('');
// Location was on last time: pick it up again, but only if it's still allowed,
// so opening the app never pops a permission prompt the guard didn't ask for.
if (store.get('twenny.loc', false)) {
  permissionState().then(state => { if (state === 'granted' || state === 'unknown') startLoc(); });
}
addEventListener('load', () => map.resize());
