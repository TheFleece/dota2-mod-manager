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
const { Installer, conflictingPaths } = require('./src/installer');
const { Library } = require('./src/library');
const { Fingerprints } = require('./src/fingerprints');
const { writePresetFile, readPresetFile } = require('./src/preset-share');
const { SCHEME, encodePresetLink, decodePresetLink } = require('./src/preset-link');
const discordAuth = require('./src/discord-auth');
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

  // fold imports that predate single-file merging (pakNN_dir.vpk + pakNN_000.vpk)
  try {
    installer.mergeMultiPartRecords(library);
  } catch (e) {
    diag('multi-part merge skipped: ' + e.message);
  }

  registerIpc();
  // only the installed build claims the scheme — a dev run must not point the system's
  // d2mm:// handler at a local electron binary
  if (app.isPackaged) app.setAsDefaultProtocolClient(SCHEME);
  createWindow();
  diag('createWindow done');
  // launched BY a link (cold start): the renderer has to exist before it can be told
  const cold = firstLink(process.argv);
  if (cold) win.webContents.once('did-finish-load', () => handleDeepLink(cold));
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

// ---------- d2mm:// links ----------

// A preset link clicked anywhere on the system lands here. Nothing installs: it parks in
// the Presets tab exactly like a dropped file, and the user decides.
function handleDeepLink(url) {
  if (!url || !url.startsWith(`${SCHEME}://`)) return;
  const res = importPresetLink(url.replace(new RegExp(`^${SCHEME}://preset/`), ''));
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
    win.webContents.send('preset-link', res);
  }
}

const firstLink = (argv) => (argv || []).find((a) => typeof a === 'string' && a.startsWith(`${SCHEME}://`));

// One running copy only — two instances writing manifest.json would race each other, and
// a link clicked while the app is open must reach the window that already exists.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (e, argv) => {
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
    handleDeepLink(firstLink(argv));
  });
  app.on('open-url', (e, url) => { e.preventDefault(); handleDeepLink(url); }); // macOS
}

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
        // real clash only when the two mods provide the same path with different content
        .filter((o) => conflictingPaths(own, installer.installedContentPaths(o)).length > 0)
        .map((o) => o.name);
    } catch { /* ignore */ }
    imported.push({ name: rec.name, relPath: r.files[0].relPath, merged: r.merged || 0, conflicts });
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

// ---------- shared presets (.d2mm) ----------

// where an imported .d2mm waits until the user installs it
function sharedPresetFile(presetId) {
  return path.join(app.getPath('userData'), 'shared-presets', `${presetId}.d2mm`);
}

function dropSharedPresetFile(preset) {
  const f = preset && preset.source && preset.source.file;
  if (f) { try { fs.rmSync(f, { force: true }); } catch { /* noop */ } }
}

// "<categoryId>|<name>|<styleLabel>" -> what mods:install needs to fetch it
async function catalogIndex() {
  const map = new Map();
  const key = (c, n, s) => `${c}|${n}|${s || ''}`;
  let data;
  try { data = await catalog.load(); } catch { return map; } // offline with no cache
  for (const [categoryId, list] of Object.entries((data.mods && data.mods.modsData) || {})) {
    if (!Array.isArray(list)) continue;
    for (const m of list) {
      if (Array.isArray(m.styles)) {
        for (const s of m.styles) {
          map.set(key(categoryId, m.name, s.label), { categoryId, name: m.name, styleLabel: s.label, fileRef: s.file, preview: s.preview });
        }
      } else {
        map.set(key(categoryId, m.name, null), { categoryId, name: m.name, styleLabel: null, fileRef: m.file, preview: m.preview });
      }
    }
  }
  map.lookup = (c, n, s) => map.get(key(c, n, s)) || null;
  return map;
}

// How one library record travels: as a catalog identity when the catalog can hand it to
// the receiver, otherwise as its own bytes. `loadData` is deferred so building the plan
// (which only needs sizes) doesn't merge tens of MB per mod.
function shareEntryFor(rec, cat) {
  const hit = rec.categoryId !== 'imported' && cat.lookup(rec.categoryId, rec.name, rec.styleLabel);
  if (hit) {
    return {
      kind: 'catalog', categoryId: rec.categoryId, name: rec.name,
      styleLabel: rec.styleLabel || null, fp: (installer.analyzeRecord(rec) || {}).fp || null, size: 0,
    };
  }
  const hasVpk = (rec.files || []).some((f) => f.root === 'lang' && /_dir\.vpk$/i.test(f.relPath));
  if (!hasVpk) {
    return { kind: 'missing', name: rec.name, reason: t('нет в каталоге и нечего вложить') };
  }
  let size = 0;
  try {
    const lang = installer.langFolder();
    for (const f of (rec.files || []).filter((x) => x.root === 'lang')) {
      const p = ['', '.off', '.moff'].map((s) => path.join(lang, f.relPath) + s).find((x) => fs.existsSync(x));
      if (p) size += fs.statSync(p).size;
    }
  } catch { /* size stays an estimate of 0 */ }
  const a = installer.analyzeRecord(rec) || {};
  return {
    kind: 'embedded', name: rec.name, categoryId: rec.categoryId, info: a.info || '', fp: a.fp || null,
    size, loadData: () => installer.mergeToSingleVpk(rec),
  };
}

// A pack travels as its members: each one keeps its own identity, and the receiver's app
// rebuilds the pack from them. Member VPKs are already sitting flattened in packsDir.
function packShareEntry(rec, cat) {
  const members = (rec.members || []).map((m) => {
    const hit = m.categoryId !== 'imported' && cat.lookup(m.categoryId, m.name, m.styleLabel);
    if (hit) {
      return { kind: 'catalog', categoryId: m.categoryId, name: m.name, styleLabel: m.styleLabel || null, fp: m.fp || null, size: 0 };
    }
    const src = installer.packMemberFile(rec.id, m.id);
    if (!fs.existsSync(src)) return { kind: 'missing', name: m.name, reason: t('файл участника пака не найден') };
    return {
      kind: 'embedded', name: m.name, categoryId: m.categoryId, info: m.info || '', fp: m.fp || null,
      size: fs.statSync(src).size, loadData: () => fs.readFileSync(src),
    };
  });
  return { kind: 'pack', name: rec.name, members };
}

// Every mod of a preset, described the way it would be shared.
async function presetShareEntries(preset) {
  const cat = await catalogIndex();
  const out = [];
  for (const id of preset.modIds || []) {
    const rec = library.find(id);
    if (!rec) continue;
    out.push(rec.kind === 'pack' ? packShareEntry(rec, cat) : shareEntryFor(rec, cat));
  }
  return out;
}

// strips the deferred loaders so the plan can cross the IPC boundary; `key` is what the
// renderer sends back to leave an oversized mod out of the file
function planShape(entries) {
  const plain = (e, key) => ({ key, kind: e.kind, name: e.name, size: e.size || 0, info: e.info || '', reason: e.reason || '' });
  return entries.map((e, i) => (e.kind === 'pack'
    ? { ...plain(e, String(i)), members: e.members.map((m, j) => plain(m, `${i}.${j}`)) }
    : plain(e, String(i))));
}

// fingerprint -> installed record id, so a shared mod already on disk isn't written twice
function installedFpIndex() {
  const map = new Map();
  for (const rec of library.list()) {
    if (rec.kind === 'pack') continue;
    const a = installer.analyzeRecord(rec);
    if (a && a.fp) map.set(a.fp, rec.id);
  }
  return map;
}

// The mods of a preset flattened for a link, or null if even one of them can't be named —
// a link carries identities only, so a single import makes the whole preset file-only.
// A pack flattens to its members: packing is a local storage choice, not part of the build.
function presetLinkMods(preset, cat) {
  const out = [];
  for (const id of preset.modIds || []) {
    const rec = library.find(id);
    if (!rec) continue;
    for (const it of (rec.kind === 'pack' ? rec.members || [] : [rec])) {
      if (it.categoryId === 'imported' || !cat.lookup(it.categoryId, it.name, it.styleLabel)) return null;
      out.push({ categoryId: it.categoryId, name: it.name, styleLabel: it.styleLabel || null });
    }
  }
  return out.length ? out : null;
}

// What installing a received preset would actually do, for the card in the Presets tab.
async function sharedPresetStatus(preset, cat) {
  const fpIndex = installedFpIndex();
  const out = { installed: 0, download: 0, embedded: 0, unavailable: [] };
  const visit = (e) => {
    if (e.kind === 'catalog') {
      if (library.findByKey(e.categoryId, e.name, e.styleLabel)) out.installed++;
      else if (cat.lookup(e.categoryId, e.name, e.styleLabel)) out.download++;
      else out.unavailable.push(e.name);
    } else if (e.kind === 'embedded') {
      if (e.fp && fpIndex.has(e.fp)) out.installed++;
      else out.embedded++;
    } else {
      out.unavailable.push(e.name);
    }
  };
  for (const e of preset.wanted || []) {
    if (e.kind === 'pack') e.members.forEach(visit);
    else visit(e);
  }
  return out;
}

// Build a fresh pack out of standalone records (the subset of packs:combine a received
// preset needs — it never absorbs packs the user already has).
function packFromRecords(name, recIds) {
  const recs = recIds.map((id) => library.find(id)).filter(packableRecord);
  if (recs.length < 2) return null; // nothing to save by packing — leave them standalone
  const target = library.add({
    name, categoryId: 'combined', styleLabel: null, fileRef: null, preview: null,
    files: [], kind: 'pack', members: [],
  });
  fs.mkdirSync(installer.packFolder(target.id), { recursive: true });
  for (const r of recs) {
    target.members.push(installer.addPackMemberFromRecord(target.id, r, crypto.randomUUID()));
    try { installer.remove(r.files); } catch { /* noop */ }
    library.removeRecord(r.id);
  }
  deployAndApply(target);
  return target;
}

// Validate a received .d2mm and park it in the Presets tab as a not-yet-installed preset.
// Nothing is written into the game folder here — the user sees the contents first.
function importPresetFile(filePath) {
  try {
    const { manifest } = readPresetFile(filePath);
    if (!manifest.mods.length) return { error: t('В пресете нет модов') };
    const preset = library.addSharedPreset({
      name: manifest.name, note: manifest.note, author: manifest.author, wanted: manifest.mods,
    });
    // the archive has to survive until "Install": its embedded VPKs live nowhere else
    const embeds = (e) => e.kind === 'embedded' || (e.kind === 'pack' && e.members.some((m) => m.kind === 'embedded'));
    if (manifest.mods.some(embeds)) {
      const dest = sharedPresetFile(preset.id);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(filePath, dest);
      preset.source.file = dest;
      library.save();
    }
    return { ok: true, preset };
  } catch (err) {
    return { error: String(err.message || err) };
  }
}

// A pasted d2mm://preset/... link. Same landing as a file: it parks in the Presets tab as
// a wish list and installs nothing until asked. No stash — a link has no payload to keep.
function importPresetLink(text) {
  try {
    const decoded = decodePresetLink(text);
    if (!decoded.mods.length) return { error: t('В пресете нет модов') };
    const preset = library.addSharedPreset({
      name: decoded.name, note: '', author: decoded.author, wanted: decoded.mods,
    });
    return { ok: true, preset };
  } catch (err) {
    return { error: String(err.message || err) };
  }
}

// enable exactly the preset's mods, disable everything else
function applyPreset(preset) {
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
  return errors;
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
      discordConfigured: discordAuth.isConfigured(),
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

  // ----- account (Discord) -----
  ipcMain.handle('account:signIn', async () => {
    try {
      const account = await discordAuth.signIn();
      settings.set('account', account);
      if (win && !win.isDestroyed()) { win.show(); win.focus(); }
      return { ok: true, account };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  ipcMain.handle('account:signOut', () => {
    settings.set('account', null);
    return { ok: true };
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
      title: t('Выбери .vpk файлы модов или .zip с ними'),
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: t('Моды (.vpk, .zip)'), extensions: ['vpk', 'zip'] }],
    });
    if (res.canceled || !res.filePaths.length) return { cancelled: true };
    return importVpkPaths(res.filePaths);
  });

  // folder picker — Windows can't offer files and folders in one dialog, so a pack that
  // unzipped to a whole game tree (Skinchanger) gets its own entry point
  ipcMain.handle('mods:importFolderDialog', async () => {
    const res = await dialog.showOpenDialog(win, {
      title: t('Выбери папку с модами'),
      properties: ['openDirectory'],
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
    // mods that overwrite each other's files — surfaced as a warning in the library
    let conflicts = [];
    try { conflicts = installer.libraryConflicts(installed); } catch { /* best-effort */ }
    return { installed, external, slots, slotCeil: 98, conflicts };
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
  ipcMain.handle('presets:list', async () => {
    const cat = await catalogIndex();
    return Promise.all(library.listPresets().map(async (p) => (p.wanted
      // a received preset shows what installing it would cost before anything downloads
      ? { ...p, status: await sharedPresetStatus(p, cat).catch(() => null) }
      // and an own preset only offers a link when every mod in it can be named
      : { ...p, shareable: !!presetLinkMods(p, cat) })));
  });
  ipcMain.handle('presets:save', (e, name) => {
    library.savePreset(name);
    return library.listPresets();
  });
  ipcMain.handle('presets:delete', (e, id) => {
    dropSharedPresetFile(library.getPreset(id));
    library.deletePreset(id);
    return library.listPresets();
  });
  ipcMain.handle('presets:apply', (e, id) => {
    const preset = library.getPreset(id);
    if (!preset) return { error: t('Пресет не найден') };
    const errors = applyPreset(preset);
    return errors.length ? { error: errors.join('\n') } : { ok: true };
  });

  // ----- sharing presets as .d2mm -----

  ipcMain.handle('presets:exportPlan', async (e, id) => {
    const preset = library.getPreset(id);
    if (!preset) return { error: t('Пресет не найден') };
    try {
      return { name: preset.name, entries: planShape(await presetShareEntries(preset)) };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  ipcMain.handle('presets:export', async (e, id, opts) => {
    const preset = library.getPreset(id);
    if (!preset) return { error: t('Пресет не найден') };
    const safe = preset.name.replace(/[<>:"/\\|?*]/g, '_') || 'preset';
    const res = await dialog.showSaveDialog(win, {
      title: t('Сохранить пресет для друга'),
      defaultPath: `${safe}.d2mm`,
      filters: [{ name: t('Пресет Mod Manager'), extensions: ['d2mm'] }],
    });
    if (res.canceled || !res.filePath) return { cancelled: true };
    try {
      const skip = new Set((opts && opts.skip) || []);
      sendProgress({ type: 'stage', label: preset.name, stage: t('сборка пресета') });
      // pull the bytes only now, and only for what the user kept ticked
      const prep = (entry, key) => {
        if (entry.kind === 'pack') return { ...entry, members: entry.members.map((m, j) => prep(m, `${key}.${j}`)) };
        const { loadData, ...rest } = entry;
        if (entry.kind !== 'embedded') return rest;
        if (skip.has(key)) return { kind: 'missing', name: entry.name, reason: t('отправитель не вложил файл') };
        return { ...rest, data: loadData() };
      };
      const entries = (await presetShareEntries(preset)).map((entry, i) => prep(entry, String(i)));
      const written = writePresetFile(res.filePath, {
        name: preset.name,
        note: (opts && String(opts.note || '').slice(0, 600)) || '',
        author: { name: (opts && String(opts.author || '').slice(0, 80)) || '' },
        app: app.getVersion(),
        catalogFetchedAt: catalog.cacheInfo().fetchedAt,
      }, entries);
      sendProgress({ type: 'done', label: preset.name });
      return { ok: true, path: written.path, size: written.size };
    } catch (err) {
      sendProgress({ type: 'error', label: preset.name, message: String(err.message || err) });
      return { error: String(err.message || err) };
    }
  });

  ipcMain.handle('presets:shareLink', async (e, id) => {
    const preset = library.getPreset(id);
    if (!preset) return { error: t('Пресет не найден') };
    try {
      const mods = presetLinkMods(preset, await catalogIndex());
      if (!mods) return { error: t('В пресете есть свои моды — ссылкой не поделиться, только файлом') };
      const account = settings.get('account');
      const link = encodePresetLink({ name: preset.name, author: account && account.username, mods });
      return { ok: true, ...link, count: mods.length };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  ipcMain.handle('presets:importLink', (e, text) => importPresetLink(text));

  ipcMain.handle('presets:importDialog', async () => {
    const res = await dialog.showOpenDialog(win, {
      title: t('Выбери файл пресета (.d2mm)'),
      properties: ['openFile'],
      filters: [{ name: t('Пресет Mod Manager'), extensions: ['d2mm'] }],
    });
    if (res.canceled || !res.filePaths[0]) return { cancelled: true };
    return importPresetFile(res.filePaths[0]);
  });

  ipcMain.handle('presets:importFile', (e, filePath) => importPresetFile(filePath));

  ipcMain.handle('presets:resolve', async (e, id) => {
    const preset = library.getPreset(id);
    if (!preset || !preset.wanted) return { error: t('Пресет не найден') };
    const stash = preset.source && preset.source.file;
    let bundle = null;
    if (stash && fs.existsSync(stash)) {
      try { bundle = readPresetFile(stash); } catch (err) { return { error: String(err.message || err) }; }
    }
    const cat = await catalogIndex();
    const fpIndex = installedFpIndex();
    const errors = [];

    // -> id of the library record that now provides this mod, or null
    const resolveEntry = async (entry) => {
      try {
        if (entry.kind === 'catalog') {
          const have = library.findByKey(entry.categoryId, entry.name, entry.styleLabel);
          if (have) return have.id;
          const hit = cat.lookup(entry.categoryId, entry.name, entry.styleLabel);
          if (!hit) { errors.push(`${entry.name}: ${t('нет в каталоге')}`); return null; }
          const files = await installer.install({ categoryId: hit.categoryId, modName: hit.name, fileRef: hit.fileRef });
          return library.add({
            categoryId: hit.categoryId, name: hit.name, styleLabel: hit.styleLabel,
            fileRef: hit.fileRef, preview: hit.preview, files,
          }).id;
        }
        if (entry.kind === 'embedded') {
          if (entry.fp && fpIndex.has(entry.fp)) return fpIndex.get(entry.fp); // already on disk
          if (!bundle) { errors.push(`${entry.name}: ${t('файл пресета недоступен')}`); return null; }
          sendProgress({ type: 'stage', label: entry.name, stage: t('установка') });
          const files = installer.installVpkBuffer(bundle.readMod(entry.file));
          const rec = library.add({
            categoryId: 'imported', name: entry.name, styleLabel: null,
            fileRef: null, preview: null, files,
          });
          if (entry.fp) fpIndex.set(entry.fp, rec.id);
          return rec.id;
        }
        errors.push(`${entry.name}: ${entry.reason || t('нет в файле')}`);
        return null;
      } catch (err) {
        errors.push(`${entry.name}: ${String(err.message || err)}`);
        return null;
      }
    };

    const ids = [];
    for (const entry of preset.wanted) {
      if (entry.kind === 'pack') {
        const memberIds = [];
        for (const m of entry.members) { const r = await resolveEntry(m); if (r) memberIds.push(r); }
        const built = packFromRecords(entry.name, memberIds);
        if (built) ids.push(built.id); else ids.push(...memberIds);
      } else {
        const r = await resolveEntry(entry);
        if (r) ids.push(r);
      }
    }

    preset.modIds = [...new Set(ids)];
    delete preset.wanted;                       // resolved: it's an ordinary preset now
    if (preset.source) preset.source.file = null;
    library.save();
    if (stash) { try { fs.rmSync(stash, { force: true }); } catch { /* noop */ } }

    errors.push(...applyPreset(preset));
    afterDeployMaster();
    sendProgress({ type: 'done', label: preset.name });
    return { ok: true, installed: preset.modIds.length, errors };
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
