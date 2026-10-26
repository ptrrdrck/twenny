// speech.js: thin wrapper over the browser's speech recognition.
// Not every browser has it (and iOS home-screen apps may refuse it), so the
// app checks speechSupported and falls back to the text box + keyboard dictation.

import {joinResults} from './fix.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const speechSupported = typeof SR === 'function';

// Chrome on Android repeats earlier words in each result; see joinResults.
const cumulative = /Android/i.test(navigator.userAgent);

// onText(transcript) fires on every interim and final result.
// onEnd() fires once when listening stops for any reason.
// onError(code) gets the SpeechRecognition error code ('not-allowed', 'network', ...).
export function createListener({onText, onEnd, onError}) {
  const rec = new SR();
  rec.lang = 'en-US';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  rec.onresult = e => {
    const finals = [], interim = [];
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i];
      (r.isFinal ? finals : interim).push(r[0].transcript);
    }
    onText(joinResults([...finals, ...interim], cumulative));
  };
  rec.onerror = e => onError(e.error);
  rec.onend = () => onEnd();
  return {
    start() { rec.start(); },
    stop() { try { rec.stop(); } catch (e) { onEnd(); } }
  };
}
