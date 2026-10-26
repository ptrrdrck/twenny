// map.js: Leaflet map with OSM tiles, the fix pin, landmarks and "me".
// Leaflet is loaded as a classic script (vendor/leaflet) and read from window.L.
// Colors come from CSS classes so light/dark tokens apply.

const L = window.L;
const HOME = [32.64, -117.18];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const PIN_SVG = '<svg width="34" height="46" viewBox="0 0 34 46" aria-hidden="true">' +
  '<path class="pin-body" d="M17 1C8.2 1 1 8 1 16.7 1 28 17 45 17 45s16-17 16-28.3C33 8 25.8 1 17 1z"/>' +
  '<circle class="pin-eye" cx="17" cy="16.5" r="5.5"/></svg>';

export function createMap(el, landmarks) {
  const map = L.map(el, {
    zoomAnimation: !reduceMotion, fadeAnimation: !reduceMotion, markerZoomAnimation: !reduceMotion
  }).setView(HOME, 11);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
  }).addTo(map);
  map.attributionControl.setPrefix(false);

  for (const l of landmarks) {
    L.circleMarker([l.lat, l.lon], {radius: 5, className: 'lm-dot'}).bindTooltip(l.name).addTo(map);
  }

  const pinIcon = L.divIcon({className: 'pin', html: PIN_SVG, iconSize: [34, 46], iconAnchor: [17, 45]});
  let pin = null, line = null, meDot = null, meAcc = null;

  return {
    // near: nearest landmark ({lat, lon, d} in nm) or null; far: true when the fix looks wrong.
    showFix(fix, near, far) {
      const at = [fix.lat, fix.lon];
      if (!pin) pin = L.marker(at, {icon: pinIcon, keyboard: false, interactive: false, zIndexOffset: 1000}).addTo(map);
      else pin.setLatLng(at);
      if (line) { line.remove(); line = null; }
      let zoom = far ? 5 : 15;
      if (near && !far && near.d < 3) {
        line = L.polyline([[near.lat, near.lon], at], {className: 'lm-line', interactive: false}).addTo(map);
        // Zoom so the landmark fits with the fix still centered.
        const mirror = [2 * fix.lat - near.lat, 2 * fix.lon - near.lon];
        zoom = Math.max(12, Math.min(16, map.getBoundsZoom(L.latLngBounds([near.lat, near.lon], mirror), false, L.point(48, 48))));
      }
      map.setView(at, zoom, {animate: !reduceMotion});
    },
    clearFix() {
      if (pin) { pin.remove(); pin = null; }
      if (line) { line.remove(); line = null; }
    },
    showMe(me) {
      const at = [me.lat, me.lon];
      if (!meDot) {
        meAcc = L.circle(at, {radius: me.acc, className: 'me-acc', interactive: false}).addTo(map);
        meDot = L.circleMarker(at, {radius: 8, className: 'me-dot', interactive: false}).addTo(map);
      } else { meDot.setLatLng(at); meAcc.setLatLng(at).setRadius(me.acc); }
    },
    hideMe() {
      if (meDot) { meDot.remove(); meAcc.remove(); meDot = meAcc = null; }
    },
    resize: () => map.invalidateSize()
  };
}
