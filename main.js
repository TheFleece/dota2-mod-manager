const { app, BrowserWindow, ipcMain, shell, dialog, net } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFile } = require('child_process');
const AdmZip = require('adm-zip');

let autoUpdater = null;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch { /* dev environment without the dependency installed yet */ }

const { Settings } = require('./src/settings');
const { Catalog } = require('./src/catalog');
const { Installer } = require('./src/installer');
const { Library } = require('./src/library');
const { Fingerprints } = require('./src/fingerprints');
const { writePresetFile, readPresetFile } = require('./src/preset-share');
const { SCHEME, encodePresetLink, decodePresetLink } = require('./src/preset-link');
const discordAuth = require('./src/discord-auth');
const { DiscordPresence } = require('./src/discord-presence');
const { findDotaGamePath, validateGamePath } = require('./src/steam');
const { createSchemaService } = require('./src/schema-service');
const { createRemoteConfig } = require('./src/remote-config');
const { createToolchain } = require('./src/toolchain');
const { createGameIcons } = require('./src/game-icons');
const { createModPreviews } = require('./src/mod-preview');
const { createModIdentity } = require('./src/mod-id');
const { gameStamp, createPatchWatcher } = require('./src/patch-watch');
const { Icons } = require('./src/icons');
const { buildReport } = require('./src/diagnostics');
const gamelang = require('./src/gamelang');
const i18n = require('./src/i18n');
const { t } = i18n;

let win;
let settings, catalog, installer, library, fingerprints, presence, schemaService, icons, remoteConfig;
let toolchain, gameIcons, modPreviews, modId;
let presenceView = 'catalog';
// The one folder mods are installed into. Dota mounts the folder named by its audio
// language, so the app sets that language rather than offering a choice of folders
// (see keepRussianFolder).
const LANG_FOLDER = 'russian';
// set when startup moved mods into that folder from wherever they were; the renderer
// picks it up once with settings:get and tells the user what happened
let langMigration = null;
// fonts and cursors Steam's file check took back and the app could not put back on its own
// (the archive they came in is no longer cached), reported by mods:list
let verifyStuck = [];
// what the app did about the last Dota patch, shown as a banner in My mods:
// { state: 'idle' | 'waiting' | 'done' | 'failed', healed: string[], error?, at }
let patchRepair = { state: 'idle' };
let patchWatcher = null;
let repairTimer = null;

function sendProgress(evt) {
  if (win && !win.isDestroyed()) win.webContents.send('progress', evt);
}

// UI scale, kept inside a range where the layout still holds together
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 1.6;
function clampZoom(v) {
  const z = Number(v);
  if (!Number.isFinite(z) || z <= 0) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
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

  // Ctrl +/-/0 scale the content. Handled here rather than in the renderer because
  // preventDefault() at this point also swallows Electron's built-in zoom accelerators —
  // those zoom the whole window, panels included, which is exactly what we don't want.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !input.control || input.alt) return;
    const cur = clampZoom(settings.get('uiScale'));
    let z = null;
    if (input.key === '=' || input.key === '+') z = clampZoom(cur + 0.05);
    else if (input.key === '-' || input.key === '_') z = clampZoom(cur - 0.05);
    else if (input.key === '0') z = 1;
    if (z === null) return;
    event.preventDefault();
    settings.set('uiScale', z);
    win.webContents.send('ui:zoom', z); // the renderer owns the scale itself
  });

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
          if (process.env.MM_SEARCH) {
            // dev-only: type into the title-bar search (its handler is debounced)
            await win.webContents.executeJavaScript(`(() => {
              const el = document.getElementById('globalSearch');
              if (!el) return;
              el.value = ${JSON.stringify(process.env.MM_SEARCH)};
              el.dispatchEvent(new Event('input', { bubbles: true }));
            })()`);
            await new Promise((r) => setTimeout(r, 2500));
          }
          if (process.env.MM_CLICK) {
            // dev-only: click a comma-separated list of CSS selectors before capture
            for (const sel of process.env.MM_CLICK.split('||')) {
              await win.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(sel)})?.click()`);
              await new Promise((r) => setTimeout(r, 700));
            }
          }
          if (process.env.MM_HOVER) {
            // dev-only: park the pointer over a selector (or "x,y") so the shot shows the
            // hover state. Half of what a card does only exists under the cursor, and a
            // screenshot of the resting state cannot show a control that slides on hover.
            const spec = process.env.MM_HOVER;
            let point = null;
            if (/^\d+\s*,\s*\d+$/.test(spec)) {
              const [x, y] = spec.split(',').map(Number);
              point = { x, y };
            } else {
              point = await win.webContents.executeJavaScript(`(() => {
                const el = document.querySelector(${JSON.stringify(spec)});
                if (!el) return null;
                const r = el.getBoundingClientRect();
                return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
              })()`);
            }
            if (point) {
              // two moves: the first lands, the second keeps the pointer there after any
              // relayout the first one caused
              win.webContents.sendInputEvent({ type: 'mouseMove', x: point.x, y: point.y });
              await new Promise((r) => setTimeout(r, 250));
              win.webContents.sendInputEvent({ type: 'mouseMove', x: point.x, y: point.y });
              await new Promise((r) => setTimeout(r, 600));
            }
          }
          if (process.env.MM_DRAG) {
            // dev-only: press, move, release — "x1,y1,x2,y2" (drags a grip, swipes a strip)
            const [x1, y1, x2, y2] = process.env.MM_DRAG.split(',').map(Number);
            win.webContents.sendInputEvent({ type: 'mouseDown', x: x1, y: y1, button: 'left', clickCount: 1 });
            for (let i = 1; i <= 12; i++) {
              win.webContents.sendInputEvent({
                type: 'mouseMove', button: 'left',
                x: Math.round(x1 + ((x2 - x1) * i) / 12), y: Math.round(y1 + ((y2 - y1) * i) / 12),
              });
              await new Promise((r) => setTimeout(r, 30));
            }
            win.webContents.sendInputEvent({ type: 'mouseUp', x: x2, y: y2, button: 'left', clickCount: 1 });
            await new Promise((r) => setTimeout(r, 500));
          }
          if (process.env.MM_WHEEL) {
            // dev-only: wheel ticks at a point — "x,y,deltaY[,ctrl]", several split by ";"
            for (const spec of process.env.MM_WHEEL.split(';')) {
              const [x, y, dy, mod] = spec.split(',').map((v) => v.trim());
              win.webContents.sendInputEvent({
                type: 'mouseWheel', x: Number(x), y: Number(y),
                deltaX: 0, deltaY: Number(dy), canScroll: true,
                modifiers: mod === 'ctrl' ? ['control'] : [],
              });
              await new Promise((r) => setTimeout(r, 400));
            }
          }
          if (process.env.MM_SCROLL) {
            // dev-only: scroll the scrollable pane by N px before capture (long views)
            await win.webContents.executeJavaScript(`(() => {
              const el = [...document.querySelectorAll('#main, *')].find((e) =>
                e.scrollHeight > e.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(e).overflowY));
              (el || document.scrollingElement).scrollBy(0, ${Number(process.env.MM_SCROLL) || 0});
            })()`);
            await new Promise((r) => setTimeout(r, 600));
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
          if (process.env.MM_EVAL) {
            // dev-only: read the finished DOM and write the answer beside the screenshot.
            // A picture cannot say whether a fold opened with the right text in the right
            // language, and that is exactly the kind of thing that ships broken.
            const out = await win.webContents.executeJavaScript(`(async () => {
              ${process.env.MM_EVAL}
            })()`);
            fs.writeFileSync(`${process.env.MM_SHOT}.eval.json`, JSON.stringify(out, null, 1));
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

// A small rotating log every install keeps, so a support report (see src/diagnostics.js and
// the diag:export handler below) doesn't depend on reproducing the problem live. MM_DIAG is
// a separate, opt-in mirror to an arbitrary path, used only by the screenshot test harness.
let _logFile = null;
function logFile() {
  if (!_logFile) _logFile = path.join(app.getPath('userData'), 'logs', 'app.log');
  return _logFile;
}
const LOG_MAX_BYTES = 1024 * 1024;
function appendLog(line) {
  try {
    const file = logFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    try { if (fs.statSync(file).size > LOG_MAX_BYTES) fs.renameSync(file, file + '.1'); } catch { /* first write */ }
    fs.appendFileSync(file, line);
  } catch { /* logging must never be why the app crashes */ }
}

const DIAG = process.env.MM_DIAG;
function diag(msg) {
  const line = `${new Date().toISOString()} ${msg}\n`;
  appendLog(line);
  if (DIAG) { try { fs.appendFileSync(DIAG, line); } catch { /* noop */ } }
}

process.on('uncaughtException', (err) => diag('uncaughtException: ' + (err?.stack || err)));
process.on('unhandledRejection', (reason) => diag('unhandledRejection: ' + (reason?.stack || reason)));

app.whenReady().then(async () => {
  diag('whenReady');
  const userData = app.getPath('userData');
  settings = new Settings(userData);
  i18n.setLang(settings.get('uiLang'));
  catalog = new Catalog(userData);
  library = new Library(userData);
  fingerprints = new Fingerprints(userData);
  fingerprints.refresh(); // fire-and-forget: pull the latest fp -> mod map
  modId = createModIdentity({ getGamePath: () => settings.get('dotaGamePath'), log: diag });
  installer = new Installer({
    userDataDir: userData,
    getGamePath: () => settings.get('dotaGamePath'),
    getLangSuffix: () => settings.get('langSuffix'),
    onProgress: sendProgress,
    identify: (paths) => modId.identify(paths),
  });
  presence = new DiscordPresence({ clientId: discordAuth.CLIENT_ID, onDiag: diag });
  schemaService = createSchemaService({ settings, library, installer, userDataDir: userData });
  // what the app can be told after it shipped: a feature switched off with a reason, and
  // dated notices. Fire-and-forget, and everything it governs stays on until it says otherwise
  remoteConfig = createRemoteConfig({ userDataDir: userData, appVersion: () => app.getVersion(), log: diag });
  remoteConfig.refresh();
  // pictures for the cosmetics picker come through Electron's network stack (see src/icons.js)
  icons = new Icons(userData, net.fetch);
  // ...unless the Source 2 toolchain is here, in which case they come out of the game itself
  toolchain = createToolchain({ userDataDir: userData, onProgress: sendProgress, log: diag });
  gameIcons = createGameIcons({
    userDataDir: userData,
    toolchain,
    getGamePath: () => settings.get('dotaGamePath'),
    log: diag,
  });
  // ...and the same toolchain gives a mod that came with no picture one out of itself
  modPreviews = createModPreviews({
    userDataDir: userData,
    toolchain,
    langFileOf: (relPath) => installer.langFileOnDisk(relPath),
    log: diag,
  });

  // auto-detect dota on first run
  if (!validateGamePath(settings.get('dotaGamePath'))) {
    const found = await findDotaGamePath();
    if (found) settings.set('dotaGamePath', found);
  }

  // put the mods where the game will look for them, and make the game look there
  try {
    await keepRussianFolder();
    applyVoicePreference();
  } catch (e) {
    diag('lang folder sync skipped: ' + e.message);
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

  // put the switched-on cursor set back on disk, and stash a copy of sets installed before
  // they could be switched off at all
  try {
    reconcileCursors();
  } catch (e) {
    diag('cursor reconcile skipped: ' + e.message);
  }

  // finish what a killed process could not: a file a transaction had parked while it worked
  try {
    const swept = installer.sweepStaged();
    if (swept.restored || swept.dropped) diag(`staged files: ${swept.restored} restored, ${swept.dropped} dropped`);
  } catch (e) {
    diag('staged sweep skipped: ' + e.message);
  }

  // one-time sweep of mods installed before the schema engine existed: they still carry a
  // stale item table and a stale localization copy inside their VPK
  try {
    const m = schemaService.migrate();
    if (m.changed) diag(`schema migrate: ${m.changed}/${m.scanned} mods cleaned, ${m.deltas} blocks, ~${m.freedMB} MB freed`);
  } catch (e) {
    diag('schema migrate skipped: ' + e.message);
  }
  // cosmetic picks used to live in settings.json; move them into library records so they
  // can be toggled, deleted and shared like any other mod
  try {
    schemaService.migrateCosmeticSettings();
  } catch (e) {
    diag('cosmetic migrate skipped: ' + e.message);
  }

  // a Dota update overwrites the patched gameinfo and moves the item table: put both
  // back before the user gets a chance to launch the game with a half-applied setup
  const startupHealed = [];
  let startupError = null;
  try {
    const healed = schemaService.heal();
    if (healed.healed && healed.healed.length) { startupHealed.push(...healed.healed); diag('schema healed: ' + healed.healed.join(',')); }
    if (healed.error) { startupError = healed.error; diag('schema heal failed: ' + healed.error); }
  } catch (e) {
    startupError = e.message;
    diag('schema heal skipped: ' + e.message);
  }

  // the same job for the two kinds of mod that overwrite files Valve ships
  try {
    if (restoreAfterVerify()) startupHealed.push('files');
  } catch (e) {
    diag('restore after verify skipped: ' + e.message);
  }

  // Did the game change while the app was closed? The repair for it has just run either
  // way - this only decides whether the user is told about it, and hands the watcher the
  // build to compare against.
  try {
    const stamp = gameStamp(settings.get('dotaGamePath'));
    const known = settings.get('gameStamp');
    if (stamp && known && stamp !== known) {
      diag(`Dota changed while the app was closed: ${known} -> ${stamp}`);
      patchRepair = { state: startupError ? 'failed' : 'done', healed: startupHealed, error: startupError, at: Date.now() };
    }
    if (stamp) settings.set('gameStamp', stamp);
  } catch (e) {
    diag('build check skipped: ' + e.message);
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
  applyPresenceSetting();
  setupAutoUpdate();

  // and from here on, notice a patch the moment it lands rather than at the next start
  patchWatcher = createPatchWatcher({
    getGamePath: () => settings.get('dotaGamePath'),
    onPatch: (evt) => repairAfterPatch(evt),
    log: diag,
  });
  patchWatcher.start(settings.get('gameStamp'));
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
app.on('before-quit', () => {
  clearTimeout(repairTimer);
  if (patchWatcher) patchWatcher.stop();
});

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
/**
 * The changelog section for one version, in the app's language when there is a translation.
 * The same file CI puts on the release page, shipped with the build so the screen works
 * offline and needs no GitHub call.
 * @returns {string|null} markdown, or null when this version has no section
 */
function releaseNotes(version, lang) {
  const files = lang === 'ru' ? ['CHANGELOG.ru.md', 'CHANGELOG.md'] : ['CHANGELOG.md'];
  const head = new RegExp(`^## ${version.replace(/\./g, '\\.')}(?:[^0-9.].*)?$`, 'm');
  for (const name of files) {
    let text;
    try { text = fs.readFileSync(path.join(app.getAppPath(), name), 'utf-8'); } catch { continue; }
    const m = head.exec(text);
    if (!m) continue;
    const rest = text.slice(m.index + m[0].length);
    const next = /^## /m.exec(rest);
    const body = (next ? rest.slice(0, next.index) : rest).trim();
    if (body) return body;
  }
  return null;
}

/**
 * Everything a VPK that just landed in the game folder needs before it counts as a mod:
 * a name that says what is in it, the item blocks lifted out of it, a split when it turns
 * out to be several heroes in one file, and a match against the catalog fingerprints.
 *
 * Every route into the library goes through here — the import button, drag and drop, and
 * the mods that arrive inside a shared preset. That last one used to land as a bare record
 * instead, which is why a received build showed up unnamed, unrecognised and still needing
 * "split" by hand while the same file dragged in by the user came out clean.
 *
 * @param {{files: Array, name?: string, fileRef?: string, identity?: object}} input
 * @returns {{ records: Array<object>, schema: boolean, split: boolean }}
 */
function adoptImportedFiles({ files, name, fileRef, identity }) {
  const dirRel = (files.find((f) => /_dir\.vpk$/i.test(f.relPath)) || files[0])?.relPath;
  // a name from the file's own content beats "pak42" and beats a sender's slot name; a
  // real identity (a catalog mod, or a name the sender meant) is kept as it is
  const contentName = (dirRel && installer.displayNameForFile(dirRel)) || null;
  const useContentName = !name || /^!?pak\d+(_dir)?$/i.test(name);
  const base = identity || {
    name: (useContentName && contentName) || name || contentName || t('Мод'),
    categoryId: 'imported',
    styleLabel: null,
    preview: null,
  };
  const rec = library.add({ ...base, fileRef: fileRef || null, files });

  // skinchanger-style packs carry the whole item table and the localization files:
  // keep the item blocks they changed, drop the tables (see installer.harvestSchema)
  const harvest = schemaService.harvest(rec);
  let schema = !!(harvest && harvest.deltas);

  // …and they can hold several heroes at once. One mod per hero, each with its own files
  // and its own item blocks, so they can be turned on and off separately.
  let parts = null;
  try {
    const fresh = library.find(rec.id) || rec;
    const subjects = (installer.analyzeRecord(fresh) || {}).subjects || 0;
    // a curated collection of a dozen heroes would eat a dozen pak slots, so only the
    // small exports split by themselves - bigger ones keep the manual "Split" button
    if (subjects >= 2 && subjects <= 4) parts = schemaService.split(fresh);
  } catch { /* a pack that will not split stays one mod */ }
  if (parts && parts.length) {
    for (const p of parts) if (Array.isArray(p.schema) && p.schema.length) schema = true;
    return { records: parts, schema, split: true };
  }
  return { records: [library.find(rec.id) || rec], schema, split: false };
}

function registerImportResults(results) {
  const imported = [];
  let needSchema = false;
  for (const r of results) {
    if (r.error) continue;
    const { records, schema, split } = adoptImportedFiles({ files: r.files, name: r.name, fileRef: r.source });
    if (schema) needSchema = true;
    for (const rec of records) {
      imported.push({
        name: rec.name,
        relPath: rec.files[0].relPath,
        merged: split ? 0 : r.merged || 0,
        ...(split ? { fromSplit: r.name } : {}),
      });
    }
  }
  if (imported.length && installer.masterIsOff()) { try { installer.setMasterEnabled(false); } catch { /* noop */ } }
  if (needSchema) schemaService.refresh();
  return { imported, errors: results.filter((r) => r.error), schema: needSchema };
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

// ---------- item schema (game/dota_mods) ----------
// The engine reads scripts/items/items_game.txt through the MOD path - the game's own dota
// folder - so nothing in a language folder can override it. Mods therefore never ship their
// copy: src/schema-service.js lifts the blocks they changed and splices them into the game's
// CURRENT table. Everything below is a thin call into that service.

// Whether toggling/removing this record can change what belongs in the built schema: a mod
// with lifted item blocks, or a cosmetic pick (which IS a schema edit, not a file).
function touchesSchema(rec) {
  return rec.categoryId === 'cosmetic' || (Array.isArray(rec.schema) && rec.schema.length > 0);
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

// ---------- Discord presence ----------

const PRESENCE_VIEWS = {
  catalog: 'Смотрит каталог модов',
  library: 'В своей библиотеке',
  presets: 'Собирает пресет',
  cosmetics: 'Выбирает косметику',
  tools: 'В инструментах',
  guides: 'Читает гайды',
  settings: 'В настройках',
};

// The status is written in the language the user chose for the app: their friends read it,
// and that is the only language signal we have about them.
function presenceActivity() {
  let mods = 0;
  let masterOff = false;
  try {
    mods = library.list().filter((r) => r.enabled).length;
    // the master switch renames files rather than clearing each record's own flag, so the
    // per-mod count still reads "on" while nothing is actually loading
    masterOff = installer.masterIsOff();
  } catch { /* no library or no game path yet */ }
  let state = t('Ещё без модов');
  if (masterOff) state = t('Моды выключены');
  else if (mods) state = t('{0} модов включено', mods);
  return {
    details: t(PRESENCE_VIEWS[presenceView] || PRESENCE_VIEWS.catalog),
    state,
    buttons: [{ label: t('Скачать Mod Manager'), url: 'https://thefleece.github.io/dota2-mod-manager/' }],
  };
}

function refreshPresence() {
  if (presence && presence.enabled) presence.set(presenceActivity());
}

// Follows the setting: turning it off tears the connection down, not just the updates.
function applyPresenceSetting() {
  if (!presence) return;
  if (settings.get('discordPresence') === false) { presence.stop(); return; }
  presence.start();
  refreshPresence();
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

// The mods of one catalog category. Most categories are a flat array, but some (creeps,
// towers, hero-items, item-effects, creep-deny) group theirs under `groups` - the same two
// shapes the catalog view walks (see categoryMods in renderer/app.js). Reading only the
// flat ones meant every mod in a grouped category looked like it was not in the catalog:
// the share dialog called them the user's own and packed them into the file as bytes, and
// a preset link dropped them entirely.
function categoryModList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.groups)) return data.groups.flatMap((g) => g.mods || []);
  return [];
}

// "<categoryId>|<name>|<styleLabel>" -> what mods:install needs to fetch it
async function catalogIndex() {
  const map = new Map();
  const key = (c, n, s) => `${c}|${n}|${s || ''}`;
  let data;
  try { data = await catalog.load(); } catch { return map; } // offline with no cache
  for (const [categoryId, list] of Object.entries((data.mods && data.mods.modsData) || {})) {
    for (const m of categoryModList(list)) {
      if (!m || !m.name) continue;
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
  // a cosmetic pick is a slot + an id from the receiver's OWN game schema — both players'
  // games carry the same Valve items, so there is nothing to fetch or embed at all
  if (rec.categoryId === 'cosmetic') {
    return { kind: 'cosmetic', name: rec.name, slot: rec.slot, itemId: rec.itemId, size: 0 };
  }
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
    size, loadData: () => installer.mergeToSingleVpk(rec, rec.schema),
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
  const plain = (e, key) => ({
    key, kind: e.kind, name: e.name, size: e.size || 0, info: e.info || '', reason: e.reason || '',
    ...(e.kind === 'cosmetic' ? { slot: e.slot } : {}),
  });
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

// The mods of a preset flattened for a link, plus the names of the ones that cannot ride
// along. A link carries identities only, so a mod the receiver has no way to fetch — a
// user's own import — has to be left out; the rest of the build still travels, and the
// sender is told exactly what was dropped. Refusing to make a link at all over one import
// is what made "share by link" look broken in a library that is mostly imports.
//
// A pack flattens to its members: packing is a local storage choice, not part of the build.
// A cosmetic pick travels too — slot + item id is a few bytes, and needs no catalog lookup
// at all (both players' games carry the same Valve schema).
function presetLinkMods(preset, cat) {
  const mods = [];
  const skipped = [];
  for (const id of preset.modIds || []) {
    const rec = library.find(id);
    if (!rec) continue;
    if (rec.categoryId === 'cosmetic') {
      mods.push({ kind: 'cosmetic', slot: rec.slot, itemId: rec.itemId, name: rec.name });
      continue;
    }
    for (const it of (rec.kind === 'pack' ? rec.members || [] : [rec])) {
      if (it.categoryId === 'imported' || !cat.lookup(it.categoryId, it.name, it.styleLabel)) {
        skipped.push(it.name);
        continue;
      }
      mods.push({ kind: 'catalog', categoryId: it.categoryId, name: it.name, styleLabel: it.styleLabel || null });
    }
  }
  return { mods, skipped };
}

// What installing a received preset would actually do, for the card in the Presets tab.
async function sharedPresetStatus(preset, cat) {
  const fpIndex = installedFpIndex();
  const out = { installed: 0, download: 0, embedded: 0, free: 0, unavailable: [] };
  const visit = (e) => {
    if (e.kind === 'catalog') {
      if (library.findByKey(e.categoryId, e.name, e.styleLabel)) out.installed++;
      else if (cat.lookup(e.categoryId, e.name, e.styleLabel)) out.download++;
      else out.unavailable.push(e.name);
    } else if (e.kind === 'embedded') {
      if (e.fp && fpIndex.has(e.fp)) out.installed++;
      else out.embedded++;
    } else if (e.kind === 'cosmetic') {
      // free either way — nothing to fetch, just an instant pick from the local game schema
      const have = library.list().find((r) => r.categoryId === 'cosmetic' && r.slot === e.slot && r.itemId === e.itemId);
      if (have && have.enabled !== false) out.installed++;
      else out.free++;
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
  const recs = library.list();
  let schemaTouched = false;
  // off first, then on: two cursor sets cannot be live at once, so the outgoing one has to
  // put the vanilla files back before the incoming one writes over them
  for (const pass of [false, true]) {
    for (const rec of recs) {
      const shouldEnable = wanted.has(rec.id);
      if (shouldEnable !== pass || rec.enabled === shouldEnable) continue;
      try {
        installer.setEnabled(rec.files, shouldEnable, rec.id);
        library.setEnabled(rec.id, shouldEnable);
        if (touchesSchema(rec)) schemaTouched = true;
      } catch (err) {
        errors.push(`${rec.name}: ${err.message}`);
      }
    }
  }
  if (schemaTouched) schemaService.refresh();
  return errors;
}

// ---------- cursors ----------

// A cursor set is loose files in resource\cursor, not a pak that can be renamed aside, and
// every set writes the same names — so only one can be live and switching happens by
// copying files back and forth (see the cursor section of src/installer.js).

function isCursorRecord(rec) {
  return !!rec && (rec.files || []).some((f) => f.root === 'cursor');
}

// switch off every cursor set except one, and report which ones gave way
function disableOtherCursors(exceptId) {
  const off = [];
  for (const rec of library.list()) {
    if (rec.id === exceptId || rec.enabled === false || !isCursorRecord(rec)) continue;
    try {
      installer.setEnabled(rec.files, false, rec.id);
      library.setEnabled(rec.id, false);
      off.push(rec.name);
    } catch { /* noop */ }
  }
  return off;
}

// a slot (weather, courier, ...) only ever has one active look — same rule as cursors,
// just without files to rename: the sibling only needs its enabled flag flipped
function disableOtherCosmetics(rec) {
  const off = [];
  for (const other of library.list()) {
    if (other.id === rec.id || other.enabled === false) continue;
    if (other.categoryId !== 'cosmetic' || other.slot !== rec.slot) continue;
    library.setEnabled(other.id, false);
    off.push(other.name);
  }
  return off;
}

// the master switch renames paks in the language folder, which leaves cursors untouched —
// take them off (and put them back) alongside it, so "mods off" really means vanilla
function applyMasterToCursors(enabled) {
  for (const rec of library.list()) {
    if (rec.enabled === false || !isCursorRecord(rec)) continue;
    try {
      if (enabled) installer.deployCursor(rec.id, rec.files);
      else installer.undeployCursor(rec.id, rec.files);
    } catch { /* noop */ }
  }
}

// Startup repair: the cursor folder can drift from the manifest (a game update, a Steam
// verify, another tool), and records made before cursors could be switched off have no
// stored copy yet. Also settles the legacy case of several sets marked on at once — only
// the newest was ever really on disk.
function reconcileCursors() {
  if (!settings.get('dotaGamePath')) return;
  const cursors = library.list().filter(isCursorRecord)
    .sort((a, b) => (b.installedAt || 0) - (a.installedAt || 0));
  if (!cursors.length) return;
  let masterOff = false;
  try { masterOff = installer.masterIsOff(); } catch { /* no language folder yet */ }
  let liveClaimed = false;
  for (const rec of cursors) {
    try {
      if (!fs.existsSync(installer.cursorStoreDir(rec.id))) {
        const adopted = rec.enabled !== false && !liveClaimed && installer.ensureCursorStore(rec.id, rec.files);
        if (adopted) liveClaimed = true;
        else {
          // nothing of this set is kept anywhere — it can only come back by reinstalling
          if (rec.enabled !== false) library.setEnabled(rec.id, false);
          continue;
        }
      }
      if (rec.enabled === false || masterOff) installer.undeployCursor(rec.id, rec.files);
      else installer.deployCursor(rec.id, rec.files);
    } catch { /* best-effort */ }
  }
}

// a library record that can go into a combined pack: a lang-folder skin/import with a
// _dir.vpk (not a pack itself, not a loose font/cursor set, not a terrain maps file)
function packableRecord(rec) {
  return rec && rec.kind !== 'pack'
    && rec.categoryId !== 'fonts' && rec.categoryId !== 'cursors'
    && (rec.files || []).some((f) => f.root === 'lang' && /_dir\.vpk$/i.test(f.relPath));
}

// Dota reads boot.vcfg once at startup and rewrites it on exit, so language changes must be
// made while it is closed or the game would just overwrite them.
function dotaIsRunning() {
  return new Promise((resolve) => {
    execFile('tasklist', ['/FI', 'IMAGENAME eq dota2.exe', '/NH'], (err, stdout) => {
      resolve(!err && /dota2\.exe/i.test(stdout || ''));
    });
  });
}

// Move installed mod files between language folders. The game's own files stay put:
// pak01_* are Valve's voice paks and gameinfo.gi is the folder's layer definition.
function moveLangFolder(game, fromSuffix, toSuffix) {
  if (!game || !fromSuffix || !toSuffix || fromSuffix === toSuffix) return 0;
  const oldDir = path.join(game, `dota_${fromSuffix}`);
  let moved = 0;
  try {
    if (!fs.existsSync(oldDir)) return 0;
    const newDir = gamelang.ensureLangFolder(game, toSuffix);
    for (const f of fs.readdirSync(oldDir)) {
      if (/^pak01_/i.test(f) || f.toLowerCase() === 'gameinfo.gi') continue;
      const dst = path.join(newDir, f);
      if (fs.existsSync(dst)) continue;
      fs.renameSync(path.join(oldDir, f), dst);
      moved++;
    }
    // a folder we no longer use and that holds nothing else goes away
    if (!fs.readdirSync(oldDir).length) fs.rmdirSync(oldDir);
  } catch (err) {
    console.error('lang folder migration failed:', err);
  }
  return moved;
}

/* Mods live in dota_russian, and the app is the one that arranges it.
 *
 * The engine mounts the folder named by Dota's audio language, so a mod folder is not a
 * preference - it is a consequence of a setting somewhere else. Asking the user to keep the
 * two in step was asking them to understand our filing system. Now there is one folder,
 * always the same one, and the app writes the audio language that mounts it.
 *
 * The text language stays untouched. It is the one the user picked when they installed the
 * game, and nothing about mods depends on it. Voices are not disturbed either unless Valve's
 * Russian pack is actually downloaded: without it dota_russian mounts with our mods in it
 * and the speech keeps coming from dota/pak01, which is English.
 *
 * Dota rewrites boot.vcfg when it exits, so a running game means we try again next launch.
 */
async function keepRussianFolder() {
  const game = settings.get('dotaGamePath');
  if (!game) return;
  const mounted = gamelang.detectLangSuffix(game).suffix;
  if (mounted !== LANG_FOLDER) {
    if (await dotaIsRunning()) {
      diag(`audio language is ${mounted}, Dota is running - leaving boot.vcfg alone`);
      return;
    }
    gamelang.writeBootLanguages(game, { audio: LANG_FOLDER });
    diag(`audio language ${mounted} -> ${LANG_FOLDER}`);
  }
  gamelang.ensureLangFolder(game, LANG_FOLDER);
  // whatever the mods were following before: our own last setting, and the folder the game
  // was mounting until a moment ago
  let moved = 0;
  const from = new Set([settings.get('langSuffix'), mounted].filter((s) => s && s !== LANG_FOLDER));
  for (const old of from) moved += moveLangFolder(game, old, LANG_FOLDER);
  if (moved) {
    langMigration = { from: [...from][0], to: LANG_FOLDER, moved };
    diag(`mods moved into dota_${LANG_FOLDER}: ${moved} files from ${[...from].join(', ')}`);
  }
  settings.set('langSuffix', LANG_FOLDER);
}

/* Whatever the user asked of the voices, applied to what is on disk now.
 *
 * Run on every launch, not only when the switch is touched: verifying the game files through
 * Steam hands Valve's voice pack back without telling anyone, and the answer to "I want
 * English voices" should not quietly expire because somebody checked their install.
 */
function applyVoicePreference() {
  const game = settings.get('dotaGamePath');
  if (!game) return 'absent';
  try {
    return gamelang.setVoiceEnabled(game, LANG_FOLDER, !settings.get('englishVoices'));
  } catch (err) {
    // Dota holds its paks open, so a running game means we try again next launch
    diag('voice pack not switched: ' + err.message);
    return gamelang.voiceState(game, LANG_FOLDER);
  }
}

/* Put back what Steam's file check took away.
 *
 * Only fonts and cursors can be taken: they overwrite files Valve ships. What can be restored
 * from what the app already holds is restored without a word - it is the state the user asked
 * for, and they did not ask Steam to undo it. What would need downloading is left alone and
 * reported instead: starting a download at launch because a file changed is not something to
 * do behind somebody's back.
 */
function restoreAfterVerify() {
  const lost = installer.lostToVerify(library.list());
  if (!lost.length) return 0;
  const stuck = [];
  let restored = 0;
  for (const rec of lost) {
    try {
      const from = installer.restoreDeployed(rec);
      if (from) { restored++; diag(`restored after verify: ${rec.name} (from ${from})`); }
      else stuck.push({ id: rec.id, name: rec.name });
    } catch (err) {
      diag(`restore failed for ${rec.name}: ${err.message}`);
      stuck.push({ id: rec.id, name: rec.name });
    }
  }
  verifyStuck = stuck;
  return restored;
}

/* Everything the app puts back after the game changed underneath it.
 *
 * Not one line of the repair itself is new: heal() re-applies the search-path patch and
 * rebuilds the item schema, restoreAfterVerify() puts fonts and cursors back, and
 * applyVoicePreference() re-applies the voice choice. What 4.1 adds is when this runs and
 * that somebody hears about it - before, it happened at startup and on our own Play button,
 * while Steam patches the game in the background and most people press Play in Steam.
 *
 * Nothing is written while Dota is running. It holds gameinfo and its paks open, so a write
 * would half-succeed, and the client has already read the files anyway. The app says it is
 * waiting and tries again after the game exits.
 */
const REPAIR_RETRY_MS = 20000;

function setPatchRepair(next) {
  patchRepair = next;
  if (win && !win.isDestroyed()) win.webContents.send('patch-repair', patchRepair);
}

async function repairAfterPatch(reason) {
  const game = settings.get('dotaGamePath');
  if (!game) return;
  clearTimeout(repairTimer);
  repairTimer = null;

  if (await dotaIsRunning()) {
    diag('Dota patched while the game is running - repair deferred');
    setPatchRepair({ state: 'waiting', reason, at: Date.now() });
    repairTimer = setTimeout(() => { repairAfterPatch(reason); }, REPAIR_RETRY_MS);
    return;
  }

  const healed = [];
  let error = null;
  try {
    const res = schemaService.heal();
    if (res.healed) healed.push(...res.healed);
    if (res.error) error = res.error;
  } catch (err) {
    error = String(err.message || err);
  }
  try {
    if (restoreAfterVerify()) healed.push('files');
  } catch (err) {
    diag('restore after verify skipped: ' + err.message);
  }
  try {
    applyVoicePreference();
  } catch (err) {
    diag('voice preference skipped: ' + err.message);
  }

  // remembered only now: a stamp stored before a failed repair would make the next start
  // think there is nothing to fix
  settings.set('gameStamp', gameStamp(game));
  diag(`repair after patch: ${healed.join(',') || 'nothing to do'}${error ? ' error=' + error : ''}`);
  setPatchRepair({ state: error ? 'failed' : 'done', healed, error, at: Date.now() });
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

  // What changed in the version now running. The app updates itself in the background, so
  // without this a user is simply handed a different app one day and has to guess what
  // moved — which is exactly what people ask about in Discord.
  ipcMain.handle('app:notes', (e, lang) => {
    const version = app.getVersion();
    const seen = settings.get('lastSeenVersion');
    return { version, notes: releaseNotes(version, lang), unseen: !!seen && seen !== version };
  });

  ipcMain.handle('app:notesSeen', () => {
    settings.set('lastSeenVersion', app.getVersion());
    return { ok: true };
  });

  // ----- UI scale ----- (the renderer applies it; this only remembers it)
  ipcMain.handle('ui:setZoom', (e, factor) => {
    const z = clampZoom(factor);
    settings.set('uiScale', z);
    return { ok: true, uiScale: z };
  });

  // ----- settings -----
  ipcMain.handle('settings:get', () => {
    const game = settings.get('dotaGamePath');
    let minifyDetected = false;
    try { minifyDetected = !!game && fs.existsSync(path.join(game, 'dota_minify')); } catch { /* ignore */ }
    const folders = gamelang.langFolders(game);
    const migrated = langMigration;
    langMigration = null; // reported once
    return {
      ...settings.all(),
      dotaPathValid: validateGamePath(game),
      minifyDetected,
      discordConfigured: discordAuth.isConfigured(),
      // What is left of the language question, now that the folder is always dota_russian:
      // whether the game agrees, and whether any mods are stranded outside it. Both are
      // things to tell the user about, not things to ask them.
      gameLang: {
        mounted: game ? gamelang.detectLangSuffix(game).suffix : null,
        folder: LANG_FOLDER,
        // mods sitting in a folder the game does not mount
        stranded: folders.filter((f) => f.suffix !== LANG_FOLDER && f.modFiles > 0)
          .map((f) => ({ suffix: f.suffix, modFiles: f.modFiles })),
      },
      langMigration: migrated,
    };
  });

  ipcMain.handle('settings:set', (e, key, value) => {
    // keep main-process strings (dialogs, errors) in sync with the UI language
    if (key === 'uiLang') i18n.setLang(value);
    settings.set(key, value);
    // the status text is localized, so a language change has to redraw it too
    if (key === 'discordPresence' || key === 'uiLang') applyPresenceSetting();
    return settings.all();
  });

  // ----- Discord presence -----
  // the renderer tells us which tab is open; everything else comes from the library
  ipcMain.handle('presence:view', (e, view) => {
    presenceView = typeof view === 'string' ? view : 'catalog';
    refreshPresence();
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

  // ----- English voices (Valve's pak01 in or out of the mount) -----
  ipcMain.handle('voice:state', () => {
    const game = settings.get('dotaGamePath');
    return {
      state: game ? gamelang.voiceState(game, LANG_FOLDER) : 'absent',
      english: !!settings.get('englishVoices'),
    };
  });

  ipcMain.handle('voice:setEnabled', async (e, english) => {
    const stop = blocked('voice');
    if (stop) return stop;
    const game = settings.get('dotaGamePath');
    if (!game) return { error: t('Путь к Dota 2 не задан') };
    if (await dotaIsRunning()) return { error: t('Сначала закрой Dota 2 — она держит файлы озвучки открытыми') };
    settings.set('englishVoices', !!english);
    try {
      return { state: gamelang.setVoiceEnabled(game, LANG_FOLDER, !english), english: !!english };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  // rescue mods sitting in a folder the game does not mount (our old dota_123, another
  // tool's dota_minify, or whatever the audio language used to be)
  ipcMain.handle('settings:moveLangFiles', (e, fromSuffix) => {
    const game = settings.get('dotaGamePath');
    if (!game) return { error: t('Путь к Dota 2 не задан') };
    const moved = moveLangFolder(game, String(fromSuffix || ''), LANG_FOLDER);
    return { moved, to: LANG_FOLDER };
  });

  ipcMain.handle('settings:detectDota', async () => {
    const found = await findDotaGamePath();
    if (found) {
      settings.set('dotaGamePath', found);
      // the watcher is holding handles on the folder that was current a moment ago
      if (patchWatcher) patchWatcher.rearm();
    }
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
    if (patchWatcher) patchWatcher.rearm();
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
    const stop = blocked('install');
    if (stop) return stop;
    try {
      const existing = library.findByKey(payload.categoryId, payload.name, payload.styleLabel);
      if (existing) return { error: t('Уже установлено'), already: true };
      // a cursor set is written straight over the one in resource\cursor, so the set that
      // is on has to step aside first — otherwise its files are gone with no way back
      const replaced = payload.categoryId === 'cursors' ? disableOtherCursors(null) : [];
      const files = await installer.install({
        categoryId: payload.categoryId,
        modName: payload.name,
        fileRef: payload.fileRef,
      });
      const rec = library.add({ ...payload, files });
      // lift any item-schema changes out of the mod and rebuild the schema pak
      const harvest = schemaService.harvest(rec);
      if (harvest && harvest.deltas) schemaService.refresh();
      // keep the set's own copy, so it can be switched back on later without a re-download
      if (payload.categoryId === 'cursors') { try { installer.ensureCursorStore(rec.id, files); } catch { /* noop */ } }
      // installed while the master switch is off? sweep the fresh file off too, so the
      // library state stays consistent (all mods off) until the user turns them back on.
      if (installer.masterIsOff()) {
        try { installer.setMasterEnabled(false); } catch { /* noop */ }
        applyMasterToCursors(false);
      }
      sendProgress({ type: 'done', label: payload.name });
      return { ok: true, record: rec, replaced };
    } catch (err) {
      sendProgress({ type: 'error', label: payload.name, message: String(err.message || err) });
      return { error: String(err.message || err) };
    }
  });

  ipcMain.handle('mods:exportSingle', async (e, id) => {
    const rec = library.find(id);
    if (!rec) return { error: t('Мод не найден') };
    try {
      // a cursor set is loose files, not a pak — it travels as the zip the catalog uses
      const cursor = isCursorRecord(rec);
      const buf = cursor ? installer.cursorZip(rec) : installer.mergeToSingleVpk(rec, rec.schema);
      const safe = rec.name.replace(/[<>:"/\\|?*]/g, '_') || 'mod';
      const res = await dialog.showSaveDialog(win, {
        title: cursor ? t('Сохранить курсор архивом') : t('Сохранить мод одним .vpk файлом'),
        defaultPath: `${safe}.${cursor ? 'zip' : 'vpk'}`,
        filters: [cursor
          ? { name: t('Архив курсора'), extensions: ['zip'] }
          : { name: t('VPK мод'), extensions: ['vpk'] }],
      });
      if (res.canceled || !res.filePath) return { cancelled: true };
      fs.writeFileSync(res.filePath, buf);
      return { ok: true, path: res.filePath, size: buf.length };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  // The other half of "pack a folder": hand the author back the files themselves, so a mod
  // can be opened, changed and dropped in again without any other tool.
  ipcMain.handle('mods:unpackToFolder', async (e, id) => {
    const rec = library.find(id);
    if (!rec) return { error: t('Мод не найден') };
    try {
      const res = await dialog.showOpenDialog(win, {
        title: t('Куда распаковать мод'),
        properties: ['openDirectory', 'createDirectory'],
      });
      if (res.canceled || !res.filePaths.length) return { cancelled: true };
      const safe = rec.name.replace(/[<>:"/\\|?*]/g, '_') || 'mod';
      const dest = path.join(res.filePaths[0], safe);
      fs.mkdirSync(dest, { recursive: true });
      const out = installer.unpackToFolder(rec, dest);
      return { ok: true, path: dest, ...out };
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
    // fingerprint -> a mod already in the library, so a file that is byte-identical to
    // something managed can be called what it is (a leftover copy) instead of a mystery
    const installedFps = new Map();
    try {
      for (const rec of library.list()) {
        if (rec.kind === 'pack') continue;
        const a = installer.analyzeRecord(rec);
        if (a && a.fp && !installedFps.has(a.fp)) installedFps.set(a.fp, rec.name);
      }
    } catch { /* no game path — nothing to compare against */ }
    try {
      const known = library.knownFiles();
      const canMatch = fingerprints.hasData();
      external = installer.externalFiles(known, { scanExtras: canMatch });
      for (const f of external) {
        if (!f.fp) continue;
        f.match = fingerprints.match(f.fp); // recognise catalog mods
        if (installedFps.has(f.fp)) f.duplicateOf = installedFps.get(f.fp);
      }
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
        // fpOriginal: the file was repacked to drop the whole-game tables it shipped, so
        // match on what it hashed to before that, or a recognised mod becomes unknown
        const matches = fingerprints.match(rec.fpOriginal || a.fp);
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
    // Who is quietly covering whom. Both lists take part: a foreign file in the folder is
    // mounted by the game exactly like a managed one, so leaving it out would name the wrong
    // winner. Only switched-on mods, because a switched-off one is renamed and never mounted.
    let covered = new Map();
    try {
      const live = [
        ...installed.filter((r) => r.enabled).map((r) => ({ key: r.id, name: r.name, files: r.files })),
        ...external.filter((f) => f.enabled).map((f) => ({ key: f.key, name: f.name, files: f.files })),
      ];
      covered = installer.coverage(live);
    } catch { /* no game path — nothing is mounted, nothing covers anything */ }
    external = external.map((f) => (covered.has(f.key) ? { ...f, coveredBy: covered.get(f.key) } : f));

    let slots = 0;
    try { slots = installer.usedModSlots(); } catch { /* no game path */ }
    // the renderer re-lists after every install, toggle, preset and bulk action, so this is
    // the one place that keeps the Discord status honest without hooking a dozen handlers
    refreshPresence();
    // The lifted item blocks are only ever needed in the main process; the renderer just
    // shows that a mod has them, and whether the patch that makes them work is on. Copies,
    // never the stored records — dropping the field off those would erase it on save.
    const schemaOn = schemaService.state().enabled;
    const listed = installed.map((rec) => {
      const by = covered.get(rec.id);
      if (!Array.isArray(rec.schema)) return by ? { ...rec, coveredBy: by } : rec;
      const { schema, ...rest } = rec;
      return { ...rest, schemaCount: schema.length, schemaLive: schemaOn, ...(by ? { coveredBy: by } : {}) };
    });
    return { installed: listed, external, slots, slotCeil: 98, verifyStuck };
  });

  // ----- launch + master mods switch -----

  // Launch Dota via Steam so the user's own launch options apply (-novid, -fps max,
  // -language russian … differ per user). rungameid mirrors clicking Play in Steam.
  ipcMain.handle('game:launch', () => {
    // a Dota update wipes the search-path patch and moves the item table underneath our
    // build: the launch button is the last chance to notice before the game starts
    schemaService.heal();
    shell.openExternal('steam://rungameid/570');
    return { ok: true };
  });

  // ---------- item schema / search-path patch ----------

  // ----- what the app was told from the network -----

  // A switch is honoured here rather than in the renderer: this is the boundary an old
  // window, a stale screen or a replayed click all have to come through.
  const uiLang = () => (settings.get('uiLang') === 'ru' ? 'ru' : 'en');
  const blocked = (name) => {
    const f = remoteConfig.feature(name, uiLang());
    return f.off ? { error: f.note || t('Эта возможность временно отключена') } : null;
  };

  ipcMain.handle('config:state', () => ({
    features: Object.fromEntries(remoteConfig.SWITCHABLE.map((n) => [n, remoteConfig.feature(n, uiLang())])),
    notices: remoteConfig.notices(uiLang()),
    seen: settings.get('seenNotices') || [],
  }));

  ipcMain.handle('config:noticeSeen', (e, id) => {
    const seen = new Set(settings.get('seenNotices') || []);
    seen.add(String(id));
    // an id list that only grows is a settings file that only grows
    settings.set('seenNotices', [...seen].slice(-50));
    return [...seen];
  });

  ipcMain.handle('patch:state', () => schemaService.state());

  // what the app did about the last Dota patch (the banner in My mods asks on every visit;
  // while the app is open it is pushed instead, see setPatchRepair)
  ipcMain.handle('patch:repairState', () => patchRepair);
  // "I closed the game, do it now" — the same path the retry timer takes
  ipcMain.handle('patch:repairNow', async () => {
    await repairAfterPatch('manual');
    return patchRepair;
  });
  // the banner is news, not a state of the game: once it has been read it goes away
  ipcMain.handle('patch:repairSeen', () => {
    if (patchRepair.state === 'done' || patchRepair.state === 'failed') patchRepair = { state: 'idle' };
    return patchRepair;
  });

  // The one moment the app touches files of the game install: gated on an explicit yes,
  // reversible from the same switch, and every original is backed up in userData first.
  ipcMain.handle('patch:setEnabled', async (e, enabled) => {
    // turning it OFF is always allowed: a switch that traps people in the state it broke is
    // worse than the problem it was flipped for
    if (enabled) { const stop = blocked('cosmetics'); if (stop) return stop; }
    if (!settings.get('dotaGamePath')) return { error: t('Путь к Dota 2 не задан') };
    // the game holds gameinfo open while it runs, so writing it would fail half-way
    if (await dotaIsRunning()) return { error: t('Закрой Dota 2 перед изменением файлов игры') };
    try {
      return schemaService.setEnabled(!!enabled);
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  ipcMain.handle('schema:refresh', () => schemaService.refresh());

  // Free cosmetics are generated from the installed game's own schema, so a weather or
  // courier Valve ships later appears in the list without an app update.
  ipcMain.handle('cosmetics:slots', () => schemaService.cosmeticSlots());

  // One picture per tile, so opening a slot with 2000 items costs only what is on screen.
  //
  // A tile asks with a chain of sources, best first ("modart:pak54_dir.vpk|hero:Brewmaster"),
  // and gets back the first one that has a picture. That is how "the mod's own art beats the
  // wiki's portrait of the vanilla hero, but a raw model texture does not" stays written down
  // in one place - renderer/ui/thumb.js, which composes the chain - instead of being spread
  // across three. A plain name is simply a chain of one, which is what the picker sends.
  //
  // Sources: the mod's own files and the game's own pictures when the toolchain is here
  // (exact, offline, no rate limit), the wiki for whatever is left.
  ipcMain.handle('cosmetics:icons', async (e, names) => {
    const wanted = (Array.isArray(names) ? names : []).slice(0, 60);
    const chains = new Map(wanted.map((n) => [n, String(n).split('|').filter(Boolean)]));
    const sources = [...new Set([...chains.values()].flat())];

    const isMod = (s) => s.startsWith(modPreviews.VID) || s.startsWith(modPreviews.ART) || s.startsWith(modPreviews.TEX);
    const found = {};
    try {
      Object.assign(found, await modPreviews.getMany(sources.filter(isMod)));
    } catch (err) {
      diag('mod previews failed, falling back to the usual pictures: ' + err.message);
    }
    const forIcons = sources.filter((s) => !isMod(s) && !found[s]);
    if (forIcons.length) {
      let fromGame = {};
      try {
        fromGame = await gameIcons.getMany(forIcons);
      } catch (err) {
        diag('game icons failed, falling back to the wiki: ' + err.message);
      }
      const left = forIcons.filter((n) => !fromGame[n]);
      Object.assign(found, left.length ? await icons.getMany(left) : {}, fromGame);
    }

    const pictures = {};
    for (const [key, chain] of chains) {
      const hit = chain.find((s) => found[s]);
      if (hit) pictures[key] = found[hit];
    }
    // A clip beats everything else a mod can be pictured by, but only the window can open
    // one. So the answer also says where a frame is still worth taking: the tile shows
    // whatever was found meanwhile, and swaps it for the frame when that arrives.
    const decode = new Set();
    for (const [, chain] of chains) {
      const clip = chain.find((s) => s.startsWith(modPreviews.VID));
      if (clip && !found[clip] && modPreviews.hasVideo(clip)) decode.add(clip);
    }
    return { pictures, decode: [...decode] };
  });

  // A mod that replaces a hero's animated portrait carries its own showcase, and a still out
  // of it is the best picture of that mod there is. Decoding video is the window's job - the
  // app is a browser and already has the decoder - so the bytes go there and the frame comes
  // back to be judged and kept. That is why no ffmpeg is downloaded for this.
  ipcMain.handle('preview:video', (e, key) => {
    try {
      const got = modPreviews.videoBytes(String(key || ''));
      return got ? got.bytes : null;
    } catch (err) {
      diag('mod preview video failed: ' + err.message);
      return null;
    }
  });

  ipcMain.handle('preview:frame', (e, key, png) => {
    try {
      return modPreviews.saveFrame(String(key || ''), Buffer.from(png || []));
    } catch (err) {
      diag('mod preview frame failed: ' + err.message);
      return null;
    }
  });

  // ----- the Source 2 toolchain (Settings shows this) -----
  ipcMain.handle('tools:state', () => ({ tools: toolchain.state(), iconCacheBytes: gameIcons.size() + modPreviews.size() }));

  ipcMain.handle('tools:install', async (e, name) => {
    try {
      await toolchain.ensure(String(name || 'vrf'));
      return { ok: true, tools: toolchain.state() };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  ipcMain.handle('tools:remove', (e, name) => {
    toolchain.remove(String(name || 'vrf'));
    // the pictures it produced are only reachable through it
    gameIcons.clear();
    modPreviews.clear();
    return { ok: true, tools: toolchain.state() };
  });

  // A pick is a library record like any other mod: mods:setEnabled/mods:remove already
  // handle it (see touchesSchema above), this is only for the initial choice.
  ipcMain.handle('cosmetics:pick', (e, slot, itemId, itemName) => {
    const stop = blocked('cosmetics');
    if (stop) return stop;
    try {
      const rec = schemaService.pickCosmetic(slot, itemId, itemName);
      return { ok: true, record: rec };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  ipcMain.handle('mods:masterState', () => {
    try { return { off: installer.masterIsOff() }; } catch { return { off: false }; }
  });

  ipcMain.handle('mods:setMaster', (e, enabled) => {
    try {
      const r = installer.setMasterEnabled(!!enabled);
      applyMasterToCursors(!!enabled);
      refreshPresence();
      return { ok: true, ...r };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  ipcMain.handle('mods:setEnabled', (e, id, enabled) => {
    const rec = library.find(id);
    if (!rec) return { error: t('Мод не найден') };
    try {
      // only one cursor set — and only one look per cosmetic slot — can be live at a time
      const replaced = enabled && isCursorRecord(rec) ? disableOtherCursors(id)
        : enabled && rec.categoryId === 'cosmetic' ? disableOtherCosmetics(rec)
          : [];
      installer.setEnabled(rec.files, enabled, rec.id);
      library.setEnabled(id, enabled);
      if (touchesSchema(rec)) schemaService.refresh();
      return { ok: true, replaced };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  ipcMain.handle('mods:remove', (e, id) => {
    const rec = library.find(id);
    if (!rec) return { error: t('Мод не найден') };
    try {
      if (rec.kind === 'pack') installer.removePackFully(rec);
      else installer.remove(rec.files, { recId: rec.id, deployed: rec.enabled !== false });
      library.removeRecord(id);
      if (touchesSchema(rec)) schemaService.refresh();
      return { ok: true };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  /**
   * Move a mod one step through the load order. The game mounts pakNN_dir.vpk in numeric
   * order and the first copy of a file wins, so the pak number IS the priority - stepping
   * up means trading slots with the mod directly above.
   *
   * This is the whole ordering story now. The app used to work out who covered whom by
   * comparing what every mod ships and then offer to fix it, which was wrong often enough
   * to be worse than useless: mods that merely share a stock file are not fighting, and no
   * amount of filtering told the two cases apart reliably. Which mod wins is a decision
   * only the person looking at the game can make.
   */
  ipcMain.handle('mods:move', (e, id, dir) => {
    const rec = library.find(id);
    if (!rec) return { error: t('Мод не найден') };
    try {
      const ordered = library.list()
        .map((r) => ({ r, n: installer.slotNumber(r) }))
        .filter((x) => x.n != null)
        .sort((a, b) => a.n - b.n);
      const at = ordered.findIndex((x) => x.r.id === id);
      if (at === -1) return { error: t('У мода нет слота pakNN') };
      const to = at + (dir < 0 ? -1 : 1);
      if (to < 0 || to >= ordered.length) return { ok: true, moved: 0 };
      const other = ordered[to].r;
      for (const m of installer.swapSlots(rec, other)) library.update(m.id, { files: m.files });
      return { ok: true, moved: 1, with: other.name };
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
      const lang = installer.langFolder();
      const base = fileName.replace(/\.off$/i, '');
      // the index alone leaves its data volumes behind as orphans the app then lists as
      // more foreign files — take the whole set, in whatever on/off state each part is in
      for (const rel of [base, ...installer.siblingParts(base)]) {
        for (const suf of ['', '.off']) {
          const abs = path.join(lang, rel + suf);
          if (fs.existsSync(abs)) fs.rmSync(abs, { force: true });
        }
      }
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
      if (!rec.files.some((f) => f.root === 'lang' && /_dir\.vpk$/i.test(f.relPath))) {
        return { error: t('Нет _dir.vpk для разбора') };
      }
      // the service splits the files AND hands each part the item blocks that belong to it
      const parts = schemaService.split(rec);
      if (!parts || !parts.length) return { error: t('В файле меньше двух героев — разбирать нечего') };
      if (parts.some((p) => Array.isArray(p.schema) && p.schema.length)) schemaService.refresh();
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

  /**
   * Take a file someone dropped into the game folder by hand into the library.
   *
   * Recognised as a catalog mod, it joins under that identity (preview, category, updates).
   * Unrecognised, it still joins — as an import named after its content, exactly what
   * dragging the same file onto the app would have produced. Refusing everything the
   * fingerprint list had never seen is what left users with a nameless "external file" row
   * and no way out of it; the catalog is a nice-to-have, not the price of admission.
   */
  ipcMain.handle('mods:adoptExternal', (e, fileName, preview) => {
    try {
      const lang = installer.langFolder();
      const base = fileName.replace(/\.off$/i, '');
      const onDisk = ['', '.off'].map((s) => path.join(lang, base + s)).find((p) => fs.existsSync(p));
      if (!onDisk) return { error: t('Файл не найден в папке модов') };

      const { fingerprintVpk, readVpkIndexFile } = require('./src/vpk');
      let matches = null;
      try { matches = fingerprints.match(fingerprintVpk(readVpkIndexFile(onDisk))); } catch { /* not a readable index */ }

      // the _dir.vpk plus any sibling data archives (<base>_NNN.vpk) — one mod, several files
      const files = [{ root: 'lang', relPath: base }];
      for (const part of installer.siblingParts(base)) files.push({ root: 'lang', relPath: part });

      const m = matches && matches[0]; // identical-content entries are interchangeable
      const identity = m
        ? { name: m.name, categoryId: m.categoryId, styleLabel: m.styleLabel || null, preview: preview || null }
        : { name: installer.displayNameForFile(base) || base.replace(/_dir\.vpk$/i, ''), categoryId: 'imported', styleLabel: null, preview: null };
      const rec = library.add({ ...identity, fileRef: fileName, files });
      // A file dropped into the folder by something else has never been through an install,
      // so its item blocks are still sitting inside it doing nothing. Adopting is the moment
      // the app takes it over - lift them now, or the mod stays without its effects.
      const harvest = schemaService.harvest(rec);
      if (harvest && harvest.deltas) schemaService.refresh();
      // a file that arrived switched off keeps that state, the way an imported mod would not
      if (/\.off$/i.test(fileName)) library.setEnabled(rec.id, false);
      return { ok: true, name: identity.name, matched: !!m };
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
      const rec = library.add({ name: m.name, categoryId: m.categoryId, styleLabel: m.styleLabel || null, fileRef: m.name, preview: preview || null, files: rels.map((rp) => ({ root: 'cursor', relPath: rp })) });
      // the set is on disk but not ours yet — keep a copy so it can be switched off and on
      try { installer.ensureCursorStore(rec.id, rec.files); } catch { /* noop */ }
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
    return Promise.all(library.listPresets().map(async (p) => {
      // a received preset shows what installing it would cost before anything downloads
      if (p.wanted) return { ...p, status: await sharedPresetStatus(p, cat).catch(() => null) };
      // an own preset says how much of it a link could carry, so the button can explain
      // itself instead of quietly disappearing
      const { mods, skipped } = presetLinkMods(p, cat);
      return { ...p, link: { count: mods.length, skipped } };
    }));
  });
  ipcMain.handle('presets:save', (e, name) => {
    library.savePreset(name);
    return library.listPresets();
  });
  // overwrite a preset with the current on/off state — the "save" the user actually means
  // when they have tweaked a build they already named
  ipcMain.handle('presets:update', (e, id) => {
    const p = library.updatePresetMods(id);
    if (!p) return { error: t('Пресет не найден') };
    return { ok: true, count: p.modIds.length };
  });

  ipcMain.handle('presets:rename', (e, id, name) => {
    const clean = String(name || '').trim().slice(0, 120);
    if (!clean) return { error: t('Введи название пресета') };
    if (!library.updatePreset(id, { name: clean })) return { error: t('Пресет не найден') };
    return { ok: true, name: clean };
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
      const { mods, skipped } = presetLinkMods(preset, await catalogIndex());
      if (!mods.length) return { error: t('В пресете только свои моды — ссылка их не донесёт, отправь файлом') };
      const account = settings.get('account');
      const link = encodePresetLink({ name: preset.name, author: account && account.username, mods });
      return { ok: true, ...link, count: mods.length, skipped };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

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
    let schemaTouched = false;

    // -> ids of the library records that now provide this mod (a multi-hero bundle splits
    // into several), or an empty list when it could not be resolved at all
    const resolveEntry = async (entry) => {
      try {
        if (entry.kind === 'catalog') {
          const have = library.findByKey(entry.categoryId, entry.name, entry.styleLabel);
          if (have) return [have.id];
          const hit = cat.lookup(entry.categoryId, entry.name, entry.styleLabel);
          if (!hit) { errors.push(`${entry.name}: ${t('нет в каталоге')}`); return []; }
          if (hit.categoryId === 'cursors') disableOtherCursors(null); // one cursor at a time
          const files = await installer.install({ categoryId: hit.categoryId, modName: hit.name, fileRef: hit.fileRef });
          const rec = library.add({
            categoryId: hit.categoryId, name: hit.name, styleLabel: hit.styleLabel,
            fileRef: hit.fileRef, preview: hit.preview, files,
          });
          if (hit.categoryId === 'cursors') { try { installer.ensureCursorStore(rec.id, files); } catch { /* noop */ } }
          return [rec.id];
        }
        if (entry.kind === 'embedded') {
          if (entry.fp && fpIndex.has(entry.fp)) return [fpIndex.get(entry.fp)]; // already on disk
          if (!bundle) { errors.push(`${entry.name}: ${t('файл пресета недоступен')}`); return []; }
          sendProgress({ type: 'stage', label: entry.name, stage: t('установка') });
          const files = installer.installVpkBuffer(bundle.readMod(entry.file));
          // exactly the treatment a dragged-in file gets: the sender's item blocks lifted
          // out, a multi-hero bundle split, a name from the content when theirs is a slot
          const { records, schema } = adoptImportedFiles({ files, name: entry.name, fileRef: null });
          if (schema) schemaTouched = true;
          if (entry.fp && records.length === 1) fpIndex.set(entry.fp, records[0].id);
          return records.map((r) => r.id);
        }
        if (entry.kind === 'cosmetic') {
          const rec = schemaService.pickCosmetic(entry.slot, entry.itemId, entry.name);
          return rec ? [rec.id] : [];
        }
        errors.push(`${entry.name}: ${entry.reason || t('нет в файле')}`);
        return [];
      } catch (err) {
        errors.push(`${entry.name}: ${String(err.message || err)}`);
        return [];
      }
    };

    const ids = [];
    for (const entry of preset.wanted) {
      if (entry.kind === 'pack') {
        const memberIds = [];
        for (const m of entry.members) memberIds.push(...await resolveEntry(m));
        const built = packFromRecords(entry.name, memberIds);
        if (built) ids.push(built.id); else ids.push(...memberIds);
      } else {
        ids.push(...await resolveEntry(entry));
      }
    }

    preset.modIds = [...new Set(ids)];
    delete preset.wanted;                       // resolved: it's an ordinary preset now
    if (preset.source) preset.source.file = null;
    library.save();
    if (stash) { try { fs.rmSync(stash, { force: true }); } catch { /* noop */ } }

    errors.push(...applyPreset(preset));
    // a mod that arrived already enabled never passes through applyPreset's own switch, so
    // its freshly lifted blocks would sit in the library without ever reaching the build
    if (schemaTouched) schemaService.refresh();
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

  // ----- diagnostics -----
  // fire-and-forget: a renderer crash it can't recover from still lands in the log a support
  // report is built from, instead of vanishing with the window
  ipcMain.on('diag:rendererError', (e, msg) => diag('renderer: ' + String(msg || '').slice(0, 2000)));

  ipcMain.handle('diag:export', async () => {
    try {
      const { report, files } = buildReport({
        settings, library, installer, schemaService, catalog, icons,
        app: { version: app.getVersion(), logFile: logFile() },
      });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const res = await dialog.showSaveDialog(win, {
        title: t('Сохранить отчёт для поддержки'),
        defaultPath: `dota2-mod-manager-diag-${stamp}.zip`,
        filters: [{ name: t('Отчёт диагностики'), extensions: ['zip'] }],
      });
      if (res.canceled || !res.filePath) return { cancelled: true };
      const zip = new AdmZip();
      zip.addFile('report.json', Buffer.from(JSON.stringify(report, null, 2)));
      for (const [name, text] of Object.entries(files)) zip.addFile(name, Buffer.from(text, 'utf-8'));
      try { zip.addFile('manifest.json', fs.readFileSync(library.file)); } catch { /* nothing installed yet */ }
      fs.writeFileSync(res.filePath, zip.toBuffer());
      shell.showItemInFolder(res.filePath);
      return { ok: true, path: res.filePath };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });
}
