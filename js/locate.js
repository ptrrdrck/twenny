// locate.js: permission plumbing for "Use my location".
// The location request itself runs straight from the tap, so the browser shows
// its own prompt (as it does for the mic). Once location is blocked, though, a
// page can't ask again: the guard has to allow it in settings, so blockedHelp()
// says exactly where, for the phone in hand. Tested in test/locate.test.js.

// 'granted' | 'prompt' | 'denied', or 'unknown' where the browser can't say.
export async function permissionState() {
  try { return (await navigator.permissions.query({name: 'geolocation'})).state; } catch (e) { return 'unknown'; }
}

// cb(state) whenever the guard changes the permission (e.g. in Settings).
export async function onPermissionChange(cb) {
  try {
    const p = await navigator.permissions.query({name: 'geolocation'});
    p.addEventListener('change', () => cb(p.state));
  } catch (e) { /* no Permissions API: "Try again" still works */ }
}

export function platform({ua, touchPoints = 0}) {
  // iPadOS reports a Mac user agent; a touch screen gives it away.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

// What to do when location is blocked. standalone: opened from the home screen.
export function blockedHelp({ua, touchPoints, standalone}) {
  const p = platform({ua, touchPoints});
  if (p === 'ios') {
    return standalone
      ? 'Location is blocked for Twenny. On the iPhone open Settings → Privacy & Security → Location Services, check it’s on, and set Safari Websites to “While Using the App”. Then come back and tap Try again.'
      : 'Location is blocked for this site. In Safari tap aA (left of the address) → Website Settings → Location → Allow. If that’s already set, open Settings → Privacy & Security → Location Services and set Safari Websites to “While Using the App”. Then tap Try again.';
  }
  if (p === 'android') {
    return standalone
      ? 'Location is blocked for Twenny. Long-press the Twenny icon → App info → Permissions → Location → Allow, and check the phone’s Location is on. Then tap Try again.'
      : 'Location is blocked for this site. Tap the icon left of the web address → Permissions → Location → Allow, and check the phone’s Location is on. Then tap Try again.';
  }
  return 'Location is blocked for this site. Allow it in the browser’s site settings (usually the icon left of the web address), then tap Try again.';
}

export function unavailableHelp({ua, touchPoints}) {
  return platform({ua, touchPoints}) === 'ios'
    ? 'The phone can’t give a position. Check Settings → Privacy & Security → Location Services is on, then tap Try again.'
    : 'The phone can’t give a position. Check that Location is turned on, then tap Try again.';
}
