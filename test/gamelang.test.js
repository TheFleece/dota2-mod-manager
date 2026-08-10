// Which dota_<lang> folder the game mounts, and therefore where mods have to go. This is the
// single most common cause of "my mods do nothing": the engine substitutes the AUDIO language
// into its Game_Language search path and mounts nothing at all for English, so a mod sitting
// in a folder the game never mounts is invisible with no error anywhere.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const gamelang = require('../src/gamelang.js');

/** A throwaway ...\dota 2 beta\game tree. Returns the game path. */
function fakeGame(t, { boot, steamLang, folders = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'd2mm-lang-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const game = path.join(root, 'steamapps', 'common', 'dota 2 beta', 'game');
  fs.mkdirSync(path.join(game, 'dota', 'cfg'), { recursive: true });

  if (boot) fs.writeFileSync(path.join(game, 'dota', 'cfg', 'boot.vcfg'), boot);
  if (steamLang) {
    fs.writeFileSync(
      path.join(root, 'steamapps', 'appmanifest_570.acf'),
      `"AppState"\n{\n\t"appid"\t\t"570"\n\t"MountedConfig"\n\t{\n\t\t"language"\t\t"${steamLang}"\n\t}\n}\n`
    );
  }
  for (const [name, files] of Object.entries(folders)) {
    fs.mkdirSync(path.join(game, name), { recursive: true });
    for (const f of files) fs.writeFileSync(path.join(game, name, f), '');
  }
  return game;
}

const bootFile = (ui, audio) =>
  `"boot"\n{\n\t"UILanguage"\t\t"${ui}"\n\t"AudioLanguage"\t\t"${audio}"\n}\n`;

test('the two language settings are read separately', (t) => {
  const game = fakeGame(t, { boot: bootFile('english', 'russian') });
  // The combination most of the audience actually runs: English text, Russian voice - and it
  // is the voice language that decides the mod folder.
  assert.deepEqual(gamelang.bootLanguages(game), { ui: 'english', audio: 'russian' });
});

test('audio falls back to the UI language when the game recorded only one', (t) => {
  const game = fakeGame(t, { boot: '"boot"\n{\n\t"UILanguage"\t\t"german"\n}\n' });
  assert.deepEqual(gamelang.bootLanguages(game), { ui: 'german', audio: 'german' });
});

test('a game that has never booted reports no languages rather than a guess', (t) => {
  const game = fakeGame(t, {});
  assert.equal(gamelang.bootLanguages(game), null);
});

test("Steam's own language is the fallback before the game has ever run", (t) => {
  const game = fakeGame(t, { steamLang: 'russian' });
  assert.equal(gamelang.steamLanguage(game), 'russian');
  assert.deepEqual(gamelang.detectLangSuffix(game), {
    suffix: 'russian',
    source: 'steam',
    uiLanguage: null,
  });
});

test("the game's own setting wins over Steam's", (t) => {
  const game = fakeGame(t, { boot: bootFile('english', 'russian'), steamLang: 'schinese' });
  const got = gamelang.detectLangSuffix(game);
  assert.equal(got.suffix, 'russian');
  assert.equal(got.source, 'boot');
  assert.equal(got.uiLanguage, 'english');
});

test('an audio language Dota does not ship is ignored in favour of Steam', (t) => {
  const game = fakeGame(t, { boot: bootFile('english', 'klingon'), steamLang: 'russian' });
  const got = gamelang.detectLangSuffix(game);
  assert.equal(got.suffix, 'russian');
  assert.equal(got.source, 'steam');
});

test('with nothing official to go on the suffix is null, not a default', (t) => {
  const game = fakeGame(t, { boot: bootFile('klingon', 'klingon') });
  assert.deepEqual(gamelang.detectLangSuffix(game), {
    suffix: null,
    source: null,
    uiLanguage: 'klingon',
  });
});

test('every voice language gets the folder the engine will actually mount', () => {
  // Three of Dota's four voice languages have a folder of their own and keep it.
  assert.equal(gamelang.folderFor('russian'), 'russian');
  assert.equal(gamelang.folderFor('koreana'), 'koreana');
  assert.equal(gamelang.folderFor('schinese'), 'schinese');
});

test('English borrows the Russian folder, because it has none of its own', () => {
  // English speech ships inside dota/pak01, so Valve makes no dota_english and its gameinfo
  // mounts no language path for English at all. A dota_english built by hand is never read.
  assert.equal(gamelang.folderFor('english'), 'russian');
  assert.ok(!gamelang.MOD_FOLDERS.includes('english'));
});

test('an unknown audio language falls back rather than inventing a folder', () => {
  assert.equal(gamelang.folderFor('klingon'), 'russian');
  assert.equal(gamelang.folderFor(null), 'russian');
  assert.equal(gamelang.folderFor(undefined), 'russian');
});

test('the voice languages are the four Dota records, not the text languages', () => {
  // Reading the wrong one of the two lists is how a mod lands in a folder nobody mounts:
  // Dota has text in twenty-nine languages and voice in four.
  assert.deepEqual([...gamelang.VOICE_LANGUAGES].sort(), ['english', 'koreana', 'russian', 'schinese']);
  assert.ok(!gamelang.VOICE_LANGUAGES.includes('german'));
});

test("Valve's voice paks and our mod paks are told apart", (t) => {
  const game = fakeGame(t, {
    folders: {
      // pak01_* is the voice-over; everything else in here is a mod
      dota_russian: ['pak01_dir.vpk', 'pak01_000.vpk', 'pak10_dir.vpk', 'pak11_dir.vpk.off'],
    },
  });
  const [ru] = gamelang.langFolders(game);
  assert.equal(ru.suffix, 'russian');
  assert.equal(ru.official, true);
  assert.equal(ru.valveContent, true, 'pak01 present means the voice pack is installed');
  assert.equal(ru.modFiles, 2, 'a disabled mod still counts as ours');
});

test('a language folder holding only mods is not reported as Valve content', (t) => {
  const game = fakeGame(t, { folders: { dota_russian: ['pak10_dir.vpk'] } });
  const [ru] = gamelang.langFolders(game);
  assert.equal(ru.valveContent, false);
  assert.equal(ru.modFiles, 1);
});

test('addons, low violence and core are not language layers', (t) => {
  const game = fakeGame(t, {
    folders: { dota_addons: [], dota_lv: ['pak01_dir.vpk'], dota_core: [], dota_russian: [] },
  });
  assert.deepEqual(gamelang.langFolders(game).map((f) => f.suffix), ['russian']);
});

test('a made-up language folder is reported but flagged as unofficial', (t) => {
  const game = fakeGame(t, { folders: { dota_123: ['pak10_dir.vpk'] } });
  const [made] = gamelang.langFolders(game);
  assert.equal(made.suffix, '123');
  assert.equal(made.official, false, 'the engine will not mount this one');
});

test('the voice pack is only considered installed when its paks are on disk', (t) => {
  const game = fakeGame(t, {
    folders: { dota_russian: ['pak01_dir.vpk'], dota_german: ['pak10_dir.vpk'] },
  });
  // This is the mechanism behind serving mods from a Russian folder while voices stay
  // English: mount the folder, keep Valve's pak01 out of it.
  assert.equal(gamelang.voiceInstalled(game, 'russian'), true);
  assert.equal(gamelang.voiceInstalled(game, 'german'), false);
  assert.equal(gamelang.voiceInstalled(game, 'koreana'), false);
});

test('writing the languages patches the file and leaves other keys alone', (t) => {
  const game = fakeGame(t, {
    boot: '"boot"\n{\n\t"UILanguage"\t\t"english"\n\t"AudioLanguage"\t\t"english"\n\t"SomethingElse"\t\t"keep me"\n}\n',
  });
  gamelang.writeBootLanguages(game, { ui: 'english', audio: 'russian' });

  const got = gamelang.bootLanguages(game);
  assert.deepEqual(got, { ui: 'english', audio: 'russian' });
  const text = fs.readFileSync(path.join(game, 'dota', 'cfg', 'boot.vcfg'), 'utf-8');
  assert.ok(text.includes('"keep me"'), 'unrelated settings survive');
});

test('writing the languages creates the file when the game never wrote one', (t) => {
  const game = fakeGame(t, {});
  gamelang.writeBootLanguages(game, { ui: 'ru', audio: 'russian' });
  assert.deepEqual(gamelang.bootLanguages(game), { ui: 'ru', audio: 'russian' });
});

// The app sets the audio language and nothing else: the folder it names is where mods have
// to live, while the language somebody reads the game in was their choice long before this.
test('the audio language can be set without touching the text one', (t) => {
  const game = fakeGame(t, {
    boot: '"boot"\n{\n\t"UILanguage"\t\t"koreana"\n\t"AudioLanguage"\t\t"english"\n}\n',
  });
  gamelang.writeBootLanguages(game, { audio: 'russian' });

  assert.deepEqual(gamelang.bootLanguages(game), { ui: 'koreana', audio: 'russian' });
});

test('setting only the audio language on a game that never booted writes just that', (t) => {
  const game = fakeGame(t, {});
  gamelang.writeBootLanguages(game, { audio: 'russian' });

  const text = fs.readFileSync(path.join(game, 'dota', 'cfg', 'boot.vcfg'), 'utf-8');
  assert.ok(!/UILanguage/i.test(text), 'no text language is invented for the user');
  assert.deepEqual(gamelang.bootLanguages(game), { ui: null, audio: 'russian' });
});

test('creating a mod folder mirrors Valve and never overwrites an existing gameinfo', (t) => {
  const game = fakeGame(t, {});

  const dir = gamelang.ensureLangFolder(game, 'russian');
  const gi = path.join(dir, 'gameinfo.gi');
  assert.ok(fs.existsSync(gi));
  const written = fs.readFileSync(gi, 'utf-8');
  assert.match(written, /LayeredOnMod\s+dota/);
  assert.match(written, /Game\s+dota_russian/);
  assert.match(written, /Mod\s+dota_russian/);

  fs.writeFileSync(gi, 'hand edited');
  gamelang.ensureLangFolder(game, 'russian');
  assert.equal(fs.readFileSync(gi, 'utf-8'), 'hand edited', "Valve's own file is left as found");
});

// ---------- English voices with the mods left in place ----------
// The mods live in dota_russian and stay there; what makes the speech Russian is Valve's own
// voice pack inside that folder, so the switch moves the pack out of the mount and nothing else.
