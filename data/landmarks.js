// Twenny landmarks: the "640 yd WSW of Imperial Beach Pier" line uses the
// nearest one of these.
//
// To fix a position: change lat/lon below (decimal degrees, west is negative),
// commit, and the next deploy picks it up. Order doesn't matter.
// A quick way to get a number: long-press the spot in Google Maps and copy
// the "32.xxxxx, -117.xxxxx" it shows.
//
// APPROXIMATE: entered from memory. Verify each one before trusting it at work.
// `npm test` checks every entry is near San Diego (catches a dropped minus sign).

export const LANDMARKS = [
  {name: 'Mission Beach (Belmont Park)', lat: 32.7708, lon: -117.2525},
  {name: 'Ocean Beach Pier', lat: 32.7493, lon: -117.2551},
  {name: 'Sunset Cliffs', lat: 32.7186, lon: -117.2557},
  {name: 'Ballast Point', lat: 32.6869, lon: -117.2333},
  {name: 'Point Loma Lighthouse', lat: 32.6654, lon: -117.2420},
  {name: 'Hotel del Coronado', lat: 32.6807, lon: -117.1785},
  {name: 'Silver Strand State Beach', lat: 32.6345, lon: -117.1431},
  {name: 'Imperial Beach Pier', lat: 32.5794, lon: -117.1339},
  {name: 'Tijuana River mouth', lat: 32.5520, lon: -117.1270},
  {name: 'Border Field', lat: 32.5343, lon: -117.1236}
];
