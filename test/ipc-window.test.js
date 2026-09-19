/* The window and update channels, against a stand-in for Electron.
 *
 * These handlers are registered at startup and used minutes later, so anything they capture at
 * registration is whatever it was before the app had done anything. `win` is handed over as a
 * getter for exactly that reason. `portableUpdate` was not, and the version a portable copy is
 * offered is learned when the update check finds one: the download button answered "no update"
 * every time from 2.3.0 until this was noticed on 2026-09-19.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Module = require('module');

const ROOT = path.resolve(__dirname, '..');

/** Register src/ipc-window.js against a fake Electron, and hand back its channels. */
function register(ctx) {
  const channels = new Map();
  const electron = {
    ipcMain: { handle: (ch, fn) => channels.set(ch, fn), on: (ch, fn) => channels.set(ch, fn) },
    shell: { openExternal: () => {}, openPath: () => {}, showItemInFolder: () => {} },
    app: { getVersion: () => '2.6.12' },
    dialog: {},
    clipboard: { writeText: () => {} },
    nativeImage: { createFromPath: () => ({ isEmpty: () => true }) },
    BrowserWindow: class { static getAllWindows() { return []; } },
  };
  const load = Module._load;
  Module._load = function stubbed(request, ...rest) {
    return request === 'electron' ? electron : load.call(this, request, ...rest);
  };
  try {
    const file = path.join(ROOT, 'src', 'ipc-window.js');
    delete require.cache[require.resolve(file)];
    const { registerWindowIpc } = require(file);
    registerWindowIpc(ctx);
  } finally {
    Module._load = load;
    delete require.cache[require.resolve(path.join(ROOT, 'src', 'ipc-window.js'))];
  }
  return channels;
}

function stand({ portable = true } = {}) {
  const asked = [];
  let version = null; // nothing is known at registration, which is the whole point
  const ctx = {
    IS_PORTABLE: portable,
    autoUpdater: { checkForUpdates: async () => {} },
    clampZoom: () => {},
    diag: () => {},
    portableUpdate: () => version,
    portableUpdater: {
      portableDir: () => path.join(ROOT, 'dist'),
      fetchBeside: async (v) => { asked.push(v); return { name: `Dota-2-Mod-Manager-Portable-${v}.exe`, path: `C:/dl/${v}.exe` }; },
    },
    releaseNotes: () => '',
    sendProgress: () => {},
    settings: { get: () => null, set: () => {} },
    win: () => ({ minimize: () => {}, isMaximized: () => false }),
  };
  return { ctx, asked, found: (v) => { version = v; } };
}

test('the portable download button uses the version the update check found afterwards', async () => {
  const s = stand();
  const channels = register(s.ctx);
  const fetchPortable = channels.get('update:fetchPortable');
  assert.ok(fetchPortable, 'update:fetchPortable is not registered');

  // before the check has found anything: there is nothing to fetch, and the app says so
  const before = await fetchPortable({});
  assert.ok(before.error, 'nothing found yet, so there is nothing to fetch');
  assert.deepEqual(s.asked, []);

  s.found('2.7.0');
  const out = await fetchPortable({});
  assert.deepEqual(s.asked, ['2.7.0'], 'the handler still holds the version it had at registration, which is none');
  assert.equal(out.ok, true);
  assert.match(out.name, /2\.7\.0/);
});

test('an installed build is told this is not a portable copy', async () => {
  const s = stand({ portable: false });
  s.found('2.7.0');
  const channels = register(s.ctx);
  const out = await channels.get('update:fetchPortable')({});
  assert.ok(out.error, 'an installed build has nothing to fetch beside itself');
  assert.deepEqual(s.asked, []);
});

test('revealing a downloaded copy refuses a path that is not the folder we wrote into', async () => {
  const s = stand();
  const channels = register(s.ctx);
  const reveal = channels.get('update:revealPortable');
  assert.ok((await reveal({}, 'C:/somewhere/else/evil.exe')).error, 'a path outside our own folder is refused');
  assert.deepEqual(await reveal({}, path.join(ROOT, 'dist', 'Dota-2-Mod-Manager-Portable.exe')), { ok: true });
});
