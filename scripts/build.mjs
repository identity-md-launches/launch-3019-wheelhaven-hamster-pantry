// The production source is already native JavaScript in dist/. Validate it and rebuild its ZIP.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} failed`);
}
function asset(reference) {
  if (/^(?:https?:|data:|#)/.test(reference)) return;
  assert.ok(reference.startsWith('./'), `Static asset must be relative: ${reference}`);
  if (reference === './') reference = './index.html';
  const file = path.resolve(dist, reference);
  assert.ok(file.startsWith(dist + path.sep) && statSync(file).isFile(), `Missing asset: ${reference}`);
}
for (const file of readdirSync(dist).filter(file => file.endsWith('.mjs'))) {
  run(process.execPath, ['--check', path.join(dist, file)]);
  for (const [, reference] of readFileSync(path.join(dist, file), 'utf8').matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) asset(reference);
}
const html = readFileSync(path.join(dist, 'index.html'), 'utf8');
for (const [, reference] of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) asset(reference);
for (const field of ['<title>', 'rel="icon"', 'name="description"', 'property="og:title"', 'property="og:image"']) {
  assert.ok(html.includes(field), `Missing share metadata: ${field}`);
}
assert.ok(statSync(path.join(dist, 'og-image.png')).size > 0);
run('python3', ['scripts/source-archive.py']);
console.log('Production export checked: native modules, relative assets, share metadata, complete source download.');
