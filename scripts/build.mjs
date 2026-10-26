// Builds the deployable site into _site/ (or the folder given as the first argument).
// Copies the site files, then stamps a content-hash version and the precache list
// into sw.js and the version into index.html. Same files in = same version out,
// so guards only see "New version" when something actually changed.
import {readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, rmSync, cpSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// Everything the app needs at runtime. Add new top-level files or folders here.
export const SITE = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'data', 'fonts', 'vendor', 'icons'];

const walk = p => statSync(join(ROOT, p)).isDirectory()
  ? readdirSync(join(ROOT, p)).flatMap(f => walk(join(p, f)))
  : [p];

export function build(out = join(ROOT, '_site')) {
  const files = SITE.flatMap(walk).map(f => f.split('\\').join('/')).sort();
  const hash = createHash('sha256');
  for (const f of files) hash.update(f + '\0').update(readFileSync(join(ROOT, f)));
  const version = hash.digest('hex').slice(0, 10);

  rmSync(out, {recursive: true, force: true});
  mkdirSync(out, {recursive: true});
  for (const p of SITE) cpSync(join(ROOT, p), join(out, p), {recursive: true});

  const assets = ['./', ...files.filter(f => f !== 'sw.js')];
  const stamp = (file, from, to) => {
    const path = join(out, file), src = readFileSync(path, 'utf8');
    if (!src.includes(from)) throw new Error(`build: "${from}" not found in ${file}`);
    writeFileSync(path, src.replace(from, to));
  };
  stamp('sw.js', "const VERSION = 'dev';", `const VERSION = '${version}';`);
  stamp('sw.js', "const ASSETS = ['./'];", `const ASSETS = ${JSON.stringify(assets)};`);
  stamp('index.html', '__TWENNY_VERSION__', version);
  return {version, assets, out};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const {version, assets, out} = build(process.argv[2] ? resolve(process.argv[2]) : undefined);
  console.log(`Built ${relative(process.cwd(), out) || out}: version ${version}, ${assets.length} cached files`);
}
