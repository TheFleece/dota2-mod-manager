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
 * A beta shares the folder and not the names: its binaries carry -beta, and its two manifests are
 * rewritten to ask for those. The bucket also holds the mod mirror and was at 8.77 GB of the free
 * 10 GB in September 2026, so a second copy of every release was not worth 320 MB for ever. A
 * release writes beta.yml as well, pointing at its own files, so a tester whose GitHub is
 * unreachable moves on rather than sitting on the beta it replaced. tools/mirror-plan.js decides
 * all of that and is tested; this fetches and uploads.
 *
 * Usage: node tools/r2-release.mjs <version>        e.g. 2.6.5 or 2.7.0-beta.1
 *        node tools/r2-release.mjs <version> --dry
 */
import { createR2 } from './r2-client.js';
import { releasePlan, retargetFeed, staleReleaseFiles, UPDATES } from './mirror-plan.js';

const version = (process.argv[2] || '').replace(/^v/, '');
const dry = process.argv.includes('--dry');
const REPO = 'dota2modmanager/dota2-mod-manager';
const PREFIX = UPDATES;

if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error('usage: node tools/r2-release.mjs <version> [--dry]   (2.6.5 or 2.7.0-beta.1)');
  process.exit(1);
}
const plan = releasePlan(version);

/* What an updater needs, and nothing else. The .yml files are what electron-updater reads to
 * learn a version exists; portable.yml is what src/portable-update.js reads for the same reason.
 * The binaries are what they point at. The blockmap is for differential downloads against a
 * previous installer, which a mirror holding one release cannot serve, so it stays on GitHub. */
const WANTED = plan.uploads;

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

for (const { asset, name, type, retarget } of WANTED) {
  const key = `${PREFIX}${name}`;
  try {
    let body = await fetchAsset(asset);
    // a beta's feed has to ask for the -beta copies of the files it names
    if (retarget) body = Buffer.from(retargetFeed(body.toString('utf-8')), 'utf-8');
    // The manifests are small and change every release; the binaries are large and a matching
    // size means the same file, since a release tag never gets two different builds.
    if (before.get(key) === body.length && !name.endsWith('.yml')) {
      uploaded.add(key);
      console.log(`already there ${name} (${(body.length / 1024 ** 2).toFixed(0)} MB)`);
      continue;
    }
    if (!dry) await r2.put(key, body, type);
    uploaded.add(key);
    console.log(`${dry ? 'would upload' : 'uploaded'} ${key} (${(body.length / 1024 ** 2).toFixed(1)} MB)`);
  } catch (err) {
    // A release that never carried this asset is not a failure: Linux builds do not produce
    // portable.yml, and a version published before a file existed will not have it.
    failed++;
    console.log(`skipped ${name}: ${err.message}`);
  }
}

// Whatever the last run of this kind left behind, so each folder holds one version rather than
// all of them - and a beta never clears out the release everybody else updates from.
for (const key of staleReleaseFiles([...before.keys()], uploaded, plan.beta)) {
  if (!dry) await r2.remove(key);
  console.log(`${dry ? 'would remove' : 'removed'} ${key} (from an older ${plan.beta ? 'beta' : 'release'})`);
}

console.log(`\n${uploaded.size} of ${WANTED.length} files published for ${version}${plan.beta ? ' (beta)' : ''}${failed ? `, ${failed} not found` : ''}`);
if (uploaded.size === 0) process.exit(1);
