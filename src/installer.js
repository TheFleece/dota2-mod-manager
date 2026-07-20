// Installer engine: download, extract, pak allocation, per-category install/uninstall
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { RAW_BASE } = require('./catalog');

// Categories whose VPKs must load with higher priority: lower pak numbers (02-09).
// The game only mounts files named pakNN_dir.vpk — the "!pak" prefix seen in
// Dota2PornFx cart zips is a merge-order hint for VPKMerge, not a valid install name.
const PRIORITY_CATEGORIES = ['trees', 'river', 'shaders', 'herofx', 'ranged-attack', 'hero-items', 'optimization'];

const FONTS_SUBDIR = ['dota', 'panorama', 'fonts'];
const CURSOR_SUBDIR = ['dota', 'resource', 'cursor'];

function fileUrl(categoryId, fileRef) {
  if (/^https?:\/\//i.test(fileRef)) return fileRef;
  return `${RAW_BASE}/assets/files/${categoryId}/${encodeURIComponent(fileRef)}`;
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
    fs.mkdirSync(this.downloadsDir, { recursive: true });
    fs.mkdirSync(this.toolsDir, { recursive: true });
    fs.mkdirSync(this.backupsDir, { recursive: true });
    this.getGamePath = getGamePath;
    this.getLangSuffix = getLangSuffix;
    this.onProgress = onProgress || (() => {});
  }

  langFolder() {
    const game = this.getGamePath();
    if (!game) throw new Error('Путь к Dota 2 не задан');
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
    if (!res.ok) throw new Error(`HTTP ${res.status} — не удалось скачать ${safeName}`);
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
        // consider disabled files as occupying their base name too
        used.add(f.toLowerCase().replace(/\.off$/, ''));
      }
    }
    return used;
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
    throw new Error('Свободных слотов pakNN не осталось (10-99 заняты)');
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
    this.onProgress({ type: 'stage', label: modName, stage: 'установка' });

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
    if (!game) throw new Error('Путь к Dota 2 не задан');
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
    if (!records.length) throw new Error(`${modName}: в архиве не найдено assets/custom`);
    return records;
  }

  // Cursors: zip has <Name>/cursor/* → game\dota\resource\cursor (vanilla backed up once)
  installCursor(localZip, modName) {
    const game = this.getGamePath();
    if (!game) throw new Error('Путь к Dota 2 не задан');
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
    if (!records.length) throw new Error(`${modName}: в архиве не найдена папка cursor`);
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
      default: throw new Error(`Неизвестный root: ${root}`);
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
      for (const p of [abs, abs + '.off']) {
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

  // files present in lang folder but not referenced by the manifest.
  // The game's own localization files (pak01_*, gameinfo.gi) live in official
  // language folders like dota_russian — never list them as manageable mods.
  externalFiles(knownRelPaths) {
    const lang = this.langFolder();
    if (!fs.existsSync(lang)) return [];
    const known = new Set(knownRelPaths.map((p) => p.toLowerCase()));
    const out = [];
    for (const f of fs.readdirSync(lang)) {
      const full = path.join(lang, f);
      if (!fs.statSync(full).isFile()) continue;
      const base = f.toLowerCase().replace(/\.off$/, '');
      if (/^pak01_/.test(base) || base === 'gameinfo.gi') continue;
      if (!known.has(base)) {
        out.push({ name: f, size: fs.statSync(full).size, enabled: !f.toLowerCase().endsWith('.off') });
      }
    }
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

module.exports = { Installer, PRIORITY_CATEGORIES };
