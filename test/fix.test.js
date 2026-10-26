import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nearest, fromYou, relTo, farWarning, formats, copyText, mapLinks, joinResults, addRecent} from '../js/fix.js';

const PIER = {lat: 32.5794, lon: -117.1339};

test('landmark line', () => {
  const fix = {lat: 32.577385, lon: -117.139674}; // 640 yd WSW of the pier
  const n = nearest(fix);
  assert.equal(n.name, 'Imperial Beach Pier');
  assert.equal(n.line, '640 yd WSW of Imperial Beach Pier');
  assert.equal(relTo(PIER, PIER, 'Imperial Beach Pier'), 'At Imperial Beach Pier');
});

test('line from you', () => {
  assert.equal(fromYou({lat: 32.58, lon: -117.13}, PIER), '410 yd W of you');
});

test('no warning for local fixes', () => {
  assert.equal(farWarning({lat: 32.62, lon: -117.15}), null);
  assert.equal(farWarning({lat: 32.66, lon: -117.40}), null); // ~9 nm off Point Loma
});

test('far warning names the likely mistake', () => {
  assert.match(farWarning({lat: -32.58, lon: -117.14}), /^3,909 nm .*came out south\. Did they say north\?$/);
  assert.match(farWarning({lat: 32.58, lon: 117.14}), /came out east\. Did they say west\?$/);
  assert.match(farWarning({lat: -32.58, lon: 117.14}), /south and east/);
  assert.match(farWarning({lat: 33.58, lon: -117.14}), /^49 nm .*Check the numbers\.$/);
});

test('three formats, copy text and map links', () => {
  const fix = {lat: 32.6795, lon: -117.184};
  assert.deepEqual(formats(fix), {
    ddm: '32° 40.770′ N  117° 11.040′ W',
    dms: '32° 40′ 46.2″ N  117° 11′ 02.4″ W',
    dd: '32.67950, -117.18400'
  });
  assert.equal(copyText(fix), '32° 40.770′ N 117° 11.040′ W (32.67950, -117.18400)');
  const l = mapLinks(fix);
  assert.equal(l.apple, 'https://maps.apple.com/?ll=32.679500,-117.184000&q=Twenny%20fix');
  assert.equal(l.google, 'https://www.google.com/maps/search/?api=1&query=32.679500,-117.184000');
});

test('joinResults appends normal speech results', () => {
  assert.equal(joinResults(['32 34.5 north', ' 117 8.4 west']), '32 34.5 north 117 8.4 west');
  // A repeated number is real speech unless results are cumulative.
  assert.equal(joinResults(['32', '32 10 north']), '32 32 10 north');
  assert.equal(joinResults(['', '  ']), '');
});

test('joinResults collapses Android cumulative results', () => {
  assert.equal(joinResults(['32', '32 40', '32 40.5 north'], true), '32 40.5 north');
  assert.equal(joinResults(['32 40.5 north', '117 10 west'], true), '32 40.5 north 117 10 west');
  assert.equal(joinResults(['32 40.5 north', 'north'], true), '32 40.5 north');
});

test('addRecent keeps newest first, skips repeats, caps length', () => {
  const a = {lat: 32.6, lon: -117.1, t: 1}, b = {lat: 32.7, lon: -117.2, t: 2};
  assert.deepEqual(addRecent([], a), [a]);
  assert.deepEqual(addRecent([a], b), [b, a]);
  const again = {...b, t: 3};
  assert.deepEqual(addRecent([b, a], again), [again, a]);
  const many = Array.from({length: 30}, (_, i) => ({lat: 32 + i / 100, lon: -117, t: i}));
  assert.equal(many.reduce((l, e) => addRecent(l, e, 25), []).length, 25);
});
