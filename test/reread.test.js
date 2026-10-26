import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reread} from '../js/reread.js';

const TOL = 5e-6;
const near = (r, lat, lon) => r && Math.abs(r.lat - lat) < TOL && Math.abs(r.lon - lon) < TOL;

// Transcripts with no direction between the two coordinates, slipped the way
// speech-to-text slips. Each should come back as 32 34.5 N 117 08.4 W.
const SLIPS = [
  ['one number written as two', '32 34.5 1 17 8.4'],
  ['decimal ran into the next number', '32 34.5117 8.4'],
  ['digits read one at a time', '3 2 3 4.5 1 1 7 0 8.4'],
  ['no break, both packed', '3234.5117 8.4'],
];

// Reported on the phone: "32 39.613" then "117 08.168", run together.
test('reread: minutes run into the longitude, no space', () => {
  assert.ok(near(reread('32 3911708'), 32.65, -117 - 8 / 60));
  assert.ok(near(reread('32 39.61311708'), 32 + 39.613 / 60, -117 - 8 / 60));
});
for (const [what, text] of SLIPS) {
  test(`reread: ${what}: ${text}`, () => {
    const r = reread(text);
    assert.ok(near(r, 32.575, -117.14), JSON.stringify(r));
  });
}

test('reread says how many changes it made', () => {
  assert.equal(reread('32 34.5 1 17 8.4').changes, 1);
});

test('reread gives up rather than guess far away or with half a fix', () => {
  assert.equal(reread('32 34.5'), null, 'only the latitude was said');
  assert.equal(reread('hello'), null);
  assert.equal(reread(''), null);
  assert.equal(reread('45 10 120 5'), null, 'nothing near San Diego');
});

test('reread respects spoken directions', () => {
  const r = reread('32 34.5 north 1 17 8.4 west');
  assert.ok(near(r, 32.575, -117.14), JSON.stringify(r));
});
