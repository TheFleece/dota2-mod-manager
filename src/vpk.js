// Minimal reader for the index of Source-engine VPK "_dir" files (v1/v2).
// Only walks the directory tree — enough to list which game files a mod overrides.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { t } = require('./i18n');

const VPK_SIGNATURE = 0x55aa1234;

function readCString(buf, pos) {
  const end = buf.indexOf(0, pos);
  if (end === -1) throw new Error(t('VPK: незакрытая строка в дереве'));
  return { str: buf.toString('utf-8', pos, end), next: end + 1 };
}

// A VPK tree stores "empty" as a single space, for the folder AND for the extension.
// Only the folder case used to be handled, so an extension-less entry came out as
// "name. " — Dota 2 Skinchanger writes a whole decoy tree of those, and every one of
// them showed up as a bogus game path in analysis and conflict checks.
function joinPath(folder, name, ext) {
  const dir = folder === ' ' ? '' : folder + '/';
  const suffix = ext === ' ' ? '' : '.' + ext;
  return `${dir}${name}${suffix}`.toLowerCase();
}

/**
 * Read only the header + directory tree of a *_dir.vpk off disk. A self-contained mod
 * is tens of MB of payload sitting behind a few KB of index, and the index is all any
 * of the listing/analysis/fingerprint helpers ever touch — so scanning a whole library
 * never has to pull the payloads into memory.
 * @param {string} filePath
 * @returns {Buffer} header + tree — what every listing / analysis helper here parses
 */
function readVpkIndexFile(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const head = Buffer.alloc(28);
    const got = fs.readSync(fd, head, 0, 28, 0);
    if (got < 12 || head.readUInt32LE(0) !== VPK_SIGNATURE) throw new Error(t('VPK: неверная сигнатура'));
    const version = head.readUInt32LE(4);
    const treeSize = head.readUInt32LE(8);
    const headerSize = version === 2 ? 28 : 12;
    const size = fs.fstatSync(fd).size;
    if (got < headerSize || headerSize + treeSize > size) throw new Error(t('VPK: неверная сигнатура'));
    const buf = Buffer.alloc(headerSize + treeSize);
    head.copy(buf, 0, 0, headerSize);
    fs.readSync(fd, buf, headerSize, treeSize, headerSize);
    return buf;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * @param {Buffer} buf contents of a *_dir.vpk file
 * @returns {string[]} lowercased inner paths like "materials/water/water_ti10_000.vmat_c"
 */
function listVpkPaths(buf) {
  if (buf.length < 12 || buf.readUInt32LE(0) !== VPK_SIGNATURE) {
    throw new Error(t('VPK: неверная сигнатура'));
  }
  const version = buf.readUInt32LE(4);
  let pos = version === 2 ? 28 : 12; // v2 header carries 16 extra bytes of section sizes

  const paths = [];
  for (;;) {
    const ext = readCString(buf, pos);
    pos = ext.next;
    if (!ext.str) break;
    for (;;) {
      const folder = readCString(buf, pos);
      pos = folder.next;
      if (!folder.str) break;
      for (;;) {
        const name = readCString(buf, pos);
        pos = name.next;
        if (!name.str) break;
        // entry: crc(4) preloadBytes(2) archiveIndex(2) offset(4) length(4) terminator(2)
        const preloadBytes = buf.readUInt16LE(pos + 4);
        pos += 18 + preloadBytes;
        paths.push(joinPath(folder.str, name.str, ext.str));
      }
    }
  }
  return paths;
}

function listVpkPathsFile(filePath) {
  return listVpkPaths(readVpkIndexFile(filePath));
}

/**
 * Like listVpkPaths, but returns each inner path together with the CRC32 the VPK index
 * stores for it. Two mods that carry a byte-identical filler asset share the same CRC, so
 * comparing CRCs (not just paths) tells a real override apart from a coincidental shared file.
 * @param {Buffer} buf contents of a *_dir.vpk file
 * @returns {Map<string, number>} lowercased inner path -> crc32
 */
function listVpkPathCrcs(buf) {
  if (buf.length < 12 || buf.readUInt32LE(0) !== VPK_SIGNATURE) {
    throw new Error(t('VPK: неверная сигнатура'));
  }
  const version = buf.readUInt32LE(4);
  let pos = version === 2 ? 28 : 12;
  const map = new Map();
  for (;;) {
    const ext = readCString(buf, pos);
    pos = ext.next;
    if (!ext.str) break;
    for (;;) {
      const folder = readCString(buf, pos);
      pos = folder.next;
      if (!folder.str) break;
      for (;;) {
        const name = readCString(buf, pos);
        pos = name.next;
        if (!name.str) break;
        const crc = buf.readUInt32LE(pos); // entry: crc(4) preloadBytes(2) archiveIndex(2) offset(4) length(4) terminator(2)
        const preloadBytes = buf.readUInt16LE(pos + 4);
        pos += 18 + preloadBytes;
        map.set(joinPath(folder.str, name.str, ext.str), crc);
      }
    }
  }
  return map;
}

function listVpkPathCrcsFile(filePath) {
  return listVpkPathCrcs(readVpkIndexFile(filePath));
}

// ---------- content analysis (which hero / equip slots a mod touches) ----------

// Dota's internal hero folder names differ from the display name for a chunk of the
// roster. Only the mismatches are listed; anything else is title-cased from its id.
const HERO_DISPLAY = {
  nerubian_assassin: 'Nyx Assassin', obsidian_destroyer: 'Outworld Destroyer',
  skeleton_king: 'Wraith King', windrunner: 'Windranger', shredder: 'Timbersaw',
  rattletrap: 'Clockwerk', furion: "Nature's Prophet", doom_bringer: 'Doom',
  wisp: 'Io', zuus: 'Zeus', necrolyte: 'Necrophos', magnataur: 'Magnus',
  treant: 'Treant Protector', abyssal_underlord: 'Underlord', life_stealer: 'Lifestealer',
  centaur: 'Centaur Warrunner', vengefulspirit: 'Vengeful Spirit', queenofpain: 'Queen of Pain',
  nevermore: 'Shadow Fiend', drow_ranger: 'Drow Ranger', keeper_of_the_light: 'Keeper of the Light',
  dark_seer: 'Dark Seer', night_stalker: 'Night Stalker', bounty_hunter: 'Bounty Hunter',
  storm_spirit: 'Storm Spirit', earth_spirit: 'Earth Spirit', ember_spirit: 'Ember Spirit',
  spirit_breaker: 'Spirit Breaker', faceless_void: 'Faceless Void', phantom_assassin: 'Phantom Assassin',
  phantom_lancer: 'Phantom Lancer', shadow_demon: 'Shadow Demon', shadow_shaman: 'Shadow Shaman',
  witch_doctor: 'Witch Doctor', crystal_maiden: 'Crystal Maiden', dragon_knight: 'Dragon Knight',
  legion_commander: 'Legion Commander', ancient_apparition: 'Ancient Apparition', anti_mage: 'Anti-Mage',
  sand_king: 'Sand King', death_prophet: 'Death Prophet', troll_warlord: 'Troll Warlord',
  templar_assassin: 'Templar Assassin', naga_siren: 'Naga Siren', ogre_magi: 'Ogre Magi',
  elder_titan: 'Elder Titan', arc_warden: 'Arc Warden', winter_wyvern: 'Winter Wyvern',
  primal_beast: 'Primal Beast', void_spirit: 'Void Spirit',
};

function heroDisplayName(id) {
  if (HERO_DISPLAY[id]) return HERO_DISPLAY[id];
  return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// keyword found in a model filename token -> canonical equip slot
const SLOT_KEYWORDS = [
  ['shoulder', 'shoulder'], ['pauldron', 'shoulder'],
  ['helmet', 'head'], ['helm', 'head'], ['head', 'head'], ['hood', 'head'], ['mask', 'head'],
  ['hair', 'head'], ['face', 'head'], ['hat', 'head'], ['crown', 'head'], ['horn', 'head'],
  ['weapon', 'weapon'], ['sword', 'weapon'], ['blade', 'weapon'], ['staff', 'weapon'],
  ['bow', 'weapon'], ['axe', 'weapon'], ['hammer', 'weapon'], ['scythe', 'weapon'],
  ['offhand', 'offhand'], ['shield', 'shield'],
  ['bracer', 'arms'], ['glove', 'arms'], ['hand', 'arms'], ['arm', 'arms'],
  ['shoulders', 'shoulder'], ['belt', 'belt'], ['waist', 'belt'],
  ['cape', 'back'], ['cloak', 'back'], ['back', 'back'], ['wing', 'wings'], ['tail', 'tail'],
  ['skirt', 'legs'], ['leg', 'legs'], ['boot', 'legs'], ['feet', 'legs'], ['foot', 'legs'],
  ['mount', 'mount'], ['armor', 'armor'], ['ambient', 'ambient'],
];
const SLOT_DISPLAY = {
  head: 'голова', weapon: 'оружие', offhand: 'оружие (2)', shield: 'щит', armor: 'броня',
  shoulder: 'плечи', belt: 'пояс', arms: 'руки', back: 'спина', wings: 'крылья', tail: 'хвост',
  legs: 'ноги', mount: 'ездовое', ambient: 'эффекты', misc: 'разное', base: 'модель',
};

function slotDisplayName(slot) { return t(SLOT_DISPLAY[slot] || slot); }

function slotFromModelStem(hero, stem) {
  if (stem === hero || /^\d+$/.test(stem)) return 'base'; // bare hero name or "1.vmdl" = base body override
  let tok = stem.startsWith(hero + '_') ? stem.slice(hero.length + 1) : stem;
  tok = tok.replace(/_(lod\d+|c|model|hero|full|default|\d+)$/g, '');
  if (!tok || /^\d+$/.test(tok) || /(^|_)(base|body|model)$/.test(tok)) return 'base';
  for (const [kw, slot] of SLOT_KEYWORDS) if (tok.includes(kw)) return slot;
  return 'misc';
}

const HERO_MODEL_RE = /^models\/heroes\/([a-z0-9_]+)\/(.+)$/;
const HERO_PARTICLE_RE = /^particles\/units\/heroes\/hero_([a-z0-9_]+)\//;

/**
 * Classify what a mod's inner path list actually changes.
 * @param {string[]} paths lowercased inner VPK paths (from listVpkPaths)
 * @returns {{ heroes: Array<{id,name,slots:string[],base:boolean,models:number}>, kind: string, pathCount: number }}
 */
function analyzeVpkPaths(paths) {
  const heroes = new Map(); // id -> { slots:Set, base:bool, models:int, seen:bool }
  const hero = (id) => {
    if (!heroes.has(id)) heroes.set(id, { slots: new Set(), base: false, models: 0 });
    return heroes.get(id);
  };
  for (const p of paths) {
    let m = HERO_MODEL_RE.exec(p);
    if (m) {
      const h = hero(m[1]);
      if (/\.vmdl_c$/.test(p)) {
        const stem = m[2].replace(/\.vmdl_c$/, '').split('/').pop();
        const slot = slotFromModelStem(m[1], stem);
        if (slot === 'base') h.base = true; else h.slots.add(slot);
        h.models++;
      }
      continue;
    }
    m = HERO_PARTICLE_RE.exec(p);
    if (m) hero(m[1]);
  }
  // authors sometimes use both the canonical folder (nerubian_assassin) and a custom
  // alias (nyx_assassin) for the same hero — merge entries that resolve to one name.
  const byName = new Map();
  for (const [id, v] of heroes) {
    const name = heroDisplayName(id);
    const cur = byName.get(name) || { id, name, slots: new Set(), base: false, models: 0 };
    for (const s of v.slots) cur.slots.add(s);
    cur.base = cur.base || v.base;
    cur.models += v.models;
    byName.set(name, cur);
  }
  const list = [...byName.values()].map((v) => ({
    id: v.id, name: v.name, slots: [...v.slots], base: v.base, models: v.models,
  })).sort((a, b) => b.models - a.models || a.name.localeCompare(b.name));

  let kind = 'other';
  if (list.length) kind = 'hero';
  else if (paths.some((p) => /(^|\/)ward|models\/props_gameplay\/.*ward/.test(p))) kind = 'wards';
  else if (paths.some((p) => p.startsWith('particles/econ/courier') || p.includes('/courier'))) kind = 'courier';
  else if (paths.some((p) => p.startsWith('panorama/'))) kind = 'ui';
  else if (paths.some((p) => p.startsWith('sounds/'))) kind = 'sounds';
  else if (paths.some((p) => p.startsWith('maps/'))) kind = 'terrain';

  return { heroes: list, kind, pathCount: paths.length };
}

function analyzeVpk(buf) {
  return analyzeVpkPaths(listVpkPaths(buf));
}

// Human one-liner for a single detected hero, e.g. "Nyx Assassin (model, weapon)".
function describeHero(h) {
  const parts = [];
  if (h.base) parts.push(t('модель'));
  for (const s of h.slots) parts.push(slotDisplayName(s));
  if (!parts.length && !h.models) parts.push(t('перекраска'));
  return h.name + (parts.length ? ` (${parts.join(', ')})` : '');
}

const KIND_LABEL = { wards: 'варды', courier: 'курьер', ui: 'интерфейс', sounds: 'звуки', terrain: 'террейн', other: '' };

// Human summary of a whole analysis: hero skins, or a coarse content kind.
function describeAnalysis(a) {
  if (a.heroes.length) return a.heroes.map(describeHero).join('; ');
  return t(KIND_LABEL[a.kind] || '');
}

// A short display NAME for a mod from its analysis — used to name imported VPKs by their
// content (a hero, a set, or a content kind) instead of a bare "pakNN" slot. Null if the
// content isn't recognisable enough to name.
const KIND_NAME = { wards: 'Варды', courier: 'Курьер', ui: 'Интерфейс меню', sounds: 'Звуки', terrain: 'Ландшафт' };
function nameFromAnalysis(a) {
  if (a.heroes.length === 1) return a.heroes[0].name;
  if (a.heroes.length >= 2 && a.heroes.length <= 3) return a.heroes.map((h) => h.name).join(', ');
  if (a.heroes.length > 3) return t('Сборка · {0} героев', a.heroes.length);
  return KIND_NAME[a.kind] ? t(KIND_NAME[a.kind]) : null;
}

const EMPTY = Buffer.alloc(0);
const INLINE = 0x7fff; // archiveIndex meaning "data lives in the _dir file itself"

// full inner path of a read entry, lowercased (" " means the root / no extension)
function entryPath(en) {
  return joinPath(en.folder, en.name, en.ext);
}

// Read every entry of a _dir.vpk (following external _NNN archives) into a flat list
// with its bytes: [{ ext, folder, name, crc, preload, data }], in on-disk tree order.
function readVpkEntries(dirBuf, dirPath, archivePathFor) {
  if (dirBuf.length < 12 || dirBuf.readUInt32LE(0) !== VPK_SIGNATURE) {
    throw new Error(t('VPK: неверная сигнатура'));
  }
  const version = dirBuf.readUInt32LE(4);
  const treeSize = dirBuf.readUInt32LE(8);
  const headerSize = version === 2 ? 28 : 12;
  const embeddedBase = headerSize + treeSize; // where inline (0x7fff) data sits

  const archiveCache = new Map();
  const readArchive = (idx) => {
    if (idx === INLINE) return dirBuf;
    if (!archiveCache.has(idx)) {
      const p = archivePathFor
        ? archivePathFor(idx)
        : dirPath.replace(/_dir\.vpk$/i, `_${String(idx).padStart(3, '0')}.vpk`);
      archiveCache.set(idx, fs.readFileSync(p));
    }
    return archiveCache.get(idx);
  };

  const entries = [];
  let pos = headerSize;
  for (;;) {
    const ext = readCString(dirBuf, pos); pos = ext.next; if (!ext.str) break;
    for (;;) {
      const folder = readCString(dirBuf, pos); pos = folder.next; if (!folder.str) break;
      for (;;) {
        const name = readCString(dirBuf, pos); pos = name.next; if (!name.str) break;
        const crc = dirBuf.readUInt32LE(pos);
        const preloadBytes = dirBuf.readUInt16LE(pos + 4);
        const archiveIndex = dirBuf.readUInt16LE(pos + 6);
        const entryOffset = dirBuf.readUInt32LE(pos + 8);
        const entryLength = dirBuf.readUInt32LE(pos + 12);
        pos += 18;
        const preload = preloadBytes ? Buffer.from(dirBuf.subarray(pos, pos + preloadBytes)) : EMPTY;
        pos += preloadBytes;
        let data = EMPTY;
        if (entryLength > 0) {
          const src = readArchive(archiveIndex);
          const base = archiveIndex === INLINE ? embeddedBase : 0;
          data = src.subarray(base + entryOffset, base + entryOffset + entryLength);
        }
        entries.push({ ext: ext.str, folder: folder.str, name: name.str, crc, preload, data });
      }
    }
  }
  return entries;
}

// Build one self-contained single-file VPK v2 from a flat entry list. Groups entries
// by ext -> folder (first-seen order), embeds every entry's data inline (0x7fff).
function buildVpk(entries) {
  const tree = new Map();
  for (const en of entries) {
    let folders = tree.get(en.ext); if (!folders) { folders = new Map(); tree.set(en.ext, folders); }
    let names = folders.get(en.folder); if (!names) { names = []; folders.set(en.folder, names); }
    names.push(en);
  }

  const dataChunks = [];
  let dataLen = 0;
  for (const [, folders] of tree) for (const [, names] of folders) for (const en of names) {
    en._offset = dataLen;
    if (en.data.length) { dataChunks.push(en.data); dataLen += en.data.length; }
  }

  const z = Buffer.from([0]);
  const cstr = (s) => Buffer.concat([Buffer.from(s, 'utf-8'), z]);
  const parts = [];
  for (const [ext, folders] of tree) {
    parts.push(cstr(ext));
    for (const [folder, names] of folders) {
      parts.push(cstr(folder));
      for (const en of names) {
        parts.push(cstr(en.name));
        const meta = Buffer.alloc(18);
        meta.writeUInt32LE(en.crc >>> 0, 0);
        meta.writeUInt16LE(en.preload.length, 4);
        meta.writeUInt16LE(INLINE, 6);
        meta.writeUInt32LE(en._offset >>> 0, 8);
        meta.writeUInt32LE(en.data.length >>> 0, 12);
        meta.writeUInt16LE(0xffff, 16);
        parts.push(meta);
        if (en.preload.length) parts.push(en.preload);
      }
      parts.push(z); // end of names in this folder
    }
    parts.push(z); // end of folders for this ext
  }
  parts.push(z); // end of extensions
  const treeBuf = Buffer.concat(parts);

  const header = Buffer.alloc(28);
  header.writeUInt32LE(VPK_SIGNATURE, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(treeBuf.length, 8);
  header.writeUInt32LE(dataLen, 12); // fileDataSectionSize; MD5/signature sections left at 0
  return Buffer.concat([header, treeBuf, ...dataChunks]);
}

// Build a _dir.vpk index that references data in *external* archives (_NNN.vpk). Entries
// must already carry { archiveIndex, offset, length } pointing into those archives. Unlike
// buildVpk (single-file, inline 0x7fff) this holds no file data — the tree only.
function buildVpkDir(entries) {
  const tree = new Map();
  for (const en of entries) {
    let folders = tree.get(en.ext); if (!folders) { folders = new Map(); tree.set(en.ext, folders); }
    let names = folders.get(en.folder); if (!names) { names = []; folders.set(en.folder, names); }
    names.push(en);
  }
  const z = Buffer.from([0]);
  const cstr = (s) => Buffer.concat([Buffer.from(s, 'utf-8'), z]);
  const parts = [];
  for (const [ext, folders] of tree) {
    parts.push(cstr(ext));
    for (const [folder, names] of folders) {
      parts.push(cstr(folder));
      for (const en of names) {
        parts.push(cstr(en.name));
        const meta = Buffer.alloc(18);
        meta.writeUInt32LE(en.crc >>> 0, 0);
        meta.writeUInt16LE(en.preload.length, 4);
        meta.writeUInt16LE(en.archiveIndex & 0xffff, 6);
        meta.writeUInt32LE(en.offset >>> 0, 8);
        meta.writeUInt32LE(en.length >>> 0, 12);
        meta.writeUInt16LE(0xffff, 16);
        parts.push(meta);
        if (en.preload.length) parts.push(en.preload);
      }
      parts.push(z); // end of names
    }
    parts.push(z); // end of folders
  }
  parts.push(z); // end of extensions
  const treeBuf = Buffer.concat(parts);

  const header = Buffer.alloc(28);
  header.writeUInt32LE(VPK_SIGNATURE, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(treeBuf.length, 8);
  header.writeUInt32LE(0, 12); // no inline data section — all data lives in _NNN archives
  return Buffer.concat([header, treeBuf]);
}

/**
 * Combine several independent single-file VPK mods into ONE multi-part VPK
 * (<base>_dir.vpk index + <base>_NNN.vpk data volumes) written straight to disk. This is
 * how many mods share a single pakNN slot — the game caps usable pak numbers at 99, so
 * packing lets a library grow past that. Data is streamed volume-by-volume (each capped at
 * `volumeCap`) so a multi-GB pack never has to sit in memory at once.
 *
 * When two members provide the same inner path the first member wins and the later one's
 * copy is dropped (recorded in `conflicts`) — a merged VPK can't hold two files at one path.
 *
 * @param {Array<{key:string, buf:Buffer}>} members  self-contained VPK buffers, in priority order
 * @param {string} outDir   directory to write <base>_dir.vpk and volumes into
 * @param {string} outBase  slot base name, e.g. "pak10"
 * @param {{volumeCap?:number}} [opts]
 * @returns {{ dir:string, parts:string[], memberPaths:Record<string,string[]>, conflicts:Array }}
 */
function combineVpksToFiles(members, outDir, outBase, { volumeCap = 1 << 30 } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const entries = [];
  const seen = new Set();
  const conflicts = [];
  const memberPaths = {};
  const partName = (i) => `${outBase}_${String(i).padStart(3, '0')}.vpk`;

  let volIdx = 0;
  let volPos = 0;
  let fd = fs.openSync(path.join(outDir, partName(0)), 'w');
  const parts = [partName(0)];
  const rollVolume = () => {
    fs.closeSync(fd);
    volIdx++; volPos = 0;
    fd = fs.openSync(path.join(outDir, partName(volIdx)), 'w');
    parts.push(partName(volIdx));
  };

  try {
    for (const m of members) {
      const memEntries = readVpkEntries(m.buf, '', () => { throw new Error('combine: member must be single-file'); });
      memberPaths[m.key] = [];
      for (const en of memEntries) {
        const p = entryPath(en);
        if (seen.has(p)) { conflicts.push({ key: m.key, path: p }); continue; }
        seen.add(p);
        memberPaths[m.key].push(p);
        // never split one file across volumes; roll to a fresh volume if it wouldn't fit
        if (en.data.length && volPos > 0 && volPos + en.data.length > volumeCap) rollVolume();
        const offset = volPos;
        if (en.data.length) { fs.writeSync(fd, en.data, 0, en.data.length, volPos); volPos += en.data.length; }
        entries.push({
          ext: en.ext, folder: en.folder, name: en.name, crc: en.crc, preload: en.preload,
          archiveIndex: volIdx, offset, length: en.data.length,
        });
      }
    }
  } finally {
    fs.closeSync(fd);
  }

  fs.writeFileSync(path.join(outDir, `${outBase}_dir.vpk`), buildVpkDir(entries));
  return { dir: `${outBase}_dir.vpk`, parts, memberPaths, conflicts };
}

/**
 * Rewrites a multi-part VPK (_dir.vpk + _000.vpk, _001.vpk…) into one self-contained
 * single-file VPK v2 with every entry's data embedded — the format the Dota2PornFx
 * catalog uses. Data is copied byte-for-byte; CRCs and preload are preserved.
 *
 * @param {string} dirPath  path to the *_dir.vpk index file
 * @param {(idx: number) => string} [archivePathFor]  resolves external archive N to a path
 * @returns {Buffer} the merged single-file VPK
 */
function mergeVpkToSingle(dirPath, archivePathFor) {
  return buildVpk(readVpkEntries(fs.readFileSync(dirPath), dirPath, archivePathFor));
}

/**
 * Split a merged multi-hero VPK into one self-contained VPK per detected hero — the
 * inverse of tools that pack several skins into one file (e.g. Dota 2 Skinchanger).
 * A file that clearly belongs to a hero (…/heroes/<hero>/… or …/hero_<hero>/…) goes to
 * that hero; everything else (shared stock, cross-hero assets) is copied into every
 * output so each result stands alone and installs/removes independently.
 *
 * @returns {Array<{ id: string, name: string, buf: Buffer }>} empty if <2 heroes.
 */
function splitVpkByHero(dirPath, archivePathFor) {
  const dirBuf = fs.readFileSync(dirPath);
  const entries = readVpkEntries(dirBuf, dirPath, archivePathFor);
  const paths = entries.map(entryPath);
  const heroes = analyzeVpkPaths(paths).heroes;
  if (heroes.length < 2) return [];
  const ids = heroes.map((h) => h.id);
  const ownerOf = (p) => ids.find((id) =>
    p.includes(`/heroes/${id}/`) || p.startsWith(`heroes/${id}/`) ||
    p.includes(`/hero_${id}/`) || p.startsWith(`hero_${id}/`)) || null;

  const buckets = new Map(ids.map((id) => [id, []]));
  const shared = [];
  entries.forEach((en, i) => {
    const owner = ownerOf(paths[i]);
    if (owner) buckets.get(owner).push(en); else shared.push(en);
  });
  return heroes.map((h) => ({ id: h.id, name: h.name, buf: buildVpk([...buckets.get(h.id), ...shared]) }));
}

// Content fingerprint of a mod: sha1 over its sorted (path:crc) index. Independent of
// packaging (multi-part vs single, filename), so the same mod installed from the site,
// from another tool, or via this app all hash identically — the basis for recognising
// a foreign vpk as a specific catalog mod.
function fingerprintEntries(entries) {
  const canon = entries.map((e) => `${e.path}:${e.crc}`).sort().join('\n');
  return crypto.createHash('sha1').update(canon).digest('hex');
}

function fingerprintVpk(buf) {
  return fingerprintEntries(listVpkEntries(buf));
}

// Content fingerprint of a loose-file mod (cursors, fonts): sha1 over sorted
// "path:sha1(bytes)". Paths should already be normalized (top folder stripped,
// lowercased) so it reproduces from either the source zip or the installed files.
function fingerprintFiles(files) {
  const rows = files.map((f) => `${f.path}:${crypto.createHash('sha1').update(f.data).digest('hex')}`);
  return crypto.createHash('sha1').update(rows.sort().join('\n')).digest('hex');
}

// Lightweight (path, crc) list — the mod's content signature, no archive reads.
function listVpkEntries(buf) {
  if (buf.length < 12 || buf.readUInt32LE(0) !== VPK_SIGNATURE) throw new Error(t('VPK: неверная сигнатура'));
  const version = buf.readUInt32LE(4);
  let pos = version === 2 ? 28 : 12;
  const out = [];
  for (;;) {
    const ext = readCString(buf, pos); pos = ext.next; if (!ext.str) break;
    for (;;) {
      const folder = readCString(buf, pos); pos = folder.next; if (!folder.str) break;
      for (;;) {
        const name = readCString(buf, pos); pos = name.next; if (!name.str) break;
        const crc = buf.readUInt32LE(pos);
        const preloadBytes = buf.readUInt16LE(pos + 4);
        pos += 18 + preloadBytes;
        out.push({ path: joinPath(folder.str, name.str, ext.str), crc: crc >>> 0 });
      }
    }
  }
  return out;
}

module.exports = {
  listVpkPaths, listVpkPathsFile, listVpkPathCrcs, listVpkPathCrcsFile, listVpkEntries, mergeVpkToSingle, splitVpkByHero,
  readVpkEntries, readVpkIndexFile, buildVpk, buildVpkDir, combineVpksToFiles, entryPath,
  fingerprintVpk, fingerprintEntries, fingerprintFiles,
  analyzeVpk, analyzeVpkPaths, heroDisplayName, slotDisplayName,
  describeHero, describeAnalysis, nameFromAnalysis,
};
