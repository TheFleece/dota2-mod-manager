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

test('a URL that is not on GitHub raw is its own only mirror', () => {
  const other = 'https://example.com/some/mod.zip';
  assert.deepEqual(net.mirrorsFor(other), [other]);
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
