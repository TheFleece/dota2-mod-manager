/* Switching a feature off for the releases that are broken, and nowhere else.
 *
 * The version-bounded switch is new, and the danger in adding one is not in the new code. It is
 * in the copies already on people's machines, which read only `features` and `notices` and will
 * never be updated to read anything else. A block that leaked into what they act on would switch
 * the feature off for all of them. So those copies are tested with their own code:
 * test/fixtures/remote-config-2.6.12.js is the module exactly as 2.6.12 shipped it.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const current = require('../src/remote-config.js');
const shipped = require('./fixtures/remote-config-2.6.12.js');
const { verify } = require('../src/catalog-signature.js');

const load = () => import('../tools/rollback.mjs');
const TODAY = '2026-09-16';
const EMPTY = { features: {}, notices: [] };
const at = (day) => () => Date.parse(`${day}T12:00:00Z`);

const INSTALL_270 = {
  feature: 'install',
  versions: '2.7.0',
  until: '2026-09-30',
  en: 'Installing is paused in 2.7.0. Update to 2.7.1.',
  ru: 'В 2.7.0 установка на паузе. Обнови до 2.7.1.',
};

/** One copy of the app, of one version and one module generation, reading a config it has cached. */
function copyOf(t, lib, config, version, day = TODAY) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2mm-rollback-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'remote-config.json'), JSON.stringify(config));
  return lib.createRemoteConfig({ userDataDir: dir, appVersion: () => version, now: at(day) });
}

test('a block switches a feature off for the broken versions and nowhere else', async (t) => {
  const { addBlock } = await load();
  const { config } = addBlock(EMPTY, { ...INSTALL_270, versions: '2.7.0-2.7.1' }, TODAY);

  for (const [version, off] of [['2.6.13', false], ['2.7.0', true], ['2.7.1', true], ['2.7.2', false]]) {
    assert.equal(copyOf(t, current, config, version).feature('install').off, off, `install in ${version}`);
  }
  assert.equal(copyOf(t, current, config, '2.7.0').feature('cosmetics').off, false,
    'a switch nobody named was caught up in it');
});

test('the people it stops are told why, in their language, and nobody else is', async (t) => {
  const { addBlock } = await load();
  const { config } = addBlock(EMPTY, INSTALL_270, TODAY);

  const broken = copyOf(t, current, config, '2.7.0');
  assert.deepEqual(broken.feature('install', 'ru'), { off: true, note: INSTALL_270.ru });
  assert.equal(broken.notices('en')[0].text, INSTALL_270.en);
  assert.equal(broken.notices('en')[0].level, 'warn');
  assert.deepEqual(copyOf(t, current, config, '2.7.1').notices(), [], 'the fixed release was told about the broken one');
});

test('a block holds through its last day and lets go the day after', async (t) => {
  // nobody has to remember to take it out for the switch to come back on
  const { addBlock } = await load();
  const { config } = addBlock(EMPTY, INSTALL_270, TODAY);

  assert.equal(copyOf(t, current, config, '2.7.0', '2026-09-30').feature('install').off, true);
  const after = copyOf(t, current, config, '2.7.0', '2026-10-01');
  assert.equal(after.feature('install').off, false);
  assert.deepEqual(after.notices(), []);
});

test('copies already in the field ignore a block, running their own code', async (t) => {
  /* This is the proof that adding blocks is safe at all. 2.6.12 reads features and notices and
     nothing else; a block that ended up where it looks would switch installing off for every
     one of those copies, broken release or not. */
  const { addBlock } = await load();
  const { config } = addBlock(EMPTY, INSTALL_270, TODAY);

  const old = copyOf(t, shipped, config, '2.6.12');
  assert.equal(old.feature('install').off, false, 'a copy of 2.6.12 switched installing off');
  assert.deepEqual(old.notices(), [], 'a copy of 2.6.12 was shown a notice meant for 2.7.0');
  assert.deepEqual(shipped.normalize(config).features, {}, 'the block leaked into what old copies act on');
});

test('a block aimed at versions that cannot read it is refused, with what to do instead', async () => {
  const { addBlock } = await load();
  assert.ok(current.cmpVersion(current.BLOCKS_SINCE, '2.6.12') > 0, '2.6.12 shipped without blocks');
  assert.throws(() => addBlock(EMPTY, { ...INSTALL_270, versions: '2.6.12' }, TODAY), /2\.6\.13/);
  assert.throws(() => addBlock(EMPTY, { ...INSTALL_270, versions: '2.6.0-2.7.0' }, TODAY), /everywhere/);
});

test('the fallback for old copies reaches them, and so does taking it back', async (t) => {
  const { switchOff, switchOn } = await load();
  const off = switchOff(EMPTY, { feature: 'voice', en: 'Voices are paused.', ru: 'Озвучка на паузе.' });

  assert.equal(copyOf(t, shipped, off, '2.6.12').feature('voice').off, true, '2.6.12 did not honour the switch');
  assert.equal(copyOf(t, current, off, '2.7.0').feature('voice').off, true);

  const on = switchOn(off, 'voice');
  assert.equal(copyOf(t, shipped, on, '2.6.12').feature('voice').off, false);
  assert.throws(() => switchOn(on, 'voice'), /not switched off/);
});

test('lifting a block takes its notice with it and leaves the others', async () => {
  const { addBlock, liftBlock } = await load();
  let config = addBlock(EMPTY, INSTALL_270, TODAY).config;
  const { config: both, id } = addBlock(config, { ...INSTALL_270, feature: 'cosmetics' }, TODAY);
  config = both;

  const lifted = liftBlock(config, id);
  assert.deepEqual(lifted.blocks.map((b) => b.feature), ['install']);
  assert.deepEqual(lifted.notices.map((n) => n.id), [lifted.blocks[0].id]);
  assert.throws(() => liftBlock(lifted, id), /nothing has the id/);
});

test('pruning takes out only what is past its day', async () => {
  const { addBlock, pruneExpired } = await load();
  let config = addBlock(EMPTY, { ...INSTALL_270, until: '2026-09-20' }, TODAY).config;
  config = addBlock(config, { ...INSTALL_270, feature: 'cosmetics', until: '2026-10-20' }, TODAY).config;

  const { config: pruned, gone } = pruneExpired(config, '2026-09-25');
  assert.deepEqual(pruned.blocks.map((b) => b.feature), ['cosmetics']);
  assert.equal(pruned.notices.length, 1);
  assert.equal(gone.length, 1);
});

test('nonsense is refused before anything is written', async () => {
  const { addBlock } = await load();
  for (const [bad, why] of [
    [{ feature: 'selfDestruct' }, /not a switch/],
    [{ ru: '  ' }, /--en and --ru/],
    [{ until: 'next week' }, /--until must be a day/],
    [{ until: '2026-09-01' }, /already past/],
    [{ versions: '2.7.1-2.7.0' }, /comes after/],
    [{ versions: 'latest' }, /--versions must look like/],
    [{ url: 'http://example.com' }, /https/],
  ]) {
    assert.throws(() => addBlock(EMPTY, { ...INSTALL_270, ...bad }, TODAY), why, JSON.stringify(bad));
  }
});

test('a block with a damaged last day is dropped, not held forever', () => {
  /* The module fails open. A notice with a typo in its day shows with no end, which is harmless;
     a switch with one would be an outage nobody can end from the user's side. */
  const out = current.normalize({
    blocks: [
      { id: 'a', feature: 'install', minVersion: '2.7.0', until: 'soon' },
      { id: 'b', feature: 'install', minVersion: '2.7.0' },
      { id: 'c', feature: 'selfDestruct', until: '2026-09-30' },
    ],
  });
  assert.deepEqual(out.blocks, []);
});

test('the file is written with LF only, because the signature is over the bytes git publishes', async () => {
  const { addBlock, serialize } = await load();
  const text = serialize(addBlock(EMPTY, INSTALL_270, TODAY).config);
  assert.ok(!text.includes('\r'));
  assert.ok(text.endsWith('\n'));
});

test('a key the app does not pin is refused, because every copy would ignore what it signed', async () => {
  const { signFor, serialize } = await load();
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const pinned = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const bytes = Buffer.from(serialize(EMPTY));

  const sig = signFor(bytes, pem, pinned);
  assert.ok(verify(bytes, sig, pinned), 'a signature from the pinned key does not verify');
  assert.throws(() => signFor(bytes, pem), /not the one the app pins/);
});

test('the list says what the file is doing today', async () => {
  const { addBlock, switchOff, describe } = await load();
  assert.deepEqual(describe(EMPTY, TODAY), ['nothing is switched off and nobody is told anything']);

  let config = addBlock(EMPTY, { ...INSTALL_270, until: '2026-09-20' }, TODAY).config;
  config = switchOff(config, { feature: 'voice', en: 'Voices are paused.', ru: 'x' });
  const lines = describe(config, '2026-09-25');
  assert.ok(lines.some((l) => l.startsWith('OFF EVERYWHERE') && l.includes('voice')));
  assert.ok(lines.some((l) => l.startsWith('expired') && l.includes('install in 2.7.0')));
});
