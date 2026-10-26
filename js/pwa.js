// pwa.js: registers the service worker and offers new versions.
// Nothing changes under the guard's feet: a new version (changed app files, or a
// changed sw.js) waits until they tap "New version, tap to refresh".

// onUpdate(apply) is called when a new version is ready; onVersion(text) with
// the short version id of what's running.
export function registerSW(onUpdate, onVersion) {
  if (!('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;
  let reloading = false;
  const reload = () => { if (!reloading) { reloading = true; location.reload(); } };

  sw.addEventListener('message', e => {
    if (e.data === 'update-ready') offer();
    else if (e.data === 'applied') reload();
    else if (e.data && e.data.version) onVersion(e.data.version);
  });
  // First visit: the worker takes over once it has saved the app; ask what it saved.
  sw.addEventListener('controllerchange', () => { if (sw.controller) sw.controller.postMessage('version'); });

  let reg = null;
  const offer = () => onUpdate(() => {
    if (reg && reg.waiting) {
      // New sw.js: let it take over, then reload into it.
      sw.addEventListener('controllerchange', reload);
      reg.waiting.postMessage('skipWaiting');
    } else if (sw.controller) {
      sw.controller.postMessage('apply'); // answered with 'applied'
    }
  });

  sw.register('./sw.js').then(r => {
    reg = r;
    // A waiting sw.js is only an update if there was a working version before it.
    const offerWaiting = () => { if (reg.waiting && reg.active) offer(); };
    offerWaiting();
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      if (worker) worker.addEventListener('statechange', () => { if (worker.state === 'installed') offerWaiting(); });
    });

    // Check now, when the app comes back to the foreground, and every 30 minutes
    // (a home-screen app can stay open for days).
    const check = () => {
      reg.update().catch(() => {});
      if (sw.controller) sw.controller.postMessage('check');
    };
    check();
    if (sw.controller) sw.controller.postMessage('version');
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    setInterval(check, 30 * 60 * 1000);
  }).catch(err => console.warn('Service worker registration failed', err));
}
