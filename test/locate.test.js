import {test} from 'node:test';
import assert from 'node:assert/strict';
import {platform, blockedHelp, unavailableHelp} from '../js/locate.js';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

test('platform', () => {
  assert.equal(platform({ua: IPHONE}), 'ios');
  assert.equal(platform({ua: IPAD, touchPoints: 5}), 'ios', 'iPadOS says Macintosh');
  assert.equal(platform({ua: IPAD, touchPoints: 0}), 'other', 'a real Mac');
  assert.equal(platform({ua: ANDROID}), 'android');
});

test('blocked help names the right settings', () => {
  assert.match(blockedHelp({ua: IPHONE, standalone: false}), /aA .*Website Settings → Location → Allow/);
  assert.match(blockedHelp({ua: IPHONE, standalone: true}), /Safari Websites to “While Using the App”/);
  assert.match(blockedHelp({ua: ANDROID, standalone: true}), /Long-press the Twenny icon/);
  assert.match(blockedHelp({ua: ANDROID, standalone: false}), /left of the web address/);
  for (const ua of [IPHONE, ANDROID, IPAD]) assert.match(blockedHelp({ua, standalone: false}), /Try again\.$/);
});

test('unavailable help', () => {
  assert.match(unavailableHelp({ua: IPHONE}), /Location Services is on/);
  assert.match(unavailableHelp({ua: ANDROID}), /Location is turned on/);
});
