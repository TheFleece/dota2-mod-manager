#!/usr/bin/env node
/*
 * A second place to get an update from.
 *
 * The app updates itself out of GitHub Releases and nowhere else, so on 2026-08-17, when GitHub
 * was down for three hours, no copy of this app could have checked for or fetched an update.
 * Nobody noticed, because an app that fails to update looks exactly like an app. It becomes
 * visible on the day a release fixes something urgent, and by then it is too late to arrange a
 * second route.
 *
 * The mods and the catalog already have one (tools/r2-sync.mjs). This puts the release itself
 * there too: the manifests electron-updater reads and the binaries they point at, under
 * updates/ in the same bucket, served from cdn.dota2modmanager.com.
 *
 * Only the current release is kept. Each run uploads this version and deletes whatever was
 * there before, so the bucket carries about 320 MB for updates rather than 320 MB per release
 * for ever. Old versions stay on GitHub, which is where anybody looking for one goes.
 *
 * Usage: node tools/r2-release.mjs <version>        e.g. 2.6.5
 *        node tools/r2-release.mjs <version> --dry
 */
import fs from 'node:fs';
import path from 'node:path';
import { createR2 } from './r2-client.js';

const version = (process.argv[2] || '').replace(/^v/, '');
const dry = process.argv.includes('--dry');
const REPO = 'TheFleece/dota2-mod-manager';
const PREFIX = 'updates/';

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('usage: node tools/r2-release.mjs <version> [--dry]');
  process.exit(1);
}

/* What an updater needs, and nothing else.
 *
 * The two .yml files are what electron-updater reads to learn a version exists; portable.yml is
 * what src/portable-update.js reads for the same reason. The binaries are what they point at.
 * The blockmap is for differential downloads against a previous installer, which a mirror that
 * only ever holds one release cannot serve, so it is left on GitHub. */
const WANTED = [
  ['latest.yml', 'text/yaml'],
  ['latest-linux.yml', 'text/yaml'],
  ['portable.yml', 'text/yaml'],
  ['Dota-2-Mod-Manager-Setup.exe', 'application/octet-stream'],
  ['Dota-2-Mod-Manager-Portable.exe', 'application/octet-stream'],
  ['Dota-2-Mod-Manager.AppImage', 'application/octet-stream'],
];

const r2 = createR2();
if (!r2.configured) {
  console.error('R2 credentials are not set, so there is nowhere to publish to');
  process.exit(1);
}

const assetUrl = (name) => `https://github.com/${REPO}/releases/download/v${version}/${encodeURIComponent(name)}`;

async function fetchAsset(name) {
  const res = await fetch(assetUrl(name));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

const before = await r2.list(PREFIX);
console.log(`updates/ holds ${before.size} object(s), ${(([...before.values()].reduce((n, v) => n + v, 0)) / 1024 ** 2).toFixed(0)} MB`);

const uploaded = new Set();
let failed = 0;

for (const [name, type] of WANTED) {
  const key = `${PREFIX}${name}`;
  try {
    const body = await fetchAsset(name);
    // The manifests are small and change every release; the binaries are large and a matching
    // size means the same file, since a release tag never gets two different builds.
    if (before.get(key) === body.length && !name.endsWith('.yml')) {
      uploaded.add(key);
      console.log(`already there ${name} (${(body.length / 1024 ** 2).toFixed(0)} MB)`);
      continue;
    }
    if (!dry) await r2.put(key, body, type);
    uploaded.add(key);
    console.log(`${dry ? 'would upload' : 'uploaded'} ${name} (${(body.length / 1024 ** 2).toFixed(1)} MB)`);
  } catch (err) {
    // A release that never carried this asset is not a failure: Linux builds do not produce
    // portable.yml, and a version published before a file existed will not have it.
    failed++;
    console.log(`skipped ${name}: ${err.message}`);
  }
}

// Whatever the last release left behind, so the bucket holds one version rather than all of them
for (const key of before.keys()) {
  if (uploaded.has(key)) continue;
  if (!dry) await r2.remove(key);
  console.log(`${dry ? 'would remove' : 'removed'} ${key.slice(PREFIX.length)} (from an older release)`);
}

console.log(`\n${uploaded.size} of ${WANTED.length} assets published for ${version}${failed ? `, ${failed} not found` : ''}`);
if (uploaded.size === 0) process.exit(1);
