// Offline safety net: everything the page loads must be in the service worker's
// precache list, or Twenny breaks the first time a guard opens it without signal.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, posix} from 'node:path';
import {build} from '../scripts/build.mjs';

const out = mkdtempSync(join(tmpdir(), 'twenny-build-'));
const {version, assets} = build(out);
const read = f => readFileSync(join(out, f), 'utf8');
test.after(() => rmSync(out, {recursive: true, force: true}));

// Local references in one file, resolved relative to it.
function refs(file) {
  const src = read(file);
  const pats = file.endsWith('.html') ? [/(?:href|src)="([^"]+)"/g]
    : file.endsWith('.css') ? [/url\(([^)]+)\)/g]
    : file.endsWith('.webmanifest') ? [/"src":\s*"([^"]+)"/g]
    : [/(?:import|from)\s*['"]([^'"]+)['"]/g];
  const found = pats.flatMap(p => [...src.matchAll(p)].map(m => m[1].replace(/^["']|["']$/g, '')));
  return found
    .filter(u => !/^(https?:|data:|#|mailto:)/.test(u))
    .map(u => posix.normalize(posix.join(posix.dirname(file), u)));
}

test('version is stamped', () => {
  assert.match(version, /^[0-9a-f]{10}$/);
  assert.match(read('sw.js'), new RegExp(`const VERSION = '${version}';`));
  assert.match(read('index.html'), new RegExp(`data-version="${version}"`));
  assert.equal(build(out).version, version, 'same files give the same version');
});

test('every local file the app loads is precached', () => {
  const cached = new Set(assets);
  const pending = ['index.html'], seen = new Set();
  while (pending.length) {
    const f = pending.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    if (f !== 'index.html') assert.ok(cached.has(f), `${f} is loaded but not precached`);
    if (/\.(html|css|js|webmanifest)$/.test(f) && f !== 'vendor/leaflet/leaflet.js' && f !== 'vendor/leaflet/leaflet.css') pending.push(...refs(f));
  }
  for (const must of ['./', 'index.html', 'js/app.js', 'data/landmarks.js', 'css/theme.css', 'vendor/leaflet/leaflet.js']) {
    assert.ok(cached.has(must), must);
  }
  assert.ok(!cached.has('sw.js'));
});
