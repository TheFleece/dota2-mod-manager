/* The wire between the window and the process behind it, checked as a contract.
 *
 * There are three sides to every channel and nothing made them agree: preload.js says what the
 * renderer may call, some module in src/ registers the handler, and the screens call through
 * whatever name preload happens to expose. Get any two out of step and the failure is a
 * TypeError at the moment somebody clicks, which is exactly where nobody is looking.
 *
 * It has already cost time twice. Splitting registerIpc out of main.js gave one module the
 * window as a value rather than a getter, so win:isMaximized threw on its first call; and a
 * probe written against `api.schema.refresh` - a name preload does not have - looked like a
 * regression for several minutes because a renderer-side TypeError and a main-side handler
 * failure read almost the same.
 *
 * So: every channel the renderer can reach has a handler, every handler is reachable, and no
 * channel is registered twice. None of this needs the app running.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Files that register handlers: main.js and everything it hands the job to. */
const HANDLER_FILES = [
  'main.js',
  ...fs.readdirSync(path.join(ROOT, 'src'))
    .filter((f) => f.startsWith('ipc-') && f.endsWith('.js'))
    .map((f) => `src/${f}`),
  'src/uninstall-window.js',
];

const CHANNEL = /['"]([a-z][a-zA-Z]*:[a-zA-Z]+)['"]/;

/** Every channel name passed to ipcMain.handle or ipcMain.on, with the file it came from. */
function handlers() {
  const found = new Map();
  const dupes = [];
  for (const file of HANDLER_FILES) {
    for (const m of read(file).matchAll(/ipcMain\.(?:handle|on)\(\s*([^,)]+)/g)) {
      const name = (m[1].match(CHANNEL) || [])[1];
      if (!name) continue;
      if (found.has(name)) dupes.push({ name, first: found.get(name), again: file });
      else found.set(name, file);
    }
  }
  return { found, dupes };
}

/** Every channel the renderer can reach through the preload bridge. */
function exposed() {
  const out = new Map();
  const src = read('preload.js');
  for (const m of src.matchAll(/ipcRenderer\.(?:invoke|send)\(\s*([^,)]+)/g)) {
    const name = (m[1].match(CHANNEL) || [])[1];
    if (name) out.set(name, 'preload.js');
  }
  // the uninstall window has a bridge of its own
  for (const m of read('preload-uninstall.js').matchAll(/ipcRenderer\.(?:invoke|send)\(\s*([^,)]+)/g)) {
    const name = (m[1].match(CHANNEL) || [])[1];
    if (name) out.set(name, 'preload-uninstall.js');
  }
  return out;
}

/* Channels the main process pushes to the window rather than answering. They are sent with
 * webContents.send and listened for with ipcRenderer.on, so neither side above sees them. */
const PUSH_ONLY = new Set(
  [...read('preload.js').matchAll(/ipcRenderer\.on\(\s*['"]([a-z][\w-]*)['"]/g)].map((m) => m[1]),
);

test('every channel the renderer can call has a handler behind it', () => {
  const { found } = handlers();
  const gaps = [...exposed()].filter(([name]) => !found.has(name));
  assert.deepEqual(gaps, [], gaps.length
    ? `exposed with nothing to answer: ${gaps.map(([n, f]) => `${n} (${f})`).join(', ')}`
    : '');
});

test('every handler is reachable from the renderer', () => {
  /* A handler nothing can call is either dead or a channel somebody forgot to expose, and the
   * second is the expensive one: the feature looks written and does nothing. */
  const { found } = handlers();
  const reach = exposed();
  const orphans = [...found].filter(([name]) => !reach.has(name) && !PUSH_ONLY.has(name));
  assert.deepEqual(orphans, [], orphans.length
    ? `registered but unreachable: ${orphans.map(([n, f]) => `${n} (${f})`).join(', ')}`
    : '');
});

test('no channel is registered twice', () => {
  /* ipcMain.handle throws on a second registration for the same name, so this would be a crash
   * at startup - but only on the path that reaches both, which after the split is easy to miss
   * while moving handlers between files. */
  const { dupes } = handlers();
  assert.deepEqual(dupes, [], dupes.length
    ? dupes.map((d) => `${d.name}: ${d.first} and ${d.again}`).join('; ')
    : '');
});

test('the split left every ipc module wired into main', () => {
  /* A module can be perfect and still never run. Every src/ipc-*.js has to be required and
   * called from main.js, or its whole set of channels quietly does not exist. */
  const main = read('main.js');
  const missing = [];
  for (const file of HANDLER_FILES) {
    if (!file.startsWith('src/ipc-')) continue;
    const base = path.basename(file, '.js');
    const fn = (read(file).match(/^function (register\w+)/m) || [])[1];
    if (!fn) { missing.push(`${file}: no register function`); continue; }
    if (!main.includes(`/${base}`)) missing.push(`${file}: not required by main.js`);
    else if (!new RegExp(`${fn}\\s*\\(`).test(main)) missing.push(`${file}: ${fn} never called`);
  }
  assert.deepEqual(missing, [], missing.join('; '));
});

test('the channels are worth counting, so a silent emptying of this test is visible', () => {
  // If a rename made the regexes match nothing, every assertion above would pass on empty sets.
  const { found } = handlers();
  assert.ok(found.size > 80, `expected 80+ handlers, found ${found.size}`);
  assert.ok(exposed().size > 80, `expected 80+ exposed channels, found ${exposed().size}`);
});
