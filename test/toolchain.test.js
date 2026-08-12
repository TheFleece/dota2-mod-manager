// The toolchain downloads and then runs a third-party binary, which makes the pin the whole
// safety story: a version, a URL that can only be that project's own release page, and a
// SHA-256 that has to match. These tests are about what the app refuses, because that is
// what stands between a moved URL and running somebody else's executable.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

const net = require('../src/net.js');
const { createToolchain, BUILT_IN_PINS, validPin } = require('../src/toolchain.js');

function userDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2mm-tool-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** A zip that looks like a tool release: the executable plus the DLLs beside it. */
function toolZip(exeName = 'Source2Viewer-CLI.exe') {
  const zip = new AdmZip();
  zip.addFile(exeName, Buffer.from('MZ pretend this is a program'));
  zip.addFile('libSkiaSharp.dll', Buffer.from('a library it needs'));
  return zip.toBuffer();
}

/** Serve `data` at any path, so the pin URL can point at a local server. */
async function serve(t, data) {
  const server = http.createServer((req, res) => {
    const m = /^bytes=(\d+)-/.exec(req.headers.range || '');
    if (!m) { res.writeHead(200, { 'content-length': data.length }); res.end(data); return; }
    const from = Number(m[1]);
    res.writeHead(206, { 'content-length': data.length - from, 'content-range': `bytes ${from}-${data.length - 1}/${data.length}` });
    res.end(data.subarray(from));
  });
  server.listen(0, '127.0.0.1');
  await new Promise((r) => server.on('listening', r));
  t.after(() => { server.close(); net.setMirrors(null); });
  const port = server.address().port;
  // the pin URL is a real github.com release address; the mirror table sends it here
  net.setMirrors([{ host: `127.0.0.1:${port}`, map: () => `http://127.0.0.1:${port}/tool.zip` }]);
  return port;
}

test('the built-in pins are the shape the code demands of a remote one', () => {
  for (const [name, pin] of Object.entries(BUILT_IN_PINS)) {
    assert.ok(validPin(pin, name), `${name} pin is valid`);
  }
});

test('a pin is refused unless it points at a project release with a real hash', () => {
  const good = BUILT_IN_PINS.vrf;
  assert.equal(validPin({ ...good, url: 'https://example.com/tool.zip' }, 'vrf'), false, 'any host will not do');
  assert.equal(validPin({ ...good, url: 'https://github.com/someone/else/raw/main/tool.zip' }, 'vrf'), false, 'a raw file is not a release');
  assert.equal(validPin({ ...good, sha256: 'nope' }, 'vrf'), false);
  assert.equal(validPin({ ...good, sha256: undefined }, 'vrf'), false, 'an unpinned tool is not a tool');
  assert.equal(validPin({ ...good, exe: '../../evil.exe' }, 'vrf'), false, 'the executable is a name, not a path');
  assert.equal(validPin({ ...good, version: '' }, 'vrf'), false);
});

// The digest travels in the same file as the URL, so "a GitHub release whose hash matches"
// is something anybody can produce with a repository of their own. Only the tool's own
// project counts, and a config that names no tool at all counts for nothing.
test('a pin may only point at the repository the tool actually comes from', () => {
  const good = BUILT_IN_PINS.vrf;
  const elsewhere = 'https://github.com/attacker/ValveResourceFormat/releases/download/19.2/cli-windows-x64.zip';
  assert.equal(validPin({ ...good, url: elsewhere }, 'vrf'), false, 'somebody else’s release is not the tool');
  assert.equal(validPin(good, 'unknown-tool'), false, 'a tool with no pinned repository has no valid pin');
  assert.equal(validPin(good, undefined), false);
  assert.ok(validPin(good, 'vrf'), 'the real one still passes');
});

test('a tool downloads, unpacks and is found where it says', async (t) => {
  const data = toolZip();
  await serve(t, data);
  const dir = userDir(t);
  const tc = createToolchain({ userDataDir: dir });
  // pretend the built-in pin describes what the local server is about to hand over
  BUILT_IN_PINS.vrf.sha256 = crypto.createHash('sha256').update(data).digest('hex');

  const exe = await tc.ensure('vrf');
  assert.ok(fs.existsSync(exe), 'the executable is on disk');
  assert.match(exe, /Source2Viewer-CLI\.exe$/);
  assert.equal(tc.pathOf('vrf'), exe, 'and it is found again without downloading');
  const state = tc.state().find((s) => s.name === 'vrf');
  assert.equal(state.ready, true);
  assert.equal(state.version, BUILT_IN_PINS.vrf.version);
  assert.ok(state.installedBytes > 0);
});

test('an archive that hashes to something else is not unpacked at all', async (t) => {
  await serve(t, toolZip());
  const dir = userDir(t);
  const tc = createToolchain({ userDataDir: dir });
  BUILT_IN_PINS.vrf.sha256 = 'f'.repeat(64); // what we pinned is not what arrived

  await assert.rejects(() => tc.ensure('vrf'), /checksum/);
  assert.equal(tc.pathOf('vrf'), null, 'nothing was installed');
  assert.deepEqual(fs.readdirSync(path.join(dir, 'toolchain')).filter((f) => f.endsWith('.exe')), []);
});

test('an archive without the executable it promised is thrown away', async (t) => {
  const data = toolZip('SomethingElse.exe');
  await serve(t, data);
  const dir = userDir(t);
  const tc = createToolchain({ userDataDir: dir });
  BUILT_IN_PINS.vrf.sha256 = crypto.createHash('sha256').update(data).digest('hex');

  await assert.rejects(() => tc.ensure('vrf'), /Source2Viewer-CLI\.exe/);
  assert.equal(tc.pathOf('vrf'), null);
});

test('a tool nobody asked for is not a tool', async (t) => {
  const tc = createToolchain({ userDataDir: userDir(t) });
  await assert.rejects(() => tc.ensure('vpk'), /unknown tool/);
});

test('deleting a tool leaves nothing behind', async (t) => {
  const data = toolZip();
  await serve(t, data);
  const dir = userDir(t);
  const tc = createToolchain({ userDataDir: dir });
  BUILT_IN_PINS.vrf.sha256 = crypto.createHash('sha256').update(data).digest('hex');

  await tc.ensure('vrf');
  tc.remove('vrf');
  assert.equal(tc.pathOf('vrf'), null);
  assert.equal(fs.existsSync(path.join(dir, 'toolchain', 'vrf')), false);
  assert.equal(tc.state().find((s) => s.name === 'vrf').ready, false);
});
