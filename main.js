const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let autoUpdater = null;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch { /* dev environment without the dependency installed yet */ }

const { Settings } = require('./src/settings');
const { Catalog } = require('./src/catalog');
const { Installer } = require('./src/installer');
const { Library } = require('./src/library');
const { Fingerprints } = require('./src/fingerprints');
const { findDotaGamePath, validateGamePath } = require('./src/steam');
const i18n = require('./src/i18n');
const { t } = i18n;

let win;
let settings, catalog, installer, library, fingerprints;

function sendProgress(evt) {
  if (win && !win.isDestroyed()) win.webContents.send('progress', evt);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1020,
    minHeight: 640,
    backgroundColor: '#050506',
    autoHideMenuBar: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.on('maximize', () => win.webContents.send('win:maximized', true));
  win.on('unmaximize', () => win.webContents.send('win:maximized', false));

  // dev: MM_SHOT=<path> saves a screenshot after load (used for automated UI checks)
  if (process.env.MM_SHOT) {
    win.webContents.once('did-finish-load', () => {
      diag('did-finish-load');
      setTimeout(async () => {
        diag('capture start');
        try {
          win.show();
          win.focus();
          if (process.env.MM_VIEW) {
            await win.webContents.executeJavaScript(
              `document.querySelector('[data-view="${process.env.MM_VIEW}"]')?.click()`);
            await new Promise((r) => setTimeout(r, 2500));
          }
          if (process.env.MM_CAT) {
            await win.webContents.executeJavaScript(
              `document.querySelector('.rail-item[data-cat="${process.env.MM_CAT}"]')?.click()`);
            await new Promise((r) => setTimeout(r, 2500));
          }
          if (process.env.MM_CLICK) {
            // dev-only: click a comma-separated list of CSS selectors before capture
            for (const sel of process.env.MM_CLICK.split('||')) {
              await win.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(sel)})?.click()`);
              await new Promise((r) => setTimeout(r, 700));
            }
          }
          if (process.env.MM_MODAL) {
            await win.webContents.executeJavaScript(`
              [...document.querySelectorAll('.card .card-name')]
                .find(n => n.textContent.trim() === ${JSON.stringify(process.env.MM_MODAL)})
                ?.closest('.card')?.click()`);
            await new Promise((r) => setTimeout(r, 1500));
            if (process.env.MM_PREVIEW) {
              await win.webContents.executeJavaScript(`document.getElementById('previewPlayBtn')?.click()`);
              await new Promise((r) => setTimeout(r, 2500));
            }
          }
          await new Promise((r) => setTimeout(r, 500));
          const img = await win.webContents.capturePage();
          fs.writeFileSync(process.env.MM_SHOT, img.toPNG());
          diag('capture done ' + img.getSize().width + 'x' + img.getSize().height);
        } catch (e) {
          fs.writeFileSync(process.env.MM_SHOT + '.err.txt', String(e));
        }
      }, 7000);
    });
  }
}

const DIAG = process.env.MM_DIAG;
function diag(msg) {
  if (DIAG) { try { fs.appendFileSync(DIAG, `${new Date().toISOString()} ${msg}\n`); } catch { /* noop */ } }
}

app.whenReady().then(async () => {
  diag('whenReady');
  const userData = app.getPath('userData');
  settings = new Settings(userData);
  i18n.setLang(settings.get('uiLang'));
  catalog = new Catalog(userData);
  library = new Library(userData);
  fingerprints = new Fingerprints(userData);
  fingerprints.refresh(); // fire-and-forget: pull the latest fp -> mod map
  installer = new Installer({
    userDataDir: userData,
    getGamePath: () => settings.get('dotaGamePath'),
    getLangSuffix: () => settings.get('langSuffix'),
    onProgress: sendProgress,
  });

  // auto-detect dota on first run
  if (!validateGamePath(settings.get('dotaGamePath'))) {
    const found = await findDotaGamePath();
    if (found) settings.set('dotaGamePath', found);
  }

  // repair "!pakNN" files left by versions before 1.0.4 (the game ignored them)
  try {
    installer.migrateLegacyPriorityPaks(library);
  } catch (e) {
    diag('legacy pak migration skipped: ' + e.message);
  }

  registerIpc();
  createWindow();
  diag('createWindow done');
  setupAutoUpdate();
}).catch((e) => diag('whenReady FAIL: ' + (e.stack || e)));

// ---- auto-update via GitHub Releases (packaged builds only) ----
function setupAutoUpdate() {
  if (!autoUpdater || !app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.on('update-available', (info) => {
    if (win && !win.isDestroyed()) win.webContents.send('update', { type: 'available', version: info.version });
  });
  autoUpdater.on('update-downloaded', (info) => {
    if (win && !win.isDestroyed()) win.webContents.send('update', { type: 'downloaded', version: info.version });
  });
  autoUpdater.on('error', () => { /* offline or rate-limited — silent */ });
  autoUpdater.checkForUpdates().catch(() => {});
  // re-check every 4 hours while the app is open
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000);
}

app.on('window-all-closed', () => app.quit());

// register installer.importVpks/importVpkBuffers results into the library
function registerImportResults(results) {
  const imported = [];
  for (const r of results) {
    if (r.error) continue;
    // name the import by its content (a hero / set / kind) instead of the bare pak slot
    const dirRel = (r.files.find((f) => /_dir\.vpk$/i.test(f.relPath)) || r.files[0])?.relPath;
    const contentName = (dirRel && installer.displayNameForFile(dirRel)) || r.name;
    const rec = library.add({
      name: contentName, categoryId: 'imported', styleLabel: null,
      fileRef: r.source, preview: null, files: r.files,
    });
    // best-effort warning: does the new file overlap other enabled mods?
    let conflicts = [];
    try {
      const own = installer.installedContentPaths(rec);
      conflicts = library.list()
        .filter((o) => o.id !== rec.id && o.enabled)
        .filter((o) => {
          const other = installer.installedContentPaths(o);
          for (const p of own) if (other.has(p)) return true;
          return false;
        })
        .map((o) => o.name);
    } catch { /* ignore */ }
    imported.push({ name: rec.name, relPath: r.files[0].relPath, conflicts });
  }
  if (imported.length && installer.masterIsOff()) { try { installer.setMasterEnabled(false); } catch { /* noop */ } }
  return { imported, errors: results.filter((r) => r.error) };
}

// copy user .vpk files into the lang folder and register them in the library
function importVpkPaths(paths) {
  try { return registerImportResults(installer.importVpks(Array.isArray(paths) ? paths : [])); }
  catch (err) { return { error: String(err.message || err) }; }
}

// same, but from raw bytes — the drag-and-drop fallback when a real path can't be resolved
function importVpkBuffers(items) {
  try { return registerImportResults(installer.importVpkBuffers(Array.isArray(items) ? items : [])); }
  catch (err) { return { error: String(err.message || err) }; }
}

// after any deploy, if the master switch is off, sweep freshly written files off too
function afterDeployMaster() {
  try { if (installer.masterIsOff()) installer.setMasterEnabled(false); } catch { /* noop */ }
}

// rebuild a pack's deployed VPK, persist its files, and re-apply pack + master off-state
function deployAndApply(pack) {
  const { files, conflicts } = installer.deployPack(pack);
  library.update(pack.id, { files, members: pack.members });
  if (pack.enabled === false && files.length) { try { installer.setEnabled(files, false); } catch { /* noop */ } }
  afterDeployMaster();
  return conflicts;
}

// a library record that can go into a combined pack: a lang-folder skin/import with a
// _dir.vpk (not a pack itself, not a loose font/cursor set, not a terrain maps file)
function packableRecord(rec) {
  return rec && rec.kind !== 'pack'
    && rec.categoryId !== 'fonts' && rec.categoryId !== 'cursors'
    && (rec.files || []).some((f) => f.root === 'lang' && /_dir\.vpk$/i.test(f.relPath));
}

function registerIpc() {
  // ----- window controls -----
  ipcMain.handle('win:minimize', () => win.minimize());
  ipcMain.handle('win:maximize', () => {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return win.isMaximized();
  });
  ipcMain.handle('win:close', () => win.close());
  ipcMain.handle('win:isMaximized', () => win.isMaximized());

  // ----- updates -----
  ipcMain.handle('update:install', () => {
    if (autoUpdater) autoUpdater.quitAndInstall();
  });
  ipcMain.handle('app:version', () => app.getVersion());

  // ----- settings -----
  ipcMain.handle('settings:get', () => {
    const game = settings.get('dotaGamePath');
    let minifyDetected = false;
    try { minifyDetected = !!game && fs.existsSync(path.join(game, 'dota_minify')); } catch { /* ignore */ }
    return {
      ...settings.all(),
      dotaPathValid: validateGamePath(game),
      minifyDetected,
    };
  });

  ipcMain.handle('settings:set', (e, key, value) => {
    // keep main-process strings (dialogs, errors) in sync with the UI language
    if (key === 'uiLang') i18n.setLang(value);
    // when the language folder changes, move installed mod files over
    if (key === 'langSuffix' && value !== settings.get('langSuffix')) {
      const game = settings.get('dotaGamePath');
      if (game) {
        const oldDir = path.join(game, `dota_${settings.get('langSuffix')}`);
        const newDir = path.join(game, `dota_${value}`);
        try {
          if (fs.existsSync(oldDir)) {
            fs.mkdirSync(newDir, { recursive: true });
            for (const f of fs.readdirSync(oldDir)) {
              // never move the game's own localization files (official lang folders)
              if (/^pak01_/i.test(f) || f.toLowerCase() === 'gameinfo.gi') continue;
              const src = path.join(oldDir, f);
              const dst = path.join(newDir, f);
              if (!fs.existsSync(dst)) fs.renameSync(src, dst);
            }
            // remove old folder if now empty
            if (!fs.readdirSync(oldDir).length) fs.rmdirSync(oldDir);
          }
        } catch (err) {
          console.error('lang folder migration failed:', err);
        }
      }
    }
    settings.set(key, value);
    return settings.all();
  });

  ipcMain.handle('settings:detectDota', async () => {
    const found = await findDotaGamePath();
    if (found) settings.set('dotaGamePath', found);
    return found;
  });

  ipcMain.handle('settings:browseDota', async () => {
    const res = await dialog.showOpenDialog(win, {
      title: t('Выбери папку game внутри dota 2 beta'),
      properties: ['openDirectory'],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    let p = res.filePaths[0];
    // allow picking "dota 2 beta" root as well
    if (!validateGamePath(p) && validateGamePath(path.join(p, 'game'))) p = path.join(p, 'game');
    if (!validateGamePath(p)) return { error: t('В этой папке не найдена Dota 2 (нет подпапки dota)') };
    settings.set('dotaGamePath', p);
    return { path: p };
  });

  // ----- catalog -----
  ipcMain.handle('catalog:load', async (e, force) => {
    try {
      return await catalog.load({ forceRefresh: !!force });
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  // ----- install/manage -----
  ipcMain.handle('mods:install', async (e, payload) => {
    // payload: { categoryId, name, styleLabel, fileRef, preview }
    try {
      const existing = library.findByKey(payload.categoryId, payload.name, payload.styleLabel);
      if (existing) return { error: t('Уже установлено'), already: true };
      const files = await installer.install({
        categoryId: payload.categoryId,
        modName: payload.name,
        fileRef: payload.fileRef,
      });
      const rec = library.add({ ...payload, files });
      // installed while the master switch is off? sweep the fresh file off too, so the
      // library state stays consistent (all mods off) until the user turns them back on.
      if (installer.masterIsOff()) { try { installer.setMasterEnabled(false); } catch { /* noop */ } }
      sendProgress({ type: 'done', label: payload.name });
      return { ok: true, record: rec };
    } catch (err) {
      sendProgress({ type: 'error', label: payload.name, message: String(err.message || err) });
      return { error: String(err.message || err) };
    }
  });

  ipcMain.handle('mods:checkConflicts', async (e, payload) => {
    // payload: { categoryId, name, fileRef }
    try {
      const conflicts = await installer.findConflicts(
        { categoryId: payload.categoryId, fileRef: payload.fileRef, modName: payload.name },
        library.list()
      );
      return { conflicts };
    } catch (err) {
      // conflict check is best-effort — never block installation on its errors
      return { conflicts: [], error: String(err.message || err) };
    }
  });

  ipcMain.handle('mods:exportSingle', async (e, id) => {
    const rec = library.find(id);
    if (!rec) return { error: t('Мод не найден') };
    try {
      const buf = installer.mergeToSingleVpk(rec);
      const safe = rec.name.replace(/[<>:"/\\|?*]/g, '_') || 'mod';
      const res = await dialog.showSaveDialog(win, {
        title: t('Сохранить мод одним .vpk файлом'),
        defaultPath: `${safe}.vpk`,
        filters: [{ name: t('VPK мод'), extensions: ['vpk'] }],
      });
      if (res.canceled || !res.filePath) return { cancelled: true };
      fs.writeFileSync(res.filePath, buf);
      return { ok: true, path: res.filePath, size: buf.length };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  ipcMain.handle('mods:importDialog', async () => {
    const res = await dialog.showOpenDialog(win, {
      title: t('Выбери .vpk файлы модов'),
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: t('VPK моды'), extensions: ['vpk'] }],
    });
    if (res.canceled || !res.filePaths.length) return { cancelled: true };
    return importVpkPaths(res.filePaths);
  });

  ipcMain.handle('mods:importPaths', (e, paths) => importVpkPaths(Array.isArray(paths) ? paths : []));
  ipcMain.handle('mods:importBuffers', (e, items) => importVpkBuffers(items));

  ipcMain.handle('mods:list', () => {
    // folder sync: a mod deleted straight from the game folder drops out of the library
    try {
      for (const rec of [...library.list()]) {
        if (rec.kind === 'pack') {
          if ((rec.files || []).length && !installer.langPrimaryPresent(rec)) {
            installer.removePackFully(rec);
            library.removeRecord(rec.id);
          }
        } else if (!installer.langPrimaryPresent(rec)) {
          library.removeRecord(rec.id);
        }
      }
    } catch { /* no game path yet — nothing to sync */ }

    let external = [];
    try {
      const known = library.knownFiles();
      const canMatch = fingerprints.hasData();
      external = installer.externalFiles(known, { scanExtras: canMatch });
      for (const f of external) if (f.fp) f.match = fingerprints.match(f.fp); // recognise catalog mods
      // lang-root files are always worth listing; maps/cursor only when recognised
      external = external.filter((f) => f.primary || f.match);
      // fonts share panorama\fonts with vanilla — subset-match instead of a folder fp
      if (canMatch && fingerprints.fonts.length && !known.some((f) => f.root === 'fonts')) {
        const fh = installer.fontFolderHashes();
        for (const m of (fh ? fingerprints.matchFonts(fh) : [])) {
          external.push({
            kind: 'font', key: `__font__${m.name}`, name: m.name, primary: false,
            size: 0, enabled: true, files: Object.keys(m.files).map((bn) => ({ root: 'fonts', relPath: bn })),
            match: [{ name: m.name, categoryId: m.categoryId, styleLabel: m.styleLabel || null }],
          });
        }
      }
    } catch { /* lang folder may not exist yet */ }
    // imported mods have no catalog identity — tag them by content, match to catalog if known
    const installed = library.list().map((rec) => {
      if (rec.categoryId !== 'imported') return rec;
      try {
        const a = installer.analyzeRecord(rec) || {};
        const matches = a.fp ? fingerprints.match(a.fp) : null;
        // one-time: give bare "pakNN" imports a real name — the catalog name if the file
        // is recognised, otherwise the content (hero / set / kind)
        if (/^!?pak\d+$/i.test(rec.name)) {
          const dir = rec.files.find((f) => f.root === 'lang' && /_dir\.vpk$/i.test(f.relPath));
          const nm = (matches && matches[0] && matches[0].name) || (dir && installer.displayNameForFile(dir.relPath));
          if (nm && nm !== rec.name) { library.update(rec.id, { name: nm }); rec.name = nm; }
        }
        return { ...rec, ...a, match: matches };
      } catch { return rec; }
    });
    let slots = 0;
    try { slots = installer.usedModSlots(); } catch { /* no game path */ }
    return { installed, external, slots, slotCeil: 98 };
  });

  // ----- launch + master mods switch -----

  // Launch Dota via Steam so the user's own launch options apply (-novid, -fps max,
  // -language russian … differ per user). rungameid mirrors clicking Play in Steam.
  ipcMain.handle('game:launch', () => {
    shell.openExternal('steam://rungameid/570');
    return { ok: true };
  });

  ipcMain.handle('mods:masterState', () => {
    try { return { off: installer.masterIsOff() }; } catch { return { off: false }; }
  });

  ipcMain.handle('mods:setMaster', (e, enabled) => {
    try {
      const r = installer.setMasterEnabled(!!enabled);
      return { ok: true, ...r };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  ipcMain.handle('mods:setEnabled', (e, id, enabled) => {
    const rec = library.find(id);
    if (!rec) return { error: t('Мод не найден') };
    try {
      installer.setEnabled(rec.files, enabled);
      library.setEnabled(id, enabled);
      return { ok: true };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  ipcMain.handle('mods:remove', (e, id) => {
    const rec = library.find(id);
    if (!rec) return { error: t('Мод не найден') };
    try {
      if (rec.kind === 'pack') installer.removePackFully(rec);
      else installer.remove(rec.files);
      library.removeRecord(id);
      return { ok: true };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  ipcMain.handle('mods:externalSetEnabled', (e, fileName, enabled) => {
    try {
      const lang = installer.langFolder();
      const abs = path.join(lang, fileName);
      const base = fileName.replace(/\.off$/i, '');
      const on = path.join(lang, base);
      const off = on + '.off';
      if (enabled && fs.existsSync(off)) fs.renameSync(off, on);
      if (!enabled && fs.existsSync(on)) fs.renameSync(on, off);
      return { ok: true };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  ipcMain.handle('mods:externalRemove', (e, fileName) => {
    try {
      const abs = path.join(installer.langFolder(), fileName);
      if (fs.existsSync(abs)) fs.rmSync(abs, { force: true });
      return { ok: true };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  // split a merged multi-hero library record into one managed mod per hero
  ipcMain.handle('mods:splitMod', (e, id) => {
    const rec = library.find(id);
    if (!rec) return { error: t('Мод не найден') };
    try {
      const dir = rec.files.find((f) => f.root === 'lang' && /_dir\.vpk$/i.test(f.relPath));
      if (!dir) return { error: t('Нет _dir.vpk для разбора') };
      const parts = installer.splitVpkFile(dir.relPath);
      if (!parts.length) return { error: t('В файле меньше двух героев — разбирать нечего') };
      for (const p of parts) {
        library.add({ name: p.name, categoryId: 'imported', styleLabel: null, fileRef: rec.name, preview: null, files: p.files });
      }
      installer.remove(rec.files);
      library.removeRecord(id);
      return { ok: true, count: parts.length, names: parts.map((p) => p.name) };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  // adopt an imported record whose content matches a catalog mod: relabel it to that
  // catalog identity so it's managed like a natively installed mod (no re-download)
  ipcMain.handle('mods:adoptMod', (e, id, preview) => {
    const rec = library.find(id);
    if (!rec) return { error: t('Мод не найден') };
    const a = installer.analyzeRecord(rec);
    const matches = a && fingerprints.match(a.fp);
    if (!matches) return { error: t('Совпадение с каталогом не найдено') };
    const m = matches[0]; // identical-content entries are interchangeable; take the first
    const fields = { name: m.name, categoryId: m.categoryId, styleLabel: m.styleLabel || null };
    if (preview) fields.preview = preview; // catalog thumbnail resolved by the renderer
    library.update(id, fields);
    return { ok: true, name: m.name };
  });

  // adopt a foreign file in the game folder as its matching catalog mod: register it
  // (and any multi-part data archives) in the library under the catalog identity
  ipcMain.handle('mods:adoptExternal', (e, fileName, preview) => {
    try {
      const lang = installer.langFolder();
      const base = fileName.replace(/\.off$/i, '');
      const buf = fs.readFileSync(path.join(lang, base));
      const { fingerprintVpk } = require('./src/vpk');
      const matches = fingerprints.match(fingerprintVpk(buf));
      if (!matches) return { error: t('Совпадение с каталогом не найдено') };
      const m = matches[0]; // identical-content entries are interchangeable; take the first
      // include the _dir.vpk and any sibling data archives (<base>_NNN.vpk)
      const origBase = base.replace(/_dir\.vpk$/i, '');
      const partRe = new RegExp(`^${origBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_\\d{3}\\.vpk$`, 'i');
      const files = [{ root: 'lang', relPath: base }];
      for (const f of fs.readdirSync(lang)) if (partRe.test(f)) files.push({ root: 'lang', relPath: f });
      library.add({ name: m.name, categoryId: m.categoryId, styleLabel: m.styleLabel || null, fileRef: fileName, preview: preview || null, files });
      return { ok: true, name: m.name };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  // adopt a foreign font mod (its files present in panorama\fonts) as a catalog mod
  ipcMain.handle('mods:adoptFont', (e, name, preview) => {
    try {
      const fh = installer.fontFolderHashes();
      const m = fh && fingerprints.matchFonts(fh).find((x) => x.name === name);
      if (!m) return { error: t('Совпадение с каталогом не найдено') };
      library.add({ name: m.name, categoryId: m.categoryId, styleLabel: m.styleLabel || null, fileRef: m.name, preview: preview || null, files: Object.keys(m.files).map((bn) => ({ root: 'fonts', relPath: bn })) });
      return { ok: true, name: m.name };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  // adopt a foreign cursor set (resource\cursor) recognised as a catalog mod
  ipcMain.handle('mods:adoptCursor', (e, preview) => {
    try {
      const cursorDir = path.join(installer.getGamePath(), 'dota', 'resource', 'cursor');
      if (!fs.existsSync(cursorDir)) return { error: t('Папка курсора не найдена') };
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
      walk(cursorDir, '');
      const { fingerprintFiles } = require('./src/vpk');
      const matches = fingerprints.match(fingerprintFiles(files));
      if (!matches) return { error: t('Совпадение с каталогом не найдено') };
      const m = matches[0];
      library.add({ name: m.name, categoryId: m.categoryId, styleLabel: m.styleLabel || null, fileRef: m.name, preview: preview || null, files: rels.map((rp) => ({ root: 'cursor', relPath: rp })) });
      return { ok: true, name: m.name };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  // split a merged multi-hero external file (placed in the game folder by another tool)
  ipcMain.handle('mods:splitExternal', (e, fileName) => {
    try {
      const lang = installer.langFolder();
      const base = fileName.replace(/\.off$/i, '');
      const parts = installer.splitVpkFile(base);
      if (!parts.length) return { error: t('В файле меньше двух героев — разбирать нечего') };
      for (const p of parts) {
        library.add({ name: p.name, categoryId: 'imported', styleLabel: null, fileRef: fileName, preview: null, files: p.files });
      }
      // delete the source _dir.vpk (and any multi-part data archives + .off variant)
      const origBase = base.replace(/_dir\.vpk$/i, '');
      for (const f of fs.readdirSync(lang)) {
        const n = f.toLowerCase().replace(/\.off$/i, '');
        if (n === base.toLowerCase() || new RegExp(`^${origBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_\\d{3}\\.vpk$`, 'i').test(n)) {
          fs.rmSync(path.join(lang, f), { force: true });
        }
      }
      return { ok: true, count: parts.length, names: parts.map((p) => p.name) };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  // ----- combined packs -----

  // Combine any mix of standalone mods and existing packs into one pack. Packs are
  // absorbed by moving their stored member VPKs into the target pack, so two packs (or a
  // pack + mods) are effectively taken apart and rebuilt together into a single slot.
  ipcMain.handle('packs:combine', (e, payload) => {
    try {
      const recs = (payload.modIds || []).map((id) => library.find(id)).filter(Boolean);
      const packs = recs.filter((r) => r.kind === 'pack');
      const mods = recs.filter((r) => packableRecord(r));
      const totalMembers = packs.reduce((n, p) => n + (p.members ? p.members.length : 0), 0) + mods.length;
      if (totalMembers < 2) return { error: t('Выбери минимум 2 мода (или пак и мод / два пака)') };

      // reuse the first selected pack as the target (absorb the rest into it), else new
      let target = packs[0];
      const otherPacks = packs.slice(1);
      if (!target) {
        target = library.add({
          name: (payload.name && payload.name.trim()) || t('Пак ({0})', totalMembers),
          categoryId: 'combined', styleLabel: null, fileRef: null, preview: null, files: [], kind: 'pack', members: [],
        });
      } else if (payload.name && payload.name.trim()) {
        target.name = payload.name.trim();
      }
      fs.mkdirSync(installer.packFolder(target.id), { recursive: true });

      // standalone mods -> new members (their own deployment is removed)
      for (const r of mods) {
        target.members.push(installer.addPackMemberFromRecord(target.id, r, crypto.randomUUID()));
        try { installer.remove(r.files); } catch { /* noop */ }
        library.removeRecord(r.id);
      }
      // other packs -> move each stored member VPK into the target, then delete the pack
      for (const p of otherPacks) {
        for (const m of p.members || []) {
          const src = installer.packMemberFile(p.id, m.id);
          if (!fs.existsSync(src)) continue;
          const newId = crypto.randomUUID();
          fs.renameSync(src, installer.packMemberFile(target.id, newId));
          target.members.push({ ...m, id: newId });
        }
        installer.removePackFully(p);
        library.removeRecord(p.id);
      }
      const conflicts = deployAndApply(target);
      return { ok: true, pack: library.find(target.id), conflicts };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  // Add more library mods into an existing pack.
  ipcMain.handle('packs:addMembers', (e, packId, modIds) => {
    const pack = library.find(packId);
    if (!pack || pack.kind !== 'pack') return { error: t('Пак не найден') };
    try {
      const recs = (modIds || []).map((id) => library.find(id)).filter(packableRecord);
      if (!recs.length) return { error: t('Нет совместимых модов для добавления') };
      for (const r of recs) {
        pack.members.push(installer.addPackMemberFromRecord(pack.id, r, crypto.randomUUID()));
        try { installer.remove(r.files); } catch { /* noop */ }
        library.removeRecord(r.id);
      }
      const conflicts = deployAndApply(pack);
      return { ok: true, pack: library.find(pack.id), added: recs.length, conflicts };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  // Enable/disable one member inside a pack (rebuilds the merged VPK from enabled members).
  ipcMain.handle('packs:setMemberEnabled', (e, packId, memberId, enabled) => {
    const pack = library.find(packId);
    if (!pack || pack.kind !== 'pack') return { error: t('Пак не найден') };
    const m = (pack.members || []).find((x) => x.id === memberId);
    if (!m) return { error: t('Мод в паке не найден') };
    try {
      m.enabled = !!enabled;
      const conflicts = deployAndApply(pack);
      return { ok: true, conflicts };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  // Remove one member from a pack. If it was the last one, the pack itself is removed.
  ipcMain.handle('packs:removeMember', (e, packId, memberId) => {
    const pack = library.find(packId);
    if (!pack || pack.kind !== 'pack') return { error: t('Пак не найден') };
    const idx = (pack.members || []).findIndex((x) => x.id === memberId);
    if (idx < 0) return { error: t('Мод в паке не найден') };
    try {
      try { fs.rmSync(installer.packMemberFile(pack.id, pack.members[idx].id), { force: true }); } catch { /* noop */ }
      pack.members.splice(idx, 1);
      if (!pack.members.length) {
        installer.removePackFully(pack);
        library.removeRecord(pack.id);
        return { ok: true, removedPack: true };
      }
      deployAndApply(pack);
      return { ok: true };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  // Extract selected members out of a pack back into standalone deployed mods, keeping the
  // rest of the pack intact (removes the pack entirely if nothing is left).
  ipcMain.handle('packs:extractMembers', (e, packId, memberIds) => {
    const pack = library.find(packId);
    if (!pack || pack.kind !== 'pack') return { error: t('Пак не найден') };
    try {
      const ids = new Set(memberIds || []);
      const names = [];
      for (const m of (pack.members || []).filter((x) => ids.has(x.id))) {
        const { files } = installer.deployMemberAsMod(pack, m);
        const rec = library.add({ name: m.name, categoryId: m.categoryId || 'imported', styleLabel: m.styleLabel || null, fileRef: pack.name, preview: m.preview || null, files });
        if (m.enabled === false) { try { installer.setEnabled(files, false); } catch { /* noop */ } library.setEnabled(rec.id, false); }
        try { fs.rmSync(installer.packMemberFile(pack.id, m.id), { force: true }); } catch { /* noop */ }
        names.push(m.name);
      }
      pack.members = (pack.members || []).filter((x) => !ids.has(x.id));
      if (!pack.members.length) {
        installer.removePackFully(pack);
        library.removeRecord(pack.id);
        afterDeployMaster();
        return { ok: true, count: names.length, names, removedPack: true };
      }
      deployAndApply(pack);
      return { ok: true, count: names.length, names };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  // Disband a pack back into standalone mods (one deployed pak per member).
  ipcMain.handle('packs:disband', (e, packId) => {
    const pack = library.find(packId);
    if (!pack || pack.kind !== 'pack') return { error: t('Пак не найден') };
    try {
      const names = [];
      for (const m of pack.members || []) {
        const { files } = installer.deployMemberAsMod(pack, m);
        const rec = library.add({ name: m.name, categoryId: m.categoryId || 'imported', styleLabel: m.styleLabel || null, fileRef: pack.name, preview: m.preview || null, files });
        if (m.enabled === false) { try { installer.setEnabled(files, false); } catch { /* noop */ } library.setEnabled(rec.id, false); }
        names.push(m.name);
      }
      installer.removePackFully(pack);
      library.removeRecord(pack.id);
      afterDeployMaster();
      return { ok: true, count: names.length, names };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  // ----- presets -----
  ipcMain.handle('presets:list', () => library.listPresets());
  ipcMain.handle('presets:save', (e, name) => {
    library.savePreset(name);
    return library.listPresets();
  });
  ipcMain.handle('presets:delete', (e, id) => {
    library.deletePreset(id);
    return library.listPresets();
  });
  ipcMain.handle('presets:apply', (e, id) => {
    const preset = library.getPreset(id);
    if (!preset) return { error: t('Пресет не найден') };
    const wanted = new Set(preset.modIds);
    const errors = [];
    for (const rec of library.list()) {
      const shouldEnable = wanted.has(rec.id);
      if (rec.enabled !== shouldEnable) {
        try {
          installer.setEnabled(rec.files, shouldEnable);
          library.setEnabled(rec.id, shouldEnable);
        } catch (err) {
          errors.push(`${rec.name}: ${err.message}`);
        }
      }
    }
    return errors.length ? { error: errors.join('\n') } : { ok: true };
  });

  // ----- misc -----
  ipcMain.handle('misc:openLangFolder', () => {
    try {
      const lang = installer.langFolder();
      fs.mkdirSync(lang, { recursive: true });
      shell.openPath(lang);
      return { ok: true };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  ipcMain.handle('misc:openToolsFolder', (e, sub) => {
    const p = sub ? path.join(installer.toolsDir, sub) : installer.toolsDir;
    shell.openPath(p);
    return { ok: true };
  });

  ipcMain.handle('misc:openExternal', (e, url) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { ok: true };
  });

  ipcMain.handle('misc:cacheSize', () => installer.downloadCacheSize());
  ipcMain.handle('misc:clearCache', () => {
    installer.clearDownloadCache();
    return { ok: true };
  });

  ipcMain.handle('misc:runTool', (e, toolDirName) => {
    // find first exe inside the tool folder and launch it
    try {
      const dir = path.join(installer.toolsDir, toolDirName);
      const findExe = (d) => {
        for (const f of fs.readdirSync(d)) {
          const full = path.join(d, f);
          if (fs.statSync(full).isDirectory()) {
            const r = findExe(full);
            if (r) return r;
          } else if (f.toLowerCase().endsWith('.exe')) {
            return full;
          }
        }
        return null;
      };
      const exe = findExe(dir);
      if (!exe) return { error: t('exe не найден в папке инструмента') };
      shell.openPath(exe);
      return { ok: true };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });
}
