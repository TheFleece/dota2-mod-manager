/* Living next to Minify.
 *
 * The two apps get mods into the game by different routes, and the difference is the whole
 * story - so it is written down here rather than guessed at each time somebody looks.
 *
 * What this app does: Dota keeps a text language and a voice language in game/dota/cfg/
 * boot.vcfg, and gameinfo.gi builds its Game_Language search path out of the VOICE one
 * (measured with -condebug, see the vault). Three of Dota's languages have a voice folder of
 * their own, so the app sets the voice language to one of those three and fills that folder.
 * No launch parameters, no extra VPK, and nothing the game did not already support.
 *
 * What Minify does: it writes `-language <locale>` into Steam's launch options
 * (Minify/core/steam.py, fix_launch_options) and fills the folder that names. Its own locale
 * is "minify" -> game/dota_minify, and for English it ships a fix built on Dutch.
 *
 * The part that matters, and the part this file used to get wrong: since Dota's 2026-07-24
 * update the mounted folder comes from the game's own language setting and NOT from
 * -language, and the setting only takes a real Dota language. So dota_minify does not mount
 * at all any more - which is presumably why Minify v1.14rc6 moved to Dutch, "to mount the
 * VPKs properly". Dutch is a real language, so dota_dutch does mount, and that is the version
 * that can actually collide with us: one folder is mounted and it is either theirs or ours.
 *
 * None of which is a fight to win. It is a thing to be able to explain in a sentence, so
 * whoever is looking at a game with no mods in it knows why.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/** Its own locale, which is not a language Dota knows, and the real one it moved to. */
const MINIFY_FOLDER = 'minify';
const MINIFY_BORROWED = 'dutch';

/* The pak slots Minify writes, from its own ARCHITECTURE.md: 65 for merged VPK mods, 66 for
 * the ones it compiles, 67 for what its d2pfx browser installs. We hand out pak10 to pak99,
 * so without this we would eventually name a file it is going to write over - and the loser
 * is whichever of us wrote first. Three slots out of ninety is the whole price of never
 * having to coordinate, so they are skipped whether or not Minify is installed today. */
const RESERVED_PAKS = [65, 66, 67];

/** Where Minify keeps the settings it publishes about itself. */
function configPath() {
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  return path.join(local, 'Dota2-Minify', 'config', 'minify_config.json');
}

/**
 * What Minify says about itself, or null. Its own config beats anything we could infer: it
 * names the locale it sets, which is the whole question between the two apps.
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
 * @param {string|null} p.audio  the voice language the game is set to, which names the folder
 *   it mounts
 * @param {string[]} p.gameLanguages  the languages Dota will accept for that setting
 * @param {string} p.ourFolder   the suffix this app installs into, from gamelang.folderFor()
 * @param {number} [p.ourMods]   how many mods this app has installed
 * @returns {{
 *   present: boolean, folder: string|null, mods: number, mounts: boolean,
 *   mounted: string|null, ourFolder: string, sharing: boolean,
 *   live: 'ours'|'minify'|'both'|'neither'|'unknown', declared: boolean,
 * }}
 */
function readMinify({
  folders = [], audio = null, gameLanguages = [], ourFolder, ourMods = 0, config = readConfig(),
}) {
  const at = (suffix) => folders.find((f) => f.suffix === suffix) || null;
  const declared = config && config.locale ? config.locale : null;

  /* Its own folder is proof by name. The borrowed one is proof only when it holds mods:
   * dota_dutch is a folder Valve ships voice for, so an empty one means somebody simply owns
   * the Dutch voice pack, and calling that Minify would be a guess dressed as a finding. */
  const borrowed = at(MINIFY_BORROWED);
  const folder = declared
    || (at(MINIFY_FOLDER) ? MINIFY_FOLDER : (borrowed && borrowed.modFiles > 0 ? MINIFY_BORROWED : null));
  const present = !!folder;
  const mods = folder ? (at(folder)?.modFiles || 0) : 0;

  /* Whether the folder it fills is one Dota can be pointed at. Its default locale is not a
   * language, so on today's game that folder is never mounted and its mods do nothing - no
   * matter what either app does. Worth saying plainly; it is not a conflict with us. */
  const mounts = present && gameLanguages.includes(folder);

  const mounted = audio ? String(audio).toLowerCase() : null;
  const sharing = present && folder === ourFolder;

  let live = 'unknown';
  if (mounted) {
    const oursLive = mounted === ourFolder && ourMods > 0;
    const minifyLive = mounts && mounted === folder && mods > 0;
    if (sharing && (oursLive || minifyLive)) live = 'both';
    else if (oursLive && minifyLive) live = 'both';
    else if (oursLive) live = 'ours';
    else if (minifyLive) live = 'minify';
    else live = 'neither';
  }

  return { present, folder, mods, mounts, mounted, ourFolder, sharing, live, declared: !!declared };
}

module.exports = { readMinify, readConfig, configPath, MINIFY_FOLDER, MINIFY_BORROWED, RESERVED_PAKS };
