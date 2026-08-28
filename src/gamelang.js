/* Which dota_<lang> folder the game actually mounts.
 *
 * Dota's 2026-07-24 update split the language setting in two — "Language" (UI text) and
 * "Audio Language" (spoken) — and stores both in game/dota/cfg/boot.vcfg:
 *
 *   "boot" { "UILanguage" "russian"  "AudioLanguage" "russian" }
 *
 * The engine substitutes the AUDIO language into the Game_Language search path
 * (`dota_*LANGUAGE*` in dota/gameinfo.gi). That folder holds the localized voice paks —
 * which is why switching it asks for a restart, while switching UI text does not.
 *
 * Consequence for mods: a made-up folder like dota_123 no longer mounts, because the value
 * comes from the game's own settings instead of a free-form `-language` argument. Text is
 * unaffected either way: every language's strings live in dota/pak01 (resource/localization),
 * so `-language 123` used to fall back to English simply because no *_123.txt existed.
 */
const fs = require('fs');
const path = require('path');

/* Languages Dota records VOICE in - four of them, and that is the list that matters here.
 *
 * The engine substitutes the audio language into its Game_Language search path, so the folder
 * a mod has to live in is named by this setting and by nothing else. Text is a different list
 * of twenty-nine languages living in dota/pak01, and it has no bearing on any of this; reading
 * the wrong one of the two is how a mod ends up in a folder nobody mounts.
 */
const VOICE_LANGUAGES = ['english', 'koreana', 'russian', 'schinese'];

/* Three of those four get a folder on disk.
 *
 * English speech ships inside dota/pak01 with the base game, so Valve makes no dota_english,
 * and its own gameinfo.gi mounts the language path only "if running a specific language",
 * which English is not. A dota_english built by hand, correct gameinfo.gi and all, filled with
 * mods, is never read. Tested 2026-08-10 rather than assumed, twice.
 */
const MOD_FOLDERS = ['koreana', 'russian', 'schinese'];

/** Borrowed by English, and by anything unrecognised. */
const FALLBACK_FOLDER = 'russian';

/**
 * Where mods have to live for a given audio language.
 *
 * English has no folder of its own, so it borrows the Russian one. The folder mounts whether
 * or not Valve's voice pack was ever downloaded, because Steam decides what is on disk and
 * Dota decides what is mounted, and they are separate. So an English speaker gets a mounted
 * dota_russian holding nothing but mods, and keeps hearing the English speech out of
 * dota/pak01 without noticing anything happened.
 */
function folderFor(audio) {
  return MOD_FOLDERS.includes(audio) ? audio : FALLBACK_FOLDER;
}

// what Valve puts in every official language folder; mirrored when we have to create one
const gameinfoStub = (suffix) => `"GameInfo"
{
	LayeredOnMod	dota

	FileSystem
	{
		SearchPaths
		{
			Game				dota_${suffix}
			Game				dota
			Game				core

			Mod					dota_${suffix}
			Mod					dota

			AddonRoot			dota_addons

			// Note: addon content is included in publiccontent by default.
			PublicContent		core
		}
	}
}
`;

const readKey = (text, key) => {
  const m = text.match(new RegExp(`"${key}"\\s*"([^"]+)"`, 'i'));
  return m ? m[1].trim().toLowerCase() : null;
};

/** UI + audio language the game wrote at its last boot, or null if it never ran. */
function bootLanguages(gamePath) {
  if (!gamePath) return null;
  try {
    const file = path.join(gamePath, 'dota', 'cfg', 'boot.vcfg');
    const text = fs.readFileSync(file, 'utf-8');
    const audio = readKey(text, 'AudioLanguage');
    const ui = readKey(text, 'UILanguage');
    if (!audio && !ui) return null;
    return { ui, audio: audio || ui };
  } catch {
    return null;
  }
}

/** Language Steam has the game mounted as — the fallback before Dota has ever booted. */
function steamLanguage(gamePath) {
  if (!gamePath) return null;
  try {
    // <lib>/steamapps/common/dota 2 beta/game -> <lib>/steamapps/appmanifest_570.acf
    const acf = path.resolve(gamePath, '..', '..', '..', 'appmanifest_570.acf');
    const text = fs.readFileSync(acf, 'utf-8');
    for (const block of ['MountedConfig', 'UserConfig']) {
      const m = text.match(new RegExp(`"${block}"\\s*\\{([^}]*)\\}`, 'i'));
      const lang = m && readKey(m[1], 'language');
      if (lang) return lang;
    }
  } catch { /* not a Steam layout, or no manifest */ }
  return null;
}

/** Every dota_* folder on disk, with what is inside each. */
function langFolders(gamePath) {
  if (!gamePath) return [];
  const out = [];
  let names = [];
  try { names = fs.readdirSync(gamePath, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return []; }
  for (const name of names) {
    const m = name.match(/^dota_(.+)$/i);
    if (!m) continue;
    const suffix = m[1].toLowerCase();
    if (suffix === 'addons' || suffix === 'lv' || suffix === 'core') continue; // not language layers
    let files = [];
    try { files = fs.readdirSync(path.join(gamePath, name)); } catch { /* unreadable */ }
    out.push({
      suffix,
      official: MOD_FOLDERS.includes(suffix),
      // Valve's own voice paks vs anything we or another tool put there
      valveContent: files.some((f) => /^pak01_/i.test(f)),
      modFiles: files.filter((f) => /^pak\d+_dir\.vpk(\.off|\.moff)?$/i.test(f) && !/^pak01_/i.test(f)).length,
    });
  }
  return out;
}

/**
 * The folder suffix the game will mount, and where that answer came from.
 * `boot` (the game's own setting) wins over `steam` (what the depot is set to).
 */
/* `suffix` is the audio language among the four Dota records voice in; `audio` is whatever
 * the setting actually says, which is not always one of them. Another mod manager can put a
 * language there that Valve ships no voice for - Minify sets Dutch, so the engine mounts
 * dota_dutch and reads its mods out of it - and the folder Dota mounts follows that value
 * whether or not we recognise it. Anything asking "whose mods are live" needs the raw one.
 */
function detectLangSuffix(gamePath) {
  const boot = bootLanguages(gamePath);
  const steam = steamLanguage(gamePath);
  const audio = boot?.audio || steam || null;
  if (boot?.audio && VOICE_LANGUAGES.includes(boot.audio)) {
    return { suffix: boot.audio, source: 'boot', uiLanguage: boot.ui || null, audio };
  }
  if (steam && VOICE_LANGUAGES.includes(steam)) {
    return { suffix: steam, source: 'steam', uiLanguage: boot?.ui || null, audio };
  }
  return { suffix: null, source: null, uiLanguage: boot?.ui || null, audio };
}

/**
 * Set the game's language settings. Dota reads boot.vcfg at startup, so this has to happen
 * while the game is closed. Existing keys are patched in place and anything else in the file
 * is left alone; a missing file gets Valve's own shape.
 *
 * Either setting may be left out, and the app leaves the text one out always: which language
 * somebody reads the game in is their business, decided long before this app arrived. Only
 * the audio language is ours to set, because it is what names the folder the engine mounts
 * and therefore where a mod has to live.
 */
function writeBootLanguages(gamePath, { ui, audio }) {
  const file = path.join(gamePath, 'dota', 'cfg', 'boot.vcfg');
  let text = null;
  try { text = fs.readFileSync(file, 'utf-8'); } catch { /* first write */ }
  const pairs = [['UILanguage', ui], ['AudioLanguage', audio]].filter(([, v]) => v);
  if (!text || !/"boot"/i.test(text)) {
    text = `"boot"\n{\n${pairs.map(([k, v]) => `\t"${k}"\t\t"${v}"\n`).join('')}}\n`;
  } else {
    for (const [key, value] of pairs) {
      const re = new RegExp(`("${key}"\\s*")[^"]*(")`, 'i');
      if (re.test(text)) text = text.replace(re, `$1${value}$2`);
      else text = text.replace(/\}\s*$/, `\t"${key}"\t\t"${value}"\n}\n`);
    }
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return { ui, audio };
}

/** Is Valve's voice pack for this language actually on disk? If not, voices stay English. */
function voiceInstalled(gamePath, suffix) {
  try {
    return fs.readdirSync(path.join(gamePath, `dota_${suffix}`)).some((f) => /^pak01_/i.test(f));
  } catch {
    return false;
  }
}

/**
 * Make sure the mod folder exists. English is the one language Valve ships no folder for
 * (English voice lives in dota/pak01), so for it we create the layer ourselves, shaped
 * exactly like Valve's own — never touching a gameinfo.gi that is already there.
 */
function ensureLangFolder(gamePath, suffix) {
  const dir = path.join(gamePath, `dota_${suffix}`);
  fs.mkdirSync(dir, { recursive: true });
  const gi = path.join(dir, 'gameinfo.gi');
  if (!fs.existsSync(gi)) fs.writeFileSync(gi, gameinfoStub(suffix));
  return dir;
}

module.exports = {
  VOICE_LANGUAGES,
  MOD_FOLDERS,
  FALLBACK_FOLDER,
  folderFor,
  bootLanguages,
  steamLanguage,
  langFolders,
  detectLangSuffix,
  writeBootLanguages,
  voiceInstalled,
  ensureLangFolder,
};
