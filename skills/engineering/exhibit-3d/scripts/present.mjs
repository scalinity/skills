#!/usr/bin/env node
// present.mjs: puts "<Exhibit Name>.app" at an exhibit's root and opens it, named from index.html's
// <title> before its " · " (Induction bench · Why the magnet must move → Induction Bench.app). The app is a Mac window with
// no title bar and no window buttons, so the scene fills it. It keeps the native rounded corners and
// edge resizing; drag it by its top edge, double-click there to zoom it to the screen, Cmd+M minimizes,
// Cmd+H hides, Cmd+Q quits. Opening the app starts the exhibit's dev server (or reuses one already
// answering on the port); quitting it stops the server it started.
//
//   node present.mjs <exhibit dir> [--port 5173]
//
// The viewer (Tauri 2, ../viewer) is built once into ~/Library/Caches/exhibit-viewer, and rebuilt only
// when its source changes: a few minutes, since the build folder is deleted afterwards so that only the
// ~13 MB app is kept. It draws with the Mac's own WebKit, not Chrome: it is for presenting, and every
// check (capture.mjs, the rubric) still runs in Chrome.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const portAt = args.indexOf('--port');
const port = portAt >= 0 ? Number(args[portAt + 1]) : 5173;
const dirArg = args.find((a, i) => !a.startsWith('--') && i !== portAt + 1);
if (!dirArg || !Number.isInteger(port)) {
  console.error('usage: node present.mjs <exhibit dir> [--port 5173]');
  process.exit(1);
}
const project = resolve(dirArg);
if (!existsSync(join(project, 'node_modules/.bin/vite'))) {
  console.error(`present: no node_modules/.bin/vite in ${project}; run npm install there first`);
  process.exit(1);
}

const src = resolve(dirname(fileURLToPath(import.meta.url)), '../viewer');
const cache = join(homedir(), 'Library/Caches/exhibit-viewer');
const built = join(cache, 'Exhibit Viewer.app');

/** Every file under the viewer's source, in a stable order: the hash decides when to rebuild. */
const files = (dir) => readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
  .flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name === '.DS_Store' ? [] : [join(dir, e.name)]));
const hash = createHash('sha256');
for (const f of files(src)) hash.update(relative(src, f)).update('\0').update(readFileSync(f)).update('\0');
const sourceHash = hash.digest('hex');
const hashOf = (app) => {
  const f = join(app, 'Contents/Resources/source.sha256');
  return existsSync(f) ? readFileSync(f, 'utf8').trim() : '';
};

if (hashOf(built) !== sourceHash) {
  console.log('present: building the viewer; this takes a few minutes');
  const work = join(cache, 'source');
  const target = join(cache, 'target');
  const set = join(cache, 'icon.iconset');
  // Build a copy, so the build's generated files stay out of the skill's folder.
  rmSync(work, { recursive: true, force: true });
  cpSync(src, work, { recursive: true });
  execFileSync('cargo', ['build', '--release', '--manifest-path', join(work, 'Cargo.toml')], {
    stdio: 'inherit', env: { ...process.env, CARGO_TARGET_DIR: target },
  });
  rmSync(built, { recursive: true, force: true });
  mkdirSync(join(built, 'Contents/MacOS'), { recursive: true });
  mkdirSync(join(built, 'Contents/Resources'), { recursive: true });
  // The Dock icon: an .icns made from the viewer's 512 px icon.
  mkdirSync(set, { recursive: true });
  for (const s of [16, 32, 128, 256, 512]) {
    for (const [scale, file] of [[1, `icon_${s}x${s}.png`], [2, `icon_${s}x${s}@2x.png`]]) {
      if (s * scale > 512) continue;
      execFileSync('sips', ['-z', String(s * scale), String(s * scale), join(src, 'icons/icon.png'), '--out', join(set, file)], { stdio: 'ignore' });
    }
  }
  execFileSync('iconutil', ['-c', 'icns', set, '-o', join(built, 'Contents/Resources/icon.icns')]);
  copyFileSync(join(target, 'release/exhibit-viewer'), join(built, 'Contents/MacOS/exhibit-viewer'));
  writeFileSync(join(built, 'Contents/Resources/source.sha256'), `${sourceHash}\n`);
  // Only the app is kept: the build folder alone is close to 900 MB.
  for (const d of [work, target, set]) rmSync(d, { recursive: true, force: true });
}

// The app takes the exhibit's own name: its title before " · ", each word capitalized; the folder's
// name when the page has no title.
const title = (readFileSync(join(project, 'index.html'), 'utf8').match(/<title>([^<]*)<\/title>/)?.[1] ?? '')
  .split(' · ')[0].trim() || basename(project);
const name = title.replace(/[/:]/g, '-').replace(/(^|\s)\S/g, (c) => c.toUpperCase());
// The binary takes the name too, so Activity Monitor, Force Quit and the app menu say it as well.
const exe = name.replace(/["$`\\]/g, '');
const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'exhibit';
const PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>${name.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</string>
  <key>CFBundleIdentifier</key><string>local.exhibit-viewer.${slug}</string>
  <key>CFBundleExecutable</key><string>launch</string>
  <key>CFBundleIconFile</key><string>icon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>0.1.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
  <key>LSMinimumSystemVersion</key><string>26.0</string>
</dict>
</plist>
`;
// The bundle's executable. Finder starts apps with a bare PATH and / as the working folder, so it sets
// both itself; the project is the folder the app sits in, wherever it is moved with it.
const LAUNCH = `#!/bin/zsh
# Starts the exhibit's dev server, opens the viewer on it, and stops the server when the viewer quits.
# The project is the folder this app sits in.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
here="\${0:A:h}"
project="\${here:h:h:h}"
port=${port}
cd "$project"
# Reuse a server that is already running on the port; otherwise start one and own it.
if ! curl -s -o /dev/null "http://localhost:$port/"; then
  ./node_modules/.bin/vite --port $port --strictPort > "\${TMPDIR:-/tmp}/${slug}-server.log" 2>&1 &
  server=$!
  trap 'kill $server 2>/dev/null' EXIT
  for i in {1..100}; do curl -s -o /dev/null "http://localhost:$port/" && break; sleep 0.1; done
fi
"$here/${exe}" "http://localhost:$port/"
`;

const app = join(project, `${name}.app`);
const launchFile = join(app, 'Contents/MacOS/launch');
const plistFile = join(app, 'Contents/Info.plist');
const current = hashOf(app) === sourceHash && existsSync(launchFile) && readFileSync(launchFile, 'utf8') === LAUNCH
  && readFileSync(plistFile, 'utf8') === PLIST;
if (!current) {
  // Replaced whole, never written over in place: a running copy keeps its own files.
  rmSync(app, { recursive: true, force: true });
  cpSync(built, app, { recursive: true });
  renameSync(join(app, 'Contents/MacOS/exhibit-viewer'), join(app, 'Contents/MacOS', exe));
  writeFileSync(plistFile, PLIST);
  writeFileSync(launchFile, LAUNCH, { mode: 0o755 });
}
execFileSync('open', [app]);
console.log(`present: ${app} opened on http://localhost:${port}/ (server log: ${join(process.env.TMPDIR ?? tmpdir(), `${slug}-server.log`)})`);
