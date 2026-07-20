const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const { Settings } = require('./src/settings');
const { Catalog } = require('./src/catalog');
const { Installer } = require('./src/installer');
const { Library } = require('./src/library');
const { findDotaGamePath, validateGamePath } = require('./src/steam');

let win;
let settings, catalog, installer, library;

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
  catalog = new Catalog(userData);
  library = new Library(userData);
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

  registerIpc();
  createWindow();
  diag('createWindow done');
}).catch((e) => diag('whenReady FAIL: ' + (e.stack || e)));

app.on('window-all-closed', () => app.quit());

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

  // ----- settings -----
  ipcMain.handle('settings:get', () => ({
    ...settings.all(),
    dotaPathValid: validateGamePath(settings.get('dotaGamePath')),
  }));

  ipcMain.handle('settings:set', (e, key, value) => {
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
      title: 'Выбери папку game внутри dota 2 beta',
      properties: ['openDirectory'],
    });
    if (res.canceled || !res.filePaths[0]) return null;
    let p = res.filePaths[0];
    // allow picking "dota 2 beta" root as well
    if (!validateGamePath(p) && validateGamePath(path.join(p, 'game'))) p = path.join(p, 'game');
    if (!validateGamePath(p)) return { error: 'В этой папке не найдена Dota 2 (нет подпапки dota)' };
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
      if (existing) return { error: 'Уже установлено', already: true };
      const files = await installer.install({
        categoryId: payload.categoryId,
        modName: payload.name,
        fileRef: payload.fileRef,
      });
      const rec = library.add({ ...payload, files });
      sendProgress({ type: 'done', label: payload.name });
      return { ok: true, record: rec };
    } catch (err) {
      sendProgress({ type: 'error', label: payload.name, message: String(err.message || err) });
      return { error: String(err.message || err) };
    }
  });

  ipcMain.handle('mods:list', () => {
    let external = [];
    try {
      external = installer.externalFiles(library.knownLangRelPaths());
    } catch { /* lang folder may not exist yet */ }
    return { installed: library.list(), external };
  });

  ipcMain.handle('mods:setEnabled', (e, id, enabled) => {
    const rec = library.find(id);
    if (!rec) return { error: 'Мод не найден' };
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
    if (!rec) return { error: 'Мод не найден' };
    try {
      installer.remove(rec.files);
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
    if (!preset) return { error: 'Пресет не найден' };
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
      if (!exe) return { error: 'exe не найден в папке инструмента' };
      shell.openPath(exe);
      return { ok: true };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });
}
