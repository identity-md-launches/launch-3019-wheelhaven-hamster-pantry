// Use an external TypeScript install; the dependency-free game's manifest stays unchanged.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const compiler = process.argv[2];
const args = ['--allowJs', '--checkJs', '--noEmit', '--target', 'ES2022', '--module', 'ESNext',
  '--lib', 'ES2022,DOM,DOM.Iterable', ...readdirSync(new URL('../dist/', import.meta.url)).filter(f => f.endsWith('.mjs')).map(f => `dist/${f}`)];
const result = spawnSync(compiler ? process.execPath : 'tsc', compiler ? [compiler, ...args] : args, { cwd: root, stdio: 'inherit' });
if (result.error) {
  console.error('Install TypeScript outside the project and pass its lib/tsc.js path to this script.');
  process.exit(1);
}
process.exit(result.status ?? 1);
