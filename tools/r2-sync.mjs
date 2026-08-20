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
// One archive is not worth a tenth of the whole budget.
const MAX_FILE = 400 * 1024 ** 2;

/* Categories in the order they are worth having a second copy of: what somebody installs in
 * their first hour, then everything else in catalog order.
 */
const FIRST = ['heroes', 'terrains', 'shaders', 'trees', 'river', 'backgrounds', 'hero-items',
  'creeps', 'cursors', 'mega-kill', 'announcers', 'hero-sounds', 'couriers', 'wards'];

const host = `${ACCOUNT}.r2.cloudflarestorage.com`;
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const hmac = (k, s) => crypto.createHmac('sha256', k).update(s).digest();
const encodePath = (key) => '/' + key.split('/').map(encodeURIComponent).join('/');

/** SigV4, all of it. R2 wants region "auto" and service "s3". */
function sign({ method, key, payloadHash, headers = {}, query = '' }) {
  const stamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = stamp.slice(0, 8);
  const all = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': stamp, ...headers };
  const names = Object.keys(all).map((n) => n.toLowerCase()).sort();
  const canonicalHeaders = names
    .map((n) => `${n}:${String(all[Object.keys(all).find((k) => k.toLowerCase() === n)]).trim()}\n`)
    .join('');
  const signedHeaders = names.join(';');
  const canonical = [method, encodePath(key), query, canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${date}/auto/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', stamp, scope, sha(canonical)].join('\n');
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${SECRET}`, date), 'auto'), 's3'), 'aws4_request');
  const signature = hmac(signingKey, toSign).toString('hex');
  return {
    ...all,
    Authorization: `AWS4-HMAC-SHA256 Credential=${KEY}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

const endpoint = (key, query) => `https://${host}${encodePath(key)}${query ? `?${query}` : ''}`;

/** What is already in the bucket, so a second run is cheap. */
async function listBucket() {
  const have = new Map();
  let token = '';
  do {
    const q = new URLSearchParams({ 'list-type': '2', 'max-keys': '1000' });
    if (token) q.set('continuation-token', token);
    q.sort();
    const query = q.toString();
    const headers = sign({ method: 'GET', key: BUCKET, payloadHash: sha(''), query });
    const res = await fetch(endpoint(BUCKET, query), { headers });
    const xml = await res.text();
    if (!res.ok) throw new Error(`list: HTTP ${res.status} ${xml.slice(0, 300)}`);
    for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>[\s\S]*?<Size>(\d+)<\/Size>/g)) {
      have.set(m[1], Number(m[2]));
    }
    token = (xml.match(/<NextContinuationToken>([^<]+)</) || [])[1] || '';
  } while (token);
  return have;
}

async function put(objectKey, body, type) {
  const key = `${BUCKET}/${objectKey}`;
  const headers = sign({
    method: 'PUT',
    key,
    payloadHash: sha(body),
    headers: { 'content-type': type, 'content-length': String(body.length) },
  });
  const res = await fetch(endpoint(key), { method: 'PUT', headers, body });
  if (!res.ok) throw new Error(`put ${objectKey}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
}

// ---------------------------------------------------------------------------

if (!ACCOUNT || !KEY || !SECRET) {
  console.error('needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY');
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
for (const [categoryId, list] of Object.entries(byCategory)) {
  if (!Array.isArray(list) || categoryId === 'tools' || categoryId === 'news') continue;
  for (const mod of list) {
    const ref = mod?.file;
    if (typeof ref !== 'string' || !/\.(vpk|zip)$/i.test(ref)) continue;
    wanted.push({ path: `assets/files/${categoryId}/${ref}`, rank: rank(categoryId) });
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
    const res = await fetch(`${RAW}/${item.path}`);
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
