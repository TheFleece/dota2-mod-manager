// Living next to Minify. The two apps name a language folder by different means - Dota's own
// setting here, a Steam launch option there - and Dota mounts exactly one, so the only
// question worth answering is whose mods the game is going to read. Getting that answer wrong in either direction is worse than saying nothing: telling
// somebody their mods are dark when they are fine sends them reinstalling over a working
// setup, and the opposite leaves them staring at a game with no mods in it.
const test = require('node:test');
const assert = require('node:assert/strict');

const { readMinify: read, readConfig, MINIFY_FOLDER, MINIFY_BORROWED, RESERVED_PAKS } = require('../src/minify.js');

/* Every case below describes a whole machine, so none of them may read the Minify that is
 * installed on the one running the tests: without this the suite passes or fails depending on
 * whether the developer happens to use it. */
const DOTA_LANGUAGES = require('../src/gamelang.js').DOTA_LANGUAGES;
const readMinify = (p) => read({ config: null, gameLanguages: DOTA_LANGUAGES, ...p });

/** One entry of gamelang.langFolders(). */
const folder = (suffix, modFiles = 0, official = false) => ({
  suffix, official, valveContent: false, modFiles,
});

test('with no Minify anywhere, ours are the mods that load', () => {
  const got = readMinify({
    folders: [folder('russian', 4, true)],
    audio: 'russian',
    ourFolder: 'russian',
    ourMods: 4,
  });
  assert.equal(got.present, false);
  assert.equal(got.folder, null);
  assert.equal(got.live, 'ours');
});

test('its own folder is proof enough, even before it holds anything', () => {
  const got = readMinify({
    folders: [folder('russian', 4, true), folder(MINIFY_FOLDER, 0)],
    audio: 'russian',
    ourFolder: 'russian',
    ourMods: 4,
  });
  assert.equal(got.present, true);
  assert.equal(got.folder, MINIFY_FOLDER);
  assert.equal(got.mods, 0);
  assert.equal(got.live, 'ours', 'an empty Minify folder does not take the game from us');
});

test('its own locale is not a language, so that folder never mounts and nothing is a conflict', () => {
  // Since Dota's 2026-07-24 update the mount path comes from the game's language setting
  // rather than from -language, and the setting takes a language. "minify" is not one, so
  // dota_minify is read by nothing - which is why Minify itself moved to Dutch. Saying "the
  // game is reading its mods" here would be wrong in the way that sends somebody digging.
  const got = readMinify({
    folders: [folder('russian', 7, true), folder(MINIFY_FOLDER, 3)],
    audio: MINIFY_FOLDER,
    ourFolder: 'russian',
    ourMods: 7,
  });
  assert.equal(got.present, true);
  assert.equal(got.mounts, false, 'dota_minify cannot be mounted by this game');
  assert.equal(got.live, 'neither', 'the setting points at a folder the game will not read');
});

test('the Dutch it moved to is a real language, and that one does mount', () => {
  const got = readMinify({
    folders: [folder('russian', 7, true), folder(MINIFY_BORROWED, 3)],
    audio: MINIFY_BORROWED,
    ourFolder: 'russian',
    ourMods: 7,
  });
  assert.equal(got.mounts, true);
  assert.equal(got.live, 'minify', 'this is the version that can actually take the folder');
});

test("Minify's Dutch trick for English is recognised as its doing", () => {
  // Not the same move this app makes. It sets Dutch through a Steam launch option, which
  // locks both language settings, creates a folder that did not exist, and needs a VPK of
  // English localization to give the text back. See src/gamelang.js for the rules.
  const got = readMinify({
    folders: [folder('russian', 7, true), folder(MINIFY_BORROWED, 2)],
    audio: MINIFY_BORROWED,
    ourFolder: 'russian',
    ourMods: 7,
  });
  assert.equal(got.present, true);
  assert.equal(got.folder, MINIFY_BORROWED);
  assert.equal(got.mounts, true, 'Dutch is a language Dota knows, so the folder is read');
  assert.equal(got.live, 'minify');
});

test('an empty Dutch folder is somebody who owns the Dutch voice pack, not Minify', () => {
  const got = readMinify({
    folders: [folder('russian', 7, true), folder(MINIFY_BORROWED, 0)],
    audio: 'russian',
    ourFolder: 'russian',
    ourMods: 7,
  });
  assert.equal(got.present, false, 'a guess dressed as a finding');
  assert.equal(got.live, 'ours');
});

test('both in the one folder the game mounts means both load', () => {
  const got = readMinify({
    folders: [folder(MINIFY_FOLDER, 5)],
    audio: MINIFY_FOLDER,
    ourFolder: MINIFY_FOLDER,
    ourMods: 2,
  });
  assert.equal(got.sharing, true);
  assert.equal(got.live, 'both');
});

test('a setting pointing at a folder nobody filled means nothing loads', () => {
  const got = readMinify({
    folders: [folder('russian', 7, true), folder(MINIFY_FOLDER, 3)],
    audio: 'koreana',
    ourFolder: 'russian',
    ourMods: 7,
  });
  assert.equal(got.live, 'neither');
});

test('without a language to read, no claim is made about whose mods load', () => {
  const got = readMinify({
    folders: [folder('russian', 7, true), folder(MINIFY_FOLDER, 3)],
    audio: null,
    ourFolder: 'russian',
    ourMods: 7,
  });
  assert.equal(got.present, true);
  assert.equal(got.live, 'unknown');
  assert.equal(got.mounted, null);
});

test('the setting is read whatever case it was written in', () => {
  const got = readMinify({
    folders: [folder(MINIFY_BORROWED, 3)],
    audio: 'Dutch',
    ourFolder: 'russian',
    ourMods: 1,
  });
  assert.equal(got.mounted, MINIFY_BORROWED);
  assert.equal(got.live, 'minify');
});

test("Minify's own config beats anything guessed from folder names", (t) => {
  // It publishes the locale it sets, and that is the whole question between the two apps -
  // so a folder that does not exist yet (nothing patched since it was installed) is still
  // known about, and a locale we would never have guessed is taken at its word.
  const got = read({
    folders: [folder('russian', 4, true)],
    audio: 'russian',
    ourFolder: 'russian',
    ourMods: 4,
    config: { outputPath: 'C:/Steam/steamapps/common/dota 2 beta/game/dota_polish', locale: 'polish' },
  });
  assert.equal(got.present, true);
  assert.equal(got.folder, 'polish');
  assert.equal(got.declared, true);
  assert.equal(got.live, 'ours', 'ours are mounted; its folder is not the one the game reads');
});

test('the pak slots Minify writes are named, so ours can stay out of them', () => {
  // From its own ARCHITECTURE.md: 65 merged, 66 compiled, 67 from its d2pfx browser.
  assert.deepEqual(RESERVED_PAKS, [65, 66, 67]);
});

test('a config that is not there is not an answer', () => {
  assert.equal(readConfig('C:/no/such/minify_config.json'), null);
});
