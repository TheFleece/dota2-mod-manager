#!/usr/bin/env node
/**
 * A copy of the mod archives that does not live on GitHub.
 *
 * The app already has a second source for the four files it needs to start: the site carries
 * those. What it had no answer for is the archives themselves. Every mirror it knows is a proxy
 * standing in front of GitHub, so the three-hour outage on 2026-08-17 meant nobody could
 * install anything at all. This puts the archives in Cloudflare R2, which is a different
 * company having a different bad day.
 *
 * What gets copied: the catalog lists every mod and the file it ships as. Anything already in
 * the bucket at the right size is left alone, so the second run only moves what changed. The
 * free tier is 10 GB and the catalog is close to it, so there is a budget - the categories
 * people install from first go first, and the run stops when the budget is spent instead of
 * failing halfway through.
 *
 * The index written at the end is what keeps the app from guessing: without it, every install
 * of a mod that did not fit would cost a round trip to R2 and a 404 before falling back.
 *
 * No SDK. R2 speaks S3, S3 wants SigV4, and SigV4 is a hash of a canonical string: eighty lines
 * that never change, against a dependency with a supply chain.
 *
 *   node tools/r2-sync.mjs --limit 5     copy at most five archives, which is the smoke test
 *   node tools/r2-sync.mjs --budget 9    stop at nine gigabytes in the bucket
 *   node tools/r2-sync.mjs --dry         say what it would do and touch nothing
 */
import crypto from 'node:crypto';

const ACCOUNT = process.env.R2_ACCOUNT_ID || '';
const KEY = process.env.R2_ACCESS_KEY_ID || '';
const SECRET = process.env.R2_SECRET_ACCESS_KEY || '';
const BUCKET = process.env.R2_BUCKET || 'd2mm-mods';
const RAW = 'https://raw.githubusercontent.com/h6rd/Dota2PornFxWeb/main';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const DRY = args.includes('--dry');
const LIMIT = Number(flag('--limit', '0')) || Infinity;
const BUDGET = Number(flag('--budget', '9')) * 1024 ** 3;
/* A cap on one archive, so a single mod cannot eat the bucket. It started at 400 MB, which
 * turned out to exclude exactly one thing: a 1.02 GB voice pack. The catalog fits in 5.6 GB,
 * there is room, and the point of the mirror is that an install works when GitHub does not -
 * including that one.
 */
const MAX_FILE = Number(flag('--max-file', '1200')) * 1024 ** 2;

/* Categories in the order they are worth having a second copy of: what somebody installs in
 * their first hour, then everything else in catalog order.
 */
const FIRST = ['heroes', 'terrains', 'shaders', 'trees', 'river', 'backgrounds', 'hero-items',
  'creeps', 'cursors', 'mega-kill', 'announcers', 'hero-sounds', 'couriers', 'wards'];

import { iterMods } from './catalog-mods.js';
import { createR2 } from './r2-client.js';

/* The bucket, and SigV4 with it, live in tools/r2-client.js: the release assets need the same
   signing and a second copy of eighty lines of crypto is how the catalog walk in this very file
   came to be the one of three that was wrong. */
const r2 = createR2({ bucket: BUCKET });
const listBucket = () => r2.list();
const put = (objectKey, body, type) => r2.put(objectKey, body, type);

// ---------------------------------------------------------------------------

if (!ACCOUNT || !KEY || !SECRET) {
  console.error('needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY');
  process.exit(1);
}

/* The account id is a hostname here, so a value that is not one fails as a TLS handshake
 * error twenty lines deeper, which says nothing about the actual problem. The id is 32 hex
 * characters; anything else is usually the S3 endpoint URL pasted whole, or a stray newline.
 * The value itself never gets printed - only its shape.
 */
const shapeOf = (v) => v.replace(/[0-9]/g, '0').replace(/[a-f]/g, 'x').replace(/[g-z]/g, 'a').replace(/[A-Z]/g, 'A');
const wrong = [];
if (!/^[0-9a-f]{32}$/.test(ACCOUNT)) wrong.push(['R2_ACCOUNT_ID', ACCOUNT, '32 hex characters, the id in the dashboard URL right after dash.cloudflare.com/']);
if (!/^[0-9a-f]{32}$/.test(KEY)) wrong.push(['R2_ACCESS_KEY_ID', KEY, '32 hex characters, shown once when the R2 API token is created']);
if (!/^[0-9a-f]{64}$/.test(SECRET)) wrong.push(['R2_SECRET_ACCESS_KEY', SECRET, '64 hex characters, shown next to the access key id']);
if (wrong.length) {
  // The account id is part of the hostname, so a wrong value comes back as an SSL handshake
  // failure from a socket, which tells nobody anything. Shapes are printed, never values.
  for (const [name, value, want] of wrong) {
    console.error(`${name}: ${value.length} characters, shaped like "${shapeOf(value).slice(0, 60)}" - expected ${want}`);
  }
  console.error('Shapes only, no values. 0 is a digit, x is a-f, a is any other letter, A is uppercase.');
  process.exit(1);
}

const catalogRes = await fetch(`${RAW}/assets/data/mods.json`);
if (!catalogRes.ok) {
  console.error(`the catalog itself is unreachable: HTTP ${catalogRes.status}`);
  process.exit(1);
}
const catalog = await catalogRes.json();
const byCategory = catalog.modsData || catalog;

const wanted = [];
const rank = (id) => (FIRST.indexOf(id) < 0 ? FIRST.length : FIRST.indexOf(id));

/* tools and news are not mods people install, so the bucket does not carry them. Everything
   else comes through iterMods, which knows that five categories arrive as { groups: [...] }
   rather than as an array - the thing this file used to get wrong, and the reason 313 mods had
   never been mirrored. */
for (const { categoryId, mod } of iterMods(byCategory, { skip: ['tools', 'news'] })) {
  {
    const ref = mod?.file;
    if (typeof ref !== 'string' || !/\.(vpk|zip)$/i.test(ref)) continue;
    /* Some entries carry a whole URL rather than a file name: the catalog keeps its heaviest
       mods on Hugging Face. The key stays the shape the app asks for, so the app does not have
       to know where the original came from. */
    const absolute = /^https?:\/\//i.test(ref);
    const name = absolute ? decodeURIComponent(ref.split('/').pop()) : ref;
    wanted.push({
      path: `assets/files/${categoryId}/${name}`,
      source: absolute ? ref : null,
      rank: rank(categoryId),
    });
  }

  /* The picture as well as the archive.
   *
   * The renderer asks raw.githubusercontent for every preview directly, so a user who cannot
   * reach GitHub gets a catalog that loads and a grid of empty squares - the app looks broken
   * while working. All 1,336 of them come to about 38 MB, which is nothing beside the archives
   * and is the difference between a usable window and a blank one.
   *
   * First in the list on purpose: a picture is what somebody looks at before deciding to spend
   * 300 MB on the mod under it, and if the budget ever runs out it should run out on archives.
   */
  const preview = mod?.preview;
  if (typeof preview === 'string' && preview && !/^https?:\/\//i.test(preview)) {
    const key = preview.startsWith('assets/previews/')
      ? preview
      : `assets/previews/${categoryId}/${preview}`;
    wanted.push({ path: key, source: null, rank: -1 });
  }
}
wanted.sort((a, b) => a.rank - b.rank);
console.log(`catalog: ${wanted.length} archives`);

const have = await listBucket();
let used = [...have.values()].reduce((n, v) => n + v, 0);
console.log(`bucket: ${have.size} objects, ${(used / 1024 ** 3).toFixed(2)} GB of ${(BUDGET / 1024 ** 3).toFixed(0)} GB budget`);

let copied = 0;
let skipped = 0;
let failed = 0;
let tooBig = 0;
let stopped = '';
const index = [];

for (const item of wanted) {
  if (have.has(item.path)) { index.push(item.path); skipped++; continue; }
  if (copied >= LIMIT) { stopped = 'limit'; break; }
  if (used >= BUDGET) { stopped = 'budget'; break; }

  try {
    const res = await fetch(item.source || `${RAW}/${item.path}`);
    if (!res.ok) throw new Error(`source HTTP ${res.status}`);
    const body = Buffer.from(await res.arrayBuffer());
    if (body.length > MAX_FILE) { tooBig++; continue; }
    if (used + body.length > BUDGET) { stopped = 'budget'; break; }
    const mb = (body.length / 1024 ** 2).toFixed(1);
    if (DRY) {
      console.log(`would copy ${item.path} (${mb} MB)`);
    } else {
      await put(item.path, body, item.path.endsWith('.vpk') ? 'application/octet-stream' : 'application/zip');
      console.log(`copied ${item.path} (${mb} MB)`);
    }
    used += body.length;
    copied++;
    index.push(item.path);
  } catch (e) {
    failed++;
    console.log(`skipped ${item.path}: ${e.message}`);
  }
}

/* The list the app reads before it decides where to ask. */
if (!DRY) {
  const payload = JSON.stringify({ updated: new Date().toISOString().slice(0, 10), count: index.length, files: index.sort() });
  await put('index.json', Buffer.from(payload), 'application/json');
}

console.log(`\ncopied ${copied}, already there ${skipped}, too big ${tooBig}, failed ${failed}${stopped ? `, stopped on ${stopped}` : ''}`);
console.log(`bucket now ~${(used / 1024 ** 3).toFixed(2)} GB, index lists ${index.length} archives`);
