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

// Starts one listening session and returns {stop, abort}. A new recognizer every
// time: reusing one is what browsers (Safari especially) get wrong, and a tap
// that lands while the last session is still shutting down can't restart it.
// Throws if the browser won't start at all.
//   onText(transcript): every interim and final result of this session
//   onError(code):      the SpeechRecognition error code ('no-speech', 'not-allowed', ...)
//   onEnd():            once, when the session is over (not after abort)
//   onAudio():          when the microphone is actually feeding it
//   onEvent(name):      every event the recognizer reports, for the voice log
// The returned audioEvents is false where the browser doesn't report that.
export function listen({onText, onError, onEnd, onAudio = () => {}, onEvent = () => {}}) {
  const rec = new SR();
  rec.lang = 'en-US';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  let over = false;
  const end = () => { onEvent('end'); if (!over) { over = true; onEnd(); } };
  for (const name of ['start', 'soundstart', 'speechstart', 'speechend', 'soundend', 'audioend', 'nomatch']) {
    rec['on' + name] = () => onEvent(name);
  }
  rec.onresult = e => {
    if (over) return;
    const finals = [], interim = [];
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i];
      (r.isFinal ? finals : interim).push(r[0].transcript);
    }
    const text = joinResults([...finals, ...interim], cumulative);
    onEvent('result "' + text + '"' + (interim.length ? '' : ' (final)'));
    onText(text);
  };
  rec.onerror = e => { onEvent('error ' + e.error); if (!over) onError(e.error); };
  rec.onaudiostart = () => { onEvent('audiostart'); if (!over) onAudio(); };
  rec.onend = end;
  rec.start();
  return {
    audioEvents: 'onaudiostart' in rec,
    // Finish: the browser delivers its final words, then onEnd.
    stop() { try { rec.stop(); } catch (e) { end(); } },
    // Drop it: no more callbacks.
    abort() { over = true; try { rec.abort(); } catch (e) { /* already gone */ } }
  };
}
