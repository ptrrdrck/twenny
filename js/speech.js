// speech.js: thin wrapper over the browser's speech recognition.
// Not every browser has it (and iOS home-screen apps may refuse it), so the
// app checks speechSupported and falls back to the text box + keyboard dictation.

import {joinResults} from './fix.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const speechSupported = typeof SR === 'function';

// Chrome on Android repeats earlier words in each result; see joinResults.
const cumulative = /Android/i.test(navigator.userAgent);

// Has this page been given the microphone? 'granted' | 'prompt' | 'denied' | 'unknown'.
export async function micPermission() {
  try { return (await navigator.permissions.query({name: 'microphone'})).state; } catch (e) { return 'unknown'; }
}

// Ask for the microphone on its own, before recognition starts. On an iPhone,
// a recognizer whose start() raised the mic prompt can stay stuck after Allow:
// it never gets audio and never ends. With the mic already granted, it starts
// clean. Resolves when allowed; rejects with the browser's error (NotAllowedError
// when refused). Nothing is recorded: the tracks are stopped straight away.
export async function askForMic() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
  const stream = await navigator.mediaDevices.getUserMedia({audio: true});
  stream.getTracks().forEach(t => t.stop());
}

// One recognizer for the page, started again for each listening session. On an
// iPhone a second recognizer object in the same page gets audio but never hears
// speech (voice log, 2026-10-26: the first listen after a load worked, every
// later one sat on "Listening"), so it's created once and reused. Events go to
// the current session only; a session asked for while the last one is still
// ending starts when that one has ended.
let rec = null;
let running = false;     // between start() and its 'end'
let current = null;      // the session getting events
let queued = null;       // waiting for the running one to end
let abortedAt = 0;       // when the running one was aborted (0 = it wasn't)
const DEAD_AFTER_ABORT_MS = 2000;   // no 'end' this long after abort: replace the recognizer

function recognizer() {
  if (rec) return rec;
  const r = new SR();
  r.lang = 'en-US';
  r.continuous = true;
  r.interimResults = true;
  r.maxAlternatives = 1;
  const mine = () => rec === r;
  for (const name of ['start', 'soundstart', 'speechstart', 'speechend', 'soundend', 'audioend', 'nomatch']) {
    r['on' + name] = () => { if (mine() && current) current.onEvent(name); };
  }
  r.onaudiostart = () => {
    if (!mine() || !current) return;
    current.onEvent('audiostart');
    if (!current.over) current.onAudio();
  };
  r.onresult = e => {
    const s = mine() && current;
    if (!s || s.over) return;
    const finals = [], interim = [];
    for (let i = 0; i < e.results.length; i++) {
      const res = e.results[i];
      (res.isFinal ? finals : interim).push(res[0].transcript);
    }
    const text = joinResults([...finals, ...interim], cumulative);
    s.onEvent('result "' + text + '"' + (interim.length ? '' : ' (final)'));
    s.onText(text);
  };
  r.onerror = e => {
    if (!mine() || !current) return;
    current.onEvent('error ' + e.error);
    if (!current.over) current.onError(e.error);
  };
  r.onend = () => {
    if (!mine()) return;
    running = false;
    abortedAt = 0;
    const s = current;
    current = null;
    if (s) {
      s.onEvent('end');
      if (!s.over) { s.over = true; s.onEnd(); }
    }
    if (queued) { const q = queued; queued = null; begin(q); }
  };
  rec = r;
  return r;
}

function begin(s, tries = 0) {
  current = s;
  try {
    recognizer().start();
    running = true;
  } catch (e) {
    // Still winding down as far as the browser is concerned: try again shortly.
    s.onEvent('start threw ' + (e && e.name));
    current = null;
    if (tries < 5 && !s.over) setTimeout(() => { if (!s.over && !running) begin(s, tries + 1); }, 300);
    else if (!s.over) { s.over = true; s.onError('start-failed'); s.onEnd(); }
  }
}

// Starts one listening session and returns {stop, abort, audioEvents}.
//   onText(transcript): every interim and final result of this session
//   onError(code):      the SpeechRecognition error code ('no-speech', 'not-allowed', ...)
//   onEnd():            once, when the session is over (not after abort)
//   onAudio():          when the microphone is actually feeding it
//   onEvent(name):      every event the recognizer reports, for the voice log
// audioEvents is false where the browser doesn't report audio starting.
export function listen({onText, onError, onEnd, onAudio = () => {}, onEvent = () => {}}) {
  const s = {onText, onError, onEnd, onAudio, onEvent, over: false};
  if (running && abortedAt && Date.now() - abortedAt > DEAD_AFTER_ABORT_MS) {
    onEvent('recognizer never ended; using a new one');
    rec = null;
    running = false;
    current = null;
  }
  const r = recognizer();
  if (running) {
    // The last session is still going or ending: end it, start this one after.
    if (queued) queued.over = true;
    queued = s;
    if (current) current.over = true;
    if (!abortedAt) { abortedAt = Date.now(); try { r.abort(); } catch (e) { /* ending anyway */ } }
  } else {
    begin(s);
  }
  return {
    audioEvents: 'onaudiostart' in r,
    // Finish: the browser delivers its final words, then onEnd.
    stop() {
      if (queued === s) { queued = null; s.over = true; s.onEnd(); return; }
      if (current === s && running) { try { r.stop(); } catch (e) { r.onend(); } }
    },
    // Drop it: no more callbacks.
    abort() {
      s.over = true;
      if (queued === s) queued = null;
      if (current === s && running && !abortedAt) { abortedAt = Date.now(); try { r.abort(); } catch (e) { /* gone */ } }
    }
  };
}
