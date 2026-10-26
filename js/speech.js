// speech.js: voice input, set up the way the working examples do it (MDN's Web
// Speech demo and the react-speech-recognition library): one recognizer for the
// page, continuous off (press to talk: the browser ends the session when the
// guard stops speaking), start() straight from the tap, stop() to finish.
// Nothing else touches the microphone: no getUserMedia, no abort(), no
// watchdogs. Those workarounds kept the iPhone's audio session churning, and
// recognition there went deaf (voice logs, 2026-10-26). The browser raises its
// own mic prompt on the first start().
// Not every browser has it (and iOS home-screen apps may refuse it), so the
// app checks speechSupported and falls back to the text box + keyboard dictation.

import {joinResults} from './fix.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const speechSupported = typeof SR === 'function';

// Chrome on Android repeats earlier words in each result; see joinResults.
const cumulative = /Android/i.test(navigator.userAgent);

let rec = null;
let handlers = null;    // the current session's callbacks
let running = false;    // between start() and 'end'

function recognizer() {
  if (rec) return rec;
  rec = new SR();
  rec.lang = 'en-US';
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  for (const name of ['start', 'audiostart', 'soundstart', 'speechstart', 'speechend', 'soundend', 'audioend', 'nomatch']) {
    rec['on' + name] = () => handlers && handlers.onEvent(name);
  }
  rec.onresult = e => {
    const finals = [], interim = [];
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i];
      (r.isFinal ? finals : interim).push(r[0].transcript);
    }
    const text = joinResults([...finals, ...interim], cumulative);
    handlers.onEvent('result "' + text + '"' + (interim.length ? '' : ' (final)'));
    handlers.onText(text);
  };
  rec.onerror = e => { handlers.onEvent('error ' + e.error); handlers.onError(e.error); };
  rec.onend = () => { running = false; handlers.onEvent('end'); handlers.onEnd(); };
  return rec;
}

// Start a listening session with these callbacks:
//   onText(transcript)  every interim and final result
//   onError(code)       'no-speech', 'not-allowed', 'network', ...
//   onEnd()             the session is over
//   onEvent(name)       everything the recognizer reports, for the voice log
// False if it couldn't start (most likely the last session is still finishing).
export function startListening(callbacks) {
  if (running) return false;
  handlers = callbacks;
  try {
    recognizer().start();
  } catch (e) {
    callbacks.onEvent('start threw ' + (e && e.name));
    return false;
  }
  running = true;
  return true;
}

// Finish: the browser hands over its last words, then 'end'.
export function stopListening() {
  if (rec && running) rec.stop();
}
