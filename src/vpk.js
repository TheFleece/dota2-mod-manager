// Minimal reader for the index of Source-engine VPK "_dir" files (v1/v2).
// Only walks the directory tree — enough to list which game files a mod overrides.
const fs = require('fs');

const VPK_SIGNATURE = 0x55aa1234;

function readCString(buf, pos) {
  const end = buf.indexOf(0, pos);
  if (end === -1) throw new Error('VPK: незакрытая строка в дереве');
  return { str: buf.toString('utf-8', pos, end), next: end + 1 };
}

/**
 * @param {Buffer} buf contents of a *_dir.vpk file
 * @returns {string[]} lowercased inner paths like "materials/water/water_ti10_000.vmat_c"
 */
function listVpkPaths(buf) {
  if (buf.length < 12 || buf.readUInt32LE(0) !== VPK_SIGNATURE) {
    throw new Error('VPK: неверная сигнатура');
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
        const dir = folder.str === ' ' ? '' : folder.str + '/';
        paths.push(`${dir}${name.str}.${ext.str}`.toLowerCase());
      }
    }
  }
  return paths;
}

function listVpkPathsFile(filePath) {
  return listVpkPaths(fs.readFileSync(filePath));
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

function slotDisplayName(slot) { return SLOT_DISPLAY[slot] || slot; }

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

// Human, Russian one-liner for a single detected hero, e.g. "Nyx Assassin (модель, оружие)".
function describeHero(h) {
  const parts = [];
  if (h.base) parts.push('модель');
  for (const s of h.slots) parts.push(slotDisplayName(s));
  if (!parts.length && !h.models) parts.push('перекраска');
  return h.name + (parts.length ? ` (${parts.join(', ')})` : '');
}

const KIND_LABEL = { wards: 'варды', courier: 'курьер', ui: 'интерфейс', sounds: 'звуки', terrain: 'террейн', other: '' };

// Human summary of a whole analysis: hero skins, or a coarse content kind.
function describeAnalysis(a) {
  if (a.heroes.length) return a.heroes.map(describeHero).join('; ');
  return KIND_LABEL[a.kind] || '';
}

const EMPTY = Buffer.alloc(0);
const INLINE = 0x7fff; // archiveIndex meaning "data lives in the _dir file itself"

// full inner path of a read entry, lowercased (folder " " means the root)
function entryPath(en) {
  const dir = en.folder === ' ' ? '' : en.folder + '/';
  return `${dir}${en.name}.${en.ext}`.toLowerCase();
}

// Read every entry of a _dir.vpk (following external _NNN archives) into a flat list
// with its bytes: [{ ext, folder, name, crc, preload, data }], in on-disk tree order.
function readVpkEntries(dirBuf, dirPath, archivePathFor) {
  if (dirBuf.length < 12 || dirBuf.readUInt32LE(0) !== VPK_SIGNATURE) {
    throw new Error('VPK: неверная сигнатура');
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

// Lightweight (path, crc) list — the mod's content signature, no archive reads.
function listVpkEntries(buf) {
  if (buf.length < 12 || buf.readUInt32LE(0) !== VPK_SIGNATURE) throw new Error('VPK: неверная сигнатура');
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
        const dir = folder.str === ' ' ? '' : folder.str + '/';
        out.push({ path: `${dir}${name.str}.${ext.str}`.toLowerCase(), crc: crc >>> 0 });
      }
    }
  }
  return out;
}

module.exports = {
  listVpkPaths, listVpkPathsFile, listVpkEntries, mergeVpkToSingle, splitVpkByHero,
  readVpkEntries, buildVpk, entryPath,
  analyzeVpk, analyzeVpkPaths, heroDisplayName, slotDisplayName,
  describeHero, describeAnalysis,
};
