// Steam / Dota 2 installation discovery (Windows)
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

function regQuery(hive, key, value) {
  return new Promise((resolve) => {
    execFile('reg', ['query', `${hive}\\${key}`, '/v', value], (err, stdout) => {
      if (err || !stdout) return resolve(null);
      const m = stdout.match(/REG_SZ\s+(.+)/);
      resolve(m ? m[1].trim() : null);
    });
  });
}

function parseLibraryFolders(vdfText) {
  // libraryfolders.vdf: "path" "C:\\..." entries
  const paths = [];
  const re = /"path"\s+"([^"]+)"/g;
  let m;
  while ((m = re.exec(vdfText)) !== null) {
    paths.push(m[1].replace(/\\\\/g, '\\'));
  }
  return paths;
}

async function findSteamRoot() {
  const candidates = [
    await regQuery('HKCU', 'SOFTWARE\\Valve\\Steam', 'SteamPath'),
    await regQuery('HKLM', 'SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath'),
    await regQuery('HKLM', 'SOFTWARE\\Valve\\Steam', 'InstallPath'),
  ];
  for (let c of candidates) {
    if (!c) continue;
    c = c.replace(/\//g, '\\');
    if (fs.existsSync(c)) return c;
  }
  return null;
}

async function findDotaGamePath() {
  const steamRoot = await findSteamRoot();
  const libs = [];
  if (steamRoot) {
    libs.push(steamRoot);
    const vdf = path.join(steamRoot, 'steamapps', 'libraryfolders.vdf');
    if (fs.existsSync(vdf)) {
      try {
        libs.push(...parseLibraryFolders(fs.readFileSync(vdf, 'utf-8')));
      } catch { /* ignore parse errors, fall back to scan */ }
    }
  }
  // common fallback locations on all drives
  for (const drive of 'CDEFGH') {
    libs.push(
      `${drive}:\\Program Files (x86)\\Steam`,
      `${drive}:\\Program Files\\Steam`,
      `${drive}:\\Steam`,
      `${drive}:\\Games\\Steam`,
      `${drive}:\\SteamLibrary`
    );
  }
  const seen = new Set();
  for (const lib of libs) {
    if (!lib || seen.has(lib.toLowerCase())) continue;
    seen.add(lib.toLowerCase());
    const game = path.join(lib, 'steamapps', 'common', 'dota 2 beta', 'game');
    if (validateGamePath(game)) return game; // the leftovers of a moved library are not a hit
  }
  return null;
}

/* A folder called "dota" is not a Dota install.
 *
 * This used to check for the subfolder and nothing else, and that is exactly how a user lost
 * 43 mods (2026-08-14). He had moved his library from C to F; Steam left the empty tree behind
 * on C, as it does; the app looked at "...\dota 2 beta\game\dota", said yes, and spent weeks
 * installing into a corpse. The library listed everything, the game showed nothing, and the
 * app's own log said "pak01_dir.vpk not found" a thousand times without anyone acting on it.
 *
 * So the test is Valve's own: the base content pak, or the executable. Either one is enough,
 * and the leftovers of a move have neither.
 *
 * Two markers rather than one because a single file can be absent from a real install for a
 * moment - mid-download, or while Steam verifies. Note which pak this is: game\dota\pak01_dir
 * is the game's own content and is always there. The pak01 files in game\dota_<language> are
 * the voice pack, which plenty of people never download, and testing for those would call a
 * working install broken.
 */
function validateGamePath(p) {
  if (!p) return false;
  try {
    return fs.existsSync(path.join(p, 'dota', 'pak01_dir.vpk'))
      || fs.existsSync(path.join(p, 'bin', 'win64', 'dota2.exe'));
  } catch {
    return false;
  }
}

module.exports = { findDotaGamePath, validateGamePath };
