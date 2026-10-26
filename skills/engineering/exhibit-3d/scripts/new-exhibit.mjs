#!/usr/bin/env node
// new-exhibit.mjs: scaffold a new exhibit from the skill's template.
//
//   node new-exhibit.mjs <dir> --id <slug> [--install]
//
// Copies templates/exhibit/, vendors kit/ into src/kit/, writes package.json pinned to the newest
// `three` (and the newest @types/three for that release), and prints the next steps. The sample
// inside (a glass slab) is a working exhibit to replace, not to keep. Files already in <dir> are
// never overwritten, so an EXHIBIT.md and src/model/ written first (workflow steps 1 and 2) stay.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const skill = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const positional = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--id');
const idIndex = argv.indexOf('--id');
const target = positional[0];
if (!target) {
  console.log('usage: node new-exhibit.mjs <dir> --id <slug> [--install]');
  process.exit(2);
}
const dir = resolve(target);
const slug = (idIndex >= 0 ? argv[idIndex + 1] : basename(dir)).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');

// Versions the kit was last verified with; `three` and its types move to the newest release.
const TESTED = {
  three: '0.186.1',
  '@types/three': '0.186.0',
  '@fontsource-variable/outfit': '5.3.0',
  '@fontsource/dm-mono': '5.3.0',
  typescript: '7.0.2',
  vite: '8.3.4',
  'vite-plugin-singlefile': '2.3.3',
  vitest: '5.0.3',
  playwright: '1.64.0',
};

function npmView(args) {
  try {
    return execFileSync('npm', ['view', ...args], { stdio: ['ignore', 'pipe', 'ignore'], timeout: 30_000 }).toString().trim();
  } catch {
    return '';
  }
}

const three = npmView(['three', 'version']) || TESTED.three;
let types = TESTED['@types/three'];
try {
  const all = JSON.parse(npmView(['@types/three', 'versions', '--json']) || '[]');
  const minor = three.split('.').slice(0, 2).join('.');
  const same = all.filter((v) => v.startsWith(`${minor}.`));
  if (same.length) types = same[same.length - 1];
} catch { /* keep the tested types */ }

const kept = [];
function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    if (name === '.DS_Store' || name === 'node_modules' || name === 'dist') continue;
    const src = join(from, name);
    const dst = join(to, name);
    if (statSync(src).isDirectory()) copyTree(src, dst);
    else if (existsSync(dst)) kept.push(relative(dir, dst));
    else copyFileSync(src, dst);
  }
}
copyTree(join(skill, 'templates', 'exhibit'), dir);
copyTree(join(skill, 'kit'), join(dir, 'src', 'kit'));

const pkg = {
  name: slug,
  private: true,
  version: '0.1.0',
  type: 'module',
  scripts: {
    dev: 'vite',
    build: 'vite build',
    'build:single': 'vite build --mode single',
    typecheck: 'tsc --noEmit',
    test: 'vitest run',
    capture: 'node $HOME/.claude/skills/exhibit-3d/scripts/capture.mjs http://localhost:5173/ --out qa',
  },
  dependencies: {
    three,
    '@fontsource-variable/outfit': TESTED['@fontsource-variable/outfit'],
    '@fontsource/dm-mono': TESTED['@fontsource/dm-mono'],
  },
  devDependencies: {
    '@types/three': types,
    playwright: TESTED.playwright,
    typescript: TESTED.typescript,
    vite: TESTED.vite,
    'vite-plugin-singlefile': TESTED['vite-plugin-singlefile'],
    vitest: TESTED.vitest,
  },
};
if (existsSync(join(dir, 'package.json'))) kept.push('package.json');
else writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');

// Give the sample the new id so captures and the page title don't claim the template's name.
const schemaPath = join(dir, 'src', 'hud', 'schema.ts');
writeFileSync(schemaPath, readFileSync(schemaPath, 'utf8').replace("id: 'glass-slab'", `id: '${slug}'`));

const kitVersion = /KIT_VERSION = '([^']+)'/.exec(readFileSync(join(dir, 'src', 'kit', 'index.ts'), 'utf8'))?.[1] ?? '?';
console.log(`new-exhibit: ${dir}`);
console.log(`  id ${slug} · kit ${kitVersion} · three ${three} · @types/three ${types}`);
if (kept.length) console.log(`  kept your existing ${kept.length} file(s): ${kept.slice(0, 8).join(', ')}${kept.length > 8 ? ', …' : ''}`);

if (argv.includes('--install')) {
  const r = spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: dir, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log(`
Next steps
  1. cd ${dir}${argv.includes('--install') ? '' : '\n     npm install'}
  2. Write EXHIBIT.md for your topic (references/exhibit-design.md §14), then replace the sample:
     src/model/ (model + invariant tests), src/scene/, src/hud/schema.ts, src/main.ts
  3. npm test && npm run typecheck
  4. npm run dev   (http://localhost:5173/; add ?tune for the lookdev panel)
  5. npm run capture   (qa/ shots, metrics.json, contact-sheet.html)
`);
