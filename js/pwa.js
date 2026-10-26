// pwa.js: registers the service worker and offers new versions.
// A new deploy installs as a *waiting* worker (sw.js never skips waiting on its
// own), so the old version keeps working until the guard taps the prompt.

export function registerSW(onUpdate) {
  if (!('serviceWorker' in navigator)) return;
  let wanted = false, reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Also fires on the very first install; only reload when the guard asked.
    if (wanted && !reloading) { reloading = true; location.reload(); }
  });
  navigator.serviceWorker.register('./sw.js').then(reg => {
    const offer = worker => onUpdate(() => { wanted = true; worker.postMessage('skipWaiting'); });
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(worker);
      });
    });
    // A home-screen app can stay open for days: look for updates when it comes back.
    const check = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    setInterval(check, 30 * 60 * 1000);
  }).catch(err => console.warn('Service worker registration failed', err));
}
