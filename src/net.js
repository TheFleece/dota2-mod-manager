// Getting bytes from the internet, on a connection that may not want to cooperate.
//
// Everything the app downloads - the catalog JSON, the fingerprint map, every mod archive -
// sits in a GitHub repository, and raw.githubusercontent.com is exactly the host that is
// slow, throttled or plainly unreachable for a good part of the userbase. So each URL has
// mirrors of the same bytes, tried in order, and a host that keeps failing is stood down for
// a while instead of being asked again on every single file.
//
// Which mirrors, measured rather than copied from another project (2026-08-07, from here):
//   raw.githubusercontent.com   210 ms, Range supported            - first choice
//   ghproxy.net                 300 ms, Range supported
//   gh-proxy.com                230 ms, Range supported
//   ghfast.top                 1100 ms, Range supported            - last, it is the slowest
//   cdn.jsdelivr.net            300 ms, Range supported, but 403 on a 64 MB file
// jsDelivr caps file size on /gh/, so it serves the small JSON and never the archives. That
// is the whole reason the chain depends on what is being fetched.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RAW_HOST = 'https://raw.githubusercontent.com/';
// Release assets (the Source 2 toolchain) live on github.com rather than the raw host, and
// the same proxies serve them - measured 2026-08-07, all three answer with Range support.
// jsDelivr does not do releases at all, which is why the two lists are not the same.
const RELEASE_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/releases\/download\//;
// After this many failures a host is stood down, and for this long. A mirror that is down
// tends to be down for minutes, and asking it once per mod turns a 40-mod install into 40
// timeouts before the first byte arrives.
const FAIL_THRESHOLD = 3;
const COOLDOWN_MS = 120000;
const ATTEMPTS_PER_MIRROR = 2;
// A stalled connection has to give up eventually or the install sits there forever. The
// body has its own, longer budget: a 300 MB mod on a slow line is not a stall.
const HEAD_TIMEOUT_MS = 20000;

const proxy = (host) => (url) => `https://${host}/${url}`;
const jsdelivr = (url) => {
  const m = url.slice(RAW_HOST.length).match(/^([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/);
  return m ? `https://cdn.jsdelivr.net/gh/${m[1]}/${m[2]}@${m[3]}/${m[4]}` : null;
};

/* Our own copy of the four files the app cannot start without.
 *
 * Every other mirror on this list is a proxy standing in front of GitHub, so when GitHub
 * itself goes down they go with it - three hours of exactly that on 2026-08-17, with the
 * catalog empty for anybody whose cache had expired. The site is built and deployed
 * elsewhere, which makes this the one entry here that does not share GitHub's fate. It
 * carries nothing else: mod archives are gigabytes and belong where they are.
 */
const MIRRORED = {
  'h6rd/Dota2PornFxWeb/main/assets/data/mods.json': 'mods.json',
  'h6rd/Dota2PornFxWeb/main/assets/data/constants.json': 'constants.json',
  'h6rd/Dota2PornFxWeb/main/assets/data/guides.json': 'guides.json',
  'TheFleece/dota2-mod-manager/main/fingerprints.json': 'fingerprints.json',
};
const ourSite = (url) => {
  const name = url.startsWith(RAW_HOST) && MIRRORED[url.slice(RAW_HOST.length)];
  return name ? `https://dota2modmanager.com/mirror/${name}` : null;
};

const DEFAULT_MIRRORS = [
  { host: 'raw.githubusercontent.com', map: (url) => url },
  { host: 'dota2modmanager.com', map: ourSite, smallOnly: true },
  { host: 'cdn.jsdelivr.net', map: jsdelivr, smallOnly: true },
  { host: 'ghproxy.net', map: proxy('ghproxy.net') },
  { host: 'gh-proxy.com', map: proxy('gh-proxy.com') },
  { host: 'ghfast.top', map: proxy('ghfast.top') },
];
let MIRRORS = DEFAULT_MIRRORS;

// host -> { fails, until }
const health = new Map();

function hostOf(url) {
  try { return new URL(url).host; } catch { return url; }
}

function stoodDown(host) {
  const h = health.get(host);
  return !!(h && h.until > Date.now());
}

function noteFailure(host, why) {
  const h = health.get(host) || { fails: 0, until: 0 };
  h.fails++;
  if (h.fails >= FAIL_THRESHOLD) { h.until = Date.now() + COOLDOWN_MS; h.fails = 0; }
  h.why = why;
  health.set(host, h);
}

function noteSuccess(host) {
  health.delete(host);
}

/**
 * Every URL worth trying for this one, best first. A URL that is not on GitHub raw (a mod
 * whose catalog entry points somewhere else entirely) has no mirrors - it is itself.
 * @param {object} [opts]
 * @param {boolean} [opts.small] the file is JSON-sized, so size-capped mirrors may be used
 */
function mirrorsFor(url, { small = false, trustedOnly = false } = {}) {
  const isRaw = url.startsWith(RAW_HOST);
  const isRelease = RELEASE_RE.test(url);
  // A mirror is a stranger who hands over bytes claiming they are GitHub's. That is a fair
  // trade for a mod archive - it is checked against a digest, and a wrong one costs a broken
  // hero model. It is not a fair trade for a file that decides which binary this app
  // downloads and runs, so that one asks GitHub itself or does without.
  if (trustedOnly) return [url];
  if (!isRaw && !isRelease) return [url];
  const out = [];
  for (const m of MIRRORS) {
    if (m.smallOnly && !small) continue;
    // a release asset is only reachable through the plain proxies, and github.com itself
    if (isRelease && m.smallOnly) continue;
    const mapped = isRelease && m.host === 'raw.githubusercontent.com' ? url : m.map(url);
    if (mapped) out.push(mapped);
  }
  return out;
}

/** The mirrors in the order they should actually be tried right now: rested hosts first. */
function liveOrder(urls) {
  const ready = urls.filter((u) => !stoodDown(hostOf(u)));
  // everything is standing down: rather than fail outright, try them anyway, best first
  return ready.length ? ready : urls;
}

/**
 * Fetch, walking the mirrors. Returns the Response of the first mirror that answers.
 * @param {string} url            the canonical (raw.githubusercontent.com) URL
 * @param {object} [opts]
 * @param {boolean} [opts.small]  allow size-capped mirrors
 * @param {object} [opts.headers]
 * @param {(msg: string) => void} [opts.log]
 */
async function fetchMirrored(url, { small = false, trustedOnly = false, headers = {}, log = () => {} } = {}) {
  const candidates = liveOrder(mirrorsFor(url, { small, trustedOnly }));
  let last = null;
  for (let pass = 0; pass < ATTEMPTS_PER_MIRROR; pass++) {
    for (const candidate of candidates) {
      const host = hostOf(candidate);
      if (stoodDown(host)) continue;
      try {
        const res = await fetch(candidate, { headers, signal: AbortSignal.timeout(HEAD_TIMEOUT_MS) });
        if (!res.ok && res.status !== 206) {
          // 404 is the file, not the mirror: another mirror of the same repo will not have it
          if (res.status === 404) return res;
          throw new Error(`HTTP ${res.status}`);
        }
        noteSuccess(host);
        return res;
      } catch (err) {
        last = err;
        noteFailure(host, String(err.message || err));
        log(`mirror ${host} failed: ${err.message || err}`);
      }
    }
  }
  throw last || new Error('no mirror answered');
}

/** Text from the first mirror that answers (catalog JSON, fingerprint map). */
async function fetchText(url, opts = {}) {
  const res = await fetchMirrored(url, { small: true, ...opts });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

const sha256 = (file) => new Promise((resolve, reject) => {
  const hash = crypto.createHash('sha256');
  fs.createReadStream(file)
    .on('data', (chunk) => hash.update(chunk))
    .on('error', reject)
    .on('end', () => resolve(hash.digest('hex')));
});

/**
 * Download to a file, resuming where an interrupted attempt stopped.
 *
 * The half-finished file is kept as <dest>.part and picked up with a Range request. Every
 * mirror measured supports it, and a mod archive is up to 300 MB: starting a 60 MB download
 * over because a train went into a tunnel is the difference between a mod and a shrug.
 *
 * @param {string} url
 * @param {string} dest
 * @param {object} [opts]
 * @param {(loaded: number, total: number) => void} [opts.onProgress]
 * @param {string} [opts.expectSha256] what this file hashed to last time it was downloaded;
 *   a mirror handing over something else is refused rather than installed
 * @param {(msg: string) => void} [opts.log]
 * @returns {Promise<{ path: string, bytes: number, sha256: string, resumedFrom: number }>}
 */
async function downloadFile(url, dest, { onProgress = () => {}, expectSha256 = null, log = () => {} } = {}) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const part = `${dest}.part`;
  let have = 0;
  try { have = fs.statSync(part).size; } catch { /* nothing to resume */ }

  const headers = have > 0 ? { Range: `bytes=${have}-` } : {};
  const res = await fetchMirrored(url, { headers, log });
  if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`);

  // A mirror that ignores Range (or a file that changed upstream) answers 200 with the whole
  // thing: start over rather than glue two halves of different files together.
  const resuming = res.status === 206 && have > 0;
  if (!resuming && have > 0) {
    log(`resume refused by ${hostOf(res.url || url)}, starting over`);
    have = 0;
  }
  const totalHeader = Number(res.headers.get('content-length')) || 0;
  const total = totalHeader ? totalHeader + (resuming ? have : 0) : 0;

  const out = fs.createWriteStream(part, { flags: resuming ? 'a' : 'w' });
  let loaded = have;
  const reader = res.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      loaded += value.length;
      onProgress(loaded, total);
      await new Promise((resolve, reject) => {
        out.write(Buffer.from(value), (err) => (err ? reject(err) : resolve()));
      });
    }
  } finally {
    await new Promise((resolve) => out.end(resolve));
  }

  const digest = await sha256(part);
  if (expectSha256 && digest !== expectSha256) {
    fs.rmSync(part, { force: true });
    throw new Error(`checksum mismatch for ${path.basename(dest)}`);
  }
  fs.rmSync(dest, { force: true });
  fs.renameSync(part, dest);
  return { path: dest, bytes: fs.statSync(dest).size, sha256: digest, resumedFrom: resuming ? have : 0 };
}

/** For the diagnostics report: which mirrors are currently standing down, and why. */
function mirrorHealth() {
  const out = [];
  for (const [host, h] of health) out.push({ host, fails: h.fails, standingDownFor: Math.max(0, h.until - Date.now()), why: h.why });
  return out;
}

/** Tests reach in here; nothing in the app should need it. */
function resetHealth() {
  health.clear();
}

/** Point the chain at local servers for a test. Pass nothing to put the real list back. */
function setMirrors(list) {
  MIRRORS = list || DEFAULT_MIRRORS;
  health.clear();
}

module.exports = {
  RAW_HOST, DEFAULT_MIRRORS, FAIL_THRESHOLD, COOLDOWN_MS,
  mirrorsFor, fetchMirrored, fetchText, downloadFile, sha256, mirrorHealth, resetHealth, setMirrors,
};
