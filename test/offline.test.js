// Offline safety net: everything the page loads must be in sw.js's ASSETS list,
// or Twenny breaks the first time a guard opens it without signal.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync, readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Script} from 'node:vm';
import {posix} from 'node:path';

const ROOT = new URL('..', import.meta.url);
const read = f => readFileSync(new URL(f, ROOT), 'utf8');
const sw = read('sw.js');
const ASSETS = new Function('return ' + sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1])();

// Local files referenced by one file, resolved relative to it.
function refs(file) {
  const src = read(file);
  const pat = file.endsWith('.html') ? /(?:href|src)="([^"]+)"/g
    : file.endsWith('.css') ? /url\(([^)]+)\)/g
    : file.endsWith('.webmanifest') ? /"src":\s*"([^"]+)"/g
    : /(?:import|from)\s*['"]([^'"]+)['"]/g;
  return [...src.matchAll(pat)].map(m => m[1].replace(/^["']|["']$/g, ''))
    .filter(u => !/^(https?:|data:|#|mailto:)/.test(u))
    .map(u => posix.normalize(posix.join(posix.dirname(file), u)));
}

test('sw.js compiles', () => {
  // A syntax error in sw.js silently kills offline mode.
  assert.doesNotThrow(() => new Script(sw, {filename: 'sw.js'}));
});

test('every ASSETS entry exists', () => {
  for (const f of ASSETS) if (f !== './') assert.ok(existsSync(new URL(f, ROOT)), `${f} is in ASSETS but missing`);
  assert.ok(ASSETS.includes('./') && ASSETS.includes('index.html'));
});

test('every local file the app loads is in ASSETS', () => {
  const cached = new Set(ASSETS);
  const pending = ['index.html'], seen = new Set();
  while (pending.length) {
    const f = pending.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    assert.ok(cached.has(f), `${f} is loaded by the app but not in sw.js ASSETS`);
    if (/\.(html|css|js|webmanifest)$/.test(f) && !f.startsWith('vendor/')) pending.push(...refs(f));
  }
  assert.ok(seen.has('data/landmarks.js') && seen.has('fonts/archivo-latin-wght-normal.woff2'), 'crawl reached imports and fonts');
});

test('Pages serves files as-is', () => {
  // Without .nojekyll, GitHub Pages runs Jekyll over the repo first.
  assert.ok(existsSync(new URL('.nojekyll', ROOT)));
});

test('every app script parses', () => {
  // The app's own modules aren't all unit-tested; a syntax error in one
  // (a duplicate declaration, say) would still break the whole page.
  for (const f of readdirSync(new URL('js/', ROOT)).filter(f => f.endsWith('.js'))) {
    const r = spawnSync(process.execPath, ['--check', fileURLToPath(new URL('js/' + f, ROOT))], {encoding: 'utf8'});
    assert.equal(r.status, 0, `js/${f}: ${r.stderr}`);
  }
});
