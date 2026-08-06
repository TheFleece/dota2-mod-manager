// The one thing that can change how the app behaves without a release, which is exactly why
// it has to fail open: no file, no network, garbage in the file - everything stays on. A
// remote switch that fails closed is an outage you cannot fix from the user's side.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const net = require('../src/net.js');
const { createRemoteConfig, normalize, cmpVersion, CONFIG_URL } = require('../src/remote-config.js');

function userDir(t, contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2mm-cfg-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  if (contents != null) fs.writeFileSync(path.join(dir, 'remote-config.json'), contents);
  return dir;
}

const make = (dir, version = '2.0.0') => createRemoteConfig({ userDataDir: dir, appVersion: () => version });

test('nothing configured means nothing is off and nobody is told anything', (t) => {
  const cfg = make(userDir(t));
  assert.deepEqual(cfg.feature('install'), { off: false, note: '' });
  assert.deepEqual(cfg.notices(), []);
});

test('a damaged file is the same as no file', (t) => {
  const cfg = make(userDir(t, '{ this is not json'));
  assert.equal(cfg.feature('install').off, false);
});

test('only the switches the app knows about can be flipped', () => {
  const out = normalize({
    features: {
      install: { off: true, ru: 'Патч Доты сломал установку', en: 'A Dota patch broke installing' },
      selfDestruct: { off: true, en: 'nope' },
      cosmetics: { off: false, en: 'still on' },
    },
  });
  assert.deepEqual(Object.keys(out.features), ['install']);
});

test('a switch carries the reason in the language the user reads', (t) => {
  const dir = userDir(t, JSON.stringify({
    features: { install: { off: true, ru: 'по-русски', en: 'in English' } },
  }));
  const cfg = make(dir);
  assert.deepEqual(cfg.feature('install', 'ru'), { off: true, note: 'по-русски' });
  assert.deepEqual(cfg.feature('install', 'en'), { off: true, note: 'in English' });
});

test('a notice needs an id and some text, and its link must be https', () => {
  const out = normalize({
    notices: [
      { id: 'a', date: '2026-08-07', en: 'first', url: 'http://insecure.example' },
      { id: '', en: 'no id' },
      { en: 'no id at all' },
      'not even an object',
      { id: 'b', en: 'second', url: 'https://ok.example', level: 'warn' },
    ],
  });
  assert.deepEqual(out.notices.map((n) => n.id), ['a', 'b']);
  assert.equal(out.notices[0].url, null, 'plain http is dropped');
  assert.equal(out.notices[1].url, 'https://ok.example');
  assert.equal(out.notices[0].level, 'info', 'anything but "warn" reads as info');
});

test('a notice can be aimed at the builds it is about', (t) => {
  const dir = userDir(t, JSON.stringify({
    notices: [
      { id: 'old', date: '2026-08-01', en: 'for 1.x only', maxVersion: '1.99.99' },
      { id: 'now', date: '2026-08-07', en: 'for everybody' },
      { id: 'future', date: '2026-08-08', en: 'for 3.0 and up', minVersion: '3.0.0' },
    ],
  }));
  assert.deepEqual(make(dir, '2.0.0').notices().map((n) => n.id), ['now']);
  assert.deepEqual(make(dir, '1.15.0').notices().map((n) => n.id), ['now', 'old']);
  assert.deepEqual(make(dir, '3.1.0').notices().map((n) => n.id), ['future', 'now']);
});

test('notices come back newest first', (t) => {
  const dir = userDir(t, JSON.stringify({
    notices: [
      { id: 'older', date: '2026-07-01', en: 'a' },
      { id: 'newest', date: '2026-08-07', en: 'b' },
      { id: 'middle', date: '2026-08-01', en: 'c' },
    ],
  }));
  assert.deepEqual(make(dir).notices().map((n) => n.id), ['newest', 'middle', 'older']);
});

test('versions compare by number, not by string', () => {
  assert.equal(cmpVersion('2.0.0', '10.0.0'), -1, '10 is after 2, not before it');
  assert.equal(cmpVersion('2.1.0', '2.1.0'), 0);
  assert.equal(cmpVersion('2.1.3', '2.1.2'), 1);
  assert.equal(cmpVersion('nonsense', '0.0.0'), 0, 'a broken bound never hides a notice');
});

test('a fetched file is used and kept; a missing one changes nothing', async (t) => {
  const dir = userDir(t);
  const payload = JSON.stringify({ features: { voice: { off: true, en: 'voices are off today' } } });
  let serve404 = false;
  const server = http.createServer((req, res) => {
    if (serve404) { res.writeHead(404); res.end('no'); return; }
    res.writeHead(200, { 'content-length': Buffer.byteLength(payload) });
    res.end(payload);
  });
  server.listen(0, '127.0.0.1');
  await new Promise((r) => server.on('listening', r));
  t.after(() => { server.close(); net.setMirrors(null); });
  const port = server.address().port;
  net.setMirrors([{ host: `127.0.0.1:${port}`, map: () => `http://127.0.0.1:${port}/config.json` }]);

  const cfg = make(dir);
  await cfg.refresh();
  assert.equal(cfg.feature('voice').off, true);
  assert.ok(fs.existsSync(path.join(dir, 'remote-config.json')), 'kept for the next start');

  // the file disappears upstream: the app keeps what it had rather than losing its mind
  serve404 = true;
  const second = make(dir);
  await second.refresh();
  assert.equal(second.feature('voice').off, true);
  assert.equal(CONFIG_URL.startsWith('https://'), true);
});
