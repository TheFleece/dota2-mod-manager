// Search-path patch: registers an extra content folder ahead of the game's own, which
// is the only way to override files the engine reads through the MOD path id -
// scripts/items/items_game.txt above all. Mods in a language folder can replace any
// ordinary asset, but never the item schema: MOD resolves to game/dota alone.
//
// Mechanics (same shape the community patchers use, rebuilt from the local files):
//   game/dota/gameinfo_branchspecific.gi  gets a FileSystem/SearchPaths block whose
//     content is derived from the CURRENT gameinfo.gi plus our folder, so a Valve
//     change to the search paths is carried over instead of silently dropped;
//   game/bin/win64/dota.signatures        gets a line with the patched file's SHA1+CRC,
//     because the client checks that file against the signature list.
//
// Everything is backed up before the first write and revert() puts the originals back.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { t } = require('./i18n');

const MARKER = 'Dota 2 Mod Manager';
// Content folder we register next to the game's own "dota".
const FOLDER = 'dota_mods';
const BIN_DIRS = { win32: ['bin', 'win64'], linux: ['bin', 'linuxsteamrt64'] };
const SIG_PREFIX = '...\\..\\..\\dota\\gameinfo_branchspecific.gi';

// Folder names other patchers register, so we can spot one and not fight it.
const KNOWN_FOREIGN = ['Dota2SkinChanger', 'DotaModdingCommunityMods', 'dota_tempcontent'];

function paths(gamePath) {
  const bin = BIN_DIRS[process.platform === 'linux' ? 'linux' : 'win32'];
  return {
    gameinfo: path.join(gamePath, 'dota', 'gameinfo.gi'),
    branch: path.join(gamePath, 'dota', 'gameinfo_branchspecific.gi'),
    signatures: path.join(gamePath, ...bin, 'dota.signatures'),
  };
}

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// The signature list stores the CRC little-endian, uppercase, like the SHA1 next to it.
function fileHashes(buf) {
  const sha1 = crypto.createHash('sha1').update(buf).digest('hex').toUpperCase();
  const le = Buffer.alloc(4);
  le.writeUInt32LE(crc32(buf));
  return { sha1, crc: le.toString('hex').toUpperCase() };
}

function signatureLine(buf) {
  const { sha1, crc } = fileHashes(buf);
  return `${SIG_PREFIX}~SHA1:${sha1};CRC:${crc}`;
}

// Pull the SearchPaths block out of gameinfo.gi (branchspecific has none by default).
function searchPathsBlock(gameinfoText) {
  const at = gameinfoText.indexOf('SearchPaths');
  if (at === -1) throw new Error(t('gameinfo.gi: блок SearchPaths не найден'));
  const open = gameinfoText.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < gameinfoText.length; i++) {
    if (gameinfoText[i] === '{') depth++;
    else if (gameinfoText[i] === '}') { depth--; if (!depth) return gameinfoText.slice(at, i + 1); }
  }
  throw new Error(t('gameinfo.gi: блок SearchPaths не закрыт'));
}

/**
 * Add our folder to a SearchPaths block: as the first Game path (which is also what the
 * engine turns into the MOD path) and as the first Mod path.
 */
function withModFolder(block, folder) {
  const lines = block.split(/\r?\n/);
  const out = [];
  let addedGame = false;
  let addedMod = false;
  for (const line of lines) {
    const game = /^(\s*)Game(\s+)dota\s*$/.exec(line);
    if (game && !addedGame) {
      out.push(`${game[1]}Game${game[2]}${folder}\t\t// ${MARKER}`);
      addedGame = true;
    }
    const mod = /^(\s*)Mod(\s+)dota\s*$/.exec(line);
    if (mod && !addedMod) {
      out.push(`${mod[1]}Mod${mod[2]}${folder}\t\t// ${MARKER}`);
      addedMod = true;
    }
    out.push(line);
  }
  if (!addedGame || !addedMod) throw new Error(t('gameinfo.gi: не найдены строки Game/Mod dota'));
  return out.join('\r\n');
}

// Put the block inside branchspecific's FileSystem section (its keys win over gameinfo.gi).
function patchedBranch(branchText, block) {
  const at = branchText.indexOf('FileSystem');
  if (at === -1) throw new Error(t('gameinfo_branchspecific.gi: блок FileSystem не найден'));
  const open = branchText.indexOf('{', at);
  let depth = 0;
  let close = -1;
  for (let i = open; i < branchText.length; i++) {
    if (branchText[i] === '{') depth++;
    else if (branchText[i] === '}') { depth--; if (!depth) { close = i; break; } }
  }
  if (close === -1) throw new Error(t('gameinfo_branchspecific.gi: блок FileSystem не закрыт'));
  // The original file ends its FileSystem body with a lone indent tab meant for its closing
  // brace ("...\r\n\t}") - strip it before splicing in our own block, or the two indents stack
  // into a stray extra tab ahead of "SearchPaths".
  const head = branchText.slice(0, close).replace(/[ \t]+$/, '');
  const indented = block.split(/\r?\n/).map((l) => (l.trim() ? '\t\t' + l.trim() : l)).join('\r\n');
  return head + indented + '\r\n\t' + branchText.slice(close);
}

/**
 * Undo our own insertion in a gameinfo file, byte for byte. patchedBranch() adds exactly
 * "\t\t" + <SearchPaths block> + "\r\n\t" before the FileSystem closing brace, so cutting
 * that range gives back the file the game shipped.
 *
 * Used wherever a patched file could be mistaken for an original: a backup taken while the
 * patch was already applied would otherwise be useless, and telling the user to go repair
 * game files by hand is not an answer the app is allowed to give.
 */
function stripPatch(text) {
  let out = text;
  for (let guard = 0; guard < 8 && out.includes(MARKER); guard++) {
    const mark = out.indexOf(MARKER);
    const kw = out.lastIndexOf('SearchPaths', mark);
    if (kw === -1) break;
    const open = out.indexOf('{', kw);
    if (open === -1) break;
    let depth = 0;
    let end = -1;
    for (let i = open; i < out.length; i++) {
      if (out[i] === '{') depth++;
      else if (out[i] === '}') { depth--; if (!depth) { end = i + 1; break; } }
    }
    if (end === -1) break;
    const start = out.startsWith('\t\t', kw - 2) ? kw - 2 : kw;
    if (out.startsWith('\r\n\t', end)) end += 3;
    else if (out.startsWith('\n\t', end)) end += 2;
    out = out.slice(0, start) + out.slice(end);
  }
  return out;
}

// Same for the signature list: our line is appended after the DIGEST line, so anything of
// ours past that point comes off and the file the game shipped is left behind.
function stripSignatures(text) {
  const lines = text.split(/\r?\n/);
  const digest = lines.findIndex((l) => l.startsWith('DIGEST:'));
  if (digest === -1) return text;
  const kept = lines.filter((l, i) => i <= digest || !l.startsWith(SIG_PREFIX + '~'));
  while (kept.length && !kept[kept.length - 1].trim()) kept.pop();
  return kept.join('\r\n') + '\r\n';
}

/**
 * What the install looks like right now.
 * @returns {{ patched: boolean, signed: boolean, folder: string|null, foreign: string|null }}
 */
function state(gamePath, folder) {
  const p = paths(gamePath);
  const out = { patched: false, signed: false, folder: null, foreign: null };
  if (!fs.existsSync(p.branch) || !fs.existsSync(p.signatures)) return out;
  const branch = fs.readFileSync(p.branch, 'latin1');
  if (branch.includes(MARKER)) {
    out.patched = true;
    out.folder = folder;
  }
  for (const name of KNOWN_FOREIGN) {
    if (new RegExp(`^\\s*(Game|Mod)\\s+${name}\\s*$`, 'm').test(branch)) out.foreign = name;
  }
  if (out.patched) {
    const want = signatureLine(fs.readFileSync(p.branch));
    out.signed = fs.readFileSync(p.signatures, 'latin1').split(/\r?\n/).some((l) => l.trim() === want);
  }
  return out;
}

// Store the pristine file. A Dota update overwrites the game's copy with a fresh vanilla
// build before heal() re-patches it - that moment is the only time we ever see the new
// ground truth, so a file with no trace of our own edit always replaces whatever backup we
// are holding (an old backup is what makes revert() write files Steam's current build no
// longer recognises - "verify integrity of game files" territory). Once our edit is present,
// the existing backup is left alone; if none exists yet it is reconstructed via clean() (a
// backup lost between runs, a second tool, a crash mid-write) so the user has nothing to fix
// by hand.
function backupOnce(file, backupDir, clean, isOurs) {
  fs.mkdirSync(backupDir, { recursive: true });
  const dest = path.join(backupDir, path.basename(file) + '.orig');
  const raw = fs.readFileSync(file, 'latin1');
  if (!isOurs(raw)) {
    fs.writeFileSync(dest, Buffer.from(raw, 'latin1'));
  } else if (!fs.existsSync(dest)) {
    fs.writeFileSync(dest, Buffer.from(clean(raw), 'latin1'));
  }
  return dest;
}

// Write via a temp file + rename: a half-written gameinfo means the game will not start.
// Windows refuses to rename over a file another process has open (Steam holds gameinfo
// while the app is up), so fall back to replacing the target in place.
function writeAtomic(file, buf) {
  const tmp = file + '.mmtmp';
  fs.writeFileSync(tmp, buf);
  try {
    fs.renameSync(tmp, file);
    return;
  } catch (e) {
    if (!['EPERM', 'EACCES', 'EEXIST', 'EBUSY'].includes(e.code)) { fs.rmSync(tmp, { force: true }); throw e; }
  }
  try {
    fs.rmSync(file, { force: true });
    fs.renameSync(tmp, file);
  } catch {
    fs.writeFileSync(file, buf);
    fs.rmSync(tmp, { force: true });
  }
}

/**
 * Register the folder. Safe to call repeatedly: it rebuilds the patch from the current
 * vanilla files (restoring the backup first), so a game update just means running it again.
 */
function apply({ gamePath, folder, backupDir }) {
  const p = paths(gamePath);
  for (const f of [p.gameinfo, p.branch, p.signatures]) {
    if (!fs.existsSync(f)) throw new Error(t('Не найден {0}', f));
  }
  backupOnce(p.branch, backupDir, stripPatch, (t) => t.includes(MARKER));
  backupOnce(p.signatures, backupDir, stripSignatures, (t) => t.includes(SIG_PREFIX + '~'));

  // Always start from the pristine copies so patches never stack. A backup that somehow
  // carries our edit is cleaned rather than refused - the user has nothing to fix by hand.
  const branchOrig = stripPatch(fs.readFileSync(path.join(backupDir, path.basename(p.branch) + '.orig'), 'latin1'));
  const sigOrig = stripSignatures(fs.readFileSync(path.join(backupDir, path.basename(p.signatures) + '.orig'), 'latin1'));

  const block = withModFolder(searchPathsBlock(fs.readFileSync(p.gameinfo, 'latin1')), folder);
  const branchBuf = Buffer.from(patchedBranch(branchOrig, block), 'latin1');
  writeAtomic(p.branch, branchBuf);

  const line = signatureLine(branchBuf);
  writeAtomic(p.signatures, Buffer.from(sigOrig.replace(/\s+$/, '') + '\r\n' + line + '\r\n', 'latin1'));

  fs.mkdirSync(path.join(gamePath, folder), { recursive: true });
  return state(gamePath, folder);
}

// Put the originals back and drop the folder if it is empty.
function revert({ gamePath, folder, backupDir }) {
  const p = paths(gamePath);
  for (const [f, clean] of [[p.branch, stripPatch], [p.signatures, stripSignatures]]) {
    const src = path.join(backupDir, path.basename(f) + '.orig');
    if (!fs.existsSync(src)) continue;
    // a backup that carries our edit still restores a clean file
    writeAtomic(f, Buffer.from(clean(fs.readFileSync(src, 'latin1')), 'latin1'));
  }
  if (folder) {
    const dir = path.join(gamePath, folder);
    if (fs.existsSync(dir) && !fs.readdirSync(dir).length) fs.rmdirSync(dir);
  }
  return state(gamePath, folder);
}

module.exports = {
  MARKER,
  FOLDER,
  paths,
  fileHashes,
  signatureLine,
  searchPathsBlock,
  withModFolder,
  patchedBranch,
  stripPatch,
  stripSignatures,
  state,
  apply,
  revert,
  crc32,
};
