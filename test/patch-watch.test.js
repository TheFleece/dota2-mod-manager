// Knowing that Dota was patched is what decides whether the app repairs itself in time, and
// it has to be exact in both directions: a real patch must register, and the app's own edit
// to the signature list must not. Get the second one wrong and the app wakes itself up in a
// loop, writing into the game folder for no reason at all.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { gameStamp, clientVersion, createPatchWatcher } = require('../src/patch-watch.js');
const patcher = require('../src/patcher.js');

const INF = (version) => [
  `ClientVersion=${version}`,
  `ServerVersion=${version}`,
  'ProductName=dota2_workshop',
  'appID=570',
  'VersionDate=Aug 05 2026',
].join('\r\n');

// The shape of the real file: a line per checked file, then the digest that closes the list.
// Our own line is appended after that digest, which is what stripSignatures keys on.
const SIGNATURES = [
  '...\\..\\..\\dota\\bin\\win64\\client.dll~SHA1:AAAA;CRC:1111',
  '...\\..\\..\\dota\\gameinfo.gi~SHA1:BBBB;CRC:2222',
  '...\\..\\..\\dota\\gameinfo_branchspecific.gi~SHA1:CCCC;CRC:3333',
  'DIGEST:7860EACFC03971A8B84EE97E4DD73DC7EFA7F691FFBB83ED1E8E6',
].join('\r\n');

function fakeGame(t, { version = '6888', signatures = SIGNATURES } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2mm-patch-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'dota'), { recursive: true });
  fs.mkdirSync(path.join(root, 'bin', 'win64'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dota', 'steam.inf'), INF(version));
  fs.writeFileSync(patcher.paths(root).signatures, signatures);
  return root;
}

const setInf = (game, version) => fs.writeFileSync(path.join(game, 'dota', 'steam.inf'), INF(version));
const setSignatures = (game, text) => fs.writeFileSync(patcher.paths(game).signatures, text);

test('the build on disk reads back as one comparable string', (t) => {
  const game = fakeGame(t);
  assert.equal(clientVersion(game), '6888');
  const first = gameStamp(game);
  assert.ok(first, 'a stamp is produced');
  assert.equal(gameStamp(game), first, 'reading twice gives the same answer');
});

test('a game patch moves the stamp', (t) => {
  const game = fakeGame(t);
  const before = gameStamp(game);
  setInf(game, '6889');
  assert.notEqual(gameStamp(game), before);
});

test('a rewritten signature list moves the stamp even at the same version', (t) => {
  const game = fakeGame(t);
  const before = gameStamp(game);
  setSignatures(game, `${SIGNATURES}\r\n...\\..\\..\\dota\\newfile.vpk~SHA1:CCCC;CRC:3333`);
  assert.notEqual(gameStamp(game), before);
});

test('the app patching the signature list does NOT look like a game patch', (t) => {
  const game = fakeGame(t);
  const before = gameStamp(game);
  // exactly what patcher.apply appends: a line for the file it just edited
  const ours = patcher.signatureLine(Buffer.from('pretend this is the patched gameinfo'));
  setSignatures(game, `${SIGNATURES}\r\n${ours}\r\n`);
  assert.equal(gameStamp(game), before, 'our own line is stripped before hashing');
});

test('no game, no stamp', () => {
  assert.equal(gameStamp(null), null);
  assert.equal(gameStamp(path.join(os.tmpdir(), 'd2mm-nothing-here')), null);
});

test('a patch that lands while the app is open is reported once', async (t) => {
  const game = fakeGame(t);
  const seen = [];
  const watcher = createPatchWatcher({
    getGamePath: () => game,
    onPatch: (evt) => seen.push(evt),
    debounceMs: 20,
  });
  t.after(() => watcher.stop());
  watcher.start(gameStamp(game));

  const before = gameStamp(game);
  setInf(game, '6889');
  // a real patch rewrites many files, so the burst has to collapse into one report
  setSignatures(game, `${SIGNATURES}\r\n...\\..\\..\\dota\\other.vpk~SHA1:DDDD;CRC:4444`);
  await new Promise((r) => setTimeout(r, 200));

  assert.equal(seen.length, 1, 'one patch, one report');
  assert.equal(seen[0].from, before);
  assert.equal(seen[0].to, gameStamp(game));
});

test('touching nothing reports nothing', async (t) => {
  const game = fakeGame(t);
  const seen = [];
  const watcher = createPatchWatcher({ getGamePath: () => game, onPatch: (e) => seen.push(e), debounceMs: 20 });
  t.after(() => watcher.stop());
  watcher.start(gameStamp(game));

  // rewriting the same content is not a change, and neither is our own signature line
  setInf(game, '6888');
  setSignatures(game, `${SIGNATURES}\r\n${patcher.signatureLine(Buffer.from('x'))}`);
  await new Promise((r) => setTimeout(r, 200));
  assert.deepEqual(seen, []);
});

test('a repair that failed does not re-report the same patch', async (t) => {
  const game = fakeGame(t);
  let calls = 0;
  const watcher = createPatchWatcher({
    getGamePath: () => game,
    onPatch: () => { calls++; throw new Error('repair blew up'); },
    debounceMs: 20,
  });
  t.after(() => watcher.stop());
  watcher.start(gameStamp(game));

  setInf(game, '6889');
  await new Promise((r) => setTimeout(r, 200));
  watcher.check();
  assert.equal(calls, 1, 'retrying is the caller’s job, not the watcher’s');
});
