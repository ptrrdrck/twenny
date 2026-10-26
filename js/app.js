// app.js: wires the one Twenny screen together.

import {parseFix, LANDMARKS} from './twenny-core.js';
import {nearest, fromYou, farWarning, formats, copyText, mapLinks, addRecent} from './fix.js';
import {speechSupported, listen, askForMic, micPermission} from './speech.js';
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
  listening: false,
  voice: speechSupported,
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
  // Mid-sentence, "32 34" is a valid fix in the Atlantic. Don't fly there
  // while the guard is still talking; the warning shows once they stop.
  if (r.state === 'ok' && S.listening && farWarning(r)) {
    setStatus('pend', 'Listening…');
    S.fix = null;
    renderFix(false);
    return;
  }
  // Not a whole fix near San Diego, and nobody is mid-sentence (typing, or the
  // guard has tapped stop): take the second look at the whole thing now.
  if (!S.listening && r.state !== 'empty' && !(r.state === 'ok' && !farWarning(r)) && recheck()) return;
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

// Browsers end a recognition session on their own: after a few seconds of
// silence, at a pause, or right after the mic prompt. Until the guard taps
// stop or a whole fix is heard, Twenny starts a new one and keeps adding to
// the text, giving up after this long with nothing new heard, or after this
// many sessions in a row that heard nothing (a browser that ends every session
// at once would otherwise restart in a tight loop, beeping on Android).
const KEEP_LISTENING_MS = 20000;
const MAX_EMPTY_SESSIONS = 4;
// A session can also get stuck: on an iPhone, right after the mic prompt, it may
// never get audio and never end. Drop it and start a fresh one if the mic hasn't
// started feeding it by STALL_NO_AUDIO_MS, or nothing at all has come back by
// STALL_NO_WORDS_MS (a healthy silent session ends itself before that).
const STALL_NO_AUDIO_MS = 2500;
const STALL_NO_WORDS_MS = 10000;
const STOP_GRACE_MS = 1500;   // after tap-to-stop, wait this long for the final words
let session = null;   // {mic, fromTap, stopping, error, heard, audio}: the one listening now
let heardAt = 0;      // when something was last heard (or the tap)
let emptyRuns = 0;    // sessions in a row that heard nothing
let gotAudio = false; // any session since the tap got audio from the mic
let micReady = false; // this page has the microphone (asked once per page load)
let micAsking = false;   // waiting on the mic prompt
micPermission().then(state => { if (state === 'granted') micReady = true; });

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

// Start a session; false if the browser refused outright.
function openMic(fromTap) {
  const s = {fromTap, stopping: false, error: '', heard: false, audio: false, timers: [], n: ++sessionCount};
  try {
    s.mic = listen({
      onEvent(name) { logVoice(`#${s.n} ${name}`); },
      onAudio() { s.audio = gotAudio = true; },
      onText(t) {
        if (session !== s) return;
        s.heard = true;
        heardAt = Date.now();
        heard.value = S.prefix ? S.prefix + ' ' + t : t;
        update(heard.value);
      },
      onError(code) { if (session === s) s.error = code; },
      onEnd() { if (session === s) micEnded(s); }
    });
  } catch (e) {
    logVoice(`#${s.n} start threw ${e && e.name}`);
    return false;
  }
  logVoice(`#${s.n} started` + (fromTap ? '' : ' (no tap)'));
  session = s;
  if (s.mic.audioEvents) s.timers.push(setTimeout(() => { if (!s.audio) stalled(s); }, STALL_NO_AUDIO_MS));
  s.timers.push(setTimeout(() => { if (!s.heard) stalled(s); }, STALL_NO_WORDS_MS));
  return true;
}

// A session that's stuck (or slow to finish after stop): drop it and carry on
// as if it had ended.
function stalled(s) {
  if (session !== s) return;
  s.mic.abort();
  if (!s.error) s.error = s.audio || s.stopping ? 'stalled' : 'no-audio';
  logVoice(`#${s.n} dropped: ${s.error}`);
  micEnded(s);
}

function micEnded(s) {
  session = null;
  s.timers.forEach(clearTimeout);
  emptyRuns = s.heard ? 0 : emptyRuns + 1;
  const e = s.error;
  const refused = e === 'not-allowed' || e === 'service-not-allowed';
  if (refused && s.fromTap) {
    useFallback('Voice is blocked here. Tap the box and use the mic on the keyboard, or allow the microphone for this site.');
    return;
  }
  const r = parseFix(heard.value, S.assumeNW), state = r.state;
  // Done when there's a whole fix near San Diego. One far out at sea is usually
  // a fix still being said ("32 34.5 1 17" before "8.4"), so keep listening.
  const complete = state === 'ok' && !farWarning(r);
  const carryOn = !s.stopping && S.listening && !complete && !refused &&
    e !== 'network' && e !== 'audio-capture' &&
    Date.now() - heardAt < KEEP_LISTENING_MS && emptyRuns < MAX_EMPTY_SESSIONS;
  logVoice(`#${s.n} over` + (e ? ` (${e})` : '') + (carryOn ? ', listening again' : ''));
  if (carryOn) {
    S.prefix = heard.value.trim();
    startSession(false);
    return;
  }
  setListening(false);
  update(heard.value);   // now not listening, so this takes the second look too
  const rescued = !!(S.fix && S.fix.notes.includes('Re-read'));
  if (!complete && !rescued && state !== 'ok') {
    const why = e === 'network' ? 'Voice needs a connection. Tap the box and use the keyboard mic.'
      : e === 'audio-capture' ? 'No microphone found.'
      : !s.stopping && state === 'partial' ? 'Stopped listening. Tap and talk to say the rest.'
      : refused ? 'Voice recognition was refused. Tap and talk to try again.'
      : !gotAudio && !heard.value.trim() ? 'The mic didn’t start. Tap and talk to try again.'
      : !heard.value.trim() ? 'Didn’t hear anything. Tap and talk to try again.'
      : '';
    if (why) setStatus('off', why);
  }
  commit();
}

// Cancel without saving (Clear, picking a recent fix). Tapping the talk button
// instead ends normally and saves the fix.
function stopListening() {
  if (micAsking) { micAsking = false; setListening(false); return; }
  if (!session) return;
  session.mic.abort();
  session = null;
  setListening(false);
}

if (!S.voice) useFallback('Voice input isn’t available in this browser. Tap the box, then the mic on the keyboard.');

talk.addEventListener('click', () => {
  if (!S.voice) { heard.focus(); return; }
  if (micAsking) { logVoice('tap: cancel'); stopListening(); update(heard.value); commit(); return; }   // tapped while the mic was being asked for
  if (S.listening && session) {
    logVoice('tap: stop');
    // Done talking: let the browser hand over its final words, then save.
    const s = session;
    s.stopping = true;
    setListening(false);
    s.mic.stop();
    s.timers.push(setTimeout(() => stalled(s), STOP_GRACE_MS));
    return;
  }
  if (session) { session.mic.abort(); session = null; }   // one still winding down
  // Halfway through a fix ("heard the latitude"): keep it and listen for the rest.
  const keep = parseFix(heard.value, S.assumeNW).state === 'partial';
  S.prefix = keep ? heard.value.trim() : '';
  if (!keep) heard.value = '';
  heardAt = Date.now();
  emptyRuns = 0;
  gotAudio = false;
  logStart();
  setListening(true);
  update(heard.value);
  startSession(true);
});

// Start listening. The first time in a page load, ask for the microphone on its
// own first (a recognition that raises the mic prompt itself can stay stuck
// after Allow on an iPhone); after that, start straight away, inside the tap.
function startSession(fromTap) {
  if (micReady) {
    if (openMic(fromTap)) { update(heard.value); return; }
    setListening(false);
    setStatus('off', 'Couldn’t start the mic. Tap and talk again.');
    commit();
    return;
  }
  micAsking = true;
  setStatus('pend', 'Allow the microphone when asked');
  logVoice('mic: asking (prompt)');
  askForMic().then(() => {
    micReady = true;
    logVoice('mic: ok');
    if (!micAsking) return;          // cancelled meanwhile
    micAsking = false;
    if (openMic(false)) { update(heard.value); return; }   // not inside the tap any more
    setListening(false);
    setStatus('off', 'Couldn’t start the mic. Tap and talk again.');
    commit();
  }, err => {
    logVoice('mic: ' + (err && err.name));
    if (!micAsking) return;
    micAsking = false;
    setListening(false);
    if (err && err.name === 'NotAllowedError') {
      useFallback('The microphone is blocked for this site. Tap the box and use the mic on the keyboard, or allow the microphone and reload.');
    } else setStatus('off', 'Couldn’t start the mic. Tap and talk again.');
    commit();
  });
}

const device = {standalone: navigator.standalone === true || matchMedia('(display-mode: standalone)').matches};

/* ---------- voice log (footer): what the browser reported, for tracking down mic trouble ---------- */

let sessionCount = 0, logT0 = performance.now();
const logLines = [];
function logVoice(msg) {
  logLines.push(((performance.now() - logT0) / 1000).toFixed(1).padStart(6) + 's  ' + msg);
  if (logLines.length > 80) logLines.shift();
  if (!$('vlogBox').hidden) $('vlog').textContent = logLines.join('\n');
}
function logStart() {
  logT0 = performance.now();
  logLines.push('---');
  logVoice('tap: listen');
}
$('vlogBtn').addEventListener('click', () => {
  const box = $('vlogBox');
  box.hidden = !box.hidden;
  $('vlogBtn').textContent = box.hidden ? 'Voice log' : 'Hide voice log';
  if (!box.hidden) {
    $('vlog').textContent = logLines.join('\n') || 'Nothing yet. Tap and talk, then look here.';
    box.scrollIntoView({block: 'nearest'});
  }
});
$('vlogCopy').addEventListener('click', async () => {
  const text = [navigator.userAgent, 'home screen: ' + device.standalone, ...logLines].join('\n');
  try { await navigator.clipboard.writeText(text); toast('Voice log copied'); } catch (e) { toast('Couldn’t copy; take a screenshot instead'); }
});

/* ---------- typing ---------- */

heard.addEventListener('input', () => update(heard.value));
heard.addEventListener('change', commit);
heard.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); heard.blur(); }
});

$('clearBtn').addEventListener('click', () => {
  logVoice('clear');
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
// Location was on last time (the guard tapped Use my location and didn't Stop):
// turn it back on. If the browser still remembers the Allow this is silent;
// if it doesn't, its own prompt shows. A refusal is respected: nothing is asked.
if (store.get('twenny.loc', false)) {
  permissionState().then(state => { if (state !== 'denied') startLoc(); });
}
addEventListener('load', () => map.resize());
