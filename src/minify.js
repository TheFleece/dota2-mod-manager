/* Living next to Minify.
 *
 * The two apps reach the game by different routes, and the routes are not equivalent. The
 * rules underneath both are in src/gamelang.js, which is the one place they are written down.
 *
 * This app: set the voice language in Dota's own settings to one of the three that have a
 * folder, and fill that folder. The folders already exist on every install, English voices
 * keep playing because the chosen voice pack was never downloaded, and the player still picks
 * whatever text language they want.
 *
 * Minify: put `-language <locale>` in Steam's launch options (Minify/core/steam.py,
 * fix_launch_options) and fill the folder that names. The folder does not exist until Minify
 * creates it with a gameinfo.gi of its own; the parameter locks both language settings, so
 * getting English text back needs the VPK of English localization it ships; and setting any
 * of it up means writing into Steam's own config.
 *
 * Its own locale is "minify", which is not a language, and since the 2026-07-24 update the
 * game mounts nothing by that name - which is why its newer releases moved to Dutch. Dutch is
 * a language, so dota_dutch does mount, and that is the version that can hold the folder
 * instead of us. The author knows all of this; the Dutch move and the English-fix VPK are the
 * answer to it, not an oversight to point out.
 *
 * None of which is a fight to win. It is a thing to be able to explain in a sentence, so
 * whoever is looking at a game with no mods in it knows why.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { listVpkPathsFile } = require('./vpk');

/** Its own locale, which is not a language Dota knows, and the real one it moved to. */
const MINIFY_FOLDER = 'minify';
const MINIFY_BORROWED = 'dutch';

/* The pak slots Minify writes, from its own ARCHITECTURE.md: 65 for merged VPK mods, 66 for
 * the ones it compiles, 67 for what its d2pfx browser installs. We hand out pak10 to pak99,
 * so without this we would eventually name a file it is going to write over - and the loser
 * is whichever of us wrote first. Three slots out of ninety is the whole price of never
 * having to coordinate, so they are skipped whether or not Minify is installed today. */
const RESERVED_PAKS = [65, 66, 67];

/**
 * Is this file in the language folder one of Minify's paks?
 *
 * Reserving the slots keeps us from writing over its work, which is only half the bargain.
 * The other half is not touching what it wrote: the master switch sweeps the folder and
 * renames every mod file in it, and the foreign-file scan offers the user everything in there
 * that is not ours to adopt, disable or delete. Sharing one folder is the arrangement we tell
 * people to make, so in that arrangement both of those would reach into another program.
 *
 * Matches the dir file and its data volumes: pak66_dir.vpk, pak66_000.vpk, and the same with
 * an .off or .moff already on the end.
 * @param {string} baseLower a file name, lowercased
 */
function isMinifyFile(baseLower) {
  const m = String(baseLower).match(/^pak(\d{2})_(?:dir|\d{3})\.vpk(?:\.off|\.moff)?$/);
  return !!m && RESERVED_PAKS.includes(Number(m[1]));
}

/* How Minify marks its own work, and how it recognises it again.
 *
 * It packs metadata files into every VPK it builds and checks for them before deleting one
 * (Minify/patch/vpk_utils.py, is_minify_pak). Reading the same marker is better than reasoning
 * from slot numbers: a slot says where a file sits, the marker says who made it, and it is the
 * only thing that can identify its maps/dota.vpk - a path with no number to reserve.
 *
 * Reading their convention rather than proposing one costs nothing and needs no agreement.
 */
const MINIFY_MARKERS = ['minify_mods.json', 'minify_vpk_mods.txt', 'minify_version.txt'];

/**
 * Was this VPK built by Minify? Reads the archive index only, never the content.
 * @param {string} file  full path to a *_dir.vpk
 */
function isMinifyPak(file) {
  try {
    const names = listVpkPathsFile(file).map((n) => String(n).toLowerCase());
    return MINIFY_MARKERS.some((m) => names.includes(m));
  } catch {
    return false; // unreadable, half-written, or not a VPK: not something to claim
  }
}

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

module.exports = { readMinify, readConfig, configPath, isMinifyFile, isMinifyPak, MINIFY_MARKERS, MINIFY_FOLDER, MINIFY_BORROWED, RESERVED_PAKS };
