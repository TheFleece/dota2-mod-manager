/* Living next to Minify.
 *
 * Minify (github.com/egezenn/dota2-minify) loads mods the same way this app does, and that is
 * the whole problem. Dota substitutes the audio language into its Game_Language search path,
 * so it mounts exactly one folder: dota_<AudioLanguage>. Both managers set that setting and
 * fill the folder it names - we set russian and fill dota_russian, Minify sets its own
 * language (dota_minify, or dutch since its v1.14rc6, which is its fix for English) and fills
 * that one.
 *
 * Which means the two cannot both be live unless their mods are in the same folder, and
 * whichever app patched the setting last decides whose mods the game reads. Nothing is
 * corrupted and nothing overwrites anything; the other app's mods simply stop appearing, and
 * from the outside that looks exactly like a broken mod manager. Both sets of users have been
 * told to reinstall over it.
 *
 * So the job here is not to fight for the folder. It is to work out, from what is on disk,
 * whose mods the game is actually going to read, and to be able to say so in a sentence.
 * Everything below is derived from data the app already collects - gamelang.langFolders() and
 * gamelang.detectLangSuffix() - so this makes no guesses of its own and touches nothing.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/** Minify's own language layer, and the one it borrows when Workshop Tools are involved. */
const MINIFY_FOLDER = 'minify';
const MINIFY_BORROWED = 'dutch';

/* The pak slots Minify writes, from its own ARCHITECTURE.md: 65 for merged VPK mods, 66 for
 * the ones it compiles, 67 for what its d2pfx browser installs. We hand out pak10 to pak99,
 * so without this we would eventually name a file it is going to write over - and the loser
 * is whichever of us wrote first. Three slots out of ninety is the whole price of never
 * having to coordinate, so they are skipped whether or not Minify is installed today:
 * somebody who adds it next week should not find their mods quietly replaced. */
const RESERVED_PAKS = [65, 66, 67];

/** Where Minify keeps the settings it publishes about itself. */
function configPath() {
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  return path.join(local, 'Dota2-Minify', 'config', 'minify_config.json');
}

/**
 * What Minify says about itself, or null. Its own config is worth more than anything we could
 * infer from the folders: it names the path it writes to and the locale it sets, which is the
 * whole question between us.
 * @returns {{ outputPath: string|null, locale: string|null }|null}
 */
function readConfig(file = configPath()) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const outputPath = typeof raw.output_path === 'string' ? raw.output_path : null;
    const locale = typeof raw.output_locale === 'string' ? raw.output_locale.toLowerCase() : null;
    if (!outputPath && !locale) return null;
    return { outputPath, locale };
  } catch {
    return null; // not installed, or a version that keeps its settings somewhere else
  }
}

/**
 * @param {object} p
 * @param {Array<{suffix: string, official: boolean, valveContent: boolean, modFiles: number}>} p.folders
 *   every dota_* folder on disk, from gamelang.langFolders()
 * @param {string|null} p.audio  the audio language the game will boot with, raw
 * @param {string} p.ourFolder   the suffix this app installs into, from gamelang.folderFor()
 * @param {number} [p.ourMods]   how many mods this app has installed
 * @returns {{
 *   present: boolean, folder: string|null, mods: number,
 *   mounted: string|null, ourFolder: string, sharing: boolean,
 *   live: 'ours'|'minify'|'both'|'neither'|'unknown',
 * }}
 */
function readMinify({ folders = [], audio = null, ourFolder, ourMods = 0, config = readConfig() }) {
  const at = (suffix) => folders.find((f) => f.suffix === suffix) || null;
  const named = at(MINIFY_FOLDER);
  const borrowed = at(MINIFY_BORROWED);
  // What it told us beats what we guessed from the folder names.
  const declared = config && config.locale ? config.locale : null;

  /* Its own folder is proof by name. The borrowed one is proof only when it holds mods:
   * dota_dutch is a folder Valve ships voice for, so an empty one means somebody simply owns
   * the Dutch voice pack, and calling that Minify would be a guess dressed as a finding. */
  const folder = declared
    || (named ? MINIFY_FOLDER : (borrowed && borrowed.modFiles > 0 ? MINIFY_BORROWED : null));
  const present = !!folder;
  const mods = folder ? (at(folder)?.modFiles || 0) : 0;

  // The engine builds its mount path out of this setting, whatever it says.
  const mounted = audio ? String(audio).toLowerCase() : null;
  const sharing = present && folder === ourFolder;

  let live = 'unknown';
  if (mounted) {
    const oursLive = mounted === ourFolder && ourMods > 0;
    const minifyLive = present && mounted === folder && mods > 0;
    if (sharing && (oursLive || minifyLive)) live = 'both';
    else if (oursLive && minifyLive) live = 'both';
    else if (oursLive) live = 'ours';
    else if (minifyLive) live = 'minify';
    else live = 'neither';
  }

  return { present, folder, mods, mounted, ourFolder, sharing, live, declared: !!declared };
}

module.exports = { readMinify, readConfig, configPath, MINIFY_FOLDER, MINIFY_BORROWED, RESERVED_PAKS };
