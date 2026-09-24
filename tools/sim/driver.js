/**
 * Simulation driver: runs scenarios against the real window, the way a person would, and writes
 * down what they would have seen.
 *
 * The input is real. Pointer moves, clicks and wheel ticks go through sendInputEvent, so hover
 * states, handlers and scrolling behave as they do under a hand; nothing is clicked through the
 * DOM behind the page's back. Coordinates are window pixels, converted from CSS pixels with a
 * ratio measured from the window rather than assumed, because the app scales itself and a
 * profile may force a device scale factor on top.
 *
 * Every scenario writes checks (a name, whether it held, and why not) and pictures, and the run
 * ends with results.json beside them: the machine it ran on as the GPU process describes it, the
 * window and the work area it had, and every check. tools/sim/run.mjs reads that file.
 *
 * Dev-only. main.js loads this only when MM_SIM is set, and it lives under tools/, which the
 * installer does not carry.
 */
const { app, screen } = require('electron');
const fs = require('fs');
const path = require('path');
const { compareFrames, markChanges } = require('./frames');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Sim {
  /**
   * @param {import('electron').BrowserWindow} win
   * @param {{ out: string, scenario?: string }} opts
   */
  constructor(win, { out, scenario = 'run' }) {
    this.win = win;
    this.out = out;
    this.scenario = scenario;
    this.checks = [];
    this.pictures = [];
    this.scale = 1;
    this.x = 20;
    this.y = 20;
    fs.mkdirSync(out, { recursive: true });
  }

  js(expr) { return this.win.webContents.executeJavaScript(expr); }

  /** Polls an expression in the page until it is truthy, and returns its value, or null on timeout. */
  async until(expr, ms = 15000) {
    const end = Date.now() + ms;
    for (;;) {
      const v = await this.js(`(() => { try { return (${expr}); } catch { return null; } })()`);
      if (v) return v;
      if (Date.now() > end) return null;
      await sleep(200);
    }
  }

  /** Whether the page is ready to be used: the catalog drawn, the settings read, no dialog up. */
  async ready() {
    const [cw] = this.win.getContentSize();
    this.scale = cw / (await this.js('window.innerWidth'));
    await this.until(`document.querySelector('.rail-item[data-cat]')`, 30000);
    const blocking = await this.js(`[...document.querySelectorAll('.confirm-overlay, .lang-pick-overlay')].map((d) => d.textContent.trim().slice(0, 80))`);
    this.check('the window opens on the catalog with nothing in front of it', !blocking.length, blocking.join(' | '));
    return { scale: this.scale };
  }

  check(name, ok, detail = '', data) {
    const entry = { scenario: this.scenario, name, ok: Boolean(ok), detail: ok ? '' : String(detail || '') };
    if (data !== undefined) entry.data = data;
    this.checks.push(entry);
    process.stdout.write(`${entry.ok ? 'ok  ' : 'FAIL'} ${this.scenario}: ${name}${entry.ok ? '' : ` - ${entry.detail}`}\n`);
    return entry.ok;
  }

  // ---- input -------------------------------------------------------------------------------

  /** A selector's centre in window pixels, or null. "sel@3" is the third match. */
  async find(spec) {
    const at = /@(\d+)$/.exec(spec);
    const sel = at ? spec.slice(0, -at[0].length) : spec;
    const box = await this.js(`(() => {
      const el = document.querySelectorAll(${JSON.stringify(sel)})[${at ? Number(at[1]) - 1 : 0}];
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return b.width || b.height ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null;
    })()`);
    return box && { x: Math.round(box.x * this.scale), y: Math.round(box.y * this.scale) };
  }

  async move(x, y, steps = 8) {
    for (let i = 1; i <= steps; i++) {
      this.win.webContents.sendInputEvent({
        type: 'mouseMove',
        x: Math.round(this.x + ((x - this.x) * i) / steps),
        y: Math.round(this.y + ((y - this.y) * i) / steps),
      });
      await sleep(12);
    }
    this.x = x;
    this.y = y;
  }

  async click(spec) {
    const p = await this.find(spec);
    if (!p) return false;
    await this.move(p.x, p.y);
    this.win.webContents.sendInputEvent({ type: 'mouseDown', x: p.x, y: p.y, button: 'left', clickCount: 1 });
    await sleep(60);
    this.win.webContents.sendInputEvent({ type: 'mouseUp', x: p.x, y: p.y, button: 'left', clickCount: 1 });
    return true;
  }

  /**
   * Wheel ticks at the pointer, fast: a flick, not a reading pace. dy counts the way the page
   * does, positive down. Chromium's input events count the other way (a wheel rolled away from
   * you is positive and scrolls up), and the first run of this drove eight flicks into the top of
   * the list and compared a page that had not moved.
   */
  async fling(dy, ticks = 8, gap = 16) {
    for (let i = 0; i < ticks; i++) {
      this.win.webContents.sendInputEvent({ type: 'mouseWheel', x: this.x, y: this.y, deltaX: 0, deltaY: -dy, canScroll: true });
      await sleep(gap);
    }
  }

  /** Waits for the pictures on screen to finish loading, then a little more for anything easing in. */
  async settle(ms = 800) {
    await this.until(`[...document.querySelectorAll('img')].filter((i) => {
      const b = i.getBoundingClientRect();
      return b.bottom > 0 && b.top < innerHeight && b.width > 0;
    }).every((i) => i.complete)`, 8000);
    await sleep(ms);
  }

  // ---- pictures ----------------------------------------------------------------------------

  async shot(name) {
    const image = await this.win.webContents.capturePage();
    const file = path.join(this.out, `${this.scenario}-${name}.png`);
    fs.writeFileSync(file, image.toPNG());
    this.pictures.push(path.basename(file));
    return { file, image };
  }

  /**
   * Whether what is on screen is what the page would draw from scratch (see frames.js). A
   * frame, a forced full repaint, a second frame; a difference is kept as a picture with the
   * changed blocks outlined.
   */
  async integrity(name, { limit = 0.002 } = {}) {
    const first = await this.win.webContents.capturePage();
    this.win.webContents.invalidate();
    await sleep(350);
    const second = await this.win.webContents.capturePage();
    const { width, height } = first.getSize();
    const r = compareFrames(first.toBitmap(), second.toBitmap(), width, height);
    const ok = r.cellShare <= limit;
    const data = { cellShare: Number(r.cellShare.toFixed(5)), changedCells: r.changedCells, boxes: r.boxes.slice(0, 5) };
    if (!ok) {
      const { nativeImage } = require('electron');
      const before = path.join(this.out, `${this.scenario}-${name}-on-screen.png`);
      const marked = path.join(this.out, `${this.scenario}-${name}-repainted-marked.png`);
      fs.writeFileSync(before, first.toPNG());
      fs.writeFileSync(marked, nativeImage.createFromBitmap(markChanges(second.toBitmap(), width, height, r.boxes), { width, height }).toPNG());
      this.pictures.push(path.basename(before), path.basename(marked));
    }
    return this.check(`the screen after ${name} is what the page draws from scratch`, ok,
      `${(r.cellShare * 100).toFixed(2)}% of the screen differs after a repaint, largest block ${JSON.stringify(r.boxes[0] || null)}`, data);
  }

  /** The window against the work area it opened in, honouring the profile's simulated screen. */
  windowFits() {
    const b = this.win.getBounds();
    const fake = /^(\d+)x(\d+)$/.exec(process.env.MM_WORKAREA || '');
    const area = fake ? { x: 0, y: 0, width: Number(fake[1]), height: Number(fake[2]) } : screen.getDisplayMatching(b).workArea;
    const fits = b.width <= area.width && b.height <= area.height;
    return this.check('the window fits the work area it opened in', fits,
      `window ${b.width}x${b.height}, work area ${area.width}x${area.height}`, { window: b, workArea: area });
  }
}

/** The machine as Chromium's GPU process sees it, which is what a user's report shows too. */
async function machine() {
  /** @type {any} */
  let gpu = null;
  try { gpu = await app.getGPUInfo('basic'); } catch { /* no GPU process */ }
  return {
    platform: `${process.platform} ${require('os').release()} ${process.arch}`,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    args: process.argv.slice(2).filter((a) => a.startsWith('--') && !a.startsWith('--user-data-dir')),
    gpuFeatures: app.getGPUFeatureStatus(),
    gpuDevices: gpu && gpu.gpuDevice,
    displays: screen.getAllDisplays().map((d) => ({ size: d.size, workArea: d.workArea, scaleFactor: d.scaleFactor, refresh: d.displayFrequency })),
  };
}

/**
 * Runs the scenarios named in `list` (comma separated, files in ./scenarios) one after another
 * in the same window, and writes results.json. A scenario that throws is a failed check, not a
 * dead run: the rest still get their turn.
 */
/** @param {import('electron').BrowserWindow} win @param {string} list @param {{ out: string }} opts */
async function run(win, list, { out }) {
  const started = Date.now();
  const all = { checks: [], pictures: [] };
  for (const name of String(list).split(',').map((s) => s.trim()).filter(Boolean)) {
    const sim = new Sim(win, { out, scenario: name });
    try {
      await sim.ready();
      await require(`./scenarios/${name}`)(sim);
    } catch (e) {
      sim.check('the scenario ran to its end', false, (e && e.stack) || e);
    }
    all.checks.push(...sim.checks);
    all.pictures.push(...sim.pictures);
  }
  const result = {
    at: new Date().toISOString(),
    seconds: Math.round((Date.now() - started) / 1000),
    machine: await machine(),
    passed: all.checks.every((c) => c.ok),
    ...all,
  };
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(result, null, 1));
  return result;
}

module.exports = { Sim, run };
