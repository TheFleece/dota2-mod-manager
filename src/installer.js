// Installer engine: download, extract, pak allocation, per-category install/uninstall
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const { RAW_BASE } = require('./catalog');
const { listVpkPaths, listVpkPathsFile, listVpkPathCrcs, listVpkPathCrcsFile, readVpkIndexFile, mergeVpkToSingle, splitVpkByHero, combineVpksToFiles, analyzeVpkPaths, describeHero, describeAnalysis, nameFromAnalysis, fingerprintVpk, fingerprintFiles } = require('./vpk');
const { t } = require('./i18n');

// Categories whose VPKs must load with higher priority: lower pak numbers (02-09).
// The game only mounts files named pakNN_dir.vpk — the "!pak" prefix seen in
// Dota2PornFx cart zips is a merge-order hint for VPKMerge, not a valid install name.
const PRIORITY_CATEGORIES = ['trees', 'river', 'shaders', 'herofx', 'ranged-attack', 'hero-items', 'optimization'];

// Merging a multi-volume import into one file holds the whole mod in memory once. Well
// above any real skin pack (a Skinchanger export is ~70 MB), but a multi-GB set is left
// in its original volumes rather than risking the allocation.
const MERGE_SIZE_CAP = 1200 * 1024 * 1024;

const FONTS_SUBDIR = ['dota', 'panorama', 'fonts'];
const CURSOR_SUBDIR = ['dota', 'resource', 'cursor'];

// Master "mods off" switch: every active mod pak is renamed <file>.moff so the game
// ignores it (it only mounts pakNN_dir.vpk). Distinct from the per-mod ".off" state so
// the two never clobber each other. Official localization (pak01_*) / gameinfo.gi are
// never touched — turning mods off must not strip the game's own language files.
const MASTER_OFF = '.moff';
function isOfficialLangFile(baseLower) {
  return /^pak01_/.test(baseLower) || baseLower === 'gameinfo.gi';
}

function fileUrl(categoryId, fileRef) {
  if (/^https?:\/\//i.test(fileRef)) return fileRef;
  return `${RAW_BASE}/assets/files/${categoryId}/${encodeURIComponent(fileRef)}`;
}

// Engine stock / placeholder assets that mods carry but never really fight over:
//   - materials/default/, materials/particle/basic_, materials/models/cubemaps/,
//     particles/basic_ — the "basic_"/default filler Source 2's compiler bakes into
//     almost every mod VPK;
//   - models/dev/ (the ERROR placeholder) and models/nomodel/ (the empty null model
//     used to hide default parts) — shared by unrelated skins that hide something.
// They are identical across unrelated mods, so counting them made the conflict check
// fire on nearly every install (two skins for different heroes still "shared" ~30).
// Drop them so only genuine same-asset clashes warn.
const STOCK_CONTENT_RE = /^(?:materials\/default\/|materials\/particle\/basic_|materials\/models\/cubemaps\/|particles\/(?:models\/)?basic_|models\/(?:dev|nomodel)\/)/;

// Whole-game tables and tool branding that packaging tools bake into EVERY export.
// Dota 2 Skinchanger, for one, ships a full 47 MB scripts/items/items_game.txt plus the
// localization files, its loadout stylesheets, its logo strip and a steam-id watermark in
// every single pack it builds. Two packs for two different heroes therefore always differ
// on items_game.txt — which made the app announce "Abaddon conflicts with Elder Titan".
// They don't: the skins live in per-hero asset paths, and these files are interchangeable
// copies of the same table, so whichever one the game loads first serves both mods.
const GLOBAL_TABLE_RE = new RegExp('^(?:' + [
  'scripts/items/items_game(?:\\.txt)?"?$',            // the game's whole item table
  'resource/localization/',                            // full dota_<lang>.txt copies
  'panorama/styles/(?:hero_slot_item_picker_loadout|ui_econ_item)\\.vcss_c"?$',
  'panorama/images/(?:ds|tg|tt|wb|yu|remove|header_credits|footer_credits)[^/]*$',
  '(?:models/heroes|panorama)/\\d{8,}\\.vxml_c"?$',    // <steam id>.vxml_c watermark
].join('|') + ')');

// drops stock/filler and shared tool-table keys from a Map<path, crc> (in place)
function dropSharedPaths(paths) {
  for (const p of paths.keys()) if (STOCK_CONTENT_RE.test(p) || GLOBAL_TABLE_RE.test(p)) paths.delete(p);
  return paths;
}

// Genuine clashes between two Map<path, crc>: a shared path whose content actually differs.
// An identical CRC on both sides means the two mods ship the byte-for-byte same file (shared
// filler assets — particle packs, transparent materials, ...), which is not a conflict at all.
// A missing CRC (-1, e.g. a loose non-VPK file) is treated as unknown -> counted, to stay safe.
function conflictingPaths(candidate, installed) {
  const out = [];
  for (const [p, cc] of candidate) {
    if (!installed.has(p)) continue;
    const ic = installed.get(p);
    if (cc === -1 || ic === -1 || cc !== ic) out.push(p);
  }
  return out;
}

class Installer {
  /**
   * @param {object} opts
   * @param {string} opts.userDataDir
   * @param {() => string|null} opts.getGamePath   e.g. ...\dota 2 beta\game
   * @param {() => string} opts.getLangSuffix      e.g. "123"
   * @param {(evt: object) => void} opts.onProgress
   */
  constructor({ userDataDir, getGamePath, getLangSuffix, onProgress }) {
    this.downloadsDir = path.join(userDataDir, 'downloads');
    this.toolsDir = path.join(userDataDir, 'tools');
    this.backupsDir = path.join(userDataDir, 'backups');
    this.packsDir = path.join(userDataDir, 'packs'); // per-member source VPKs of combined packs
    fs.mkdirSync(this.downloadsDir, { recursive: true });
    fs.mkdirSync(this.toolsDir, { recursive: true });
    fs.mkdirSync(this.backupsDir, { recursive: true });
    fs.mkdirSync(this.packsDir, { recursive: true });
    this.getGamePath = getGamePath;
    this.getLangSuffix = getLangSuffix;
    this.onProgress = onProgress || (() => {});
    this._pathCache = new Map(); // "<abs>|<size>|<mtime>" -> Map<path, crc>
  }

  langFolder() {
    const game = this.getGamePath();
    if (!game) throw new Error(t('Путь к Dota 2 не задан'));
    return path.join(game, `dota_${this.getLangSuffix()}`);
  }

  // ---------- download ----------

  async download(categoryId, fileRef, label) {
    const url = fileUrl(categoryId, fileRef);
    const safeName = decodeURIComponent(url.split('/').pop());
    const destDir = path.join(this.downloadsDir, categoryId);
    fs.mkdirSync(destDir, { recursive: true });
    const dest = path.join(destDir, safeName);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return dest; // cached

    const res = await fetch(url);
    if (!res.ok) throw new Error(t('HTTP {0} — не удалось скачать {1}', res.status, safeName));
    const total = Number(res.headers.get('content-length')) || 0;
    const tmp = dest + '.part';
    const out = fs.createWriteStream(tmp);
    let loaded = 0;
    const reader = res.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        loaded += value.length;
        this.onProgress({ type: 'download', label: label || safeName, loaded, total });
        await new Promise((resolve, reject) => {
          out.write(Buffer.from(value), (err) => (err ? reject(err) : resolve()));
        });
      }
    } finally {
      await new Promise((resolve) => out.end(resolve));
    }
    fs.renameSync(tmp, dest);
    return dest;
  }

  // ---------- pak allocation ----------

  usedPakNames() {
    const lang = this.langFolder();
    const used = new Set();
    if (fs.existsSync(lang)) {
      for (const f of fs.readdirSync(lang)) {
        // disabled (.off) and master-off (.moff) files still occupy their base slot
        used.add(f.toLowerCase().replace(/\.moff$/, '').replace(/\.off$/, ''));
      }
    }
    return used;
  }

  // ---------- master mods on/off ----------

  // Is this base name a mod pak the master switch may toggle? (i.e. not the game's own
  // localization / gameinfo). Accepts a lowercased name without .off/.moff suffix.
  isTogglableModFile(baseLower) {
    return !isOfficialLangFile(baseLower);
  }

  // true when the master switch is currently "off" (any .moff file present in lang root)
  masterIsOff() {
    const lang = this.langFolder();
    if (!fs.existsSync(lang)) return false;
    for (const f of fs.readdirSync(lang)) if (f.toLowerCase().endsWith(MASTER_OFF)) return true;
    return false;
  }

  // Enable/disable every mod pak at once without losing per-mod state:
  //  off -> rename each active mod file <f> to <f>.moff (skips .off and official files)
  //  on  -> rename each <f>.moff back to <f>
  // Also covers the language\maps folder (terrain mods live there as dota.vpk).
  setMasterEnabled(enabled) {
    const lang = this.langFolder();
    if (!fs.existsSync(lang)) return { changed: 0 };
    let changed = 0;
    const sweep = (dir) => {
      for (const f of fs.readdirSync(dir)) {
        const full = path.join(dir, f);
        if (!fs.statSync(full).isFile()) continue;
        const lower = f.toLowerCase();
        if (enabled) {
          if (lower.endsWith(MASTER_OFF)) {
            fs.renameSync(full, path.join(dir, f.slice(0, -MASTER_OFF.length)));
            changed++;
          }
        } else {
          if (lower.endsWith(MASTER_OFF) || lower.endsWith('.off')) continue; // already off
          if (dir === lang && !this.isTogglableModFile(lower)) continue;       // official files
          fs.renameSync(full, full + MASTER_OFF);
          changed++;
        }
      }
    };
    sweep(lang);
    const mapsDir = path.join(lang, 'maps');
    if (fs.existsSync(mapsDir)) sweep(mapsDir);
    return { changed };
  }

  allocatePak(used, priority) {
    if (priority) {
      for (let n = 2; n <= 9; n++) {
        const name = `pak0${n}_dir.vpk`;
        if (!used.has(name)) {
          used.add(name);
          return name;
        }
      }
    }
    for (let n = 10; n <= 99; n++) {
      const name = `pak${n}_dir.vpk`;
      if (!used.has(name)) {
        used.add(name);
        return name;
      }
    }
    throw new Error(t('Свободных слотов pakNN не осталось (10-99 заняты)'));
  }

  // ---------- helpers ----------

  copyInto(src, destAbs) {
    fs.mkdirSync(path.dirname(destAbs), { recursive: true });
    fs.copyFileSync(src, destAbs);
  }

  writeInto(buf, destAbs) {
    fs.mkdirSync(path.dirname(destAbs), { recursive: true });
    fs.writeFileSync(destAbs, buf);
  }

  // ---------- install ----------

  /**
   * Installs a mod. Returns array of installed file records:
   * [{ root: 'lang'|'fonts'|'cursor'|'tools', relPath, backup? }]
   */
  async install({ categoryId, modName, fileRef }) {
    const isPriority = PRIORITY_CATEGORIES.includes(categoryId);
    const local = await this.download(categoryId, fileRef, modName);
    this.onProgress({ type: 'stage', label: modName, stage: t('установка') });

    if (categoryId === 'fonts') return this.installFonts(local, modName);
    if (categoryId === 'cursors') return this.installCursor(local, modName);
    if (categoryId === 'tools') return this.installTool(local, modName);

    const lang = this.langFolder();
    fs.mkdirSync(lang, { recursive: true });
    const used = this.usedPakNames();
    const records = [];

    if (local.toLowerCase().endsWith('.vpk')) {
      const pakName = this.allocatePak(used, isPriority);
      this.copyInto(local, path.join(lang, pakName));
      records.push({ root: 'lang', relPath: pakName });
      return records;
    }

    if (!local.toLowerCase().endsWith('.zip')) {
      // unknown single file — drop into lang folder as-is
      const base = path.basename(local);
      this.copyInto(local, path.join(lang, base));
      records.push({ root: 'lang', relPath: base });
      return records;
    }

    const zip = new AdmZip(local);
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      const rel = entry.entryName.replace(/\\/g, '/');
      const lower = rel.toLowerCase();
      const baseName = rel.split('/').pop();
      if (!baseName || lower.includes('!guide') || /(^|\/)(guide\.txt|install\.bat|uninstall\.bat|readme[^/]*)$/i.test(lower)) {
        continue;
      }

      if (categoryId === 'terrains' && lower.includes('maps/')) {
        // keep maps/... structure inside the language folder
        const parts = rel.split('/');
        const mapsIdx = parts.findIndex((p) => p.toLowerCase() === 'maps');
        const relPath = parts.slice(mapsIdx).join('/');
        this.writeInto(entry.getData(), path.join(lang, relPath));
        records.push({ root: 'lang', relPath });
      } else if (lower.endsWith('_dir.vpk') || lower.endsWith('.vpk')) {
        const pakName = lower.endsWith('_dir.vpk')
          ? this.allocatePak(used, isPriority)
          : baseName; // secondary pak parts (pakNN_000.vpk) keep names
        this.writeInto(entry.getData(), path.join(lang, pakName));
        records.push({ root: 'lang', relPath: pakName });
      } else {
        // any other payload file — preserve relative path inside lang folder,
        // stripping the zip's top-level "<Mod Name>/" wrapper if present
        const parts = rel.split('/');
        const relPath = parts.length > 1 ? parts.slice(1).join('/') : rel;
        if (!relPath) continue;
        this.writeInto(entry.getData(), path.join(lang, relPath));
        records.push({ root: 'lang', relPath });
      }
    }
    return records;
  }

  // Fonts: zip has <Name>/assets/custom (the mod) and <Name>/assets/default (vanilla files).
  // Custom files go to game\dota\panorama\fonts. Vanilla originals are backed up once.
  installFonts(localZip, modName) {
    const game = this.getGamePath();
    if (!game) throw new Error(t('Путь к Dota 2 не задан'));
    const target = path.join(game, ...FONTS_SUBDIR);
    fs.mkdirSync(target, { recursive: true });
    const zip = new AdmZip(localZip);
    const records = [];
    const backupRoot = path.join(this.backupsDir, 'fonts');
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      const rel = entry.entryName.replace(/\\/g, '/');
      const m = rel.match(/assets\/custom\/(.+)$/i);
      if (!m) continue;
      const fname = m[1];
      const destAbs = path.join(target, fname);
      // backup vanilla file once (first font mod that touches it)
      const backupAbs = path.join(backupRoot, fname);
      if (fs.existsSync(destAbs) && !fs.existsSync(backupAbs)) {
        fs.mkdirSync(path.dirname(backupAbs), { recursive: true });
        fs.copyFileSync(destAbs, backupAbs);
      }
      this.writeInto(entry.getData(), destAbs);
      records.push({ root: 'fonts', relPath: fname });
    }
    if (!records.length) throw new Error(t('{0}: в архиве не найдено assets/custom', modName));
    return records;
  }

  // Cursors: zip has <Name>/cursor/* → game\dota\resource\cursor (vanilla backed up once)
  installCursor(localZip, modName) {
    const game = this.getGamePath();
    if (!game) throw new Error(t('Путь к Dota 2 не задан'));
    const target = path.join(game, ...CURSOR_SUBDIR);
    fs.mkdirSync(target, { recursive: true });
    const zip = new AdmZip(localZip);
    const records = [];
    const backupRoot = path.join(this.backupsDir, 'cursor');
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      const rel = entry.entryName.replace(/\\/g, '/');
      const m = rel.match(/(?:^|\/)cursor\/(.+)$/i);
      if (!m) continue;
      const fname = m[1];
      const destAbs = path.join(target, fname);
      const backupAbs = path.join(backupRoot, fname);
      if (fs.existsSync(destAbs) && !fs.existsSync(backupAbs)) {
        fs.mkdirSync(path.dirname(backupAbs), { recursive: true });
        fs.copyFileSync(destAbs, backupAbs);
      }
      this.writeInto(entry.getData(), destAbs);
      records.push({ root: 'cursor', relPath: fname });
    }
    if (!records.length) throw new Error(t('{0}: в архиве не найдена папка cursor', modName));
    return records;
  }

  installTool(localZip, modName) {
    const dest = path.join(this.toolsDir, modName.replace(/[<>:"/\\|?*]/g, '_'));
    fs.mkdirSync(dest, { recursive: true });
    if (localZip.toLowerCase().endsWith('.zip')) {
      new AdmZip(localZip).extractAllTo(dest, true);
    } else {
      this.copyInto(localZip, path.join(dest, path.basename(localZip)));
    }
    return [{ root: 'tools', relPath: path.basename(dest) }];
  }

  // ---------- enable / disable / remove ----------

  rootAbs(root) {
    const game = this.getGamePath();
    switch (root) {
      case 'lang': return this.langFolder();
      case 'fonts': return path.join(game, ...FONTS_SUBDIR);
      case 'cursor': return path.join(game, ...CURSOR_SUBDIR);
      case 'tools': return this.toolsDir;
      default: throw new Error(t('Неизвестный root: {0}', root));
    }
  }

  setEnabled(files, enabled) {
    for (const f of files) {
      if (f.root === 'tools') continue;
      if (f.root === 'fonts' || f.root === 'cursor') continue; // handled by reinstall/restore
      const abs = path.join(this.rootAbs(f.root), f.relPath);
      const off = abs + '.off';
      if (enabled && fs.existsSync(off)) fs.renameSync(off, abs);
      if (!enabled && fs.existsSync(abs)) fs.renameSync(abs, off);
    }
  }

  remove(files) {
    for (const f of files) {
      const rootAbs = this.rootAbs(f.root);
      if (f.root === 'tools') {
        fs.rmSync(path.join(rootAbs, f.relPath), { recursive: true, force: true });
        continue;
      }
      const abs = path.join(rootAbs, f.relPath);
      for (const p of [abs, abs + '.off', abs + MASTER_OFF]) {
        if (fs.existsSync(p)) fs.rmSync(p, { force: true });
      }
      if (f.root === 'fonts' || f.root === 'cursor') {
        // restore vanilla file from backup if we have one
        const backupAbs = path.join(this.backupsDir, f.root === 'fonts' ? 'fonts' : 'cursor', f.relPath);
        if (fs.existsSync(backupAbs)) {
          this.copyInto(backupAbs, abs);
        }
      }
    }
  }

  // ---------- export as a single self-contained vpk ----------

  // Merges a mod's lang files (including multi-part _dir + _NNN sets) into one
  // self-contained VPK buffer — the single-file format the catalog uses, e.g.
  // for sharing an imported Dota2Changer pack with a catalog author.
  mergeToSingleVpk(rec) {
    const lang = this.langFolder();
    const dirRec = rec.files.find((f) => f.root === 'lang' && /_dir\.vpk$/i.test(f.relPath));
    if (!dirRec) throw new Error(t('У этого мода нет _dir.vpk — объединять нечего'));
    // resolve real on-disk name (files may be disabled -> ".off")
    const resolve = (relPath) => {
      const abs = path.join(lang, relPath);
      for (const suf of ['', '.off', MASTER_OFF]) if (fs.existsSync(abs + suf)) return abs + suf;
      return abs;
    };
    const dirAbs = resolve(dirRec.relPath);
    const base = dirRec.relPath.replace(/_dir\.vpk$/i, '');
    const archivePathFor = (idx) => resolve(`${base}_${String(idx).padStart(3, '0')}.vpk`);
    return mergeVpkToSingle(dirAbs, archivePathFor);
  }

  // ---------- conflict detection ----------

  // Game paths a downloaded mod file would provide, mapped to their VPK CRC (-1 = unknown,
  // for loose non-VPK payload files). Returns Map<path, crc>.
  modContentPaths(localFile) {
    const out = new Map();
    const lower = localFile.toLowerCase();
    if (lower.endsWith('.vpk')) {
      for (const [p, crc] of listVpkPathCrcsFile(localFile)) out.set(p, crc);
      return dropSharedPaths(out);
    }
    if (!lower.endsWith('.zip')) return out;
    const zip = new AdmZip(localFile);
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      const rel = entry.entryName.replace(/\\/g, '/');
      const l = rel.toLowerCase();
      const baseName = rel.split('/').pop();
      if (!baseName || l.includes('!guide') || /(^|\/)(guide\.txt|install\.bat|uninstall\.bat|readme[^/]*)$/i.test(l)) continue;
      if (l.endsWith('_dir.vpk')) {
        try { for (const [p, crc] of listVpkPathCrcs(entry.getData())) out.set(p, crc); } catch { /* skip broken vpk */ }
      } else if (l.endsWith('.vpk')) {
        // secondary archive parts (pakNN_000.vpk) carry no index
      } else if (l.includes('maps/')) {
        const parts = rel.split('/');
        const mapsIdx = parts.findIndex((p) => p.toLowerCase() === 'maps');
        out.set(parts.slice(mapsIdx).join('/').toLowerCase(), -1);
      } else {
        const parts = rel.split('/');
        out.set((parts.length > 1 ? parts.slice(1).join('/') : rel).toLowerCase(), -1);
      }
    }
    return dropSharedPaths(out);
  }

  // Path->crc index of one installed VPK, memoised on (size, mtime). Scanning the whole
  // library for conflicts re-reads the same files on every render otherwise.
  vpkContentPaths(abs) {
    const st = fs.statSync(abs);
    const key = `${abs}|${st.size}|${st.mtimeMs}`;
    const hit = this._pathCache.get(key);
    if (hit) return hit;
    const map = listVpkPathCrcsFile(abs);
    if (this._pathCache.size > 200) this._pathCache.clear();
    this._pathCache.set(key, map);
    return map;
  }

  // Game paths of an installed library record, read from disk, mapped to their VPK CRC.
  // Returns Map<path, crc> (-1 = unknown, for loose non-VPK lang files).
  installedContentPaths(rec) {
    const lang = this.langFolder();
    const out = new Map();
    for (const f of rec.files) {
      if (f.root !== 'lang') continue;
      if (/\.vpk$/i.test(f.relPath)) {
        if (!/_dir\.vpk$/i.test(f.relPath)) continue;
        // a disabled mod keeps its bytes under .off/.moff — still worth comparing
        const base = path.join(lang, f.relPath);
        const abs = ['', '.off', MASTER_OFF].map((s) => base + s).find((p) => fs.existsSync(p));
        if (!abs) continue;
        try {
          for (const [p, crc] of this.vpkContentPaths(abs)) out.set(p, crc);
        } catch { /* unreadable — ignore */ }
      } else {
        out.set(f.relPath.replace(/\\/g, '/').toLowerCase(), -1);
      }
    }
    return dropSharedPaths(out);
  }

  /**
   * Every pair of currently-enabled mods that fights over the same game files. Paths both
   * sides provide byte-identically, engine filler and shared tool tables are already out
   * (see dropSharedPaths), so what survives is a real "only one of these will show" clash.
   * @param {Array<object>} records library records
   * @returns {Array<{a:{id,name}, b:{id,name}, count:number, summary:string}>}
   */
  libraryConflicts(records) {
    const live = (records || []).filter((r) => r.enabled && (r.files || []).some((f) => f.root === 'lang'));
    const paths = [];
    for (const rec of live) {
      try {
        const own = this.installedContentPaths(rec);
        if (own.size) paths.push({ rec, own });
      } catch { /* no game path / unreadable — skip */ }
    }
    const out = [];
    for (let i = 0; i < paths.length; i++) {
      for (let j = i + 1; j < paths.length; j++) {
        const overlap = conflictingPaths(paths[i].own, paths[j].own);
        if (!overlap.length) continue;
        out.push({
          a: { id: paths[i].rec.id, name: paths[i].rec.name },
          b: { id: paths[j].rec.id, name: paths[j].rec.name },
          count: overlap.length,
          summary: analyzeVpkPaths(overlap).heroes.map(describeHero).join('; '),
        });
      }
    }
    return out.sort((x, y) => y.count - x.count);
  }

  // Which of the given (enabled) records overlap with the candidate download
  async findConflicts({ categoryId, fileRef, modName }, records) {
    if (['fonts', 'cursors', 'tools'].includes(categoryId)) return [];
    const local = await this.download(categoryId, fileRef, modName);
    const candidate = this.modContentPaths(local);
    if (!candidate.size) return [];
    const conflicts = [];
    for (const rec of records) {
      if (!rec.enabled) continue;
      const own = this.installedContentPaths(rec);
      // only paths the two mods provide with DIFFERENT content are real clashes; a shared
      // filler asset (same CRC on both sides) is byte-identical and loads fine either way
      const overlap = conflictingPaths(candidate, own);
      if (overlap.length) {
        const shared = analyzeVpkPaths(overlap);
        const summary = shared.heroes.map(describeHero).join('; ');
        conflicts.push({ name: rec.name, count: overlap.length, summary, sample: overlap.slice(0, 3) });
      }
    }
    return conflicts;
  }

  // ---------- import of user-provided vpk files ----------

  // Import whatever the user pointed at: .vpk files, a .zip, or a folder to walk.
  // Returns one result per mod: { source, name, files[], merged? } or { source, error }.
  importVpks(paths) {
    const staged = [];
    try {
      const { files, errors } = this.expandImportInputs(paths || [], staged);
      return [...errors, ...this.importVpkFiles(files)];
    } finally {
      for (const dir of staged) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* noop */ } }
    }
  }

  // Every .vpk under a dropped folder. Skinchanger packs unzip to a whole game tree
  // (<pack>\game\Dota2SkinChanger\pak01_*.vpk), so the file we want sits a few levels in.
  scanVpkTree(root, depth = 0) {
    const out = [];
    if (depth > 6) return out;
    let names = [];
    try { names = fs.readdirSync(root); } catch { return out; }
    for (const f of names) {
      const full = path.join(root, f);
      let st;
      try { st = fs.statSync(full); } catch { continue; }
      if (st.isDirectory()) out.push(...this.scanVpkTree(full, depth + 1));
      else if (/\.vpk$/i.test(f)) out.push(full);
    }
    return out;
  }

  /**
   * Turn whatever the user dropped or picked into a flat list of .vpk paths: a folder is
   * walked, a .zip is unpacked to a temp dir (keeping its layout so multi-part sets stay
   * side by side), a plain file passes through. Temp dirs are appended to `staged` for the
   * caller to delete once the import has read them.
   * @returns {{ files: string[], errors: Array<{source:string, error:string}> }}
   */
  expandImportInputs(paths, staged) {
    const files = [];
    const errors = [];
    for (const src of paths) {
      const label = path.basename(src);
      let st = null;
      try { st = fs.statSync(src); } catch { /* gone or unreadable */ }

      if (st && st.isDirectory()) {
        const found = this.scanVpkTree(src);
        if (found.length) files.push(...found);
        else errors.push({ source: label, error: t('в папке нет .vpk файлов') });
        continue;
      }
      if (/\.zip$/i.test(src)) {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-zip-'));
        staged.push(tmp);
        let found = 0;
        try {
          for (const entry of new AdmZip(src).getEntries()) {
            if (entry.isDirectory) continue;
            const rel = entry.entryName.replace(/\\/g, '/');
            if (!/\.vpk$/i.test(rel) || rel.includes('..')) continue;
            const dest = path.join(tmp, rel);
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.writeFileSync(dest, entry.getData());
            files.push(dest);
            found++;
          }
        } catch (err) {
          errors.push({ source: label, error: String(err.message || err) });
          continue;
        }
        if (!found) errors.push({ source: label, error: t('в архиве нет .vpk файлов') });
        continue;
      }
      files.push(src);
    }
    return { files, errors };
  }

  // A VPK mod is either one self-contained "<base>_dir.vpk", or a multi-volume set:
  // "<base>_dir.vpk" (index) + "<base>_000.vpk", "<base>_001.vpk"... (data). Skinchanger
  // and Dota2Changer packs ship as the latter, so the volumes are grouped with their index
  // and folded into a single file per mod on the way in.
  importVpkFiles(paths) {
    const lang = this.langFolder();
    fs.mkdirSync(lang, { recursive: true });
    const used = this.usedPakNames();
    const results = [];

    // group selected files into sets keyed by source dir + base name
    const sets = new Map(); // key -> { srcDir, base, dirFile, sourceLabel }
    for (const src of paths) {
      const fileName = path.basename(src);
      if (!/\.vpk$/i.test(fileName)) {
        results.push({ source: fileName, error: t('не .vpk файл') });
        continue;
      }
      const srcDir = path.dirname(src);
      const mDir = fileName.match(/^(.*)_dir\.vpk$/i);
      const mPart = fileName.match(/^(.*)_\d{3}\.vpk$/i);
      const base = (mDir && mDir[1]) || (mPart && mPart[1]) || fileName.replace(/\.vpk$/i, '');
      const key = srcDir.toLowerCase() + '|' + base.toLowerCase();
      const set = sets.get(key) || { srcDir, base, dirFile: null, sourceLabel: fileName };
      if (mDir) { set.dirFile = src; set.sourceLabel = fileName; }
      else if (!mPart) { set.dirFile = src; set.single = true; set.sourceLabel = fileName; }
      // bare data parts (_NNN) need no explicit entry: discovered from disk below
      sets.set(key, set);
    }

    for (const set of sets.values()) {
      try {
        // self-contained non-_dir vpk: copy as a fresh dir slot
        if (set.single) {
          const pakName = this.allocatePak(used, false);
          this.copyInto(set.dirFile, path.join(lang, pakName));
          results.push({ source: set.sourceLabel, name: set.base, files: [{ root: 'lang', relPath: pakName }] });
          continue;
        }
        // find the _dir.vpk (selected, or sitting next to selected data parts)
        let dirSrc = set.dirFile;
        if (!dirSrc) {
          const guess = path.join(set.srcDir, `${set.base}_dir.vpk`);
          if (fs.existsSync(guess)) dirSrc = guess;
        }
        if (!dirSrc) {
          results.push({ source: set.sourceLabel, error: t('нет {0}_dir.vpk рядом с data-частями', set.base) });
          continue;
        }
        const pakDir = this.allocatePak(used, false);        // pakXX_dir.vpk
        const newBase = pakDir.replace(/_dir\.vpk$/i, '');    // pakXX
        // sibling data archives <base>_NNN.vpk that belong to this index
        const partRe = new RegExp(`^${set.base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_(\\d{3})\\.vpk$`, 'i');
        const partFiles = fs.readdirSync(set.srcDir)
          .map((f) => ({ f, m: f.match(partRe) }))
          .filter((x) => x.m)
          .sort((x, y) => x.m[1].localeCompare(y.m[1]));

        // Multi-volume set (a Skinchanger pack is pak01_dir.vpk + pak01_000.vpk): fold the
        // index and its volumes into ONE self-contained pakXX_dir.vpk. One file per mod is
        // what the rest of the app assumes — enable/disable, export, packing and the folder
        // sync all key off a single name, and a stray half-set left in the folder is exactly
        // how a mod ends up half-loaded. Byte-for-byte copy stays the fallback.
        const partsBytes = partFiles.reduce((s, x) => s + fs.statSync(path.join(set.srcDir, x.f)).size, 0);
        if (partFiles.length && partsBytes <= MERGE_SIZE_CAP) {
          try {
            const archiveFor = (idx) => path.join(set.srcDir, `${set.base}_${String(idx).padStart(3, '0')}.vpk`);
            this.writeInto(mergeVpkToSingle(dirSrc, archiveFor), path.join(lang, pakDir));
            results.push({
              source: `${set.base}_dir.vpk`, name: set.base, merged: partFiles.length + 1,
              files: [{ root: 'lang', relPath: pakDir }],
            });
            continue;
          } catch { /* unreadable index or missing volume — copy the set as it is */ }
        }

        this.copyInto(dirSrc, path.join(lang, pakDir));
        const files = [{ root: 'lang', relPath: pakDir }];
        for (const { f, m } of partFiles) {
          const partName = `${newBase}_${m[1]}.vpk`;
          this.copyInto(path.join(set.srcDir, f), path.join(lang, partName));
          files.push({ root: 'lang', relPath: partName });
        }
        results.push({ source: `${set.base}_dir.vpk`, name: set.base, files });
      } catch (err) {
        results.push({ source: set.sourceLabel, error: String(err.message || err) });
      }
    }
    return results;
  }

  // Install a VPK handed over as bytes (a mod embedded in a shared preset). The index is
  // parsed first: whatever a stranger put in that archive, only something that really is a
  // VPK ever reaches the game folder, and the slot name is ours, never theirs.
  installVpkBuffer(buf) {
    if (!listVpkPaths(buf).length) throw new Error(t('Пустой VPK'));
    const lang = this.langFolder();
    fs.mkdirSync(lang, { recursive: true });
    const pakName = this.allocatePak(this.usedPakNames(), false);
    this.writeInto(buf, path.join(lang, pakName));
    return [{ root: 'lang', relPath: pakName }];
  }

  // A content-derived display name for a lang VPK (hero / set / kind), or null if the
  // content isn't recognisable — used to name imported files instead of a bare "pakNN".
  displayNameForFile(relPath) {
    try {
      return nameFromAnalysis(analyzeVpkPaths(listVpkPathsFile(path.join(this.langFolder(), relPath))));
    } catch { return null; }
  }

  // Import dropped .vpk/.zip files given as raw bytes (used when the drop can't resolve a
  // real on-disk path). Bytes are staged in a temp folder so the normal path-based importer
  // handles grouping of multi-part sets, then the temp folder is removed.
  importVpkBuffers(items) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-import-'));
    try {
      const paths = [];
      for (const it of items || []) {
        if (!it || !/\.(vpk|zip)$/i.test(it.name || '')) continue;
        const p = path.join(tmp, path.basename(it.name));
        fs.writeFileSync(p, Buffer.from(it.data));
        paths.push(p);
      }
      return this.importVpks(paths);
    } finally {
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* noop */ }
    }
  }

  // What a stored library record (or a foreign vpk) actually changes — hero(es) and
  // slots — read from its _dir.vpk on disk. Returns { info, heroes } or null.
  analyzeRecord(rec) {
    const dir = rec.files.find((f) => f.root === 'lang' && /_dir\.vpk$/i.test(f.relPath));
    if (!dir) return null;
    try {
      const buf = readVpkIndexFile(path.join(this.langFolder(), dir.relPath));
      const a = analyzeVpkPaths(listVpkPaths(buf));
      return { info: describeAnalysis(a), heroes: a.heroes.length, fp: fingerprintVpk(buf) };
    } catch { return null; }
  }

  // Split a merged multi-hero VPK sitting in the lang folder into one managed VPK per
  // hero, each written to a fresh pak slot. Returns [{ hero, name, files }]; caller
  // registers them and deletes the source. Empty if fewer than 2 heroes are found.
  splitVpkFile(sourceRelPath) {
    const lang = this.langFolder();
    const parts = splitVpkByHero(path.join(lang, sourceRelPath));
    if (!parts.length) return [];
    const used = this.usedPakNames();
    return parts.map((part) => {
      const pakName = this.allocatePak(used, false);
      this.writeInto(part.buf, path.join(lang, pakName));
      return { hero: part.name, name: part.name, files: [{ root: 'lang', relPath: pakName }] };
    });
  }

  // ---------- combined packs (many mods -> one pakNN slot) ----------

  packFolder(packId) { return path.join(this.packsDir, packId); }
  packMemberFile(packId, memberId) { return path.join(this.packFolder(packId), `${memberId}.vpk`); }

  // Flatten a library record into one self-contained VPK and store it as a pack member.
  // Returns the member descriptor (identity + a content summary for the UI) to record in
  // the pack manifest. The record's own deployed files are left for the caller to remove.
  addPackMemberFromRecord(packId, rec, memberId) {
    const buf = this.mergeToSingleVpk(rec);
    fs.mkdirSync(this.packFolder(packId), { recursive: true });
    fs.writeFileSync(this.packMemberFile(packId, memberId), buf);
    let heroes = 0, info = '', fp = null;
    try {
      const a = analyzeVpkPaths(listVpkPaths(buf));
      heroes = a.heroes.length; info = describeAnalysis(a); fp = fingerprintVpk(buf);
    } catch { /* summary is best-effort */ }
    return {
      id: memberId, name: rec.name, categoryId: rec.categoryId, styleLabel: rec.styleLabel || null,
      preview: rec.preview || null, enabled: rec.enabled !== false, heroes, info, fp,
    };
  }

  // Remove a pack's currently deployed files (index + every data volume, in any state:
  // active, .off or .moff) from the language folder, so it can be rebuilt cleanly.
  removePackDeployed(pack) {
    const lang = this.langFolder();
    if (!fs.existsSync(lang)) return;
    const base = this.packBase(pack);
    if (!base) return;
    const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(_dir|_\\d{3})\\.vpk(\\.off|\\.moff)?$`, 'i');
    for (const f of fs.readdirSync(lang)) if (re.test(f)) fs.rmSync(path.join(lang, f), { force: true });
  }

  // The pak slot base ("pak10") a pack deploys to — reused across rebuilds so the slot
  // stays stable. Taken from the pack's recorded files, else null (allocate on deploy).
  packBase(pack) {
    const dir = (pack.files || []).find((f) => f.root === 'lang' && /_dir\.vpk$/i.test(f.relPath));
    return dir ? dir.relPath.replace(/_dir\.vpk$/i, '') : null;
  }

  // (Re)build a pack's single deployed VPK from its enabled members. Removes the old
  // deployment first, then combines enabled member sources into the pack's slot. Returns
  // { files, conflicts } — caller stores files on the record and re-applies enabled/master
  // state. With no enabled members nothing is written (files: []).
  deployPack(pack) {
    const lang = this.langFolder();
    fs.mkdirSync(lang, { recursive: true });
    this.removePackDeployed(pack);
    const enabled = (pack.members || []).filter((m) => m.enabled);
    if (!enabled.length) return { files: [], conflicts: [] };
    let base = this.packBase(pack);
    if (!base) base = this.allocatePak(this.usedPakNames(), false).replace(/_dir\.vpk$/i, '');
    const members = enabled.map((m) => ({ key: m.id, buf: fs.readFileSync(this.packMemberFile(pack.id, m.id)) }));
    const { dir, parts, conflicts } = combineVpksToFiles(members, lang, base);
    const files = [{ root: 'lang', relPath: dir }, ...parts.map((p) => ({ root: 'lang', relPath: p }))];
    return { files, conflicts };
  }

  // Fully delete a pack: its deployed VPK and every stored member source.
  removePackFully(pack) {
    this.removePackDeployed(pack);
    try { fs.rmSync(this.packFolder(pack.id), { recursive: true, force: true }); } catch { /* noop */ }
  }

  // Turn a stored pack member back into a standalone deployed mod in a fresh pak slot.
  // Returns { files } for a new library record; caller deletes the member from the pack.
  deployMemberAsMod(pack, member) {
    const lang = this.langFolder();
    fs.mkdirSync(lang, { recursive: true });
    const buf = fs.readFileSync(this.packMemberFile(pack.id, member.id));
    const pakName = this.allocatePak(this.usedPakNames(), false);
    this.writeInto(buf, path.join(lang, pakName));
    return { files: [{ root: 'lang', relPath: pakName }] };
  }

  // Does a record's primary VPK still exist on disk (active/.off/.moff)? Used to sync the
  // library with the folder — a mod deleted from the folder should drop out of the library.
  langPrimaryPresent(rec) {
    let lang;
    try { lang = this.langFolder(); } catch { return true; } // no game path — can't tell, keep it
    if (!fs.existsSync(lang)) return true; // folder missing entirely — don't nuke the manifest
    const primary = (rec.files || []).find((f) => f.root === 'lang' && /\.vpk$/i.test(f.relPath));
    if (!primary) return true; // fonts/cursors/tools live elsewhere — not folder-synced
    return ['', '.off', '.moff'].some((suf) => fs.existsSync(path.join(lang, primary.relPath + suf)));
  }

  // Number of occupied pak slots (mod paks only, excluding the game's own pak01_*), used
  // to warn/suggest combining when the library approaches the 99-slot ceiling.
  usedModSlots() {
    const lang = this.langFolder();
    if (!fs.existsSync(lang)) return 0;
    const bases = new Set();
    for (const f of fs.readdirSync(lang)) {
      const m = f.toLowerCase().replace(/\.moff$/, '').replace(/\.off$/, '').match(/^(pak\d+)_dir\.vpk$/);
      if (m && !/^pak01$/.test(m[1])) bases.add(m[1]);
    }
    return bases.size;
  }

  // Older app versions wrote priority mods as "!pakNN_dir.vpk" — a name the game
  // never mounts, so those mods silently did nothing. Rename them to real low
  // pak slots and fix the matching manifest records.
  migrateLegacyPriorityPaks(library) {
    const lang = this.langFolder();
    if (!fs.existsSync(lang)) return;
    const legacy = fs.readdirSync(lang).filter((f) => /^!pak\d+_dir\.vpk(\.off)?$/i.test(f));
    if (!legacy.length) return;
    const used = this.usedPakNames();
    let changed = false;
    for (const f of legacy) {
      const disabled = /\.off$/i.test(f);
      const oldBase = f.replace(/\.off$/i, '');
      const newBase = this.allocatePak(used, true);
      fs.renameSync(path.join(lang, f), path.join(lang, newBase + (disabled ? '.off' : '')));
      for (const rec of library.list()) {
        for (const fr of rec.files) {
          if (fr.root === 'lang' && fr.relPath.toLowerCase() === oldBase.toLowerCase()) {
            fr.relPath = newBase;
            changed = true;
          }
        }
      }
    }
    if (changed) library.save();
  }

  // Imports made before multi-volume sets were folded on the way in still sit in the
  // folder as pakNN_dir.vpk + pakNN_000.vpk. Fold them now so every managed mod is one
  // file. Combined packs are left alone — their volumes are how deployPack writes them.
  mergeMultiPartRecords(library) {
    const lang = this.langFolder();
    if (!fs.existsSync(lang)) return;
    const onDisk = (relPath) => ['', '.off', MASTER_OFF]
      .map((suf) => path.join(lang, relPath) + suf).find((p) => fs.existsSync(p));

    let changed = false;
    for (const rec of library.list()) {
      if (rec.kind === 'pack') continue;
      const dirRec = (rec.files || []).find((f) => f.root === 'lang' && /_dir\.vpk$/i.test(f.relPath));
      const parts = (rec.files || []).filter((f) => f.root === 'lang' && /_\d{3}\.vpk$/i.test(f.relPath));
      if (!dirRec || !parts.length) continue;
      const dirAbs = onDisk(dirRec.relPath);
      if (!dirAbs) continue;
      try {
        const base = dirRec.relPath.replace(/_dir\.vpk$/i, '');
        const total = parts.reduce((s, f) => { const p = onDisk(f.relPath); return s + (p ? fs.statSync(p).size : 0); }, 0);
        if (total > MERGE_SIZE_CAP) continue;
        const merged = mergeVpkToSingle(dirAbs, (idx) => onDisk(`${base}_${String(idx).padStart(3, '0')}.vpk`));
        // write beside the original and swap, so a failed write can't leave a mod truncated
        fs.writeFileSync(dirAbs + '.merging', merged);
        fs.renameSync(dirAbs + '.merging', dirAbs); // keeps whatever .off/.moff state it had
        for (const f of parts) {
          for (const suf of ['', '.off', MASTER_OFF]) fs.rmSync(path.join(lang, f.relPath) + suf, { force: true });
        }
        library.update(rec.id, { files: rec.files.filter((f) => !parts.includes(f)) });
        changed = true;
      } catch { /* missing or unreadable volume — leave the set as it is */ }
    }
    if (changed) this._pathCache.clear();
  }

  // build a foreign VPK item, tagged and fingerprinted when it has a readable index
  vpkItem(abs, relPath, displayName, primary) {
    const item = {
      kind: 'vpk', key: relPath, name: displayName, primary,
      size: fs.statSync(abs).size, enabled: !abs.toLowerCase().endsWith('.off'),
      files: [{ root: 'lang', relPath: relPath.replace(/\.off$/i, '') }],
    };
    try {
      const buf = readVpkIndexFile(abs);
      const a = analyzeVpkPaths(listVpkPaths(buf));
      item.info = describeAnalysis(a);
      item.heroes = a.heroes.length;
      item.fp = fingerprintVpk(buf);
    } catch { /* data part / unreadable — leave untagged */ }
    return item;
  }

  // Foreign content — files not installed through the app — across every place a mod
  // can live: the language folder root (skins, imported), language\maps (terrains), and
  // resource\cursor (a cursor set, treated as one item). Each carries a fingerprint so
  // the caller can recognise it as a specific catalog mod. `primary` items (lang root)
  // are always listed; maps/cursor items are only worth showing when they match, so the
  // caller passes scanExtras=false to skip that scan when it has nothing to match against.
  externalFiles(knownFiles, { scanExtras = true } = {}) {
    const game = this.getGamePath();
    if (!game) return [];
    const knownLang = new Set(knownFiles.filter((f) => f.root === 'lang').map((f) => f.relPath.toLowerCase()));
    const knownCursor = knownFiles.some((f) => f.root === 'cursor');
    const out = [];

    const lang = this.langFolder();
    if (fs.existsSync(lang)) {
      for (const f of fs.readdirSync(lang)) {
        const full = path.join(lang, f);
        if (!fs.statSync(full).isFile()) continue;
        if (f.toLowerCase().endsWith(MASTER_OFF)) continue; // master-off files: handled by the toggle, not foreign
        const base = f.toLowerCase().replace(/\.off$/, '');
        if (isOfficialLangFile(base) || knownLang.has(base)) continue;
        out.push(this.vpkItem(full, f, f, true));
      }
      // terrains ship as language\maps\dota.vpk (not a *_dir.vpk in the root)
      const mapsDir = path.join(lang, 'maps');
      if (scanExtras && fs.existsSync(mapsDir)) {
        for (const f of fs.readdirSync(mapsDir)) {
          if (!/\.vpk$/i.test(f)) continue;
          const rel = `maps/${f}`;
          if (!knownLang.has(rel.toLowerCase().replace(/\.off$/, ''))) out.push(this.vpkItem(path.join(mapsDir, f), rel, rel, false));
        }
      }
    }

    // a foreign cursor set (only when the app isn't already managing cursors)
    if (scanExtras && !knownCursor) {
      const cursorDir = path.join(game, ...CURSOR_SUBDIR);
      if (fs.existsSync(cursorDir)) {
        const files = [];
        const rels = [];
        const walk = (d, pre) => {
          for (const f of fs.readdirSync(d)) {
            const full = path.join(d, f);
            const rel = pre ? `${pre}/${f}` : f;
            if (fs.statSync(full).isDirectory()) walk(full, rel);
            else { files.push({ path: f.toLowerCase(), data: fs.readFileSync(full) }); rels.push(rel); }
          }
        };
        try { walk(cursorDir, ''); } catch { /* unreadable */ }
        if (files.length) {
          out.push({
            kind: 'cursor', key: '__cursor__', name: t('Курсор'), primary: false,
            size: files.reduce((s, x) => s + x.data.length, 0), enabled: true,
            files: rels.map((rp) => ({ root: 'cursor', relPath: rp })), fp: fingerprintFiles(files),
          });
        }
      }
    }
    return out;
  }

  // basename -> sha1 of every file currently in panorama\fonts, for font subset matching
  fontFolderHashes() {
    const game = this.getGamePath();
    if (!game) return null;
    const dir = path.join(game, ...FONTS_SUBDIR);
    if (!fs.existsSync(dir)) return null;
    const out = {};
    const walk = (d) => {
      for (const f of fs.readdirSync(d)) {
        const full = path.join(d, f);
        if (fs.statSync(full).isDirectory()) walk(full);
        else out[f.toLowerCase()] = crypto.createHash('sha1').update(fs.readFileSync(full)).digest('hex');
      }
    };
    walk(dir);
    return out;
  }

  downloadCacheSize() {
    let total = 0;
    const walk = (dir) => {
      if (!fs.existsSync(dir)) return;
      for (const f of fs.readdirSync(dir)) {
        const full = path.join(dir, f);
        const st = fs.statSync(full);
        if (st.isDirectory()) walk(full);
        else total += st.size;
      }
    };
    walk(this.downloadsDir);
    return total;
  }

  clearDownloadCache() {
    fs.rmSync(this.downloadsDir, { recursive: true, force: true });
    fs.mkdirSync(this.downloadsDir, { recursive: true });
  }
}

module.exports = { Installer, PRIORITY_CATEGORIES, conflictingPaths };
