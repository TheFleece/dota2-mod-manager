/* Dota 2 Mod Manager — renderer */
'use strict';
import { $ } from './core/dom.js';
import { COSMETIC_PREFIX, PANEL_DEFAULTS, PANEL_LIMITS, PANEL_ZOOM_LIMITS } from './core/constants.js';
import { esc, fmtMB, plural } from './ui/format.js';
import { showWhatsNew, confirmDialog } from './ui/dialog.js';
import { state } from './core/store.js';
import { toast } from './ui/toast.js';
import { registerView, render, switchView } from './core/router.js';
import { refreshInstalledIndex, refreshCosmeticSlots } from './core/installed.js';
import { refreshPatchState, paintMasterSwitch, refreshMasterSwitch } from './ui/statusbar.js';
// Screens register themselves on import. What is imported by name is the little each one
// still owes the shell: a file dropped on the window can be a mod or a preset and lands on
// whichever screen is open, and the catalog is fetched at boot and re-fetched from Settings,
// both of them outside the screen that shows it.
import { handleImportResult } from './views/library.js';
import { loadCatalog } from './views/catalog.js';
import { handlePresetImport } from './views/presets.js';
import './views/tools.js';
import './views/guides.js';

const viewRoot = $('#view-root');

// Screens tell the router how to draw themselves instead of the router knowing them, so a
// screen can move into its own module without anything else being edited. Declarations
// hoist, so this reads before the functions it names. Each line moves out with its screen.
registerView('settings', () => renderSettings());

// A crash the user can't explain is the hardest kind to fix from a support chat. Both land
// in the app's own log (see main.js diag:rendererError / src/diagnostics.js), so "it broke"
// turns into a report the user can export instead of a guessing game over Discord.
window.addEventListener('error', (e) => {
  window.api.diag.reportError(`window.onerror: ${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`);
});
window.addEventListener('unhandledrejection', (e) => {
  window.api.diag.reportError(`unhandledrejection: ${e.reason?.stack || e.reason}`);
});

// ---------- UI scale ----------

// Scale of the content — the catalog, the library, the settings — in percent. It is CSS zoom
// on the content itself, deliberately not a window zoom: the panels have their own scale, and
// a window zoom lands a frame after the CSS does, which made the whole layout shudder while
// the wheel was turning. Ctrl +/-/0 come from main.js (there they also block Electron's own
// zoom accelerators); Ctrl + wheel and the slider in Settings land here.
const SCALE_MIN = 70;
const SCALE_MAX = 160;
const clampScale = (pct) => Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round(Number(pct) / 5) * 5));
const currentScalePct = () => Math.round((Number(state.settings?.uiScale) || 1) * 100);

// keep a slider and its readout in step with the value that is actually in force
function paintScaleRow(id, pct) {
  const range = $(`#${id}`);
  if (range) range.value = String(pct);
  const val = $(`#${id}Val`);
  if (val) val.textContent = `${pct}%`;
}

// the content scale doubles as the "everything" number in Settings
function paintScale(pct) {
  paintScaleRow('zoomContent', pct);
  paintScaleRow('masterRange', pct);
}

function paintPanelScales() {
  paintScaleRow('zoomTop', Math.round(state.panels.topZoom * 100));
  paintScaleRow('zoomRail', Math.round(state.panels.railZoom * 100));
  paintScaleRow('zoomBottom', Math.round(state.panels.bottomZoom * 100));
}

function applyContentZoom(factor) {
  if (state.settings) state.settings.uiScale = factor;
  document.documentElement.style.setProperty('--content-zoom', String(factor));
  paintScale(Math.round(factor * 100));
}

// paints first, saves after: the wheel can outrun the IPC and must not wait for it
function applyScalePct(pct) {
  const want = clampScale(pct);
  applyContentZoom(want / 100);
  window.api.ui.setZoom(want / 100);
}

// Ctrl + wheel resizes whatever the pointer is over: each chrome panel has its own size,
// and everywhere else means the content, which is what the UI scale governs.
const WHEEL_ZONES = [
  { sel: '#titlebar, #gripTop', zoom: 'topZoom', fold: 'topFolded' },
  { sel: '#statusbar, #gripBottom', zoom: 'bottomZoom', fold: 'bottomFolded' },
  { sel: '#catRail, #gripRail', zoom: 'railZoom', fold: 'railFolded' },
];

window.addEventListener('wheel', (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  const dir = e.deltaY < 0 ? 1 : -1;
  const zone = e.target instanceof Element ? WHEEL_ZONES.find((z) => e.target.closest(z.sel)) : null;
  if (!zone) { applyScalePct(currentScalePct() + dir * 5); return; }
  if (state.panels[zone.fold]) foldPanel(zone.fold, false); // scaling a folded panel opens it
  state.panels[zone.zoom] = clampPanelZoom(state.panels[zone.zoom] + dir * 0.05);
  paintPanels();
  savePanels();
}, { passive: false });

// main.js took a Ctrl +/-/0 press — keep the slider and the chrome honest
window.api.ui.onZoom((factor) => applyContentZoom(factor));

// ---------- panels ----------

function readPanels(saved) {
  const p = { ...PANEL_DEFAULTS, ...(saved || {}) };
  for (const [key, [min, max]] of Object.entries(PANEL_LIMITS)) {
    const v = Math.round(Number(p[key]));
    p[key] = Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : PANEL_DEFAULTS[key];
  }
  for (const key of ['topZoom', 'bottomZoom', 'railZoom']) {
    const v = Number(p[key]);
    p[key] = Number.isFinite(v) ? clampPanelZoom(v) : 1;
  }
  for (const key of ['topFolded', 'bottomFolded', 'railFolded']) p[key] = !!p[key];
  return p;
}

const clampPanelZoom = (v) => Math.round(Math.min(PANEL_ZOOM_LIMITS[1], Math.max(PANEL_ZOOM_LIMITS[0], v)) * 100) / 100;

function paintGripToggle(sel, icon, label) {
  const btn = $(sel);
  if (!btn) return;
  btn.querySelector('.ms').textContent = icon;
  btn.setAttribute('aria-label', label);
  btn.title = label;
}

function paintPanels() {
  const p = state.panels;
  const root = document.documentElement.style;
  root.setProperty('--tb-h', `${p.topH}px`);
  root.setProperty('--status-h', `${p.bottomH}px`);
  root.setProperty('--rail-w', `${p.railW}px`);
  root.setProperty('--top-zoom', String(p.topZoom));
  root.setProperty('--bottom-zoom', String(p.bottomZoom));
  root.setProperty('--rail-zoom', String(p.railZoom));
  document.body.classList.toggle('top-folded', p.topFolded);
  document.body.classList.toggle('bottom-folded', p.bottomFolded);
  document.body.classList.toggle('rail-folded', p.railFolded);
  document.body.classList.toggle('rail-off', p.railFolded || state.view !== 'catalog');
  paintPanelScales();
  paintGripToggle('#topToggle', p.topFolded ? 'expand_more' : 'expand_less',
    p.topFolded ? L`Развернуть верхнюю панель` : L`Свернуть верхнюю панель`);
  paintGripToggle('#bottomToggle', p.bottomFolded ? 'expand_less' : 'expand_more',
    p.bottomFolded ? L`Показать нижнюю панель` : L`Скрыть нижнюю панель`);
  paintGripToggle('#railToggle', p.railFolded ? 'chevron_right' : 'chevron_left',
    p.railFolded ? L`Показать категории` : L`Скрыть категории`);
}

let panelSaveTimer = null;
function savePanels() {
  clearTimeout(panelSaveTimer);
  panelSaveTimer = setTimeout(() => { window.api.settings.set('panels', state.panels); }, 250);
}

function foldPanel(key, on) {
  state.panels[key] = on === undefined ? !state.panels[key] : !!on;
  paintPanels();
  savePanels();
}

// drag the edge itself; the chevron sitting on it folds the panel instead
function bindGrip(sel, { size: sizeKey, zoom: zoomKey, fold: foldKey, delta }) {
  const el = $(sel);
  if (!el) return;
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('.grip-toggle')) return;
    if (state.panels[foldKey]) foldPanel(foldKey, false); // dragging a folded panel opens it
    const [min, max] = PANEL_LIMITS[sizeKey];
    const start = state.panels[sizeKey];
    // the pointer moves in viewport pixels, the panel is sized in its own, which its zoom
    // multiplies — so a 1px drag is 1/zoom of the panel's own
    const perPixel = 1 / state.panels[zoomKey];
    const origin = { x: e.clientX, y: e.clientY };
    el.classList.add('dragging');
    document.body.classList.add('grip-dragging');
    // the window, not the grip: the grip moves out from under the pointer as the panel
    // grows, and pointer capture is not something to depend on for that
    const move = (ev) => {
      state.panels[sizeKey] = Math.min(max, Math.max(min, Math.round(start + delta(ev, origin) * perPixel)));
      paintPanels();
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      el.classList.remove('dragging');
      document.body.classList.remove('grip-dragging');
      savePanels();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  });
  el.addEventListener('dblclick', () => {
    state.panels[sizeKey] = PANEL_DEFAULTS[sizeKey];
    state.panels[zoomKey] = 1;
    paintPanels();
    savePanels();
  });
}

// The tab strip runs out of room on a small window or a high UI scale, and then it scrolls:
// sideways with the wheel, or by grabbing and swiping it like a strip on a phone.
function syncNavOverflow() {
  const nav = $('#tbNav');
  if (nav) nav.classList.toggle('scrollable', nav.scrollWidth > nav.clientWidth + 1);
}

function bindNavScroll() {
  const nav = $('#tbNav');
  if (!nav) return;
  new ResizeObserver(syncNavOverflow).observe(nav);
  syncNavOverflow();

  // the bar drops the wordmark when it gets cramped — measured on the bar itself, since its
  // own zoom decides how much room it really has
  const tb = $('#titlebar');
  if (tb) {
    const syncWidth = () => {
      tb.classList.toggle('narrow', tb.clientWidth < 1000);
      tb.classList.toggle('tiny', tb.clientWidth < 870);
    };
    new ResizeObserver(syncWidth).observe(tb);
    syncWidth();
  }

  nav.addEventListener('wheel', (e) => {
    if (e.ctrlKey) return; // that gesture belongs to the panel size
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (!delta || nav.scrollWidth <= nav.clientWidth) return;
    e.preventDefault();
    nav.scrollLeft += delta;
  }, { passive: false });

  let drag = null;
  let swallowClick = false;
  nav.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || nav.scrollWidth <= nav.clientWidth) return;
    drag = { id: e.pointerId, x: e.clientX, left: nav.scrollLeft, moved: false };
  });
  // on the window: a swipe often runs past the strip, and it must keep scrolling anyway
  window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(dx) < 4) return; // still a click, not a swipe
      drag.moved = true;
      nav.classList.add('dragging');
    }
    nav.scrollLeft = drag.left - dx;
  });
  const endDrag = () => {
    if (!drag) return;
    if (drag.moved) swallowClick = true; // a swipe must not also switch the view
    nav.classList.remove('dragging');
    drag = null;
  };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  nav.addEventListener('click', (e) => {
    if (!swallowClick) return;
    swallowClick = false;
    e.preventDefault();
    e.stopPropagation();
  }, true);
}

function bindPanels() {
  bindGrip('#gripTop', { size: 'topH', zoom: 'topZoom', fold: 'topFolded', delta: (ev, o) => ev.clientY - o.y });
  bindGrip('#gripBottom', { size: 'bottomH', zoom: 'bottomZoom', fold: 'bottomFolded', delta: (ev, o) => o.y - ev.clientY });
  bindGrip('#gripRail', { size: 'railW', zoom: 'railZoom', fold: 'railFolded', delta: (ev, o) => ev.clientX - o.x });
  $('#topToggle')?.addEventListener('click', () => foldPanel('topFolded'));
  $('#bottomToggle')?.addEventListener('click', () => foldPanel('bottomFolded'));
  $('#railToggle')?.addEventListener('click', () => foldPanel('railFolded'));
  document.addEventListener('keydown', (e) => {
    if (!e.ctrlKey || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'b') return;
    e.preventDefault();
    foldPanel('railFolded');
  });
  bindNavScroll();
  paintPanels();
}

// ---------- window controls ----------

$('#winMin').addEventListener('click', () => window.api.win.minimize());
$('#winMax').addEventListener('click', () => window.api.win.maximize());
$('#winClose').addEventListener('click', () => window.api.win.close());
window.api.win.onMaximized((maxed) => {
  $('#winMax').innerHTML = maxed
    ? '<svg viewBox="0 0 12 12" width="12" height="12"><rect x="2" y="3.5" width="6.5" height="6.5" fill="none" stroke="currentColor" stroke-width="1.1" rx="1"/><path d="M4 3.5V2.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-1" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>'
    : '<svg viewBox="0 0 12 12" width="12" height="12"><rect x="2.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.2" rx="1"/></svg>';
});

// ---------- navigation ----------

document.querySelectorAll('.tb-tab').forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

$('#openModsFolderBtn').addEventListener('click', async () => {
  const r = await window.api.misc.openLangFolder();
  if (r.error) toast(r.error, 'error');
});

// ---------- launch + master mods switch (status bar) ----------

$('#launchBtn')?.addEventListener('click', async () => {
  if (!state.settings?.dotaPathValid) { toast(L`Сначала укажи путь к Dota 2 в настройках`, 'warn'); return; }
  await window.api.game.launch();
  toast(state.masterOff ? L`Запуск Dota 2 без модов…` : L`Запуск Dota 2 с модами…`);
});

// Discord account in the title bar. Empty (and invisible) when the build has no client id,
// so a user never meets a sign-in button that cannot work.
function paintAccount() {
  const host = $('#tbAccount');
  if (!host) return;
  const s = state.settings || {};
  if (!s.discordConfigured) { host.innerHTML = ''; return; }
  const acc = s.account;
  host.innerHTML = acc
    ? `<button class="tb-user" id="tbUserBtn" title="${esc(L`Выйти из аккаунта`)}">
         ${acc.avatar ? `<img src="${esc(acc.avatar)}" alt="">` : '<span class="ms">person</span>'}
         <span class="tb-user-name">${esc(acc.username)}</span>
       </button>`
    : `<button class="tb-login" id="tbLoginBtn" title="${esc(L`Вход нужен, чтобы подписывать свои сборки`)}">
         <span class="ms">login</span>${L`Войти`}
       </button>`;

  $('#tbLoginBtn')?.addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    toast(L`Открыл Discord в браузере — подтверди вход там`, 'ok', 6000);
    const r = await window.api.account.signIn();
    if (r.error) toast(r.error, 'error', 7000);
    else toast(L`Привет, ${r.account.username}`);
    state.settings = await window.api.settings.get();
    paintAccount();
  });
  $('#tbUserBtn')?.addEventListener('click', async () => {
    if (!await confirmDialog(L`Выйти из аккаунта «${acc.username}»?`, { okLabel: L`Выйти`, danger: false })) return;
    await window.api.account.signOut();
    state.settings = await window.api.settings.get();
    paintAccount();
  });
}


$('#modsMasterBtn')?.addEventListener('click', async () => {
  const btn = $('#modsMasterBtn');
  btn.disabled = true;
  const enable = state.masterOff; // currently off -> turn on, and vice-versa
  const r = await window.api.mods.setMaster(enable);
  btn.disabled = false;
  if (r.error) { toast(r.error, 'error'); return; }
  state.masterOff = !enable;
  paintMasterSwitch();
  toast(enable ? L`Моды включены` : L`Моды выключены — игра запустится ванильной`);
  if (state.view === 'library') render();
});


$('#safeModeBtn')?.addEventListener('click', async () => {
  const btn = $('#safeModeBtn');
  const turningUnsafe = !state.settings?.schemaPatch === true; // currently safe -> about to turn it off
  if (turningUnsafe) {
    const ok = await confirmDialog(
      L`Приложение впишет свою папку в gameinfo_branchspecific.gi и пересчитает подпись этого файла в dota.signatures — так Dota сможет читать эффекты модов и бесплатную косметику. Оригиналы сохраняются, обратное переключение возвращает их byte-в-byte.`,
      { okLabel: L`Выключить`, danger: false }
    );
    if (!ok) return;
  }
  btn.disabled = true;
  const r = await window.api.patch.setEnabled(turningUnsafe);
  btn.disabled = false;
  if (r.error) { toast(r.error, 'error'); return; }
  state.settings = { ...state.settings, schemaPatch: turningUnsafe };
  toast(turningUnsafe ? L`Безопасный режим выключен — эффекты и косметика доступны` : L`Безопасный режим включён, файлы игры восстановлены`);
  await Promise.all([refreshCosmeticSlots(), refreshPatchState()]);
  if (state.view === 'catalog') {
    // the cosmetics rail section just appeared or disappeared — bail out of a category
    // that no longer exists rather than show a dead one
    if (!turningUnsafe && state.activeCategory.startsWith(COSMETIC_PREFIX)) state.activeCategory = 'all';
    render();
  }
});

// global search
let searchTimer = null;
$('#globalSearch').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = e.target.value;
    $('#clearSearch').classList.toggle('hidden', !state.search);
    if (state.view !== 'catalog') switchView('catalog');
    else render();
  }, 180);
});
$('#clearSearch').addEventListener('click', () => {
  $('#globalSearch').value = '';
  state.search = '';
  $('#clearSearch').classList.add('hidden');
  if (state.view === 'catalog') render();
});

// drag & drop of .vpk files anywhere in the window -> import
let dragDepth = 0;
// setting dropEffect=copy on every dragover is what actually lets Windows deliver the
// drop; without it some setups report effect "none" and the drop event never fires
document.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
});
document.addEventListener('dragenter', (e) => {
  e.preventDefault();
  if ([...(e.dataTransfer?.items || [])].some((i) => i.kind === 'file')) {
    dragDepth++;
    document.body.classList.add('dropping');
  }
});
document.addEventListener('dragleave', () => {
  if (--dragDepth <= 0) {
    dragDepth = 0;
    document.body.classList.remove('dropping');
  }
});
// A dropped folder has no extension and no type — the main process walks it for .vpk
// files, which is how a whole unzipped Skinchanger pack can be dropped in at once.
const isFolderFile = (f) => !f.type && !/\.[a-z0-9]+$/i.test(f.name || '');

// Mod files, an archive of them, or a folder to scan.
async function dropMods(dropped) {
  const wanted = dropped.filter((f) => /\.(vpk|zip)$/i.test(f.name || '') || isFolderFile(f));
  if (!wanted.length) {
    toast(L`Импортировать можно .vpk файлы, .zip или папку с ними`, 'warn', 5000);
    return;
  }
  if (state.view !== 'library') switchView('library');
  // prefer real on-disk paths (lets the importer pick up sibling _NNN parts too)
  const paths = wanted.map((f) => { try { return window.api.mods.pathForFile(f); } catch { return null; } }).filter(Boolean);
  if (paths.length === wanted.length) {
    handleImportResult(await window.api.mods.importPaths(paths));
    return;
  }
  // fallback: some setups don't expose a path for dropped files — send the raw bytes
  const files = wanted.filter((f) => !isFolderFile(f));
  if (!files.length) { toast(L`Не удалось прочитать перетащенную папку`, 'error'); return; }
  try {
    const items = await Promise.all(files.map(async (f) => ({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) })));
    handleImportResult(await window.api.mods.importBuffers(items));
  } catch {
    toast(L`Не удалось прочитать перетащенные файлы`, 'error');
  }
}

// A received .d2mm.
async function dropPresets(dropped) {
  const file = dropped.find((f) => /\.d2mm$/i.test(f.name || ''));
  let p = null;
  try { p = window.api.mods.pathForFile(file); } catch { /* no path for this drop */ }
  if (!p) { toast(L`Не удалось прочитать файл пресета`, 'error'); return; }
  handlePresetImport(await window.api.presets.importFile(p)); // switches to Presets itself
}

document.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('dropping');
  const dropped = [...(e.dataTransfer?.files || [])];
  if (!dropped.length) return;
  // The file says what to do with it, not the tab that happens to be open. Routing by tab
  // meant a preset dropped anywhere but Presets was answered with "open the other tab" —
  // a file arriving from Discord lands wherever the user happens to be standing.
  if (dropped.some((f) => /\.d2mm$/i.test(f.name || ''))) return dropPresets(dropped);
  if (dropped.some((f) => /\.(vpk|zip)$/i.test(f.name || '') || isFolderFile(f))) return dropMods(dropped);
  toast(L`Сюда можно бросить моды (.vpk, .zip, папку) или пресет .d2mm`, 'warn', 5000);
});

// a d2mm:// link clicked outside the app (or the one it was launched with)
window.api.presets.onLink((res) => handlePresetImport(res));

// ===== Settings =====

// Dota's own language names, keyed by the folder suffix it uses (dota_koreana etc.)
const DOTA_LANG_NAMES = {
  brazilian: 'Portuguese-Brazil', bulgarian: 'Bulgarian', czech: 'Czech', danish: 'Danish',
  dutch: 'Dutch', english: 'English', finnish: 'Finnish', french: 'French', german: 'German',
  greek: 'Greek', hungarian: 'Hungarian', indonesian: 'Indonesian', italian: 'Italian',
  japanese: 'Japanese', koreana: 'Korean', latam: 'Spanish-Latin America', norwegian: 'Norwegian',
  polish: 'Polish', portuguese: 'Portuguese', romanian: 'Romanian', russian: 'Russian',
  schinese: 'Simplified Chinese', spanish: 'Spanish', swedish: 'Swedish',
  tchinese: 'Traditional Chinese', thai: 'Thai', turkish: 'Turkish', ukrainian: 'Ukrainian',
  vietnamese: 'Vietnamese',
};
const langName = (s) => DOTA_LANG_NAMES[s] || s;

function gameLangOptions(list, selected) {
  return (list || []).map((v) =>
    `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(langName(v))} (dota_${esc(v)})</option>`).join('');
}

// folder picker for the manual mode: every dota_* folder on disk plus the language the game
// reports, so the list always contains the one that actually works
function langOptions(s, gl) {
  const seen = new Set();
  const opts = [];
  for (const v of [gl.suffix, s.langSuffix, ...(gl.folders || []).map((f) => f.suffix)]) {
    if (!v || seen.has(v)) continue;
    seen.add(v);
    opts.push(`<option value="${esc(v)}" ${s.langSuffix === v ? 'selected' : ''}>dota_${esc(v)}</option>`);
  }
  return opts.join('');
}

async function renderSettings() {
  const s = await window.api.settings.get();
  state.settings = s;
  const gl = s.gameLang || {};
  const scalePct = Math.round((Number(s.uiScale) || 1) * 100);
  const pz = state.panels;
  const cacheSize = await window.api.misc.cacheSize();
  const appVersion = await window.api.update.version();

  viewRoot.innerHTML = `
    <div class="view-header"><h1 class="view-title">${L`Настройки`}</h1></div>

    <div class="settings-block">
      <h3>${L`Интерфейс`}</h3>
      <div class="settings-row">
        <span class="settings-label">${L`Язык`}</span>
        <div class="select-wrap">
          <span class="ms">translate</span>
          <select class="input" id="uiLangSelect" style="padding-left:30px">
            <option value="en" ${s.uiLang === 'en' ? 'selected' : ''}>English</option>
            <option value="ru" ${s.uiLang === 'ru' ? 'selected' : ''}>Русский</option>
          </select>
        </div>
      </div>
      <div style="font-size:12.5px;color:var(--text-muted);margin-top:8px">
        ${L`Один переключатель на всё: язык приложения, текст в самой Dota и её озвучку (за языком озвучки следует папка модов). Dota при этом должна быть закрыта — иначе она перезапишет настройку при выходе.`}
      </div>
      <div class="settings-row" style="margin-top:14px">
        <span class="settings-label">${L`Масштаб всего`}</span>
        <div class="scale-ctl">
          <button class="btn btn-sm scale-step" id="masterDown" aria-label="${L`Мельче`}"><span class="ms">remove</span></button>
          <input type="range" class="scale-range" id="masterRange" min="70" max="160" step="5" value="${scalePct}" aria-label="${L`Масштаб всего`}">
          <span class="scale-val" id="masterRangeVal">${scalePct}%</span>
          <button class="btn btn-sm scale-step" id="masterUp" aria-label="${L`Крупнее`}"><span class="ms">add</span></button>
          <button class="btn btn-sm" id="masterReset">${L`Сбросить всё`}</button>
        </div>
      </div>
      <div style="font-size:12.5px;color:var(--text-muted);margin-top:8px">
        ${L`Двигает содержимое и панели сразу. Ниже каждый масштаб можно задать по отдельности. Те же клавиши: Ctrl + и Ctrl − меняют содержимое, Ctrl + колесо над панелью — эту панель, Ctrl 0 возвращает 100%. За границу панели можно потянуть, чтобы изменить её размер.`}
      </div>
      <details class="settings-adv" ${state.scaleOpen ? 'open' : ''} id="scaleAdv">
        <summary>${L`Масштаб по частям`}</summary>
        ${[
          { id: 'Content', label: L`Содержимое`, icon: 'grid_view', value: scalePct, min: 70, max: 160 },
          { id: 'Top', label: L`Верхняя панель`, icon: 'toolbar', value: Math.round(pz.topZoom * 100), min: 60, max: 180 },
          { id: 'Rail', label: L`Список категорий`, icon: 'view_sidebar', value: Math.round(pz.railZoom * 100), min: 60, max: 180 },
          { id: 'Bottom', label: L`Нижняя панель`, icon: 'bottom_panel_open', value: Math.round(pz.bottomZoom * 100), min: 60, max: 180 },
        ].map((row) => `
        <div class="settings-row">
          <span class="settings-label"><span class="ms" style="font-size:16px;vertical-align:-3px;margin-right:6px;color:var(--text-faint)">${row.icon}</span>${row.label}</span>
          <div class="scale-ctl">
            <input type="range" class="scale-range" id="zoom${row.id}" min="${row.min}" max="${row.max}" step="5" value="${row.value}" aria-label="${esc(row.label)}">
            <span class="scale-val" id="zoom${row.id}Val">${row.value}%</span>
            <button class="btn btn-sm" data-zoom-reset="${row.id}">${L`Сбросить`}</button>
          </div>
        </div>`).join('')}
      </details>
      <details class="settings-adv" ${state.gameLangOpen ? 'open' : ''} id="gameLangAdv">
        <summary>${L`Задать языки Dota по отдельности`}</summary>
        <div class="settings-row">
          <span class="settings-label">${L`Текст`}</span>
          <div class="select-wrap">
            <span class="ms">translate</span>
            <select class="input" id="gameTextLang" style="padding-left:30px">
              ${gameLangOptions(gl.languages, gl.uiLanguage || 'english')}
            </select>
          </div>
        </div>
        <div class="settings-row">
          <span class="settings-label">${L`Озвучка`}</span>
          <div class="select-wrap">
            <span class="ms">campaign</span>
            <select class="input" id="gameAudioLang" style="padding-left:30px">
              ${gameLangOptions(gl.languages, s.langSuffix)}
            </select>
          </div>
        </div>
        <div class="settings-row">
          <button class="btn btn-sm btn-primary" id="applyGameLang">${L`Применить`}</button>
          <span style="font-size:12.5px;color:var(--text-muted)" id="gameLangHint"></span>
        </div>
        <div style="font-size:12.5px;color:var(--text-muted);margin-top:8px">
          ${L`Dota хранит эти языки отдельно: моды подхватываются из папки языка озвучки, а текст на них не влияет. Отсюда, например, английский интерфейс игры при русской озвучке.`}
        </div>
      </details>
    </div>

    <div class="settings-block" style="animation-delay:50ms">
      <h3>Discord</h3>
      <div class="settings-row">
        <span class="settings-label">${L`Показывать в Discord, что ты в Mod Manager`}</span>
        <button class="toggle ${s.discordPresence === false ? '' : 'on'}" id="presenceToggle" role="switch"
                aria-checked="${s.discordPresence !== false}" aria-label="${L`Показывать в Discord, что ты в Mod Manager`}"></button>
      </div>
      <div style="font-size:12.5px;color:var(--text-muted);margin-top:8px">
        ${L`Друзья увидят «Играет в Dota 2 Mod Manager», текущую вкладку и сколько модов включено. В самом Discord это работает, только если включено «Отображать текущую активность как статус».`}
      </div>
    </div>

    <div class="settings-block" style="animation-delay:60ms">
      <h3>${L`Путь к Dota 2`}</h3>
      <div class="settings-row">
        <span class="mono" style="flex:1">${esc(s.dotaGamePath || L`не найден`)}</span>
        <span class="dot ${s.dotaPathValid ? 'ok' : 'bad'}"></span>
      </div>
      <div class="settings-row">
        <button class="btn btn-sm" id="detectBtn">${L`Найти автоматически`}</button>
        <button class="btn btn-sm" id="browseBtn">${L`Указать вручную`}</button>
      </div>
    </div>

    <div class="settings-block" style="animation-delay:120ms">
      <h3>${L`Папка модов`}</h3>
      <div class="settings-row">
        <span class="settings-label">${L`Куда ставятся моды`}</span>
        <span class="mono" style="flex:1">dota_${esc(s.langSuffix)}</span>
        <span class="dot ${gl.selfMade ? 'bad' : 'ok'}"></span>
      </div>
      <div class="settings-row">
        <span class="settings-label">${L`Следовать языку озвучки Dota`}</span>
        <button class="toggle ${s.langSuffixAuto === false ? '' : 'on'}" id="langAutoToggle" role="switch"
                aria-checked="${s.langSuffixAuto !== false}" aria-label="${L`Следовать языку озвучки Dota`}"></button>
      </div>
      ${s.langSuffixAuto === false ? `
      <div class="settings-row">
        <span class="settings-label">${L`Языковая папка`}</span>
        <div class="select-wrap">
          <span class="ms">folder</span>
          <select class="input" id="langSelect" style="padding-left:30px">
            ${langOptions(s, gl)}
          </select>
        </div>
      </div>` : ''}
      <div style="font-size:12.5px;color:var(--text-muted);margin-top:8px">
        ${L`Dota монтирует только папку своего языка озвучки, поэтому придуманные папки вроде dota_123 больше не подхватываются. Параметр -language ни на что не влияет — его можно убрать из свойств Steam.`}
      </div>
      <div class="modal-note" style="margin-top:10px">
        <b>${L`Английский интерфейс`}</b>${L`: открой «Задать языки Dota по отдельности» в блоке «Интерфейс», поставь Текст = English, а Озвучку оставь той, чья папка уже используется. Языки независимы, моды продолжат работать.`}
      </div>
      ${gl.selfMade ? `
      <div class="modal-note warn" style="margin-top:10px">
        <b>${L`Папку dota_${s.langSuffix} создаёт приложение`}</b>${L`: Valve её не поставляет, и гарантии, что игра её смонтирует, нет. Если моды не появились в игре — выбери в настройках Dota другой Audio Language, например Russian.`}
      </div>` : ''}
      ${(gl.stranded || []).map((f) => `
      <div class="modal-note warn" style="margin-top:10px">
        <b>${L`Папка dota_${f.suffix} больше не работает`}</b>${L`: в ней ${f.modFiles} ${plural(f.modFiles, 'мод', 'мода', 'модов')}, игра их не видит.`}
        <button class="btn btn-sm" data-move-from="${esc(f.suffix)}" style="margin-left:8px">${L`Перенести сюда`}</button>
      </div>`).join('')}
      ${s.minifyDetected ? `
      <div class="modal-note" style="margin-top:10px">
        <b>${L`Обнаружен Minify`}</b>${L` (папка `}<code style="background:none;color:var(--primary-soft)">dota_minify</code>${L` рядом). Если Minify ставит моды в ту же папку, что и менеджер, их файлы будут перекрывать друг друга — ставь моды через что-то одно.`}
      </div>` : ''}
    </div>

    <div class="settings-block" style="animation-delay:180ms">
      <h3>${L`Кэш загрузок`}</h3>
      <div class="settings-row">
        <span class="settings-label">${L`Размер`}</span>
        <span style="font-variant-numeric:tabular-nums">${fmtMB(cacheSize)} MB</span>
        <button class="btn btn-sm" id="clearCacheBtn">${L`Очистить`}</button>
      </div>
      <div style="font-size:12.5px;color:var(--text-muted)">
        ${L`Скачанные архивы модов. Нужны для быстрой переустановки — удаление ничего не сломает.`}
      </div>
    </div>

    <div class="settings-block" style="animation-delay:240ms">
      <h3>${L`Каталог`}</h3>
      <div class="settings-row">
        <span class="settings-label">${L`Обновлён`}</span>
        <span>${state.catalog?.fetchedAt ? new Date(state.catalog.fetchedAt).toLocaleString(window.i18nLocale()) : '—'}</span>
        <button class="btn btn-sm" id="refreshCatBtn2">${L`Обновить сейчас`}</button>
      </div>
      <div class="settings-row">
        <span class="settings-label">${L`Источник`}</span>
        <a style="color:var(--primary-soft);cursor:pointer;font-size:12.5px" id="srcLink">github.com/h6rd/Dota2PornFxWeb</a>
      </div>
    </div>

    <div class="settings-block" style="animation-delay:270ms">
      <h3>${L`Диагностика`}</h3>
      <div style="font-size:12.5px;color:var(--text-muted)">
        ${L`Один файл с путём и настройками Dota, списком модов, состоянием патча и последними записями журнала приложения — без личных данных, кроме имени в Discord, если ты вошёл. Пришли его вместо скриншотов, если что-то не работает.`}
      </div>
      <div class="settings-row" style="margin-top:10px">
        <button class="btn btn-sm" id="diagExportBtn"><span class="ms">bug_report</span>${L`Экспортировать отчёт`}</button>
      </div>
    </div>

    <div class="settings-block" style="animation-delay:300ms">
      <h3>${L`О программе`}</h3>
      <div class="settings-row">
        <span class="settings-label">${L`Версия`}</span>
        <span style="font-variant-numeric:tabular-nums">v${esc(appVersion)}</span>
        <a style="color:var(--primary-soft);cursor:pointer;font-size:12.5px" id="repoLink">github.com/TheFleece/dota2-mod-manager</a>
      </div>
      <div style="font-size:12.5px;color:var(--text-muted)">
        ${L`Обновления скачиваются автоматически из GitHub Releases — когда новая версия готова, появится кнопка установки.`}
      </div>
      <div class="settings-row">
        <button class="btn btn-sm" id="whatsNewBtn"><span class="ms">auto_awesome</span>${L`Что нового`}</button>
      </div>
    </div>
  `;
  $('#repoLink').addEventListener('click', () => window.api.misc.openExternal('https://github.com/TheFleece/dota2-mod-manager'));
  $('#whatsNewBtn').addEventListener('click', () => showWhatsNew({ force: true }));
  $('#diagExportBtn').addEventListener('click', async () => {
    const r = await window.api.diag.export();
    if (r?.cancelled) return;
    if (r?.error) toast(r.error, 'error', 7000);
    else toast(L`Отчёт сохранён`);
  });

  // one language switch for everything: the app, Dota's text and Dota's voice. The voice
  // part decides which dota_<lang> folder the game mounts, so it moves the mods with it —
  // that is worth a yes/no rather than happening behind the user's back.
  $('#uiLangSelect').addEventListener('change', async (e) => {
    const lang = e.target.value;
    const want = lang === 'ru' ? 'russian' : 'english';
    const textNow = gl.uiLanguage || null;
    const audioNow = s.langSuffix || null;
    await applyLanguage(lang);
    toast(lang === 'ru' ? L`Язык переключён на Русский` : L`Язык переключён на English`);
    if (!s.dotaPathValid || (textNow === want && audioNow === want)) { renderSettings(); return; }
    const voiceReady = (gl.folders || []).some((f) => f.suffix === want && f.valveContent);
    const ask = audioNow === want
      ? L`Переключить и текст в самой Dota на ${langName(want)}? Игра должна быть закрыта.`
      : L`Переключить и саму Dota на ${langName(want)}? Текст в игре станет ${langName(want)}, моды переедут в папку dota_${want}${voiceReady ? '' : L`, а озвучка останется английской — пак «${langName(want)}» не скачан`}. Игра должна быть закрыта, после смены её надо перезапустить.`;
    if (!await confirmDialog(ask, { okLabel: L`Переключить`, danger: false })) { renderSettings(); return; }
    const r = await window.api.settings.setGameLanguages({ ui: want, audio: want });
    if (r?.error) toast(r.error, 'error', 7000);
    else toast(L`Dota переключена: текст «${langName(want)}», моды в dota_${want}. Перезапусти Dota.`, 'ok', 8000);
    renderSettings();
    await refreshInstalledIndex();
    refreshSidebarStatus();
  });

  // ----- scale: everything at once, or each part on its own -----
  // Scaling the content on every input event fights the drag: the slider moves under the
  // pointer, which feeds the next event. So the content shows its number while dragging and
  // applies on release. A panel is not under the pointer, so those apply live.
  const setEverything = (pct) => {
    const v = clampScale(pct);
    for (const key of ['topZoom', 'bottomZoom', 'railZoom']) state.panels[key] = clampPanelZoom(v / 100);
    paintPanels();
    savePanels();
    applyScalePct(v);
  };
  $('#masterRange')?.addEventListener('input', (e) => {
    const v = clampScale(Number(e.target.value));
    paintScale(v); // the number only, until the pointer is released
  });
  $('#masterRange')?.addEventListener('change', (e) => setEverything(Number(e.target.value)));
  $('#masterDown')?.addEventListener('click', () => setEverything(currentScalePct() - 5));
  $('#masterUp')?.addEventListener('click', () => setEverything(currentScalePct() + 5));
  $('#masterReset')?.addEventListener('click', () => setEverything(100));

  $('#zoomContent')?.addEventListener('input', (e) => paintScale(clampScale(Number(e.target.value))));
  $('#zoomContent')?.addEventListener('change', (e) => applyScalePct(Number(e.target.value)));
  for (const [id, key] of [['Top', 'topZoom'], ['Rail', 'railZoom'], ['Bottom', 'bottomZoom']]) {
    $(`#zoom${id}`)?.addEventListener('input', (e) => {
      state.panels[key] = clampPanelZoom(Number(e.target.value) / 100);
      paintPanels();
      savePanels();
    });
  }
  viewRoot.querySelectorAll('[data-zoom-reset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.zoomReset;
      if (id === 'Content') { applyScalePct(100); return; }
      state.panels[{ Top: 'topZoom', Rail: 'railZoom', Bottom: 'bottomZoom' }[id]] = 1;
      paintPanels();
      savePanels();
    });
  });
  $('#scaleAdv')?.addEventListener('toggle', (e) => { state.scaleOpen = e.target.open; });
  $('#gameLangAdv')?.addEventListener('toggle', (e) => { state.gameLangOpen = e.target.open; });
  $('#detectBtn').addEventListener('click', async () => {
    const found = await window.api.settings.detectDota();
    if (found) toast(L`Dota 2 найдена: ${found}`);
    else toast(L`Не нашёл автоматически — укажи вручную`, 'warn');
    renderSettings();
    refreshSidebarStatus();
  });
  $('#browseBtn').addEventListener('click', async () => {
    const r = await window.api.settings.browseDota();
    if (r?.error) toast(r.error, 'error');
    if (r?.path) toast(L`Путь сохранён`);
    renderSettings();
    refreshSidebarStatus();
  });
  $('#langSelect')?.addEventListener('change', async (e) => {
    await window.api.settings.set('langSuffix', e.target.value);
    toast(L`Папка модов: dota_${e.target.value}`, 'warn', 6000);
    renderSettings();
    refreshSidebarStatus();
  });
  // voices only change if Valve's pack for that language is actually downloaded
  const paintGameLangHint = () => {
    const audio = $('#gameAudioLang').value;
    const folder = (gl.folders || []).find((f) => f.suffix === audio);
    $('#gameLangHint').textContent = folder?.valveContent
      ? L`Озвучка станет ${langName(audio)}`
      : L`Озвучка останется английской: пак «${langName(audio)}» не скачан`;
  };
  paintGameLangHint();
  $('#gameAudioLang').addEventListener('change', paintGameLangHint);
  $('#applyGameLang').addEventListener('click', async () => {
    const ui = $('#gameTextLang').value;
    const audio = $('#gameAudioLang').value;
    const r = await window.api.settings.setGameLanguages({ ui, audio });
    if (r?.error) { toast(r.error, 'error', 7000); return; }
    toast(L`Готово: текст «${langName(ui)}», моды в dota_${audio}. Перезапусти Dota.`, 'ok', 8000);
    renderSettings();
    await refreshInstalledIndex();
    refreshSidebarStatus();
  });
  $('#langAutoToggle')?.addEventListener('click', async (e) => {
    const on = !e.currentTarget.classList.contains('on');
    await window.api.settings.set('langSuffixAuto', on);
    renderSettings();
    refreshSidebarStatus();
  });
  viewRoot.querySelectorAll('[data-move-from]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const r = await window.api.settings.moveLangFiles(btn.dataset.moveFrom);
      if (r?.error) toast(r.error, 'error');
      else toast(L`Перенесено файлов: ${r.moved}`, 'ok');
      renderSettings();
      await refreshInstalledIndex();
      refreshSidebarStatus();
    });
  });
  $('#presenceToggle')?.addEventListener('click', async (e) => {
    const on = !e.currentTarget.classList.contains('on');
    e.currentTarget.classList.toggle('on', on);
    e.currentTarget.setAttribute('aria-checked', String(on));
    state.settings = await window.api.settings.set('discordPresence', on);
  });
  $('#clearCacheBtn').addEventListener('click', async () => {
    await window.api.misc.clearCache();
    toast(L`Кэш очищен`);
    renderSettings();
  });
  $('#refreshCatBtn2').addEventListener('click', async () => {
    await loadCatalog(true);
    renderSettings();
  });
  $('#srcLink').addEventListener('click', () => window.api.misc.openExternal('https://github.com/h6rd/Dota2PornFxWeb'));
}

// ---------- status bar ----------

async function refreshSidebarStatus() {
  const s = await window.api.settings.get();
  state.settings = s;
  const dotEl = $('#dotaStatusDot');
  const txtEl = $('#dotaStatusText');
  if (s.dotaPathValid) {
    dotEl.className = 'dot ok';
    txtEl.textContent = L`Dota 2 подключена · моды в dota_${s.langSuffix}`;
  } else {
    dotEl.className = 'dot bad';
    txtEl.textContent = L`Dota 2 не найдена — укажи путь в настройках`;
  }
}

// ---------- progress ----------

let progressHideTimer = null;
window.api.onProgress((evt) => {
  const bar = $('#progressBar');
  if (evt.type === 'download') {
    bar.classList.remove('hidden');
    $('#progressLabel').textContent = L`Скачивание: ${evt.label}`;
    if (evt.total > 0) {
      $('#progressSize').textContent = `${fmtMB(evt.loaded)} / ${fmtMB(evt.total)} MB`;
      $('#progressFill').style.width = `${(evt.loaded / evt.total) * 100}%`;
    } else {
      $('#progressSize').textContent = `${fmtMB(evt.loaded)} MB`;
      $('#progressFill').style.width = '40%';
    }
    clearTimeout(progressHideTimer);
  } else if (evt.type === 'stage') {
    $('#progressLabel').textContent = `${evt.label}: ${evt.stage}`;
    $('#progressFill').style.width = '95%';
  } else if (evt.type === 'done' || evt.type === 'error') {
    $('#progressFill').style.width = '100%';
    clearTimeout(progressHideTimer);
    progressHideTimer = setTimeout(() => bar.classList.add('hidden'), 800);
  }
});

// ---------- auto-update ----------

window.api.update.onUpdate((evt) => {
  if (evt.type === 'available') {
    toast(L`Найдено обновление v${evt.version} — скачиваю в фоне…`, 'ok', 6000);
  } else if (evt.type === 'downloaded') {
    const bar = document.createElement('div');
    bar.className = 'update-bar';
    bar.innerHTML = `
      <span class="ms">system_update_alt</span>
      <span>${L`Обновление `}<b>v${esc(evt.version)}</b>${L` готово к установке`}</span>
      <button class="btn btn-sm btn-primary" id="updateNowBtn">${L`Перезапустить и обновить`}</button>
      <button class="btn btn-sm btn-ghost" id="updateLaterBtn">${L`Позже`}</button>`;
    document.body.appendChild(bar);
    bar.querySelector('#updateNowBtn').addEventListener('click', () => window.api.update.install());
    bar.querySelector('#updateLaterBtn').addEventListener('click', () => bar.remove());
  }
});

// ---------- language ----------

// translate the static app chrome (index.html markup) in place, preserving child nodes
function applyStaticI18n() {
  document.documentElement.lang = window.I18N_LANG;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const txt = tr(el.getAttribute('data-i18n'));
    if (el.firstChild && el.firstChild.nodeType === 3) el.firstChild.nodeValue = txt;
    else el.insertBefore(document.createTextNode(txt), el.firstChild);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => el.setAttribute('placeholder', tr(el.getAttribute('data-i18n-ph'))));
  document.querySelectorAll('[data-i18n-title]').forEach((el) => el.setAttribute('title', tr(el.getAttribute('data-i18n-title'))));
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', tr(el.getAttribute('data-i18n-aria'))));
  if (state.panels) paintPanels(); // grip labels depend on whether the panel is folded
  syncNavOverflow();               // translated tab labels change how much room they need
}

// switch the app's own UI language. It used to also pick the Dota folder (English -> dota_123),
// which is exactly what broke when Dota stopped mounting made-up folders — the folder now
// follows the game's audio language and has nothing to do with the language of this app.
async function applyLanguage(lang) {
  lang = lang === 'ru' ? 'ru' : 'en';
  window.I18N_LANG = lang;
  try { localStorage.setItem('uiLang', lang); } catch { /* ignore */ }
  await window.api.settings.set('uiLang', lang);
  applyStaticI18n();
  paintMasterSwitch();
  await refreshSidebarStatus();
  render();
}

// one-time chooser shown on first launch and once after this release ships. English is the
// default. Resolves once the user picks (the choice is applied by applyLanguage).
function showLanguagePicker() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'lang-pick-overlay';
    overlay.innerHTML = `
      <div class="lang-pick-box">
        <div class="lang-pick-logo">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l7 4v8l-7 8-7-8V6z"/><path d="M12 8v6"/><path d="M9 11h6"/></svg>
        </div>
        <h2>Choose your language</h2>
        <p>Выберите язык · you can change this anytime in Settings</p>
        <div class="lang-pick-opts">
          <button class="lang-pick-btn" data-lang="en">
            <span class="lp-flag">EN</span>
            <span class="lp-text"><b>English</b><small>App language only</small></span>
            <span class="ms lp-go">chevron_right</span>
          </button>
          <button class="lang-pick-btn" data-lang="ru">
            <span class="lp-flag">RU</span>
            <span class="lp-text"><b>Русский</b><small>Только язык приложения</small></span>
            <span class="ms lp-go">chevron_right</span>
          </button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));
    overlay.querySelectorAll('.lang-pick-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        overlay.querySelectorAll('.lang-pick-btn').forEach((b) => (b.disabled = true));
        await applyLanguage(btn.dataset.lang);
        await window.api.settings.set('langPromptSeen', true);
        overlay.classList.remove('show');
        setTimeout(() => { overlay.remove(); resolve(); }, 180);
      });
    });
  });
}

// ---------- boot ----------

(async function boot() {
  const maxed = await window.api.win.isMaximized();
  if (maxed) $('#winMax').innerHTML = '<svg viewBox="0 0 12 12" width="12" height="12"><rect x="2" y="3.5" width="6.5" height="6.5" fill="none" stroke="currentColor" stroke-width="1.1" rx="1"/><path d="M4 3.5V2.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-1" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>';

  // language: settings.json is the source of truth; reconcile the localStorage-seeded value
  const cfg = await window.api.settings.get();
  state.settings = cfg;
  state.favorites = new Set(Array.isArray(cfg.favorites) ? cfg.favorites : []);
  state.panels = readPanels(cfg.panels);
  applyContentZoom(Number(cfg.uiScale) || 1);
  window.I18N_LANG = cfg.uiLang === 'ru' ? 'ru' : 'en';
  try { localStorage.setItem('uiLang', window.I18N_LANG); } catch { /* ignore */ }
  applyStaticI18n();
  bindPanels();
  paintAccount();

  // Dota's language change moved the mods folder under us at startup — say so once
  if (cfg.langMigration) {
    toast(L`Моды перенесены в dota_${cfg.langMigration.to}: игра больше не подхватывает папку dota_${cfg.langMigration.from}`, 'warn', 9000);
  }

  await refreshSidebarStatus();
  await refreshMasterSwitch();
  await refreshPatchState();
  await refreshInstalledIndex();
  await refreshCosmeticSlots();
  await loadCatalog();

  // first launch, or first launch after this release — let the user pick a language
  if (!cfg.langPromptSeen) await showLanguagePicker();

  // the app updates itself in the background, so this is the only place a user finds out
  // what changed while they were away
  showWhatsNew();
})();
