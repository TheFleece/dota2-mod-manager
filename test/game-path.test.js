// What counts as a Dota install.
//
// Written after a real one (2026-08-14). A user moved his Steam library from C to F. Steam
// left the empty folder tree behind on C, as it does, and the app's check was "is there a
// folder called dota in there" - which there was. So it kept installing into the leftovers:
// forty-three mods reported as installed, nothing in the game, and the library still listing
// them all. The check now asks for Valve's own content pak, the one file that cannot be
// present unless the game is.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { validateGamePath } = require('../src/steam.js');
const { Installer } = require('../src/installer.js');

function tmpDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2mm-gamepath-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** A game folder as Steam leaves it behind after the library moves: the tree, none of it. */
function movedAway(root) {
  const game = path.join(root, 'steamapps', 'common', 'dota 2 beta', 'game');
  fs.mkdirSync(path.join(game, 'dota'), { recursive: true });
  return game;
}

/** A real one: the tree plus the content pak. */
function realInstall(root) {
  const game = movedAway(root);
  fs.writeFileSync(path.join(game, 'dota', 'pak01_dir.vpk'), 'not really a vpk, but it is there');
  return game;
}

test('the leftovers of a moved library are not an install', (t) => {
  const dir = tmpDir(t);
  assert.equal(validateGamePath(movedAway(dir)), false);
});

test('a folder with the content pak in it is', (t) => {
  const dir = tmpDir(t);
  assert.equal(validateGamePath(realInstall(dir)), true);
});

test('nothing, a missing folder and a file all fail rather than throw', (t) => {
  const dir = tmpDir(t);
  const file = path.join(dir, 'a-file');
  fs.writeFileSync(file, 'x');
  for (const bad of [null, undefined, '', path.join(dir, 'nope'), file]) {
    assert.equal(validateGamePath(bad), false, `refused: ${JSON.stringify(bad)}`);
  }
});

// The gate that matters: mkdir is recursive, so before this the installer answered a wrong
// path by building the whole tree and writing into it.
test('the installer refuses to make a mods folder where the game is not', (t) => {
  const dir = tmpDir(t);
  const game = movedAway(dir);
  const inst = new Installer({
    userDataDir: tmpDir(t),
    getGamePath: () => game,
    getLangSuffix: () => 'russian',
    onProgress: () => {},
  });

  assert.throws(() => inst.ensureLangFolder(), /Dota 2/);
  assert.equal(fs.existsSync(path.join(game, 'dota_russian')), false, 'and it created nothing');
});

test('with a real install it makes the folder as before', (t) => {
  const dir = tmpDir(t);
  const game = realInstall(dir);
  const inst = new Installer({
    userDataDir: tmpDir(t),
    getGamePath: () => game,
    getLangSuffix: () => 'russian',
    onProgress: () => {},
  });

  const made = inst.ensureLangFolder();
  assert.equal(made, path.join(game, 'dota_russian'));
  assert.ok(fs.existsSync(path.join(made, 'gameinfo.gi')), 'with the layer definition in it');
});
