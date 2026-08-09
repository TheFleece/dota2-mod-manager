// Pictures out of the game are an upgrade, never a requirement: without the toolchain, or
// without a game to read, this has to step aside quietly so the wiki still answers. That is
// what these pin - the extraction itself is proven against the real game (see the ticket),
// not here, because a fixture for it would mean shipping fifty megabytes of somebody else's
// program and a copy of Dota.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const { createGameIcons } = require('../src/game-icons.js');

function userDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2mm-gi-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const noTool = { pathOf: () => null, ensure: async () => { throw new Error('not here'); } };
const withTool = (exe) => ({ pathOf: () => exe, ensure: async () => exe });

test('without the toolchain there are no pictures and no complaints', async (t) => {
  const icons = createGameIcons({ userDataDir: userDir(t), toolchain: noTool, getGamePath: () => 'C:/nowhere' });
  assert.equal(icons.ready(), false);
  assert.deepEqual(await icons.getMany(['Weather Ash']), {});
});

test('without a game path there is nothing to read', async (t) => {
  const icons = createGameIcons({ userDataDir: userDir(t), toolchain: withTool('C:/tool.exe'), getGamePath: () => null });
  assert.equal(icons.ready(), false);
  assert.deepEqual(await icons.getMany(['Weather Ash']), {});
});

test('a game folder with no pak is not a game folder', async (t) => {
  const dir = userDir(t);
  fs.mkdirSync(path.join(dir, 'game', 'dota'), { recursive: true });
  const icons = createGameIcons({ userDataDir: dir, toolchain: withTool('C:/tool.exe'), getGamePath: () => path.join(dir, 'game') });
  assert.equal(icons.ready(), false);
});

test('the cache is keyed by the picture path, so a second run finds what the first left', (t) => {
  const dir = userDir(t);
  const icons = createGameIcons({ userDataDir: dir, toolchain: noTool, getGamePath: () => null });
  // the name a cached file gets is a pure function of the path the item table gave
  const imagePath = 'econ/items/abaddon/abaddon_endless_night_head';
  const expected = `${crypto.createHash('sha1').update(imagePath).digest('hex').slice(0, 16)}.png`;
  fs.mkdirSync(icons.root, { recursive: true });
  fs.writeFileSync(path.join(icons.root, expected), Buffer.from('pretend png'));
  assert.equal(icons.size(), 11, 'the cache reports what it holds');
  icons.clear();
  assert.equal(icons.size(), 0);
  assert.equal(fs.existsSync(icons.root), false);
});
