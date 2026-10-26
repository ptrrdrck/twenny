// speech.js: thin wrapper over the browser's speech recognition.
// Not every browser has it (and iOS home-screen apps may refuse it), so the
// app checks speechSupported and falls back to the text box + keyboard dictation.

import {joinResults} from './fix.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const speechSupported = typeof SR === 'function';

// Chrome on Android repeats earlier words in each result; see joinResults.
const cumulative = /Android/i.test(navigator.userAgent);

// Starts one listening session and returns {stop, abort}. A new recognizer every
// time: reusing one is what browsers (Safari especially) get wrong, and a tap
// that lands while the last session is still shutting down can't restart it.
// Throws if the browser won't start at all.
//   onText(transcript): every interim and final result of this session
//   onError(code):      the SpeechRecognition error code ('no-speech', 'not-allowed', ...)
//   onEnd():            once, when the session is over (not after abort)
export function listen({onText, onError, onEnd}) {
  const rec = new SR();
  rec.lang = 'en-US';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  let over = false;
  const end = () => { if (!over) { over = true; onEnd(); } };
  rec.onresult = e => {
    if (over) return;
    const finals = [], interim = [];
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i];
      (r.isFinal ? finals : interim).push(r[0].transcript);
    }
    onText(joinResults([...finals, ...interim], cumulative));
  };
  rec.onerror = e => { if (!over) onError(e.error); };
  rec.onend = end;
  rec.start();
  return {
    // Finish: the browser delivers its final words, then onEnd.
    stop() { try { rec.stop(); } catch (e) { end(); } },
    // Drop it: no more callbacks.
    abort() { over = true; try { rec.abort(); } catch (e) { /* already gone */ } }
  };
}
