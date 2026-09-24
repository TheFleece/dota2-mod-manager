/**
 * Real mods in and out of the game, through the window, with the game's own reading checked
 * after every step.
 *
 * tools/e2e.mjs already presses Install, the switch and Remove on one fixture mod and compares
 * the folder byte for byte. This asks the question that test cannot: what would the game show?
 * After each step tools/sim/dota.js mounts the folders the way the engine does and says which
 * file comes from which pack, so "installed" means "the game reads it", "off" means "the game
 * does not", and the order in My mods means the order the game uses.
 *
 * The mods are the sandbox's real ones (tools/sandbox-mods.json). They are put into the app's
 * download cache the way the app leaves them after a download, so the run needs no network and
 * installs the same bytes on every machine.
 *
 * Steps: seven mods installed from their cards; two emblems that replace the same files, so the
 * one listed first must be the one the game shows, and moving the other up must flip it; a mod
 * switched off and on; the master switch off and on; everything removed, and the language folder
 * left as it was found.
 */
const { app } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dota = require('../dota');
const { lit } = require('../driver');
const { listVpkPathCrcsFile } = require('../../../src/vpk.js');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const MANIFEST = require('../../sandbox-mods.json').mods;

// small, different kinds, and two that fight over the same files
const PICK = [
  'Bare Brewmaster', 'IO Purple', 'Aghanim Labyrinth', 'Remove Seasonal Effects',
  'Winter Versus Screen', 'Emblem of the Diretide Green', 'Emblem of the Diretide Blue',
];
const RIVALS = ['Emblem of the Diretide Green', 'Emblem of the Diretide Blue'];

const calm = `!document.documentElement.classList.contains('vt-screen')`;
const modalOpen = `!document.getElementById('modalOverlay').classList.contains('hidden')
  && !document.getElementById('modalOverlay').classList.contains('closing')
  && document.querySelector('#modalContent .modal-title')?.textContent.trim()`;

/**
 * What is in a folder, enough to tell that nothing was touched: small files by their bytes,
 * Valve's big packs by size and time. The app's ownership note is compared by the files it
 * lists, since it records when it was last written and is rewritten on every change.
 */
function listing(dir) {
  const out = {};
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!d.isFile()) continue;
    const fd = fs.openSync(path.join(dir, d.name), 'r');
    try {
      const st = fs.fstatSync(fd);
      if (d.name === 'dota2modmanager.json') {
        try { out[d.name] = JSON.stringify(JSON.parse(fs.readFileSync(fd, 'utf8')).files); } catch { out[d.name] = 'unreadable'; }
      } else if (st.size < 1 << 20) {
        out[d.name] = crypto.createHash('sha1').update(fs.readFileSync(fd)).digest('hex');
      } else {
        out[d.name] = `${st.size}:${Math.round(st.mtimeMs)}`;
      }
    } finally {
      fs.closeSync(fd);
    }
  }
  return out;
}

/**
 * A mod from the sandbox, as tools/sandbox-mods.json recorded it: the sandbox's copy, or fetched
 * when the sandbox was seeded without mods (CI does, to skip ~110 MB it has no use for; these
 * seven are 1.5 MB). Either way the bytes must hash to what the list recorded.
 *
 * The catalog is somebody else's and its authors replace files. When one has been replaced since
 * the list was written, the answer is { replaced } and the run goes on without that mod: a check
 * that fails over a commit in another repository gets switched off within a week (tools/e2e.mjs
 * says the same about the live catalog).
 * @returns {Promise<{ file?: string, replaced?: string }>}
 */
async function sandboxMod(m) {
  const file = path.join(ROOT, 'sandbox', 'mods', `${m.categoryId}__${m.file}`);
  const hash = (b) => crypto.createHash('sha256').update(b).digest('hex');
  let bytes = null;
  try { bytes = fs.readFileSync(file); } catch { /* not in this sandbox */ }
  if (bytes && hash(bytes) === m.sha256) return { file };
  const res = await fetch(m.url);
  if (!res.ok) throw new Error(`${m.url}: HTTP ${res.status}`);
  bytes = Buffer.from(await res.arrayBuffer());
  const got = hash(bytes);
  if (got !== m.sha256) return { replaced: got };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes);
  return { file };
}

/** The mod's own files in its pack, and for each where the game would read it from. */
function whoServes(gamePath, folder, pak) {
  const game = dota.load(gamePath);
  const mine = [];
  const lost = {};
  for (const [rel] of listVpkPathCrcsFile(path.join(gamePath, folder, pak))) {
    const w = game.resolve(rel);
    const by = w ? `${w.folder}/${w.pak || '(loose)'}` : 'nothing';
    if (w && w.folder === folder && w.pak === pak) mine.push(rel);
    else lost[by] = (lost[by] || 0) + 1;
  }
  return { files: mine.length + Object.values(lost).reduce((a, b) => a + b, 0), served: mine.length, lost };
}

module.exports = async function mods(sim) {
  const s = await sim.js('window.api.settings.get()');
  const game = s.dotaGamePath;
  if (!sim.check('the app has a game to work on', game && s.dotaPathValid, JSON.stringify({ game, valid: s.dotaPathValid }))) return;
  const folder = `dota_${dota.mountedLanguage(game)}`;
  const langDir = path.join(game, folder);
  fs.mkdirSync(langDir, { recursive: true });
  const pristine = listing(langDir);
  const gameCheck = (when) => {
    const r = dota.checkGame(game);
    sim.check(`the game would load its folders ${when}`, r.ok, r.problems.join(' | '), { mounts: r.mounts });
    return r;
  };

  // ---- the download cache, as a download leaves it ----
  const dl = path.join(app.getPath('userData'), 'downloads');
  const indexFile = path.join(dl, 'index.json');
  let index = {};
  try { index = JSON.parse(fs.readFileSync(indexFile, 'utf8')); } catch { /* first download */ }
  const picked = [];
  for (const name of PICK) {
    const m = MANIFEST.find((x) => x.name === name);
    let got = null;
    let why = 'not in tools/sandbox-mods.json';
    if (m) { try { got = await sandboxMod(m); } catch (e) { why = e.message; } }
    if (got && got.replaced) {
      sim.check(`${name}: the catalog replaced it since tools/sandbox-mods.json was written, so it sits this run out`, true, '',
        { recorded: m.sha256, now: got.replaced });
      continue;
    }
    if (!sim.check(`${name} is in the sandbox`, got && got.file, why)) continue;
    const src = got.file;
    fs.mkdirSync(path.join(dl, m.categoryId), { recursive: true });
    fs.copyFileSync(src, path.join(dl, m.categoryId, m.file));
    index[`${m.categoryId}/${m.file}`] = { size: m.bytes, sha256: m.sha256, at: Date.now() };
    picked.push(m);
  }
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 2));
  if (!sim.check('enough of the picked mods are available to mean something', picked.length >= 5,
    `${picked.length} of ${PICK.length}: refresh tools/sandbox-mods.json (npm run sandbox:seed)`)) return;

  // ---- install, from the card, each checked by the game ----
  const installed = [];
  for (const m of picked) {
    await sim.click('.tb-tab[data-view="catalog"]');
    await sim.until(calm, 3000);
    await sim.click(`.rail-item[data-cat="${m.categoryId}"]`);
    await sim.until(`document.querySelector('.rail-item.active')?.dataset.cat === ${lit(m.categoryId)} && ${calm}`, 8000);
    const at = await sim.until(`(() => {
      const names = [...document.querySelectorAll('.view-pane[data-pane="catalog"] .grid .card .card-name')];
      return names.findIndex((n) => n.textContent.trim() === ${lit(m.name)}) + 1;
    })()`, 8000);
    // the catalog is live: a mod taken down upstream since the sandbox was seeded is not a fault here
    if (!at) { sim.check(`${m.name} is still in the catalog`, true); continue; }
    const clicked = await sim.click(`.view-pane[data-pane="catalog"] .grid .card .card-name@${at}`);
    const title = clicked && await sim.until(modalOpen, 5000);
    if (!sim.check(`${m.name}: its window opens`, title === m.name,
      `${!clicked ? 'its card could not be found to click' : title ? `the window is for ${title}` : 'the overlay stayed hidden'}; the last click: ${JSON.stringify(sim.lastClick)}`)) {
      await sim.shot(`no-window-${m.categoryId}`);
      continue;
    }
    await sim.still();
    const before = listing(langDir);
    await sim.click('#installBtn');
    // anything the app asks on the way is answered yes, and written down
    let asked = null;
    const done = await sim.until(`document.getElementById('uninstallBtn') ? 'done'
      : document.querySelector('.confirm-overlay')?.textContent.replace(/\\s+/g, ' ').trim()`, 60000);
    if (done && done !== 'done') {
      asked = done;
      await sim.click('.confirm-overlay [data-c="yes"]');
      await sim.until(`document.getElementById('uninstallBtn')`, 60000);
    }
    const ok = await sim.js(`!!document.getElementById('uninstallBtn')`);
    const after = listing(langDir);
    const added = Object.keys(after).filter((n) => !(n in before));
    const paks = added.filter((n) => /^pak\d+_dir\.vpk$/i.test(n));
    sim.check(`${m.name}: installed from its window`, ok && paks.length === 1,
      `the window says ${ok ? 'installed' : 'not installed'}, new files: ${added.join(', ') || 'none'}`, { asked, added });
    await sim.key('Escape');
    await sim.until(`document.getElementById('modalOverlay').classList.contains('hidden')`, 3000);
    if (!paks.length) continue;
    const who = whoServes(game, folder, paks[0]);
    // A pack in the language folder can lose a file only to one loaded before it: another of
    // our mods the list puts higher, which is the list working (the rivals below check exactly
    // that), or Valve's own pak01 there, which would mean the mod never shows at all.
    const ourEarlier = (k) => installed.some((x) => `${folder}/${x.pak}` === k);
    const foreign = Object.keys(who.lost).filter((k) => !ourEarlier(k));
    sim.check(`${m.name}: every file of it reaches the game, or loses only to a mod listed before it`,
      who.files > 0 && !foreign.length, `${who.served} of ${who.files} served, lost: ${JSON.stringify(who.lost)}`, who);
    installed.push({ ...m, pak: paks[0] });
    gameCheck(`after installing ${m.name}`);
  }

  // ---- My mods: the order on screen is the order in the game ----
  await sim.click('.tb-tab[data-view="library"]');
  await sim.until(`document.querySelectorAll('.lib-row[data-row]').length >= ${installed.length} && ${calm}`, 10000);
  await sim.settle(600);
  await sim.shot('library-installed');
  const rows = () => sim.js(`[...document.querySelectorAll('.lib-row[data-row]')].map((r) => ({
    id: r.dataset.row,
    order: r.dataset.order == null ? null : Number(r.dataset.order),
    pak: r.querySelector('.lib-pak')?.textContent.trim() || '',
    text: r.textContent.replace(/\\s+/g, ' ').trim(),
  }))`);
  const rowOf = (list, name) => list.find((r) => r.text.includes(name));
  let list = await rows();
  sim.check('My mods lists every mod installed', installed.every((m) => rowOf(list, m.name)),
    `missing: ${installed.filter((m) => !rowOf(list, m.name)).map((m) => m.name).join(', ')}`, list);

  const rivals = RIVALS.map((n) => installed.find((m) => m.name === n)).filter(Boolean);
  if (rivals.length === 2) {
    // which rival My mods lists first, and which pack the game takes their shared files from
    const standing = async () => {
      list = await rows();
      const [a, b] = rivals.map((m) => ({ name: m.name, row: rowOf(list, m.name) }));
      const [top, other] = a.row.order < b.row.order ? [a, b] : [b, a];
      const game2 = dota.load(game);
      const theirs = new Set([...listVpkPathCrcsFile(path.join(langDir, other.row.pak))].map(([rel]) => rel));
      const shared = [...listVpkPathCrcsFile(path.join(langDir, top.row.pak))].map(([rel]) => rel).filter((rel) => theirs.has(rel));
      const winners = [...new Set(shared.map((rel) => game2.resolve(rel)?.pak))];
      return { top: top.name, topPak: top.row.pak, other: other.name, otherPak: other.row.pak, shared: shared.length, winners };
    };
    const shows = (r) => r.shared > 0 && r.winners.length === 1 && r.winners[0] === r.topPak;
    const first = await standing();
    sim.check('two mods that replace the same files: the game shows the one My mods lists first', shows(first), JSON.stringify(first), first);

    // The one below is moved up from its row's menu, one step at a time, the way the list offers
    // it, until it is above the other: that has to change what the game shows.
    const mover = first.other;
    let menuSeen = false;
    for (let step = 0; step < installed.length; step++) {
      const row = rowOf(await rows(), mover);
      await sim.rightClick(`.lib-row[data-row="${row.id}"] .lib-pak`);
      const menu = await sim.until(`[...document.querySelectorAll('.ctx-menu .ctx-item')].map((b) => b.textContent.trim()).join(' | ')`, 3000);
      const upAt = await sim.js(`[...document.querySelectorAll('.ctx-menu .ctx-item')].findIndex((b) => /Загружать раньше|Load earlier/.test(b.textContent)) + 1`);
      if (!menuSeen && !sim.check('the row menu offers to load a mod earlier', upAt > 0, `menu: ${menu}`)) break;
      menuSeen = true;
      await sim.click(`.ctx-menu .ctx-item@${upAt}`);
      await sim.until(`(() => { const r = [...document.querySelectorAll('.lib-row[data-row]')].find((x) => x.textContent.includes(${lit(mover)})); return r && Number(r.dataset.order) < ${row.order}; })()`, 10000);
      await sim.settle(400);
      if ((await standing()).top === mover) break;
    }
    const after = await standing();
    sim.check(`after moving ${mover} above ${first.top}, the game shows ${mover} instead`,
      after.top === mover && shows(after), JSON.stringify(after), after);
    gameCheck('after changing the order');
    await sim.shot('library-reordered');
  }

  // ---- one mod off and on ----
  const one = installed.find((m) => m.name === 'Bare Brewmaster') || installed[0];
  if (one) {
    list = await rows();
    const row = rowOf(list, one.name);
    await sim.click(`.lib-row[data-row="${row.id}"] .toggle[data-id]`);
    await sim.until(`document.querySelector(${lit(`.lib-row[data-row="${row.id}"] .toggle[data-id]`)})?.getAttribute('aria-checked') === 'false'`, 8000);
    await sim.settle(400);
    const game2 = dota.load(game);
    const mounted = game2.paks.some((p) => p.folder === folder && p.name === row.pak);
    sim.check(`${one.name} switched off: the game no longer loads its pack`, !mounted && fs.existsSync(path.join(langDir, `${row.pak}.off`)),
      `pack still mounted: ${mounted}, files: ${Object.keys(listing(langDir)).filter((n) => n.startsWith(row.pak)).join(', ')}`);
    await sim.click(`.lib-row[data-row="${row.id}"] .toggle[data-id]`);
    await sim.until(`document.querySelector(${lit(`.lib-row[data-row="${row.id}"] .toggle[data-id]`)})?.getAttribute('aria-checked') === 'true'`, 8000);
    await sim.settle(400);
    const back = whoServes(game, folder, row.pak);
    sim.check(`${one.name} switched on again: the game reads it again`, back.served > 0, JSON.stringify(back));
  }

  // ---- the master switch ----
  const ours = () => dota.load(game).paks.filter((p) => p.folder === folder && !p.valve).map((p) => p.name);
  await sim.click('#modsMasterBtn');
  await sim.until(`document.getElementById('modsMasterBtn')?.getAttribute('aria-checked') === 'false'`, 15000);
  await sim.settle(600);
  sim.check('mods switched off at the master switch: the game loads none of them', ours().length === 0, `still mounted: ${ours().join(', ')}`);
  gameCheck('with every mod off');
  await sim.shot('library-master-off');
  await sim.click('#modsMasterBtn');
  await sim.until(`document.getElementById('modsMasterBtn')?.getAttribute('aria-checked') === 'true'`, 15000);
  await sim.settle(600);
  sim.check('mods switched back on: the game loads all of them again', ours().length === installed.length,
    `${ours().length} of ${installed.length} mounted`);

  // ---- everything removed, the folder as it was ----
  for (const m of installed) {
    list = await rows();
    const row = rowOf(list, m.name);
    if (!row) continue;
    await sim.click(`.lib-row[data-row="${row.id}"] [data-del]`);
    const asked = await sim.until(`document.querySelector('.confirm-overlay [data-c="yes"]')`, 5000);
    if (asked) {
      await sim.still();
      await sim.click('.confirm-overlay [data-c="yes"]');
    }
    const gone = await sim.until(`!document.querySelector(${lit(`.lib-row[data-row="${row.id}"]`)})`, 10000);
    sim.check(`${m.name}: removed from My mods`, gone, `the row is still there${asked ? '' : ', and no confirmation was asked'}`);
  }
  await sim.settle(600);
  const now = listing(langDir);
  const extra = Object.keys(now).filter((n) => !(n in pristine));
  const missing = Object.keys(pristine).filter((n) => !(n in now));
  const changed = Object.keys(pristine).filter((n) => n in now && now[n] !== pristine[n]);
  sim.check('after removing everything, the language folder is as it was found', !extra.length && !missing.length && !changed.length,
    `extra: ${extra.join(', ') || '-'}; missing: ${missing.join(', ') || '-'}; changed: ${changed.join(', ') || '-'}`);
  gameCheck('after removing everything');
};
