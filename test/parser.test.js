// Parser and geo-helper tests. Run with `npm test` (node --test, no dependencies).
// The CASES table is the prototype's known-good list; add a row whenever a new
// way of saying a fix turns up on the radio.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFix, tokenize, distNm, bearing, compass, fmtDist, nearestLandmarks, toDDM, toDMS, LANDMARKS
} from '../twenny-core.js';

const TOL = 5e-6; // degrees, about half a metre

const CASES = [
  ['32 degrees 34.5 minutes north 117 degrees 8.4 minutes west', 32.575, -117.14],
  ['32.6795, -117.1840', 32.6795, -117.184],
  ['32°39\'10"N 117°15\'05"W', 32.652778, -117.251389],
  ['thirty two thirty seven point two, one seventeen oh nine point one', 32.62, -117.151667],
  ['N 32 40.77 W 117 11.04', 32.6795, -117.184],
  ['32 40 52 117 10 44', 32.681111, -117.178889],
  ['latitude 32.68 longitude -117.18', 32.68, -117.18],
  ['117.18 W 32.68 N', 32.68, -117.18],
  ['32.68 117.18', 32.68, -117.18],
  ['32-40.5N 117-08.4W', 32.675, -117.14],
  ['32° 34.500′ N   117° 08.400′ W', 32.575, -117.14],
  ['thirty two degrees forty minutes fifty two seconds north one hundred seventeen degrees ten minutes forty four seconds west', 32.681111, -117.178889],
  ['32 34 point 7 6 north 117 8 point 0 3 west', 32.579333, -117.133833],
  ['32 41.7 1:17 10.5', 32.695, -117.175]
];

for (const [text, lat, lon] of CASES) {
  test(`parses: ${text}`, () => {
    const r = parseFix(text);
    assert.equal(r.state, 'ok', JSON.stringify(r));
    assert.ok(Math.abs(r.lat - lat) < TOL, `lat ${r.lat} != ${lat}`);
    assert.ok(Math.abs(r.lon - lon) < TOL, `lon ${r.lon} != ${lon}`);
  });
}

test('reports the format that was used', () => {
  assert.equal(parseFix('32.6795, -117.1840').fmt, 'Decimal degrees');
  assert.equal(parseFix('N 32 40.77 W 117 11.04').fmt, 'Degrees, decimal minutes');
  assert.equal(parseFix('32 40 52 117 10 44').fmt, 'Degrees, minutes, seconds');
});

test('one coordinate is partial', () => {
  assert.deepEqual(parseFix('32 40.5 north'), {state: 'partial', msg: 'Heard the latitude. Keep going with the longitude.'});
  assert.deepEqual(parseFix('117 10 west'), {state: 'partial', msg: 'Heard the longitude. Now say the latitude.'});
});

test('no numbers is empty', () => {
  assert.deepEqual(parseFix(''), {state: 'empty'});
  assert.deepEqual(parseFix('hello'), {state: 'empty'});
});

test('assume north and west', () => {
  const on = parseFix('32.68 117.18', true);
  assert.equal(on.lon, -117.18);
  assert.deepEqual(on.notes, ['Assumed west']);
  const off = parseFix('32.68 117.18', false);
  assert.equal(off.lon, 117.18);
  assert.deepEqual(off.notes, []);
  // A spoken direction always wins over the assumption.
  assert.equal(parseFix('32.68 N 117.18 E', true).lon, 117.18);
  assert.equal(parseFix('-32.68, -117.18', true).lat, -32.68);
});

test('errors', () => {
  assert.equal(parseFix('32 north 33 north').msg, 'Heard two latitudes. Check the directions.');
  assert.equal(parseFix('32 40 north 117 10 west 33 north').msg, 'Heard more than two coordinates. Clear the box and say it again.');
  for (const s of ['32 61 117 10', 'one two three four five six seven eight']) assert.equal(parseFix(s).state, 'error', s);
});

test('tokenize reads spoken numbers', () => {
  const nums = tokenize('one seventeen oh nine point one').filter(t => t.t === 'num').map(t => t.v);
  assert.deepEqual(nums, [117, 9.1]);
});

test('distance and bearing', () => {
  const pier = {lat: 32.5794, lon: -117.1339}, west = {lat: 32.5794, lon: -117.14};
  assert.ok(Math.abs(distNm(pier, west) - 0.30862) < 1e-4);
  assert.ok(Math.abs(bearing(pier, west) - 270) < 0.01);
  assert.equal(compass(bearing(pier, west)), 'W');
  assert.equal(compass(0), 'N');
  assert.equal(compass(359), 'N');
  assert.equal(compass(11.26), 'NNE');
  assert.equal(compass(247.5), 'WSW');
});

test('fmtDist uses yards close in, nautical miles further out', () => {
  assert.equal(fmtDist(0.3), '610 yd');
  assert.equal(fmtDist(3.456), '3.5 nm');
  assert.equal(fmtDist(12.6), '13 nm');
});

test('DDM and DMS output', () => {
  assert.equal(toDDM(32.6795, true), '32° 40.770′ N');
  assert.equal(toDDM(-117.184, false), '117° 11.040′ W');
  assert.equal(toDMS(32.681111, true), '32° 40′ 52.0″ N');
  assert.equal(toDMS(-117.178889, false), '117° 10′ 44.0″ W');
  assert.equal(toDDM(32.99999999, true), '33° 00.000′ N');
  assert.equal(toDMS(32.9999999, true), '33° 00′ 00.0″ N');
});

test('nearest landmark', () => {
  const [first] = nearestLandmarks({lat: 32.575, lon: -117.14});
  assert.equal(first.name, 'Imperial Beach Pier');
  assert.ok(Math.abs(first.d - 0.40625) < 1e-4);
  assert.ok(LANDMARKS.length >= 10);
});
