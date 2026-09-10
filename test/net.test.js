// The download path decides whether somebody in a country where raw.githubusercontent is
// throttled gets a mod at all, and whether a 300 MB download survives a train tunnel. Pinned
// against local servers that misbehave on purpose: one that is down, one that ignores Range,
// one that hands over the wrong bytes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

const net = require('../src/net.js');
const { RAW_HOST } = net;

const RAW_URL = `${RAW_HOST}h6rd/Dota2PornFxWeb/main/assets/files/heroes/Mod.zip`;

/** A server whose behaviour each test decides. Returns { port, hits, close }. */
function serve(t, handler) {
  const state = { hits: 0 };
  const server = http.createServer((req, res) => { state.hits++; handler(req, res); });
  server.listen(0, '127.0.0.1');
  t.after(() => server.close());
  return new Promise((resolve) => {
    server.on('listening', () => resolve(Object.assign(state, {
      port: server.address().port,
      mirror() {
        const port = server.address().port;
        return { host: `127.0.0.1:${port}`, map: (u) => u.replace(RAW_HOST, `http://127.0.0.1:${port}/`) };
      },
    })));
  });
}

const body = (text) => (req, res) => { res.writeHead(200, { 'content-length': Buffer.byteLength(text) }); res.end(text); };
const dead = (status) => (req, res) => { res.writeHead(status); res.end('no'); };

// A server that serves `data` and honours Range, the way every measured mirror does.
const ranged = (data) => (req, res) => {
  const m = /^bytes=(\d+)-/.exec(req.headers.range || '');
  if (!m) { res.writeHead(200, { 'content-length': data.length, 'accept-ranges': 'bytes' }); res.end(data); return; }
  const from = Number(m[1]);
  res.writeHead(206, {
    'content-length': data.length - from,
    'content-range': `bytes ${from}-${data.length - 1}/${data.length}`,
  });
  res.end(data.subarray(from));
};

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2mm-net-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test.afterEach(() => net.setMirrors(null));

test('a GitHub raw URL gets mirrors, and a size-capped one only for small files', () => {
  const big = net.mirrorsFor(RAW_URL);
  const small = net.mirrorsFor(RAW_URL, { small: true });
  assert.equal(big[0], RAW_URL, 'the original host is tried first');
  assert.ok(!big.some((u) => u.includes('jsdelivr')), 'jsDelivr caps file size, so it is out for archives');
  assert.ok(small.some((u) => u.includes('cdn.jsdelivr.net/gh/h6rd/Dota2PornFxWeb@main/')), 'and in for JSON');
  assert.ok(big.some((u) => u.startsWith('https://ghproxy.net/')), 'the proxies wrap the whole raw URL');
});

// Every other mirror is a proxy in front of GitHub and dies with it. This one is the site,
// which is deployed elsewhere, and it carries the four files the app cannot start without.
test('the four startup files can also come from the site, and nothing else can', () => {
  const catalog = `${RAW_HOST}h6rd/Dota2PornFxWeb/main/assets/data/mods.json`;
  const prints = `${RAW_HOST}TheFleece/dota2-mod-manager/main/fingerprints.json`;
  for (const url of [catalog, prints]) {
    const list = net.mirrorsFor(url, { small: true });
    assert.ok(list.includes(`https://dota2modmanager.com/mirror/${url.split('/').pop()}`), url);
    assert.equal(list[0], url, 'GitHub is still asked first');
  }
  const mod = `${RAW_HOST}h6rd/Dota2PornFxWeb/main/assets/files/heroes/some-mod.zip`;
  // The bucket on cdn. holds the archives; the site itself must not be asked for one.
  assert.ok(!net.mirrorsFor(mod, { small: true }).some((u) => u.startsWith('https://dota2modmanager.com/mirror/')),
    'a mod archive is not on the site and must not be asked for there');
});

// The archives live in a bucket now, which is the only entry on the list that is not GitHub
// wearing a different hostname. The catalog JSON must not be asked for there and the bucket
// must not be asked before the origin.
test('a mod archive can come from the bucket, after GitHub and not before it', () => {
  const mod = `${RAW_HOST}h6rd/Dota2PornFxWeb/main/assets/files/heroes/Gopo%20Pudge.zip`;
  const list = net.mirrorsFor(mod);
  assert.equal(list[0], mod, 'the origin is still asked first');
  assert.equal(list[1], 'https://cdn.dota2modmanager.com/assets/files/heroes/Gopo%20Pudge.zip');
  assert.ok(list.indexOf('https://cdn.dota2modmanager.com/assets/files/heroes/Gopo%20Pudge.zip')
    < list.findIndex((u) => u.includes('ghproxy')), 'and before the proxies, which go down with GitHub');

  const catalog = `${RAW_HOST}h6rd/Dota2PornFxWeb/main/assets/data/mods.json`;
  assert.ok(!net.mirrorsFor(catalog, { small: true }).some((u) => u.includes('cdn.dota2modmanager.com')),
    'the catalog json is on the site, not in the bucket');
});

test('a URL that is not on GitHub raw is its own only mirror', () => {
  const other = 'https://example.com/some/mod.zip';
  assert.deepEqual(net.mirrorsFor(other), [other]);
});

// A proxy hands over bytes claiming they are GitHub's, which is a fair trade for a mod
// archive and not for the file that says which binary the app should download and run.
test('a file asked for trusted-only goes to GitHub itself or nowhere', () => {
  const pins = `${RAW_HOST}TheFleece/dota2-mod-manager/main/config/tools.json`;
  assert.deepEqual(net.mirrorsFor(pins, { small: true, trustedOnly: true }), [pins]);
  assert.ok(net.mirrorsFor(pins, { small: true }).length > 1, 'and the ordinary path still has its mirrors');
});

test('a mirror that is down is stepped over', async (t) => {
  const down = await serve(t, dead(500));
  const up = await serve(t, body('the catalog'));
  net.setMirrors([down.mirror(), up.mirror()]);

  assert.equal(await net.fetchText(RAW_URL), 'the catalog');
  assert.equal(up.hits, 1);
  assert.ok(down.hits >= 1, 'and it was the first one asked');
});

test('a mirror that keeps failing is stood down instead of asked every time', async (t) => {
  const down = await serve(t, dead(500));
  const up = await serve(t, body('ok'));
  net.setMirrors([down.mirror(), up.mirror()]);

  for (let i = 0; i < 4; i++) await net.fetchText(RAW_URL);
  assert.equal(net.mirrorHealth().length, 1, 'one host is standing down');
  assert.ok(down.hits <= net.FAIL_THRESHOLD, `asked ${down.hits} times, not ${4 * 2}`);
  assert.equal(up.hits, 4, 'and every request still got its answer');
});

test('a 404 is the file missing, not the mirror failing', async (t) => {
  const first = await serve(t, dead(404));
  const second = await serve(t, body('should not be reached'));
  net.setMirrors([first.mirror(), second.mirror()]);

  await assert.rejects(() => net.fetchText(RAW_URL), /404/);
  assert.equal(second.hits, 0, 'no point asking another mirror of the same repo');
});

test('a download that was cut short resumes where it stopped', async (t) => {
  const data = crypto.randomBytes(64 * 1024);
  const server = await serve(t, ranged(data));
  net.setMirrors([server.mirror()]);
  const dir = tempDir(t);
  const dest = path.join(dir, 'Mod.zip');

  // what an interrupted attempt left behind
  fs.writeFileSync(`${dest}.part`, data.subarray(0, 20000));
  const res = await net.downloadFile(RAW_URL, dest);

  assert.equal(res.resumedFrom, 20000, 'it asked for the rest, not the whole thing');
  assert.deepEqual(fs.readFileSync(dest), data);
  assert.equal(fs.existsSync(`${dest}.part`), false, 'and cleaned up after itself');
});

test('a mirror that ignores Range makes it start over rather than glue two files together', async (t) => {
  const data = crypto.randomBytes(32 * 1024);
  const server = await serve(t, (req, res) => { res.writeHead(200, { 'content-length': data.length }); res.end(data); });
  net.setMirrors([server.mirror()]);
  const dir = tempDir(t);
  const dest = path.join(dir, 'Mod.zip');
  fs.writeFileSync(`${dest}.part`, Buffer.from('half of something else'));

  const res = await net.downloadFile(RAW_URL, dest);
  assert.equal(res.resumedFrom, 0);
  assert.deepEqual(fs.readFileSync(dest), data);
});

test('a file that hashes to something else than last time is refused', async (t) => {
  const data = Buffer.from('not the mod you asked for');
  const server = await serve(t, ranged(data));
  net.setMirrors([server.mirror()]);
  const dir = tempDir(t);
  const dest = path.join(dir, 'Mod.zip');

  await assert.rejects(
    () => net.downloadFile(RAW_URL, dest, { expectSha256: 'a'.repeat(64) }),
    /checksum/,
  );
  assert.equal(fs.existsSync(dest), false, 'nothing is installed from it');
  assert.equal(fs.existsSync(`${dest}.part`), false, 'and the bad copy is not left to be resumed');
});

/*
 * The mirror is wrong, the mod is not.
 *
 * On 2026-09-10 the bucket was still serving 24 archives in the versions they had months ago,
 * because the sync skipped anything already there under the same name. Every one of them was
 * unreachable for anybody who cannot get to GitHub: the checksum said no and the download gave
 * up on the spot, with three proxies holding the current file and never asked.
 *
 * Both servers here serve real bytes and they are not the same bytes, which is the whole point
 * - a fake mirror that answers correctly on every path proves nothing about a mirror that does
 * not.
 */
test('a mirror serving a stale copy costs that mirror its turn, not the mod', async (t) => {
  const current = crypto.randomBytes(8192);
  const months_old = crypto.randomBytes(6000);
  const stale = await serve(t, ranged(months_old));
  const good = await serve(t, ranged(current));
  net.setMirrors([stale.mirror(), good.mirror()]);
  const dir = tempDir(t);
  const dest = path.join(dir, 'Mod.zip');

  const want = crypto.createHash('sha256').update(current).digest('hex');
  const res = await net.downloadFile(RAW_URL, dest, { expectSha256: want });

  assert.deepEqual(fs.readFileSync(dest), current, 'the mod that was asked for, byte for byte');
  assert.equal(res.sha256, want);
  assert.equal(stale.hits, 1, 'and the mirror that was wrong is not asked twice');
});

test('half a file from a stale mirror is not resumed from the next one', async (t) => {
  const current = crypto.randomBytes(8192);
  const stale = await serve(t, ranged(crypto.randomBytes(8192)));
  const good = await serve(t, ranged(current));
  net.setMirrors([stale.mirror(), good.mirror()]);
  const dir = tempDir(t);
  const dest = path.join(dir, 'Mod.zip');

  const want = crypto.createHash('sha256').update(current).digest('hex');
  const res = await net.downloadFile(RAW_URL, dest, { expectSha256: want });

  assert.equal(res.resumedFrom, 0, 'it started over instead of gluing two mods together');
  assert.deepEqual(fs.readFileSync(dest), current);
});

test('a file every mirror disowns is still refused', async (t) => {
  const one = await serve(t, ranged(crypto.randomBytes(2048)));
  const two = await serve(t, ranged(crypto.randomBytes(2048)));
  net.setMirrors([one.mirror(), two.mirror()]);
  const dir = tempDir(t);
  const dest = path.join(dir, 'Mod.zip');

  await assert.rejects(
    () => net.downloadFile(RAW_URL, dest, { expectSha256: 'a'.repeat(64) }),
    /checksum/,
  );
  assert.equal(fs.existsSync(dest), false, 'nothing is installed from any of them');
  assert.equal(fs.existsSync(`${dest}.part`), false);
});

test('a finished download reports the hash it should be remembered by', async (t) => {
  const data = crypto.randomBytes(4096);
  const server = await serve(t, ranged(data));
  net.setMirrors([server.mirror()]);
  const dir = tempDir(t);
  const dest = path.join(dir, 'Mod.zip');

  const res = await net.downloadFile(RAW_URL, dest);
  assert.equal(res.sha256, crypto.createHash('sha256').update(data).digest('hex'));
  assert.equal(res.bytes, data.length);
});

/*
 * The site mirror is a promise made in two places at once.
 *
 * src/net.js says "ask dota2modmanager.com for this file", and site/tools/mirror.mjs is what
 * puts the file there. They live in different packages and nothing connected them, so the
 * signatures were added to one side and not the other: the app would have asked our own site
 * for mods.json.sig on the one day it matters, and Cloudflare would have answered 200 with the
 * site's 404 page, 43 KB of HTML where 88 characters of base64 belong.
 *
 * A missing file is not the failure mode to guard against here. A present, wrong one is.
 */
test('every file the app expects from our own mirror is a file the site actually copies there', () => {
  const netSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'net.js'), 'utf-8');
  const mirrorTool = fs.readFileSync(path.join(__dirname, '..', 'site', 'tools', 'mirror.mjs'), 'utf-8');

  // the MIRRORED map: 'owner/repo/branch/path': 'name-on-our-site'
  const promised = [...netSource.matchAll(/^\s*'([\w.\-\/]+)':\s*'([\w.\-]+)',$/gm)];
  assert.ok(promised.length >= 4, 'the MIRRORED map got away from this test');

  for (const [, remotePath, name] of promised) {
    // the mapping is live, not just written down: net.js really offers our site for this URL
    // { small: true }, the way fetchText asks for these: our site is a smallOnly mirror,
    // because it carries the four startup files and never a 300 MB archive.
    const urls = net.mirrorsFor(RAW_HOST + remotePath, { small: true });
    assert.ok(
      urls.some((u) => u.includes(`dota2modmanager.com/mirror/${name}`)),
      `net.js does not actually route ${remotePath} to our mirror`,
    );
    // and the site puts it there
    assert.ok(
      new RegExp(`'${name.replace(/\./g, '\.')}'`).test(mirrorTool),
      `site/tools/mirror.mjs never copies ${name}, so our mirror would answer with the 404 page`,
    );
  }
});

/*
 * Which failure this was, so the catalog screen can say something a player understands.
 *
 * It used to print "fetch failed" - Node's words for being unable to open a socket - at
 * somebody whose wifi was off, on the screen where the mods should be. Telling those two
 * apart is the whole job: send the person with no connection to check their connection, and
 * do not send that message to the person whose connection is fine and whose server answered.
 */
test('a network that is not there is marked as such', async (t) => {
  net.setMirrors([{ host: '127.0.0.1:1', map: () => 'http://127.0.0.1:1/x.json' }]);
  t.after(() => net.setMirrors(null));

  const err = await net.fetchText(`${RAW_HOST}owner/repo/main/x.json`).then(() => null, (e) => e);
  assert.ok(err, 'a dead host has to fail');
  assert.equal(err.offline, true, 'nothing answered at all, so the connection is the thing to mention');
});

test('a server that answered is not called a missing connection', async (t) => {
  const server = http.createServer((req, res) => { res.writeHead(500); res.end('nope'); });
  server.listen(0, '127.0.0.1');
  await new Promise((r) => server.on('listening', r));
  const port = server.address().port;
  net.setMirrors([{ host: `127.0.0.1:${port}`, map: () => `http://127.0.0.1:${port}/x.json` }]);
  t.after(() => { server.close(); net.setMirrors(null); });

  const err = await net.fetchText(`${RAW_HOST}owner/repo/main/x.json`).then(() => null, (e) => e);
  assert.ok(err, 'a 500 from every mirror is still a failure');
  assert.equal(err.offline, false, 'the wifi is fine; saying otherwise sends somebody to fix nothing');
});
