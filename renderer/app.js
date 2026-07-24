/* Dota 2 Mod Manager — renderer */
'use strict';

const RAW_BASE = 'https://raw.githubusercontent.com/h6rd/Dota2PornFxWeb/main';

const CAT_RU = {
  heroes: 'Герои', 'item-effects': 'Эффекты предметов', 'hero-items': 'Предметы героев',
  backgrounds: 'Фоны меню', cursors: 'Курсоры', 'mega-kill': 'Мега-килл', shaders: 'Шейдеры',
  couriers: 'Курьеры', terrains: 'Ландшафты', creeps: 'Крипы', trees: 'Деревья', river: 'Река',
  'ti-bp-effects': 'Паки эффектов', emblems: 'Эмблемы', 'creep-deny': 'Денай крипов',
  music: 'Музыка', 'hero-sounds': 'Звуки героев', sounds: 'Звуки', 'ranged-attack': 'Дальние атаки',
  other: 'Разное', ranks: 'Ранги', 'item-icons': 'Иконки предметов', 'versus-screens': 'Экраны Versus',
  announcers: 'Анонсеры', wards: 'Варды', pedestal: 'Пьедесталы', huds: 'HUD',
  herofx: 'Эффекты героев', pings: 'Пинги', packs: 'Паки', optimization: 'Оптимизация',
  tormentor: 'Тормент', 'high-five': 'High Five', ancient: 'Древние', roshan: 'Рошан',
  towers: 'Башни', fonts: 'Шрифты', sites: 'Сайты', guides: 'Гайды', news: 'Новости',
  imported: 'Импортированный',
};

const CAT_ICON = {
  all: 'apps', heroes: 'person', 'hero-items': 'swords', herofx: 'auto_fix_high',
  'hero-sounds': 'record_voice_over', terrains: 'landscape', trees: 'forest', river: 'water',
  creeps: 'bug_report', towers: 'cell_tower', roshan: 'skull', ancient: 'castle',
  tormentor: 'deployed_code', wards: 'visibility', couriers: 'pets', pedestal: 'podium',
  'creep-deny': 'block', shaders: 'palette', 'ti-bp-effects': 'auto_awesome',
  'item-effects': 'bolt', 'ranged-attack': 'my_location', 'high-five': 'waving_hand',
  backgrounds: 'wallpaper', huds: 'dashboard', emblems: 'military_tech',
  'versus-screens': 'compare_arrows', 'item-icons': 'category', ranks: 'workspace_premium',
  pings: 'notifications_active', cursors: 'arrow_selector_tool', fonts: 'text_fields',
  announcers: 'mic', 'mega-kill': 'campaign', music: 'music_note', sounds: 'volume_up',
  packs: 'inventory_2', optimization: 'speed', other: 'widgets', guides: 'menu_book',
  sites: 'language', tools: 'build', news: 'newspaper',
};

// rail sections: [label, [categoryIds]]
const RAIL_SECTIONS = [
  ['Герои', ['heroes', 'hero-items', 'herofx', 'hero-sounds']],
  ['Мир', ['terrains', 'trees', 'river', 'creeps', 'towers', 'roshan', 'ancient', 'tormentor', 'wards', 'couriers', 'pedestal', 'creep-deny']],
  ['Эффекты', ['shaders', 'ti-bp-effects', 'item-effects', 'ranged-attack', 'high-five']],
  ['Интерфейс', ['backgrounds', 'huds', 'emblems', 'versus-screens', 'item-icons', 'ranks', 'pings', 'cursors', 'fonts']],
  ['Звук', ['announcers', 'mega-kill', 'music', 'sounds']],
  ['Прочее', ['packs', 'optimization', 'other', 'guides', 'sites']],
];

const CATALOG_EXCLUDE = ['tools', 'news'];

const SORTS = [
  { key: 'default', label: 'По умолчанию' },
  { key: 'date', label: 'Сначала новые' },
  { key: 'name', label: 'По имени А-Я' },
  { key: 'name-desc', label: 'По имени Я-А' },
];

const state = {
  view: 'catalog',
  catalog: null,
  settings: null,
  activeCategory: 'all',
  search: '',
  filters: { sort: 'default', tags: new Set(), installedOnly: false, group: '', hero: '' },
  installedIndex: new Map(),
  installing: new Set(),
  modIndex: new Map(),
  librarySel: new Set(),   // ids of library records ticked for bulk actions
  libSearch: '',           // library-scoped search query
  masterOff: false,        // mods master switch state (all mods disabled at once)
  packsOpen: new Set(),    // ids of expanded pack cards
  libConflicts: [],        // pairs of enabled mods that overwrite each other's files
};

const $ = (sel) => document.querySelector(sel);
const viewRoot = $('#view-root');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtMB(bytes) { return (bytes / 1024 / 1024).toFixed(1); }

function fmtDate(unix) {
  if (!unix) return '';
  return new Date(unix * 1000).toLocaleDateString(window.i18nLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
}

function plural(n, one, few, many) {
  if (window.I18N_LANG === 'en') {
    const pair = window.EN_PLURAL[many];
    return pair ? (n === 1 ? pair[0] : pair[1]) : many;
  }
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function toast(msg, type = 'ok', ms = 4000) {
  const el = document.createElement('div');
  el.className = `toast ${type === 'ok' ? '' : type}`;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), ms);
}

function previewUrl(categoryId, preview) {
  if (!preview) return null;
  if (/^https?:\/\//i.test(preview)) return preview;
  if (preview.startsWith('assets/previews/')) return `${RAW_BASE}/${preview.split('/').map(encodeURIComponent).join('/')}`;
  return `${RAW_BASE}/assets/previews/${encodeURIComponent(categoryId)}/${encodeURIComponent(preview)}`;
}

function isVideo(src) { return /\.(mp4|webm)$/i.test(src || ''); }
function isAudio(src) { return /\.(mp3|wav|ogg)$/i.test(src || ''); }
function isMedia(src) { return isVideo(src) || isAudio(src); }

// resolve a repo-relative or absolute link to a full URL
function resolveUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${RAW_BASE}/${url.split('/').map(encodeURIComponent).join('/')}`;
}

function mediaHtml(url, { hoverPlay = false, autoplay = false, controls = false, fallbackIcon = 'image' } = {}) {
  if (!url) {
    return `<div class="noimg"><span class="ms" style="font-size:36px">${esc(fallbackIcon)}</span></div>`;
  }
  if (isVideo(url)) {
    // preload="metadata" shows the first frame instead of a black box
    return `<video src="${esc(url)}" ${controls ? 'controls' : 'muted'} loop playsinline preload="${autoplay ? 'auto' : 'metadata'}" ${autoplay ? 'autoplay' : ''} ${hoverPlay ? 'data-hoverplay="1"' : ''}></video>`;
  }
  if (isAudio(url)) {
    return `<div class="audio-wrap"><span class="ms audio-icon">graphic_eq</span><audio src="${esc(url)}" controls preload="none"></audio></div>`;
  }
  return `<img src="${esc(url)}" loading="lazy" alt="">`;
}

// ---------- custom confirm dialog ----------

function confirmDialog(message, { okLabel = L`Удалить`, danger = true } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box">
        <div class="confirm-msg">${esc(message)}</div>
        <div class="confirm-actions">
          <button class="btn" data-c="no">${L`Отмена`}</button>
          <button class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}" data-c="yes">${esc(okLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const done = (v) => { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) done(false); });
    overlay.querySelector('[data-c="no"]').addEventListener('click', () => done(false));
    overlay.querySelector('[data-c="yes"]').addEventListener('click', () => done(true));
    const onKey = (e) => { if (e.key === 'Escape') done(false); };
    document.addEventListener('keydown', onKey);
    overlay.querySelector('[data-c="yes"]').focus();
  });
}

// text-input dialog (returns the entered string, or null if cancelled)
function promptDialog(message, { placeholder = '', value = '', okLabel = L`ОК` } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box">
        <div class="confirm-msg">${esc(message)}</div>
        <input class="input" id="promptInput" placeholder="${esc(placeholder)}" value="${esc(value)}" style="margin:14px 0 4px;width:100%">
        <div class="confirm-actions">
          <button class="btn" data-c="no">${L`Отмена`}</button>
          <button class="btn btn-primary" data-c="yes">${esc(okLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('#promptInput');
    const done = (v) => { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) done(null); });
    overlay.querySelector('[data-c="no"]').addEventListener('click', () => done(null));
    overlay.querySelector('[data-c="yes"]').addEventListener('click', () => done(input.value.trim() || null));
    const onKey = (e) => {
      if (e.key === 'Escape') done(null);
      if (e.key === 'Enter') done(input.value.trim() || null);
    };
    document.addEventListener('keydown', onKey);
    input.focus();
    input.select();
  });
}

function authorUrl(name) {
  return state.catalog?.constants?.MOD_AUTHOR?.[name] || state.catalog?.constants?.MOD_SENDER?.[name] || null;
}

// media the built-in player can show: only a dedicated "preview"-type link.
// Mods whose card preview is itself a video already play it on hover/in the modal.
function modPreviewMedia(categoryId, mod) {
  const link = (mod.links || []).find((l) => l.type === 'preview' && isMedia(l.url));
  return link ? resolveUrl(link.url) : null;
}

// ---------- built-in media player ----------

function fmtTime(s) {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function openPlayer(url, title) {
  const audio = isAudio(url);
  const overlay = document.createElement('div');
  overlay.className = 'player-overlay';
  overlay.innerHTML = `
    <div class="player-box ${audio ? 'audio' : ''}">
      ${audio
        ? `<div class="player-audio-visual"><span class="ms">graphic_eq</span></div><audio src="${esc(url)}" autoplay></audio>`
        : `<video src="${esc(url)}" autoplay playsinline></video>`}
      <div class="player-title">${esc(title || '')}</div>
      <button class="player-close" aria-label="${L`Закрыть`}"><span class="ms">close</span></button>
      <div class="player-controls">
        <button class="pl-btn" data-act="play" aria-label="${L`Пауза`}"><span class="ms">pause</span></button>
        <div class="pl-progress"><div class="pl-fill"></div><div class="pl-knob"></div></div>
        <span class="pl-time">0:00 / 0:00</span>
        <button class="pl-btn" data-act="mute" aria-label="${L`Звук`}"><span class="ms">volume_up</span></button>
        ${audio ? '' : `<button class="pl-btn" data-act="fs" aria-label="${L`На весь экран`}"><span class="ms">fullscreen</span></button>`}
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const media = overlay.querySelector('video, audio');
  const box = overlay.querySelector('.player-box');
  const playBtn = overlay.querySelector('[data-act="play"] .ms');
  const muteBtn = overlay.querySelector('[data-act="mute"] .ms');
  const fill = overlay.querySelector('.pl-fill');
  const knob = overlay.querySelector('.pl-knob');
  const timeEl = overlay.querySelector('.pl-time');
  const progress = overlay.querySelector('.pl-progress');

  media.loop = true;

  const close = () => {
    media.pause();
    media.removeAttribute('src'); // release the detached element so audio can't keep playing
    media.load();
    overlay.remove();
    document.removeEventListener('keydown', onKey, true); // capture flag must match addEventListener
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  };
  document.addEventListener('keydown', onKey, true);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('.player-close').addEventListener('click', close);

  const togglePlay = () => { media.paused ? media.play() : media.pause(); };
  overlay.querySelector('[data-act="play"]').addEventListener('click', togglePlay);
  media.addEventListener('play', () => { playBtn.textContent = 'pause'; });
  media.addEventListener('pause', () => { playBtn.textContent = 'play_arrow'; });
  if (!audio) media.addEventListener('click', togglePlay);

  media.addEventListener('timeupdate', () => {
    const pct = media.duration ? (media.currentTime / media.duration) * 100 : 0;
    fill.style.width = `${pct}%`;
    knob.style.left = `${pct}%`;
    timeEl.textContent = `${fmtTime(media.currentTime)} / ${fmtTime(media.duration)}`;
  });

  const seek = (e) => {
    const rect = progress.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    if (media.duration) media.currentTime = pct * media.duration;
  };
  progress.addEventListener('mousedown', (e) => {
    seek(e);
    const move = (ev) => seek(ev);
    const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });

  overlay.querySelector('[data-act="mute"]').addEventListener('click', () => {
    media.muted = !media.muted;
    muteBtn.textContent = media.muted ? 'volume_off' : 'volume_up';
  });
  const fsBtn = overlay.querySelector('[data-act="fs"]');
  if (fsBtn) {
    fsBtn.addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else box.requestFullscreen();
    });
  }
}

function keyOf(categoryId, name, styleLabel) {
  return `${categoryId}|${name}|${styleLabel || ''}`;
}

// label for a fingerprint match (array of catalog identities that share the content)
function matchLabel(matches) {
  return matches.map((m) => m.name + (m.styleLabel ? ` · ${m.styleLabel}` : '')).join(' / ');
}

// refresh the catalog "installed" lookup + the library tab counter from a list
function applyInstalled(installed) {
  state.installedIndex.clear();
  for (const rec of installed) {
    state.installedIndex.set(keyOf(rec.categoryId, rec.name, rec.styleLabel), rec);
  }
  $('#libCount').textContent = installed.length || '';
}

async function refreshInstalledIndex() {
  const { installed } = await window.api.mods.list();
  applyInstalled(installed);
}

// ---------- catalog data helpers ----------

// user-created packs live in localStorage
function customPacks() {
  try {
    return JSON.parse(localStorage.getItem('customPacks') || '[]');
  } catch {
    return [];
  }
}

function saveCustomPacks(packs) {
  localStorage.setItem('customPacks', JSON.stringify(packs));
}

function categoryMods(categoryId) {
  const data = state.catalog?.mods?.modsData?.[categoryId];
  if (!data) return [];
  if (Array.isArray(data)) {
    const mods = data.map((m) => ({ ...m, _group: null }));
    if (categoryId === 'packs') {
      for (const p of customPacks()) {
        mods.push({ name: p.name, type: 'pack', mods: p.mods, _group: null, _custom: true });
      }
    }
    return mods;
  }
  if (data.groups) {
    const out = [];
    for (const g of data.groups) {
      for (const m of g.mods || []) out.push({ ...m, _group: g.name, _groupId: g.id });
    }
    return out;
  }
  return [];
}

function isGrouped(categoryId) {
  const data = state.catalog?.mods?.modsData?.[categoryId];
  return !!(data && !Array.isArray(data) && data.groups);
}

function visibleCategories() {
  const cats = state.catalog?.constants?.categories || [];
  return cats.filter((c) => !CATALOG_EXCLUDE.includes(c.id) && categoryMods(c.id).length);
}

function buildModIndex() {
  state.modIndex.clear();
  for (const c of state.catalog?.constants?.categories || []) {
    for (const m of categoryMods(c.id)) {
      if (m.name) state.modIndex.set(m.name.toLowerCase(), { categoryId: c.id, mod: m });
    }
  }
}

function catName(id) {
  if (id === 'all') return tr('Все категории');
  return tr(CAT_RU[id]) || state.catalog?.constants?.translations?.[id] || id;
}

function catIcon(id) { return CAT_ICON[id] || 'extension'; }

function installTarget(mod) {
  const f = mod.file;
  if (!f) return null;
  if (/\.(vpk|zip)$/i.test(f)) return f;
  return null;
}

function tagLabel(categoryId, tag) {
  const cfg = state.catalog?.constants?.TAG_CONFIGS?.[categoryId];
  return cfg?.map?.[tag] || tag;
}

function isInstalled(categoryId, m) {
  return state.installedIndex.has(keyOf(categoryId, m.name, null)) ||
    (m.styles || []).some((s) => state.installedIndex.has(keyOf(categoryId, m.name, s.label)));
}

// can this mod ever carry the "Установлен" badge? (guides/sites are link-only)
function canBeInstalled(m) {
  return !!installTarget(m) || (m.styles || []).some((s) => s.file && /\.(vpk|zip)$/i.test(s.file));
}

// ---------- filtering / sorting ----------

function collectTags(mods) {
  const tags = new Map(); // tag -> count
  for (const m of mods) {
    for (const [k, v] of Object.entries(m.tags || {})) {
      if (v) tags.set(k, (tags.get(k) || 0) + 1);
    }
  }
  return [...tags.entries()].sort((a, b) => b[1] - a[1]);
}

function collectGroups(mods) {
  const seen = new Set();
  const out = [];
  for (const m of mods) {
    if (m._group && !seen.has(m._group)) {
      seen.add(m._group);
      out.push(m._group);
    }
  }
  return out;
}

function heroMatches(hero, name) {
  const re = new RegExp(`\\b${hero.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return re.test(name);
}

function applyFilters(mods, catForInstalled) {
  const f = state.filters;
  let out = mods;
  if (f.group) out = out.filter((m) => m._group === f.group);
  if (f.hero) out = out.filter((m) => heroMatches(f.hero, m.name));
  if (f.tags.size) {
    out = out.filter((m) => [...f.tags].every((t) => m.tags?.[t]));
  }
  if (f.installedOnly) {
    out = out.filter((m) => isInstalled(m._cat || catForInstalled, m));
  }
  const dateOf = (m) => m.meta?.date || 0;
  switch (f.sort) {
    case 'date': out = [...out].sort((a, b) => dateOf(b) - dateOf(a)); break;
    case 'name': out = [...out].sort((a, b) => a.name.localeCompare(b.name)); break;
    case 'name-desc': out = [...out].sort((a, b) => b.name.localeCompare(a.name)); break;
  }
  return out;
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

function switchView(view) {
  document.querySelectorAll('.tb-tab').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  state.view = view;
  $('#catRail').classList.toggle('hidden', view !== 'catalog');
  window.api.presence.view(view); // what Discord shows the user is doing
  render();
}

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

function paintMasterSwitch() {
  const btn = $('#modsMasterBtn');
  if (!btn) return;
  const on = !state.masterOff;
  btn.classList.toggle('on', on);
  btn.setAttribute('aria-checked', String(on));
  $('#modsMasterState').textContent = on ? L`вкл` : L`выкл`;
}

async function refreshMasterSwitch() {
  try {
    const r = await window.api.mods.masterState();
    state.masterOff = !!r.off;
  } catch { state.masterOff = false; }
  paintMasterSwitch();
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
  if (state.view === 'library') renderLibrary();
});

// global search
let searchTimer = null;
$('#globalSearch').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = e.target.value;
    $('#clearSearch').classList.toggle('hidden', !state.search);
    if (state.view !== 'catalog') switchView('catalog');
    else renderCatalog();
  }, 180);
});
$('#clearSearch').addEventListener('click', () => {
  $('#globalSearch').value = '';
  state.search = '';
  $('#clearSearch').classList.add('hidden');
  if (state.view === 'catalog') renderCatalog();
});

// ---------- views ----------

function render() {
  switch (state.view) {
    case 'catalog': return renderCatalog();
    case 'library': return renderLibrary();
    case 'presets': return renderPresets();
    case 'tools': return renderTools();
    case 'guides': return renderGuides();
    case 'settings': return renderSettings();
  }
}

// ===== Category rail =====

function renderRail() {
  const rail = $('#catRail');
  const cats = new Set(visibleCategories().map((c) => c.id));
  let html = `
    <button class="rail-item ${state.activeCategory === 'all' ? 'active' : ''}" data-cat="all">
      <span class="ms">apps</span>${L`Все категории`}
    </button>`;
  for (const [label, ids] of RAIL_SECTIONS) {
    const present = ids.filter((id) => cats.has(id));
    if (!present.length) continue;
    html += `<div class="rail-section">${esc(tr(label))}</div>`;
    for (const id of present) {
      html += `
        <button class="rail-item ${state.activeCategory === id ? 'active' : ''}" data-cat="${esc(id)}">
          <span class="ms">${catIcon(id)}</span>${esc(catName(id))}
          <span class="rail-cnt">${categoryMods(id).length}</span>
        </button>`;
    }
  }
  rail.innerHTML = html;
  rail.querySelectorAll('.rail-item').forEach((b) => {
    b.addEventListener('click', () => {
      state.activeCategory = b.dataset.cat;
      state.filters = { sort: 'default', tags: new Set(), installedOnly: false, group: '', hero: '' };
      if (state.search) {
        state.search = '';
        $('#globalSearch').value = '';
        $('#clearSearch').classList.add('hidden');
      }
      renderCatalog();
    });
  });
}

// ===== Catalog =====

function renderCatalog() {
  if (!state.catalog) {
    viewRoot.innerHTML = `<div class="empty-note">${L`Загрузка каталога…`}</div>`;
    return;
  }
  if (state.catalog.error) {
    viewRoot.innerHTML = `
      <div class="empty-note">
        ${L`Не удалось загрузить каталог: ${esc(state.catalog.error)}`}<br><br>
        <button class="btn btn-primary" id="retryCat">${L`Повторить`}</button>
      </div>`;
    $('#retryCat').addEventListener('click', () => loadCatalog(true));
    return;
  }

  renderRail();

  const searching = state.search.trim().length > 0;
  if (searching) return renderSearchResults();
  if (state.activeCategory === 'all') return renderHome();
  renderCategory(state.activeCategory);
}

// --- home (all categories) ---

function renderHome() {
  const cats = visibleCategories();
  const recent = (state.catalog.mods.recentlyAddedMods || [])
    .map((r) => {
      const hit = state.modIndex.get(r.name.toLowerCase());
      return hit && hit.categoryId === (r.category === 'effects-packs' ? 'ti-bp-effects' : r.category)
        ? { ...hit.mod, _cat: hit.categoryId }
        : (state.modIndex.get(r.name.toLowerCase()) ? { ...state.modIndex.get(r.name.toLowerCase()).mod, _cat: state.modIndex.get(r.name.toLowerCase()).categoryId } : null);
    })
    .filter(Boolean)
    .slice(0, 12);

  viewRoot.innerHTML = `
    <div class="home-hero">
      <h1>${L`Моды для Dota 2`}</h1>
      <p>${L`${cats.reduce((n, c) => n + categoryMods(c.id).length, 0)} модов в ${cats.length} категориях · каталог Dota2PornFx`}${state.catalog.fetchedAt ? L` · обновлён ${new Date(state.catalog.fetchedAt).toLocaleDateString(window.i18nLocale())}` : ''}</p>
    </div>
    ${recent.length ? `
      <div class="section-h"><span class="ms">new_releases</span>${L`Недавно добавленные`}</div>
      <div class="recent-row">${recent.map((m, i) => cardHtml(m, i, true)).join('')}</div>` : ''}
    <div class="section-h"><span class="ms">apps</span>${L`Категории`}</div>
    <div class="cat-tiles">
      ${cats.map((c, i) => {
        const prev = c.preview ? `${RAW_BASE}/assets/previews/categories/${encodeURIComponent(c.preview)}` : null;
        return `
        <div class="cat-tile" data-cat="${esc(c.id)}" style="--i:${Math.min(i, 24)}">
          ${prev ? mediaHtml(prev) : ''}
          <div class="ct-shade"></div>
          <div class="ct-label">
            <span class="ct-name">${esc(catName(c.id))}</span>
            <span class="ct-cnt">${categoryMods(c.id).length}</span>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;

  viewRoot.querySelectorAll('.cat-tile').forEach((t) => {
    t.addEventListener('click', () => {
      state.activeCategory = t.dataset.cat;
      state.filters = { sort: 'default', tags: new Set(), installedOnly: false, group: '', hero: '' };
      renderCatalog();
      $('#main').scrollTop = 0;
    });
  });
  bindCards(viewRoot);
}

// --- search results ---

function renderSearchResults() {
  const q = state.search.trim().toLowerCase();
  const cats = visibleCategories();
  let mods = [];
  for (const c of cats) {
    for (const m of categoryMods(c.id)) {
      if (m.name && m.name.toLowerCase().includes(q)) mods.push({ ...m, _cat: c.id });
    }
  }
  const installable = mods.some(canBeInstalled);
  mods = applyFilters(mods);

  viewRoot.innerHTML = `
    <div class="view-header">
      <h1 class="view-title">${L`Поиск:`} <span class="accent">${esc(state.search.trim())}</span></h1>
    </div>
    ${toolbarHtml(mods.length, { tags: [], groups: [], installable })}
    <div class="grid" id="modGrid">
      ${mods.length ? mods.map((m, i) => cardHtml(m, i, true)).join('') : `<div class="empty-note">${L`Ничего не найдено`}</div>`}
    </div>
  `;
  bindToolbar();
  bindCards(viewRoot, mods);
}

// --- single category ---

function renderCategory(categoryId) {
  const all = categoryMods(categoryId).map((m) => ({ ...m, _cat: categoryId }));
  const tags = collectTags(all);
  const groups = isGrouped(categoryId) ? collectGroups(all) : [];
  const heroes = categoryId === 'heroes'
    ? (state.catalog?.constants?.HEROES_LIST || []).filter((h) => all.some((m) => heroMatches(h, m.name)))
    : [];
  const mods = applyFilters(all, categoryId);
  const installable = all.some(canBeInstalled);

  const grouped = isGrouped(categoryId) && !state.filters.group && state.filters.sort === 'default';

  let gridHtml = '';
  if (!mods.length) {
    gridHtml = `<div class="empty-note">${L`Ничего не найдено — сбрось фильтры`}</div>`;
  } else if (grouped) {
    let lastGroup = null;
    mods.forEach((m, i) => {
      if (m._group !== lastGroup) {
        gridHtml += `<div class="group-title">${esc(m._group)}</div>`;
        lastGroup = m._group;
      }
      gridHtml += cardHtml(m, i);
    });
  } else {
    gridHtml = mods.map((m, i) => cardHtml(m, i)).join('');
  }

  viewRoot.innerHTML = `
    <div class="view-header">
      <h1 class="view-title">${esc(catName(categoryId))}</h1>
      <span class="view-sub">${all.length} ${plural(all.length, 'мод', 'мода', 'модов')}</span>
    </div>
    ${toolbarHtml(mods.length, { tags, groups, heroes, categoryId, installable })}
    <div class="grid" id="modGrid">${gridHtml}</div>
  `;
  bindToolbar();
  bindCards(viewRoot, mods);
}

// --- toolbar ---

const GROUP_LABEL = { 'hero-items': 'Все герои', 'item-effects': 'Все предметы', creeps: 'Все крипы', towers: 'Все башни', 'creep-deny': 'Все типы' };

function toolbarHtml(resultCount, { tags = [], groups = [], heroes = [], categoryId = null, installable = true }) {
  const f = state.filters;
  return `
    <div class="toolbar">
      <div class="select-wrap">
        <span class="ms">sort</span>
        <select id="sortSelect">
          ${SORTS.map((s) => `<option value="${s.key}" ${f.sort === s.key ? 'selected' : ''}>${esc(tr(s.label))}</option>`).join('')}
        </select>
      </div>
      ${heroes.length ? `
        <div class="select-wrap">
          <span class="ms">person</span>
          <select id="heroSelect">
            <option value="">${L`Все герои`}</option>
            ${heroes.map((h) => `<option value="${esc(h)}" ${f.hero === h ? 'selected' : ''}>${esc(h)}</option>`).join('')}
          </select>
        </div>` : ''}
      ${groups.length ? `
        <div class="select-wrap">
          <span class="ms">${categoryId === 'hero-items' ? 'person' : catIcon(categoryId) || 'group'}</span>
          <select id="groupSelect">
            <option value="">${esc(tr(GROUP_LABEL[categoryId] || 'Все группы'))}</option>
            ${groups.map((g) => `<option value="${esc(g)}" ${f.group === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}
          </select>
        </div>` : ''}
      ${installable ? `
      <div class="sep"></div>
      <button class="fchip ${f.installedOnly ? 'active' : ''}" id="installedChip">
        <span class="ms">check_circle</span>${L`Установленные`}
      </button>` : ''}
      ${tags.length ? '<div class="sep"></div>' : ''}
      ${tags.map(([tag, cnt]) => `
        <button class="fchip ${f.tags.has(tag) ? 'active' : ''}" data-tag="${esc(tag)}">
          ${esc(tagLabel(categoryId, tag))}<span style="opacity:.55">${cnt}</span>
        </button>`).join('')}
      <span class="count">${resultCount} ${plural(resultCount, 'результат', 'результата', 'результатов')}</span>
    </div>`;
}

function bindToolbar() {
  $('#sortSelect')?.addEventListener('change', (e) => {
    state.filters.sort = e.target.value;
    renderCatalog();
  });
  $('#groupSelect')?.addEventListener('change', (e) => {
    state.filters.group = e.target.value;
    renderCatalog();
  });
  $('#heroSelect')?.addEventListener('change', (e) => {
    state.filters.hero = e.target.value;
    renderCatalog();
  });
  $('#installedChip')?.addEventListener('click', () => {
    state.filters.installedOnly = !state.filters.installedOnly;
    renderCatalog();
  });
  document.querySelectorAll('.fchip[data-tag]').forEach((c) => {
    c.addEventListener('click', () => {
      const t = c.dataset.tag;
      if (state.filters.tags.has(t)) state.filters.tags.delete(t);
      else state.filters.tags.add(t);
      renderCatalog();
    });
  });
}

// --- cards ---

function cardHtml(m, i, withCat = false) {
  const cat = m._cat;
  const prev = previewUrl(cat, m.preview || (m.styles?.[0]?.preview));
  const installed = isInstalled(cat, m);
  const isPack = m.type === 'pack';
  const external = !installTarget(m) && !m.styles && !isPack;
  const tags = Object.entries(m.tags || {}).filter(([, v]) => v).map(([k]) => k).slice(0, 3);
  const author = m.author || m.sender;
  const playable = modPreviewMedia(cat, m);
  return `
    <div class="card" data-key="${esc(keyOf(cat, m.name, null))}" style="--i:${Math.min(i, 28)}">
      <div class="card-media">
        ${mediaHtml(prev, { hoverPlay: true, fallbackIcon: catIcon(cat) })}
        <div class="media-tags">
          ${installed ? `<span class="mtag ok">${L`Установлен`}</span>` : ''}
          ${isPack ? `<span class="mtag">${L`Пак · ${(m.mods || []).length}`}</span>` : ''}
          ${m._custom ? `<span class="mtag custom">${L`Свой`}</span>` : ''}
          ${external ? `<span class="mtag">${L`Ссылка`}</span>` : ''}
          ${tags.map((t) => `<span class="mtag">${esc(tagLabel(cat, t))}</span>`).join('')}
        </div>
        ${playable ? `
          <button class="mtag-play" data-play="${esc(playable)}" data-title="${esc(m.name)}" aria-label="${L`Смотреть превью`}">
            <span class="ms">play_arrow</span>${L`Превью`}
          </button>` : ''}
        ${m.styles ? `
          <div class="media-swatches">
            ${m.styles.slice(0, 5).map((s) => `<span class="swatch-dot" style="background:${esc(s.color || '#a78bfa')}"></span>`).join('')}
          </div>` : ''}
      </div>
      <div class="card-body">
        <div class="card-name">${esc(m.name)}</div>
        <div class="card-meta">
          ${withCat ? `<span>${esc(catName(cat))}</span>` : ''}
          ${m.meta?.date ? `<span>${fmtDate(m.meta.date)}</span>` : ''}
          ${author ? `<span class="author-chip"><span class="ms">person</span>${esc(author)}</span>` : ''}
        </div>
      </div>
    </div>`;
}

function bindCards(root, modsList) {
  root.querySelectorAll('.card[data-key]').forEach((card) => {
    card.addEventListener('click', () => {
      const key = card.dataset.key;
      // find the mod by key among provided list or global index
      let target = null;
      if (modsList) {
        target = modsList.find((m) => keyOf(m._cat, m.name, null) === key);
      }
      if (!target) {
        const [cat, name] = key.split('|');
        target = findModByName(cat, name);
      }
      if (target) openModModal(target._cat, target);
    });
    const v = card.querySelector('video[data-hoverplay]');
    if (v) {
      card.addEventListener('mouseenter', () => { v.play().catch(() => {}); });
      card.addEventListener('mouseleave', () => { v.pause(); });
    }
    const playBtn = card.querySelector('.mtag-play');
    if (playBtn) {
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openPlayer(playBtn.dataset.play, playBtn.dataset.title);
      });
    }
  });
}

function findModByName(cat, name) {
  if (cat === 'packs') {
    const custom = customPacks().find((p) => p.name === name);
    if (custom) return { ...custom, _cat: 'packs' };
  }
  const hit = state.modIndex.get(name.toLowerCase());
  return hit ? { ...hit.mod, _cat: hit.categoryId } : null;
}

// toggle "Установлен" badges on visible cards in place — keeps grid scroll position
function refreshCardBadges() {
  viewRoot.querySelectorAll('.card[data-key]').forEach((card) => {
    const [cat, name] = card.dataset.key.split('|');
    const mod = findModByName(cat, name);
    if (!mod) return;
    const installed = isInstalled(cat, mod);
    const badge = card.querySelector('.mtag.ok');
    if (installed && !badge) {
      card.querySelector('.media-tags')?.insertAdjacentHTML('afterbegin', `<span class="mtag ok">${L`Установлен`}</span>`);
    } else if (!installed && badge) {
      badge.remove();
    }
  });
}

// ---------- mod modal ----------

let modalState = null;

function openModModal(categoryId, mod) {
  modalState = { categoryId, mod, styleIdx: 0 };
  drawModal();
  $('#modalOverlay').classList.remove('hidden');
}

function closeModal() {
  $('#modalOverlay').classList.add('hidden');
  $('#modalContent').innerHTML = '';
  modalState = null;
}

$('#modalOverlay').addEventListener('click', (e) => {
  if (e.target === $('#modalOverlay')) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

const LINK_LABEL = { preview: 'Превью', source: 'Источник', author: 'Автор', bug: 'Баг', guide: 'Гайд' };

// A pack's `mods` entry is usually a mod-name string, but the catalog also ships
// entries shaped like { name, style } — treat both, or the modal crashes on open.
function packMemberName(entry) {
  return (typeof entry === 'string' ? entry : entry?.name || '').trim();
}

function packMembers(mod) {
  return (mod.mods || [])
    .map(packMemberName)
    .filter(Boolean)
    .map((name) => ({ name, hit: state.modIndex.get(name.toLowerCase()) }));
}

function drawModal() {
  const { categoryId, mod, styleIdx } = modalState;
  const styles = mod.styles || null;
  const cur = styles ? styles[styleIdx] : mod;
  const fileRef = styles ? cur.file : mod.file;
  const target = fileRef && /\.(vpk|zip)$/i.test(fileRef) ? fileRef : null;
  const isPack = mod.type === 'pack';
  const styleLabel = styles ? cur.label : null;
  const installedRec = state.installedIndex.get(keyOf(categoryId, mod.name, styleLabel));
  const busy = state.installing.has(keyOf(categoryId, mod.name, styleLabel));
  const guide = mod.guideId && state.catalog?.guides?.[mod.guideId];

  const links = mod.links || [];
  const playable = modPreviewMedia(categoryId, mod);
  const mediaUrl = previewUrl(categoryId, cur.preview || mod.preview);

  // author: mod.author/sender field, or an "author"-type link whose url is a name or URL
  const authorLink = links.find((l) => l.type === 'author');
  const authorName = mod.author || mod.sender ||
    (authorLink && !/^https?:\/\//i.test(authorLink.url) ? authorLink.url : null);
  const authorHref = (authorLink && /^https?:\/\//i.test(authorLink.url) ? authorLink.url : null) ||
    (authorName ? authorUrl(authorName) : null);

  const otherLinks = links.filter((l) => !(l.type === 'preview' && isMedia(l.url)) && l.type !== 'author');

  // pack contents (with per-session exclusions)
  if (isPack && !modalState.packExcluded) modalState.packExcluded = new Set();
  const members = isPack ? packMembers(mod) : [];
  const activeCount = isPack ? members.filter((x) => !modalState.packExcluded.has(x.name)).length : 0;

  $('#modalContent').innerHTML = `
    <div class="modal-media">
      ${mediaHtml(mediaUrl, { autoplay: true, fallbackIcon: catIcon(categoryId) })}
      <button class="modal-close" id="modalCloseBtn" aria-label="${L`Закрыть`}"><span class="ms">close</span></button>
      ${playable ? `
        <button class="preview-toggle" id="previewPlayBtn">
          <span class="ms">play_circle</span>${L`Смотреть превью`}
        </button>` : ''}
    </div>
    <div class="modal-body">
      <div class="modal-title-row">
        <div class="modal-title">${esc(mod.name)}</div>
      </div>
      <div class="modal-sub">
        <span>${esc(catName(categoryId))}</span>
        ${mod._group ? `<span>· ${esc(mod._group)}</span>` : ''}
        ${mod._custom ? `<span>${L`· свой пак`}</span>` : ''}
        ${mod.meta?.date ? `<span>· ${fmtDate(mod.meta.date)}</span>` : ''}
        ${authorName ? `
          <button class="author-chip ${authorHref ? 'clickable' : ''}" id="authorChip" ${authorHref ? '' : 'disabled'}>
            <span class="ms">person</span>${esc(authorName)}${authorHref ? '<span class="ms" style="font-size:11px">open_in_new</span>' : ''}
          </button>` : ''}
      </div>
      ${styles ? `
        <div class="style-row">
          ${styles.map((s, i) => `
            <button class="style-btn ${i === styleIdx ? 'active' : ''}" data-style="${i}">
              ${s.color ? `<span class="swatch" style="background:${esc(s.color)}"></span>` : ''}${esc(s.label)}
            </button>`).join('')}
        </div>` : ''}
      ${isPack ? `
        <div class="pack-list">
          ${members.map((x) => {
            const excluded = modalState.packExcluded.has(x.name);
            const thumb = x.hit ? previewUrl(x.hit.categoryId, x.hit.mod.preview || x.hit.mod.styles?.[0]?.preview) : null;
            const inst = x.hit && isInstalled(x.hit.categoryId, x.hit.mod);
            return `
            <div class="pack-row ${excluded ? 'excluded' : ''} ${x.hit ? '' : 'missing'}" data-member="${esc(x.name)}">
              ${thumb && !isVideo(thumb) ? `<img class="pack-thumb" src="${esc(thumb)}" loading="lazy" alt="">` : '<div class="pack-thumb"></div>'}
              <div class="pack-info">
                <div class="pack-mod-name">${esc(x.name)}</div>
                <div class="pack-mod-cat">${x.hit ? esc(catName(x.hit.categoryId)) : L`не найден в каталоге`}${inst ? L` · установлен` : ''}</div>
              </div>
              <button class="pack-x" data-toggle="${esc(x.name)}" aria-label="${excluded ? L`Вернуть` : L`Убрать`}">
                <span class="ms">${excluded ? 'add' : 'close'}</span>
              </button>
            </div>`;
          }).join('')}
        </div>
        <div class="pack-save-row">
          <input class="input" id="packSaveName" placeholder="${L`Название своего пака…`}" value="${mod._custom ? esc(mod.name) : ''}">
          <button class="btn btn-sm" id="packSaveBtn"><span class="ms">bookmark_add</span>${L`Сохранить пак`}</button>
          ${mod._custom ? `<button class="btn btn-sm btn-danger" id="packDeleteBtn">${L`Удалить пак`}</button>` : ''}
        </div>` : ''}
      <div class="modal-actions">
        ${isPack ? `<button class="btn btn-primary" id="installPackBtn" ${activeCount ? '' : 'disabled'}><span class="ms">download</span>${L`Установить пак (${activeCount})`}</button>` : ''}
        ${!isPack && target ? (installedRec
          ? `<button class="btn btn-danger" id="uninstallBtn"><span class="ms">delete</span>${L`Удалить`}</button>`
          : `<button class="btn btn-primary" id="installBtn" ${busy ? 'disabled' : ''}><span class="ms">download</span>${busy ? L`Установка…` : L`Установить`}</button>`) : ''}
        ${!isPack && !target && mod.file ? `<button class="btn" id="openLinkBtn"><span class="ms">open_in_new</span>${L`Открыть ссылку`}</button>` : ''}
      </div>
      ${otherLinks.length || guide ? `
        <div class="modal-links">
          ${guide ? `<button class="btn btn-sm" id="modalGuideLink"><span class="ms">menu_book</span>${L`Гайд: ${esc(guide.title)}`}</button>` : ''}
          ${otherLinks.map((l) => `<button class="btn btn-sm" data-link="${links.indexOf(l)}"><span class="ms">open_in_new</span>${esc(tr(LINK_LABEL[l.type] || l.type || 'Ссылка'))}</button>`).join('')}
        </div>` : ''}
      ${categoryId === 'fonts' ? `<div class="modal-note">${L`Шрифт ставится в файлы игры (game\\dota\\panorama\\fonts) — параметр запуска не нужен. Оригиналы сохраняются автоматически.`}</div>` : ''}
      ${categoryId === 'cursors' ? `<div class="modal-note">${L`Курсор ставится в game\\dota\\resource\\cursor — параметр запуска не нужен. Оригиналы сохраняются автоматически.`}</div>` : ''}
    </div>
  `;

  $('#modalCloseBtn').addEventListener('click', closeModal);

  const previewPlay = $('#previewPlayBtn');
  if (previewPlay) {
    previewPlay.addEventListener('click', () => openPlayer(playable, mod.name));
  }

  const authorChip = $('#authorChip');
  if (authorChip && authorHref) {
    authorChip.addEventListener('click', () => window.api.misc.openExternal(authorHref));
  }

  // pack interactions
  document.querySelectorAll('.pack-x').forEach((b) => {
    b.addEventListener('click', () => {
      const n = b.dataset.toggle;
      if (modalState.packExcluded.has(n)) modalState.packExcluded.delete(n);
      else modalState.packExcluded.add(n);
      drawModal();
    });
  });
  const packSaveBtn = $('#packSaveBtn');
  if (packSaveBtn) {
    packSaveBtn.addEventListener('click', () => {
      const name = $('#packSaveName').value.trim();
      if (!name) { toast(L`Введи название пака`, 'warn'); return; }
      const modNames = members.filter((x) => !modalState.packExcluded.has(x.name)).map((x) => x.name);
      if (!modNames.length) { toast(L`В паке не осталось модов`, 'warn'); return; }
      const packs = customPacks().filter((p) => p.name !== name && p.name !== (mod._custom ? mod.name : null));
      packs.push({ name, mods: modNames });
      saveCustomPacks(packs);
      toast(L`Пак «${name}» сохранён — он появился в категории Паки`);
      if (state.view === 'catalog' && state.activeCategory === 'packs') { closeModal(); renderCatalog(); }
    });
  }
  const packDeleteBtn = $('#packDeleteBtn');
  if (packDeleteBtn) {
    packDeleteBtn.addEventListener('click', async () => {
      if (!await confirmDialog(L`Удалить пак «${mod.name}»?`)) return;
      saveCustomPacks(customPacks().filter((p) => p.name !== mod.name));
      closeModal();
      renderCatalog();
    });
  }

  document.querySelectorAll('.style-btn').forEach((b) => {
    b.addEventListener('click', () => {
      modalState.styleIdx = Number(b.dataset.style);
      drawModal();
    });
  });

  const installBtn = $('#installBtn');
  if (installBtn) {
    installBtn.addEventListener('click', () => doInstall(categoryId, mod, styleLabel, fileRef, cur.preview || mod.preview));
  }
  const uninstallBtn = $('#uninstallBtn');
  if (uninstallBtn) {
    uninstallBtn.addEventListener('click', async () => {
      if (!await confirmDialog(L`Удалить «${mod.name}»?`)) return;
      const r = await window.api.mods.remove(installedRec.id);
      if (r.error) toast(r.error, 'error');
      else toast(L`${mod.name} удалён`);
      await refreshInstalledIndex();
      refreshCardBadges();
      drawModal();
    });
  }
  const packBtn = $('#installPackBtn');
  if (packBtn) packBtn.addEventListener('click', () => installPack(mod));
  const openLinkBtn = $('#openLinkBtn');
  if (openLinkBtn) openLinkBtn.addEventListener('click', () => window.api.misc.openExternal(mod.file));
  const guideLink = $('#modalGuideLink');
  if (guideLink) {
    guideLink.addEventListener('click', () => {
      closeModal();
      switchView('guides');
      setTimeout(() => {
        const el = document.querySelector(`[data-guide="${mod.guideId}"]`);
        if (el) { el.classList.add('open'); el.scrollIntoView({ behavior: 'smooth' }); }
      }, 80);
    });
  }
  otherLinks.forEach((l) => {
    const a = document.querySelector(`[data-link="${links.indexOf(l)}"]`);
    if (a) a.addEventListener('click', () => {
      const u = resolveUrl(l.url);
      if (u) window.api.misc.openExternal(u);
    });
  });
}

async function doInstall(categoryId, mod, styleLabel, fileRef, preview) {
  const k = keyOf(categoryId, mod.name, styleLabel);
  if (state.installing.has(k)) return;
  if (!state.settings?.dotaPathValid && categoryId !== 'tools') {
    toast(L`Сначала укажи путь к Dota 2 в настройках`, 'warn');
    return;
  }
  state.installing.add(k);
  if (modalState) drawModal();
  const chk = await window.api.mods.checkConflicts({ categoryId, name: mod.name, fileRef });
  if (chk.conflicts?.length) {
    const c = chk.conflicts[0];
    const rest = chk.conflicts.length > 1 ? L` (и ещё ${chk.conflicts.length - 1})` : '';
    const what = c.summary
      ? L`оба меняют ${c.summary}`
      : L`перекрываются ${c.count} ${plural(c.count, 'файл', 'файла', 'файлов')}`;
    const proceed = await confirmDialog(
      L`«${mod.name}» и уже установленный «${c.name}»${rest} конфликтуют — ${what}. Одновременно работать не будут, победит тот, что грузится приоритетнее. Установить всё равно?`,
      { okLabel: L`Установить`, danger: false }
    );
    if (!proceed) {
      state.installing.delete(k);
      // the conflict check downloaded the file to inspect it, which left the progress bar
      // on screen; no install follows on cancel, so nothing else would ever clear it
      const bar = $('#progressBar');
      if (bar) { bar.classList.add('hidden'); const fill = $('#progressFill'); if (fill) fill.style.width = '0%'; }
      if (modalState) drawModal();
      return { cancelled: true };
    }
  }
  const r = await window.api.mods.install({ categoryId, name: mod.name, styleLabel, fileRef, preview });
  state.installing.delete(k);
  if (r.error && !r.already) toast(`${mod.name}: ${r.error}`, 'error', 6000);
  else if (!r.error) toast(L`${mod.name} установлен`);
  await refreshInstalledIndex();
  refreshCardBadges();
  if (modalState) drawModal();
  return r;
}

async function installPack(pack) {
  const excluded = modalState?.packExcluded || new Set();
  const names = (pack.mods || []).map(packMemberName).filter((n) => n && !excluded.has(n));
  closeModal();
  let ok = 0, fail = 0, skip = 0;
  for (const name of names) {
    const hit = state.modIndex.get(name.toLowerCase());
    if (!hit) { skip++; continue; }
    const { categoryId, mod } = hit;
    const fileRef = mod.file || mod.styles?.[0]?.file;
    const styleLabel = mod.file ? null : mod.styles?.[0]?.label || null;
    if (!fileRef || !/\.(vpk|zip)$/i.test(fileRef)) { skip++; continue; }
    if (state.installedIndex.has(keyOf(categoryId, mod.name, styleLabel))) { skip++; continue; }
    const r = await doInstall(categoryId, mod, styleLabel, fileRef, mod.preview);
    if (r?.ok) ok++;
    else if (r?.cancelled) skip++;
    else fail++;
  }
  toast(L`Пак «${pack.name}»: установлено ${ok}, пропущено ${skip}${fail ? L`, ошибок ${fail}` : ''}`, fail ? 'warn' : 'ok', 7000);
  await refreshInstalledIndex();
  render();
}

// ===== Library =====

// does a record match the current library search (by its name or any member name)?
function libMatchesSearch(rec) {
  const q = state.libSearch.trim().toLowerCase();
  return !q || rec.name.toLowerCase().includes(q) || (rec.members || []).some((m) => m.name.toLowerCase().includes(q));
}

function isPackableRec(rec) {
  return !!rec && rec.kind !== 'pack' && !['fonts', 'cursors'].includes(rec.categoryId)
    && (rec.files || []).some((f) => f.root === 'lang' && /_dir\.vpk$/i.test(f.relPath));
}

// 2x2 preview grid built from a pack's first members
function packThumbGridHtml(rec) {
  const cells = (rec.members || []).slice(0, 4).map((m) => {
    const p = previewUrl(m.categoryId, m.preview);
    return p && !isVideo(p) ? `<img src="${esc(p)}" loading="lazy" alt="">`
      : `<div class="pack-thumb-cell"><span class="ms">${catIcon(m.categoryId)}</span></div>`;
  });
  while (cells.length < 4) cells.push('<div class="pack-thumb-cell"></div>');
  return `<div class="lib-thumb pack-thumb-grid">${cells.join('')}</div>`;
}

function memberRowHtml(rec, m, masterOff) {
  const key = memberKey(rec.id, m.id);
  const sel = state.librarySel.has(key);
  const p = previewUrl(m.categoryId, m.preview);
  const thumb = p && !isVideo(p) ? `<img class="member-thumb" src="${esc(p)}" loading="lazy" alt="">` : '<div class="member-thumb"></div>';
  return `
    <div class="member-row ${m.enabled ? '' : 'disabled'} ${sel ? 'selected' : ''}">
      <input type="checkbox" class="lib-check" data-check="${esc(key)}" ${sel ? 'checked' : ''} aria-label="${L`Выбрать мод в паке`}">
      ${thumb}
      <div class="member-info">
        <div class="member-name">${esc(m.name)}${m.styleLabel ? ` <span style="color:var(--primary-soft)">(${esc(m.styleLabel)})</span>` : ''}</div>
        <div class="member-meta">${esc(m.info || catName(m.categoryId))}</div>
      </div>
      <div class="member-actions">
        <button class="toggle sm ${m.enabled ? 'on' : ''}" data-mtoggle="${esc(m.id)}" data-pack="${esc(rec.id)}" role="switch" aria-checked="${m.enabled}" aria-label="${L`Включить/выключить мод в паке`}" ${masterOff ? 'disabled' : ''}></button>
        <button class="member-x" data-mremove="${esc(m.id)}" data-pack="${esc(rec.id)}" aria-label="${L`Удалить из пака`}" title="${L`Удалить из пака`}"><span class="ms">close</span></button>
      </div>
    </div>`;
}

function packRowHtml(rec, i, masterOff) {
  const selected = state.librarySel.has(rec.id);
  const open = state.packsOpen.has(rec.id);
  const members = rec.members || [];
  const onCount = members.filter((m) => m.enabled).length;
  const langDir = (rec.files || []).find((f) => f.root === 'lang' && /_dir\.vpk$/i.test(f.relPath));
  const clash = conflictPartners(rec.id);
  return `
    <div class="lib-row pack-row ${rec.enabled ? '' : 'disabled'} ${selected ? 'selected' : ''} ${clash.length ? 'conflict' : ''}" data-row="${esc(rec.id)}" style="--i:${Math.min(i, 20)}">
      <input type="checkbox" class="lib-check" data-check="${esc(rec.id)}" ${selected ? 'checked' : ''} aria-label="${L`Выбрать пак`}">
      <button class="pack-expand ${open ? 'open' : ''}" data-expand="${esc(rec.id)}" aria-expanded="${open}" aria-label="${L`Развернуть состав пака`}"><span class="ms">chevron_right</span></button>
      ${packThumbGridHtml(rec)}
      <div class="lib-info">
        <div class="lib-name">${esc(rec.name)} <span class="lib-tag pack">${L`Пак · ${members.length} ${plural(members.length, 'мод', 'мода', 'модов')}`}</span>${clash.length ? ` <span class="lib-tag conflict" title="${esc(L`Меняет те же файлы, что и: ${clash.join(', ')}`)}"><span class="ms">warning</span>${L`конфликт`}</span>` : ''}</div>
        <div class="lib-meta">
          <span>${L`${onCount} из ${members.length} включено`}</span>
          <span>${langDir ? esc(langDir.relPath) : L`пусто`}</span>
        </div>
      </div>
      <div class="lib-actions">
        <button class="toggle ${rec.enabled ? 'on' : ''}" data-id="${esc(rec.id)}" role="switch" aria-checked="${rec.enabled}" aria-label="${L`Включить/выключить пак целиком`}" ${masterOff ? 'disabled' : ''}></button>
        <button class="btn btn-sm" data-addto="${esc(rec.id)}" title="${L`Добавить моды в пак`}"><span class="ms">add</span>${L`Добавить`}</button>
        <button class="btn btn-sm" data-disband="${esc(rec.id)}" title="${L`Разобрать пак обратно на отдельные моды`}"><span class="ms">call_split</span>${L`Разобрать`}</button>
        <button class="btn btn-sm btn-danger" data-del="${esc(rec.id)}">${L`Удалить`}</button>
      </div>
    </div>
    <div class="pack-members ${open ? 'open' : ''}" data-members="${esc(rec.id)}">
      ${members.map((m) => memberRowHtml(rec, m, masterOff)).join('')}
    </div>`;
}

// names of the other enabled mods this one overwrites files of (empty = no clash)
function conflictPartners(id) {
  const out = [];
  for (const c of state.libConflicts) {
    if (c.a.id === id) out.push(c.b.name);
    else if (c.b.id === id) out.push(c.a.name);
  }
  return out;
}

function normalRowHtml(rec, i, masterOff) {
  const selectable = !['fonts', 'cursors'].includes(rec.categoryId);
  const selected = state.librarySel.has(rec.id);
  const clash = conflictPartners(rec.id);
  // own preview, else the catalog thumbnail if the file is recognised (so a matched
  // import shows an image right away, before it's even adopted)
  let prev = rec.preview ? previewUrl(rec.categoryId, rec.preview) : null;
  if (!prev && rec.match) { const cp = catalogPreviewFor(rec.match); if (cp) prev = previewUrl(rec.match[0].categoryId, cp); }
  const fileNames = rec.files.filter((f) => f.root === 'lang').map((f) => f.relPath);
  return `
    <div class="lib-row ${rec.enabled ? '' : 'disabled'} ${selected ? 'selected' : ''} ${clash.length ? 'conflict' : ''}" data-row="${esc(rec.id)}" style="--i:${Math.min(i, 20)}">
      ${selectable ? `<input type="checkbox" class="lib-check" data-check="${esc(rec.id)}" ${selected ? 'checked' : ''} aria-label="${L`Выбрать мод`}">` : '<span style="width:18px;flex-shrink:0"></span>'}
      ${prev && !isVideo(prev) ? `<img class="lib-thumb" src="${esc(prev)}" loading="lazy" alt="">` : '<div class="lib-thumb"></div>'}
      <div class="lib-info">
        <div class="lib-name">${esc(rec.name)}${rec.styleLabel ? ` <span style="color:var(--primary-soft);font-size:12px">(${esc(rec.styleLabel)})</span>` : ''}${rec.match ? ` <span class="lib-tag match">${esc(matchLabel(rec.match))}</span>` : rec.info ? ` <span class="lib-tag">${esc(rec.info)}</span>` : ''}${clash.length ? ` <span class="lib-tag conflict" title="${esc(L`Меняет те же файлы, что и: ${clash.join(', ')}`)}"><span class="ms">warning</span>${L`конфликт`}</span>` : ''}</div>
        <div class="lib-meta">
          <span>${esc(catName(rec.categoryId))}</span>
          ${fileNames.length ? `<span>${esc(fileNames.slice(0, 3).join(', '))}${fileNames.length > 3 ? '…' : ''}</span>` : ''}
          <span>${new Date(rec.installedAt).toLocaleDateString(window.i18nLocale())}</span>
        </div>
      </div>
      <div class="lib-actions">
        ${['fonts', 'cursors'].includes(rec.categoryId)
          ? `<span style="font-size:11.5px;color:var(--text-muted)">${L`всегда активен`}</span>`
          : `<button class="toggle ${rec.enabled ? 'on' : ''}" data-id="${esc(rec.id)}" role="switch" aria-checked="${rec.enabled}" aria-label="${L`Включить/выключить`}" ${masterOff ? 'disabled' : ''}></button>`}
        ${rec.match ? `<button class="btn btn-sm btn-primary" data-adopt="${esc(rec.id)}" title="${L`Привязать к каталогу`}"><span class="ms">library_add_check</span>${L`Привязать`}</button>` : ''}
        ${rec.heroes >= 2 ? `<button class="btn btn-sm" data-split="${esc(rec.id)}" title="${L`Разбить на отдельные моды по героям`}"><span class="ms">call_split</span>${L`Разобрать`}</button>` : ''}
        ${rec.files.some((f) => f.root === 'lang' && /_dir\.vpk$/i.test(f.relPath)) ? `<button class="btn btn-sm" data-export="${esc(rec.id)}" title="${L`Сохранить мод одним .vpk файлом (для отправки автору каталога)`}"><span class="ms">save</span>${L`Экспорт`}</button>` : ''}
        <button class="btn btn-sm btn-danger" data-del="${esc(rec.id)}">${L`Удалить`}</button>
      </div>
    </div>`;
}

// selection keys: a plain record id, or "m:<packId>:<memberId>" for a pack member
function isMemberKey(k) { return typeof k === 'string' && k.startsWith('m:'); }
function memberKey(packId, memberId) { return `m:${packId}:${memberId}`; }

// units that can be combined into one pack: standalone packable mods AND existing packs
function countCombinableSelected() {
  const recs = state.libRecords || [];
  let n = 0;
  for (const k of state.librarySel) {
    if (isMemberKey(k)) continue;
    const r = recs.find((x) => x.id === k);
    if (r && (isPackableRec(r) || r.kind === 'pack')) n++;
  }
  return n;
}

// selected top-level records that are recognised catalog mods (can be adopted)
function countAdoptableSelected() {
  const recs = state.libRecords || [];
  let n = 0;
  for (const k of state.librarySel) {
    if (isMemberKey(k)) continue;
    const r = recs.find((x) => x.id === k);
    if (r && r.match) n++;
  }
  return n;
}

// adopt every recognised mod at once — installed records and foreign files alike
async function adoptAll() {
  const recs = (state.libRecords || []).filter((r) => r.match);
  const exts = (state.libExternal || []).filter((f) => f.match);
  if (!recs.length && !exts.length) return;
  for (const r of recs) await window.api.mods.adoptMod(r.id, catalogPreviewFor(r.match));
  for (const f of exts) {
    const prev = catalogPreviewFor(f.match);
    if (f.kind === 'cursor') await window.api.mods.adoptCursor(prev);
    else if (f.kind === 'font') await window.api.mods.adoptFont(f.name, prev);
    else await window.api.mods.adoptExternal(f.key, prev);
  }
  toast(L`Привязано: ${recs.length + exts.length}`, 'ok');
  await refreshInstalledIndex();
  renderLibrary();
}

// top-level records the "select all" checkbox governs (visible, non-font/cursor)
function selectableRecordIds() {
  return (state.libRecords || [])
    .filter((r) => !['fonts', 'cursors'].includes(r.categoryId) && libMatchesSearch(r))
    .map((r) => r.id);
}

// catalog thumbnail for a fingerprint match, resolved from the loaded catalog index
function catalogPreviewFor(match) {
  const m = match && match[0];
  if (!m) return null;
  const hit = state.modIndex.get(m.name.toLowerCase());
  if (!hit) return null;
  const mod = hit.mod;
  if (m.styleLabel && mod.styles) {
    const st = mod.styles.find((s) => s.label === m.styleLabel);
    if (st && st.preview) return st.preview;
  }
  return mod.preview || (mod.styles && mod.styles[0] && mod.styles[0].preview) || null;
}

function syncSelectAll() {
  const cb = $('#selAll');
  if (!cb) return;
  const ids = selectableRecordIds();
  const sel = ids.filter((id) => state.librarySel.has(id)).length;
  cb.checked = ids.length > 0 && sel === ids.length;
  cb.indeterminate = sel > 0 && sel < ids.length;
}

function updateBulkBar() {
  const bar = $('#bulkBar');
  if (!bar) return;
  const n = state.librarySel.size;
  bar.classList.toggle('show', n > 0);
  document.body.classList.toggle('has-selection', n > 0);
  const cnt = $('#bulkCount');
  if (cnt) cnt.textContent = String(n);
  const cb = $('#bulkCombine');
  if (cb) cb.classList.toggle('hidden', countCombinableSelected() < 2);
  const ab = $('#bulkAdopt');
  if (ab) ab.classList.toggle('hidden', countAdoptableSelected() === 0);
  const eb = $('#bulkExtract');
  if (eb) eb.classList.toggle('hidden', countMembersSelected() === 0);
}

// how many selected items are pack members (governs the "extract from pack" action)
function countMembersSelected() {
  let n = 0;
  for (const k of state.librarySel) if (isMemberKey(k)) n++;
  return n;
}

// list body (filtered by the library search) — rebuilt on its own so typing in the
// search box never re-creates the input and steals focus
function libraryListHtml(masterOff) {
  const all = state.libRecords || [];
  if (!all.length) return `<div class="empty-note">${L`Пока ничего не установлено — загляни в Каталог`}</div>`;
  const installed = all.filter(libMatchesSearch);
  if (!installed.length) return `<div class="empty-note">${L`Ничего не найдено по запросу`}</div>`;
  return installed.map((rec, i) => rec.kind === 'pack' ? packRowHtml(rec, i, masterOff) : normalRowHtml(rec, i, masterOff)).join('');
}

function paintLibraryList() {
  const libList = $('#libList');
  if (!libList) return;
  libList.innerHTML = libraryListHtml(state.masterOff);
  syncSelectAll();
  updateBulkBar();
}

// modal picker: choose standalone packable mods (returns array of ids, or null)
function pickModsDialog(candidates, { title = L`Выбери моды`, okLabel = L`Готово` } = {}) {
  return new Promise((resolve) => {
    if (!candidates.length) { toast(L`Нет отдельных модов для добавления`, 'warn'); resolve(null); return; }
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box" style="max-width:460px;width:90vw">
        <div class="confirm-msg">${esc(title)}</div>
        <div class="pick-head">
          <label class="lib-selectall"><input type="checkbox" class="lib-check" id="pickSelAll">${L`Выбрать всё`}</label>
          <span class="pick-count" id="pickCount"></span>
        </div>
        <div class="pick-list">
          ${candidates.map((c) => `
            <label class="pick-row">
              <input type="checkbox" class="lib-check" value="${esc(c.id)}">
              <span class="pick-name">${esc(c.name)}</span>
              <span class="pick-sub">${esc(c.sub || '')}</span>
            </label>`).join('')}
        </div>
        <div class="confirm-actions">
          <button class="btn" data-c="no">${L`Отмена`}</button>
          <button class="btn btn-primary" data-c="yes">${esc(okLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    // scope to the list so the "select all" box above it is never counted as a candidate
    const boxes = [...overlay.querySelectorAll('.pick-list .lib-check')];
    const selAll = overlay.querySelector('#pickSelAll');
    const countEl = overlay.querySelector('#pickCount');
    const sync = () => {
      const n = boxes.filter((b) => b.checked).length;
      countEl.textContent = `${n} / ${boxes.length}`;
      selAll.checked = n === boxes.length;
      selAll.indeterminate = n > 0 && n < boxes.length;
    };
    selAll.addEventListener('change', () => { boxes.forEach((b) => { b.checked = selAll.checked; }); sync(); });
    boxes.forEach((b) => b.addEventListener('change', sync));
    sync();
    const done = (v) => { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) done(null); });
    overlay.querySelector('[data-c="no"]').addEventListener('click', () => done(null));
    overlay.querySelector('[data-c="yes"]').addEventListener('click', () => {
      const ids = boxes.filter((b) => b.checked).map((b) => b.value);
      done(ids.length ? ids : null);
    });
    const onKey = (e) => { if (e.key === 'Escape') done(null); };
    document.addEventListener('keydown', onKey);
  });
}

// standalone mods that can be combined / added into a pack
function standalonePackable() {
  return (state.libRecords || []).filter(isPackableRec).map((r) => ({
    id: r.id, name: r.name + (r.styleLabel ? ` (${r.styleLabel})` : ''), sub: r.info || catName(r.categoryId),
  }));
}

// combine a selection (standalone mods and/or existing packs) into one pack
async function combineSelection(ids) {
  if (!ids || ids.length < 2) { toast(L`Выбери минимум 2 элемента`, 'warn'); return; }
  const recs = (state.libRecords || []).filter((r) => ids.includes(r.id));
  const existingPack = recs.find((r) => r.kind === 'pack');
  const name = await promptDialog(existingPack ? L`Название объединённого пака:` : L`Название пака:`, {
    placeholder: L`напр. «Анимешный сет»`, value: existingPack ? existingPack.name : '', okLabel: L`Объединить`,
  });
  if (name === null) return;
  const r = await window.api.packs.combine(name, ids);
  if (r.error) { toast(r.error, 'error', 6000); return; }
  state.librarySel.clear();
  toast(L`Пак «${r.pack.name}»: ${r.pack.members.length} ${plural(r.pack.members.length, 'мод', 'мода', 'модов')}`, 'ok', 6000);
  if (r.conflicts?.length) toast(L`Пересечения файлов: ${r.conflicts.length} (победил тот, что раньше в паке)`, 'warn', 6000);
  await refreshInstalledIndex();
  renderLibrary();
}

async function renderLibrary() {
  const res = await window.api.mods.list();
  const installedAll = res.installed;
  const externalAll = res.external || [];
  state.libRecords = installedAll;
  applyInstalled(installedAll); // keep the tab counter + catalog badges in sync with the folder
  try { const ms = await window.api.mods.masterState(); state.masterOff = !!ms.off; } catch { state.masterOff = false; }
  paintMasterSwitch();
  const masterOff = state.masterOff;

  // drop selection for records (and members whose pack) that no longer exist
  const valid = new Set(installedAll.map((r) => r.id));
  for (const k of [...state.librarySel]) {
    if (isMemberKey(k)) { if (!valid.has(k.split(':')[1])) state.librarySel.delete(k); }
    else if (!valid.has(k)) state.librarySel.delete(k);
  }

  const enabledCount = installedAll.filter((m) => m.enabled).length;
  const slots = res.slots || 0;
  const slotCeil = res.slotCeil || 98;
  const nearLimit = slots >= 90;
  const external = externalAll;
  state.libExternal = externalAll;
  const matchedCount = installedAll.filter((r) => r.match).length + externalAll.filter((f) => f.match).length;

  // mods fighting over the same game files: only one of each pair actually loads
  state.libConflicts = res.conflicts || [];
  const clashPairs = state.libConflicts;
  const clashMods = new Set(clashPairs.flatMap((c) => [c.a.id, c.b.id])).size;
  const shownPairs = clashPairs.slice(0, 3);

  viewRoot.innerHTML = `
    <div class="view-header"><h1 class="view-title">${L`Библиотека`}</h1></div>
    ${masterOff ? `
      <div class="lib-banner off">
        <span class="ms">bolt</span>
        <div class="banner-body"><b>${L`Моды выключены`}</b>${L` мастер-переключателем внизу справа — игра запустится ванильной. Включи, чтобы менять моды по отдельности.`}</div>
      </div>` : ''}
    ${matchedCount > 0 ? `
      <div class="lib-banner info">
        <span class="ms">library_add_check</span>
        <div class="banner-body"><b>${matchedCount}</b> ${plural(matchedCount, 'файл опознан', 'файла опознаны', 'файлов опознаны')}${L` как моды из каталога — привяжи, чтобы получить превью и управлять как обычными.`}</div>
        <button class="btn btn-sm btn-primary" id="adoptAllBtn"><span class="ms">library_add_check</span>${L`Привязать все`}</button>
      </div>` : ''}
    ${clashPairs.length && !masterOff ? `
      <div class="lib-banner warn conflict-banner">
        <span class="ms">warning</span>
        <div class="banner-body">
          <b>${clashMods}</b> ${plural(clashMods, 'мод конфликтует', 'мода конфликтуют', 'модов конфликтуют')}${L` — меняют одни и те же файлы игры. Загрузится только один из пары, выключи лишний.`}
          <ul class="conflict-list">
            ${shownPairs.map((c) => `<li>«<b>${esc(c.a.name)}</b>» ${L`и`} «<b>${esc(c.b.name)}</b>»<span class="conflict-count">${c.count} ${plural(c.count, 'общий файл', 'общих файла', 'общих файлов')}${c.summary ? ` · ${esc(c.summary)}` : ''}</span></li>`).join('')}
            ${clashPairs.length > shownPairs.length ? `<li>${L`и ещё ${clashPairs.length - shownPairs.length}`}</li>` : ''}
          </ul>
        </div>
      </div>` : ''}
    ${nearLimit && !masterOff ? `
      <div class="lib-banner warn">
        <span class="ms">warning</span>
        <div class="banner-body">${L`Занято`} <b>${slots}</b>${L` из ${slotCeil} слотов. Игра не грузит больше ~99 отдельных паков — объедини моды в один, чтобы уместить больше.`}</div>
        <button class="btn btn-sm btn-primary" id="combineHintBtn"><span class="ms">merge</span>${L`Объединить`}</button>
      </div>` : ''}
    <div class="lib-toolbar">
      <div class="lib-search">
        <span class="ms">search</span>
        <input id="libSearch" placeholder="${L`Поиск в библиотеке…`}" value="${esc(state.libSearch)}" spellcheck="false" autocomplete="off">
        <button class="lib-search-clear ${state.libSearch ? 'show' : ''}" id="libSearchClear" aria-label="${L`Очистить`}"><span class="ms">close</span></button>
      </div>
      <span class="lib-stats">${installedAll.length} ${plural(installedAll.length, 'мод', 'мода', 'модов')} · ${enabledCount} ${L`вкл`} · ${slots}/${slotCeil} ${plural(slots, 'слот', 'слота', 'слотов')}</span>
      <div class="lib-toolbar-actions">
        <button class="btn btn-sm" id="importVpkBtn"><span class="ms">upload_file</span>${L`Импорт VPK`}</button>
        <button class="btn btn-sm" id="importFolderBtn" title="${L`Импортировать все .vpk из папки — например из распакованного пака Dota 2 Skinchanger`}"><span class="ms">drive_folder_upload</span>${L`Импорт папки`}</button>
        <button class="btn btn-sm" id="openFolderBtn2"><span class="ms">folder_open</span>${L`Папка модов`}</button>
      </div>
    </div>
    ${installedAll.length ? `
      <div class="lib-listhead">
        <label class="lib-selectall" title="${L`Выбрать всё`}"><input type="checkbox" class="lib-check" id="selAll">${L`Выбрать всё`}</label>
        <span class="lib-listhead-hint">${L`Отметь моды галочками — объединить в пак или массово управлять`}</span>
        <button class="btn btn-ghost btn-xs" id="enableAllBtn" ${masterOff ? 'disabled' : ''}>${L`Включить все`}</button>
        <button class="btn btn-ghost btn-xs" id="disableAllBtn" ${masterOff ? 'disabled' : ''}>${L`Выключить все`}</button>
      </div>` : ''}
    <div class="lib-list" id="libList"></div>
    ${external.length ? `
      <div class="section-h" style="margin-top:26px"><span class="ms">folder_zip</span>${L`Внешние файлы в папке модов`}</div>
      <div style="color:var(--text-muted);font-size:12.5px;margin-bottom:10px">${L`Файлы, установленные не через менеджер`}</div>
      <div class="lib-list" id="extList"></div>` : ''}
    <div style="height:72px"></div>
    <div class="bulk-bar" id="bulkBar">
      <span class="bulk-count"><b id="bulkCount">0</b> ${L`выбрано`}</span>
      <div class="bulk-actions">
        <button class="btn btn-sm" id="bulkEnable" ${masterOff ? 'disabled' : ''}><span class="ms">radio_button_checked</span>${L`Включить`}</button>
        <button class="btn btn-sm" id="bulkDisable" ${masterOff ? 'disabled' : ''}><span class="ms">radio_button_unchecked</span>${L`Выключить`}</button>
        <button class="btn btn-sm btn-primary hidden" id="bulkCombine"><span class="ms">merge</span>${L`Объединить в пак`}</button>
        <button class="btn btn-sm hidden" id="bulkExtract"><span class="ms">unarchive</span>${L`Вытащить из пака`}</button>
        <button class="btn btn-sm hidden" id="bulkAdopt"><span class="ms">library_add_check</span>${L`Привязать`}</button>
        <button class="btn btn-sm btn-danger" id="bulkRemove"><span class="ms">delete</span>${L`Удалить`}</button>
      </div>
      <button class="bulk-close" id="bulkClear" aria-label="${L`Сбросить выбор`}" title="${L`Сбросить выбор`}"><span class="ms">close</span></button>
    </div>
  `;

  paintLibraryList();
  bindLibrary(external);
}

async function bindLibrary(external) {
  const byId = (id) => (state.libRecords || []).find((r) => r.id === id);
  const reRender = async () => { await refreshInstalledIndex(); renderLibrary(); };

  // ----- search (repaints only the list so the input never loses focus) -----
  let searchTimer = null;
  $('#libSearch')?.addEventListener('input', (e) => {
    state.libSearch = e.target.value;
    $('#libSearchClear')?.classList.toggle('show', !!state.libSearch);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => paintLibraryList(), 140);
  });
  $('#libSearchClear')?.addEventListener('click', () => {
    state.libSearch = '';
    const inp = $('#libSearch'); if (inp) inp.value = '';
    $('#libSearchClear')?.classList.remove('show');
    paintLibraryList();
    inp?.focus();
  });

  // ----- select all / none (tri-state checkbox) -----
  $('#selAll')?.addEventListener('change', (e) => {
    const ids = selectableRecordIds();
    if (e.target.checked) ids.forEach((id) => state.librarySel.add(id));
    else ids.forEach((id) => state.librarySel.delete(id));
    paintLibraryList();
  });

  // ----- bulk bar -----
  $('#bulkClear')?.addEventListener('click', () => { state.librarySel.clear(); paintLibraryList(); });
  $('#bulkEnable')?.addEventListener('click', () => bulkSetEnabled(true));
  $('#bulkDisable')?.addEventListener('click', () => bulkSetEnabled(false));
  $('#bulkRemove')?.addEventListener('click', async () => {
    const keys = [...state.librarySel];
    if (!keys.length) return;
    if (!await confirmDialog(L`Удалить выбранное (${keys.length})?`)) return;
    for (const k of keys) {
      if (isMemberKey(k)) { const [, packId, memberId] = k.split(':'); await window.api.packs.removeMember(packId, memberId); }
      else await window.api.mods.remove(k);
    }
    state.librarySel.clear();
    toast(L`Удалено`);
    reRender();
  });
  $('#bulkCombine')?.addEventListener('click', () => combineSelection([...state.librarySel].filter((k) => {
    if (isMemberKey(k)) return false;
    const r = byId(k);
    return r && (isPackableRec(r) || r.kind === 'pack');
  })));
  $('#combineHintBtn')?.addEventListener('click', async () => {
    const ids = await pickModsDialog(standalonePackable(), { title: L`Выбери моды для объединения в пак`, okLabel: L`Далее` });
    if (ids) combineSelection(ids);
  });
  $('#bulkExtract')?.addEventListener('click', async () => {
    // group selected member keys by their pack, extract each group in one rebuild
    const byPack = new Map();
    for (const k of state.librarySel) {
      if (!isMemberKey(k)) continue;
      const [, packId, memberId] = k.split(':');
      if (!byPack.has(packId)) byPack.set(packId, []);
      byPack.get(packId).push(memberId);
    }
    if (!byPack.size) return;
    let total = 0;
    for (const [packId, memberIds] of byPack) {
      const r = await window.api.packs.extractMembers(packId, memberIds);
      if (r.error) { toast(r.error, 'error', 6000); continue; }
      total += r.count || 0;
    }
    state.librarySel.clear();
    toast(L`Вытащено из пака: ${total}`, 'ok');
    reRender();
  });
  $('#adoptAllBtn')?.addEventListener('click', adoptAll);
  $('#bulkAdopt')?.addEventListener('click', async () => {
    const recs = [...state.librarySel].filter((k) => !isMemberKey(k)).map(byId).filter((r) => r && r.match);
    if (!recs.length) return;
    for (const r of recs) await window.api.mods.adoptMod(r.id, catalogPreviewFor(r.match));
    state.librarySel.clear();
    toast(L`Привязано: ${recs.length}`, 'ok');
    reRender();
  });

  // ----- checkbox selection (delegated; repaint-free to keep scroll) -----
  const libList = $('#libList');
  libList?.addEventListener('change', (e) => {
    const cb = e.target.closest('.lib-check[data-check]');
    if (!cb) return;
    const key = cb.dataset.check;
    if (cb.checked) state.librarySel.add(key); else state.librarySel.delete(key);
    cb.closest('.lib-row, .member-row')?.classList.toggle('selected', cb.checked);
    syncSelectAll();
    updateBulkBar();
  });

  // ----- row / pack / member actions (delegated) -----
  libList?.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-expand],[data-id],[data-mtoggle],[data-mremove],[data-addto],[data-disband],[data-del],[data-export],[data-adopt],[data-split]');
    if (!el) return;

    if (el.dataset.expand !== undefined && el.dataset.expand) {
      const id = el.dataset.expand;
      const open = !state.packsOpen.has(id);
      if (open) state.packsOpen.add(id); else state.packsOpen.delete(id);
      el.classList.toggle('open', open);
      el.setAttribute('aria-expanded', String(open));
      libList.querySelector(`.pack-members[data-members="${id}"]`)?.classList.toggle('open', open);
      return;
    }
    if (el.classList.contains('toggle') && el.dataset.id) {
      const rec = byId(el.dataset.id);
      const r = await window.api.mods.setEnabled(rec.id, !rec.enabled);
      if (r.error) toast(r.error, 'error');
      reRender();
      return;
    }
    if (el.dataset.mtoggle) {
      const pack = byId(el.dataset.pack);
      const m = pack?.members.find((x) => x.id === el.dataset.mtoggle);
      el.disabled = true;
      const r = await window.api.packs.setMemberEnabled(el.dataset.pack, el.dataset.mtoggle, !(m && m.enabled));
      if (r.error) toast(r.error, 'error', 6000);
      reRender();
      return;
    }
    if (el.dataset.mremove) {
      const pack = byId(el.dataset.pack);
      const m = pack?.members.find((x) => x.id === el.dataset.mremove);
      if (!await confirmDialog(L`Убрать «${m?.name || tr('мод')}» из пака?`, { okLabel: L`Убрать` })) return;
      const r = await window.api.packs.removeMember(el.dataset.pack, el.dataset.mremove);
      if (r.error) toast(r.error, 'error', 6000);
      else if (r.removedPack) toast(L`Пак удалён — в нём не осталось модов`);
      else toast(L`Убрано из пака`);
      reRender();
      return;
    }
    if (el.dataset.addto) {
      const ids = await pickModsDialog(standalonePackable(), { title: L`Добавить моды в пак`, okLabel: L`Добавить` });
      if (!ids) return;
      const r = await window.api.packs.addMembers(el.dataset.addto, ids);
      if (r.error) toast(r.error, 'error', 6000);
      else toast(L`Добавлено в пак: ${r.added}`);
      reRender();
      return;
    }
    if (el.dataset.disband) {
      const rec = byId(el.dataset.disband);
      if (!await confirmDialog(L`Разобрать пак «${rec.name}» на отдельные моды? Каждый мод снова займёт свой слот.`, { okLabel: L`Разобрать` })) return;
      const r = await window.api.packs.disband(el.dataset.disband);
      if (r.error) toast(r.error, 'error', 6000);
      else toast(L`Разобрано на ${r.count}: ${r.names.slice(0, 4).join(', ')}${r.names.length > 4 ? '…' : ''}`, 'ok', 6000);
      reRender();
      return;
    }
    if (el.dataset.del) {
      const rec = byId(el.dataset.del);
      if (!await confirmDialog(rec.kind === 'pack' ? L`Удалить пак «${rec.name}» со всеми модами внутри?` : L`Удалить «${rec.name}»?`)) return;
      const r = await window.api.mods.remove(rec.id);
      if (r.error) toast(r.error, 'error');
      else toast(L`${rec.name} удалён`);
      reRender();
      return;
    }
    if (el.dataset.export) {
      const rec = byId(el.dataset.export);
      el.disabled = true;
      const prev = el.innerHTML;
      el.innerHTML = `<span class="ms">hourglass_empty</span>${L`Собираю…`}`;
      const r = await window.api.mods.exportSingle(rec.id);
      el.disabled = false; el.innerHTML = prev;
      if (r.error) toast(`${rec.name}: ${r.error}`, 'error', 6000);
      else if (r.ok) toast(L`${rec.name} сохранён одним файлом (${fmtMB(r.size)} MB)`, 'ok', 6000);
      return;
    }
    if (el.dataset.adopt) {
      el.disabled = true;
      const rec = byId(el.dataset.adopt);
      const r = await window.api.mods.adoptMod(el.dataset.adopt, catalogPreviewFor(rec && rec.match));
      if (r.error) toast(r.error, 'error', 6000);
      else toast(L`Привязан к каталогу: «${r.name}»`, 'ok');
      reRender();
      return;
    }
    if (el.dataset.split) {
      const rec = byId(el.dataset.split);
      if (!await confirmDialog(L`Разбить «${rec.name}» на отдельные моды по героям? Исходный файл заменится на отдельные, каждый можно будет включать и удалять по отдельности.`, { okLabel: L`Разобрать` })) return;
      el.disabled = true;
      const r = await window.api.mods.splitMod(rec.id);
      if (r.error) toast(r.error, 'error', 6000);
      else toast(L`Разобрано на ${r.count}: ${r.names.join(', ')}`, 'ok', 6000);
      reRender();
      return;
    }
  });

  // ----- toolbar -----
  $('#enableAllBtn')?.addEventListener('click', () => bulkToggle(state.libRecords || [], true));
  $('#disableAllBtn')?.addEventListener('click', () => bulkToggle(state.libRecords || [], false));
  $('#importVpkBtn')?.addEventListener('click', async () => handleImportResult(await window.api.mods.importDialog()));
  $('#importFolderBtn')?.addEventListener('click', async () => handleImportResult(await window.api.mods.importFolderDialog()));
  $('#openFolderBtn2')?.addEventListener('click', () => window.api.misc.openLangFolder());

  if (external.length) {
    const extList = $('#extList');
    for (const f of external) {
      const row = document.createElement('div');
      row.className = `lib-row ${f.enabled ? '' : 'disabled'}`;
      const label = f.match ? `<span class="lib-tag match">${esc(matchLabel(f.match))}</span>`
        : f.info ? `<span class="lib-tag">${esc(f.info)}</span>` : '';
      const simple = f.kind === 'cursor' || f.kind === 'font'; // full-folder/subset sets — adopt only
      const displayName = f.kind === 'cursor' ? L`Курсор в игре` : f.name;
      const sub = f.kind === 'cursor' ? 'resource/cursor'
        : f.kind === 'font' ? L`шрифт · panorama/fonts`
        : f.match ? L`мод из каталога` : f.info ? L`опознан по содержимому` : L`внешний файл`;
      const size = simple ? '' : `<span>${fmtMB(f.size)} MB</span>`;
      row.innerHTML = `
        <div class="lib-thumb"></div>
        <div class="lib-info">
          <div class="lib-name">${esc(displayName)}${label ? ' ' + label : ''}</div>
          <div class="lib-meta">${size}<span>${sub}</span></div>
        </div>
        <div class="lib-actions">
          ${simple ? '' : `<button class="toggle ${f.enabled ? 'on' : ''}" data-ext="${esc(f.key)}" role="switch" aria-checked="${f.enabled}"></button>`}
          ${f.match ? `<button class="btn btn-sm btn-primary" data-adopt="${esc(f.key)}" title="${L`Привязать к каталогу и управлять как обычным модом`}"><span class="ms">library_add_check</span>${L`Принять`}</button>` : ''}
          ${f.heroes >= 2 ? `<button class="btn btn-sm" data-extsplit="${esc(f.key)}" title="${L`Разбить на отдельные моды по героям`}"><span class="ms">call_split</span>${L`Разобрать`}</button>` : ''}
          ${simple ? '' : `<button class="btn btn-sm btn-danger" data-extdel="${esc(f.key)}">${L`Удалить`}</button>`}
        </div>
      `;
      extList.appendChild(row);
    }
    const byKey = (k) => external.find((x) => x.key === k);
    extList.querySelectorAll('.toggle').forEach((t) => {
      t.addEventListener('click', async () => {
        const f = byKey(t.dataset.ext);
        await window.api.mods.externalSetEnabled(f.key, !f.enabled);
        renderLibrary();
      });
    });
    extList.querySelectorAll('[data-adopt]').forEach((b) => {
      b.addEventListener('click', async () => {
        b.disabled = true;
        const f = byKey(b.dataset.adopt);
        const prev = catalogPreviewFor(f.match);
        const r = f.kind === 'cursor' ? await window.api.mods.adoptCursor(prev)
          : f.kind === 'font' ? await window.api.mods.adoptFont(f.name, prev)
          : await window.api.mods.adoptExternal(f.key, prev);
        if (r.error) toast(r.error, 'error', 6000);
        else toast(L`«${r.name}» принят из каталога`, 'ok');
        await refreshInstalledIndex();
        renderLibrary();
      });
    });
    extList.querySelectorAll('[data-extsplit]').forEach((b) => {
      b.addEventListener('click', async () => {
        const f = byKey(b.dataset.extsplit);
        if (!await confirmDialog(L`Разбить «${f.name}» на отдельные моды по героям? Файл заменится на отдельные управляемые моды.`, { okLabel: L`Разобрать` })) return;
        b.disabled = true;
        const r = await window.api.mods.splitExternal(f.key);
        if (r.error) toast(r.error, 'error', 6000);
        else toast(L`Разобрано на ${r.count}: ${r.names.join(', ')}`, 'ok', 6000);
        await refreshInstalledIndex();
        renderLibrary();
      });
    });
    extList.querySelectorAll('[data-extdel]').forEach((b) => {
      b.addEventListener('click', async () => {
        const f = byKey(b.dataset.extdel);
        if (!await confirmDialog(L`Удалить файл ${f.name}?`)) return;
        await window.api.mods.externalRemove(f.key);
        renderLibrary();
      });
    });
  }
}

async function handleImportResult(r) {
  if (!r || r.cancelled) return;
  if (r.error) { toast(r.error, 'error', 6000); return; }
  for (const e of r.errors || []) toast(`${e.source}: ${e.error}`, 'warn', 5000);
  const n = (r.imported || []).length;
  if (n) toast(L`Импортировано: ${n} ${plural(n, 'мод', 'мода', 'модов')}`);
  // multi-volume packs (Skinchanger: pak01_dir.vpk + pak01_000.vpk) arrive as one file
  const merged = (r.imported || []).filter((imp) => imp.merged > 1);
  if (merged.length) {
    const parts = merged.reduce((s, imp) => s + imp.merged, 0);
    toast(L`${parts} ${plural(parts, 'файл склеен', 'файла склеены', 'файлов склеены')} в ${merged.length} ${plural(merged.length, 'мод', 'мода', 'модов')}`);
  }
  for (const imp of r.imported || []) {
    if (imp.conflicts?.length) {
      toast(L`«${imp.name}» перекрывается с: ${imp.conflicts.slice(0, 2).join(', ')}${imp.conflicts.length > 2 ? '…' : ''}`, 'warn', 7000);
    }
  }
  await refreshInstalledIndex();
  if (state.view === 'library') renderLibrary();
}

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
    // the hint has to say what THIS tab takes, since the two tabs take different files
    document.body.dataset.drop = ['library', 'presets'].includes(state.view) ? state.view : 'none';
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

// Library tab: mod files, an archive of them, or a folder to scan.
async function dropMods(dropped) {
  const wanted = dropped.filter((f) => /\.(vpk|zip)$/i.test(f.name || '') || isFolderFile(f));
  if (!wanted.length) {
    const hint = dropped.some((f) => /\.d2mm$/i.test(f.name || ''))
      ? L`Это пресет — открой его во вкладке «Пресеты»`
      : L`Импортировать можно .vpk файлы, .zip или папку с ними`;
    toast(hint, 'warn', 5000);
    return;
  }
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

// Presets tab: shared preset files only.
async function dropPresets(dropped) {
  const file = dropped.find((f) => /\.d2mm$/i.test(f.name || ''));
  if (!file) {
    const hint = dropped.some((f) => /\.(vpk|zip)$/i.test(f.name || '') || isFolderFile(f))
      ? L`Это мод — перетащи его во вкладку «Библиотека»`
      : L`Сюда можно перетащить файл пресета .d2mm`;
    toast(hint, 'warn', 5000);
    return;
  }
  let p = null;
  try { p = window.api.mods.pathForFile(file); } catch { /* no path for this drop */ }
  if (!p) { toast(L`Не удалось прочитать файл пресета`, 'error'); return; }
  handlePresetImport(await window.api.presets.importFile(p));
}

document.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('dropping');
  const dropped = [...(e.dataTransfer?.files || [])];
  if (!dropped.length) return;
  // each tab accepts its own kind of file, so a drop is never ambiguous
  if (state.view === 'presets') return dropPresets(dropped);
  if (state.view === 'library') return dropMods(dropped);
  toast(L`Моды перетаскивай в «Библиотеку», пресеты — в «Пресеты»`, 'warn', 5000);
});

// a d2mm:// link clicked outside the app (or the one it was launched with)
window.api.presets.onLink((res) => handlePresetImport(res));

async function bulkToggle(installed, enabled) {
  for (const rec of installed) {
    if (['fonts', 'cursors'].includes(rec.categoryId)) continue;
    if (rec.enabled !== enabled) await window.api.mods.setEnabled(rec.id, enabled);
  }
  renderLibrary();
  refreshInstalledIndex();
}

// enable/disable exactly the ticked items — works on both top-level mods and pack members
async function bulkSetEnabled(enabled) {
  const keys = [...state.librarySel];
  if (!keys.length) return;
  for (const k of keys) {
    if (isMemberKey(k)) {
      const [, packId, memberId] = k.split(':');
      await window.api.packs.setMemberEnabled(packId, memberId, enabled);
    } else {
      const rec = (state.libRecords || []).find((r) => r.id === k);
      if (!rec || ['fonts', 'cursors'].includes(rec.categoryId)) continue;
      if (rec.enabled !== enabled) await window.api.mods.setEnabled(k, enabled);
    }
  }
  toast(enabled ? L`Включено` : L`Выключено`);
  await refreshInstalledIndex();
  renderLibrary();
}

// ===== Presets =====

// Pre-flight for sharing: shows what travels as a catalog reference (free) and what has to
// go in as bytes, so a 190 MB file is a choice and not a surprise. Returns the export
// options, or null if cancelled.
function shareDialog(plan) {
  const heavy = [];
  for (const e of plan.entries) {
    if (e.kind === 'embedded') heavy.push(e);
    for (const m of e.members || []) if (m.kind === 'embedded') heavy.push(m);
  }
  const count = (kind) => plan.entries.reduce((n, e) => n
    + (e.kind === kind ? 1 : 0)
    + (e.members || []).filter((m) => m.kind === kind).length, 0);
  const refs = count('catalog');
  const gone = count('missing');

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box share-box">
        <div class="share-title">${L`Поделиться пресетом «${plan.name}»`}</div>
        <div class="share-line">
          <span class="ms">link</span>
          <div><b>${refs}</b> ${plural(refs, 'мод из каталога', 'мода из каталога', 'модов из каталога')}
          <span class="share-hint">${L`уедут ссылками, почти не весят`}</span></div>
        </div>
        ${heavy.length ? `
          <div class="share-line">
            <span class="ms">inventory_2</span>
            <div><b>${heavy.length}</b> ${plural(heavy.length, 'свой мод', 'своих мода', 'своих модов')}
            <span class="share-hint">${L`нет в каталоге, поедут файлом целиком`}</span></div>
          </div>
          <div class="share-list">
            ${heavy.map((e) => `
              <label class="share-item">
                <input type="checkbox" class="lib-check" data-skip="${esc(e.key)}" checked>
                <span class="share-item-name">${esc(e.name)}</span>
                <span class="share-item-size">${fmtMB(e.size)} ${L`МБ`}</span>
              </label>`).join('')}
          </div>` : ''}
        ${gone ? `<div class="share-line muted"><span class="ms">block</span><div>${gone} ${plural(gone, 'мод не получится передать', 'мода не получится передать', 'модов не получится передать')}</div></div>` : ''}
        <input class="input" id="shareAuthor" placeholder="${L`Твой ник (необязательно)`}" maxlength="80" style="margin-top:12px" value="${esc(state.settings?.account?.username || '')}">
        <input class="input" id="shareNote" placeholder="${L`Пара слов о сборке (необязательно)`}" maxlength="200" style="margin-top:8px">
        <div class="share-total">${L`Размер файла:`} <b id="shareSize"></b></div>
        <div class="confirm-actions">
          <button class="btn" data-c="no">${L`Отмена`}</button>
          <button class="btn btn-primary" data-c="yes"><span class="ms">save</span>${L`Сохранить файл`}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const boxes = [...overlay.querySelectorAll('[data-skip]')];
    const paintSize = () => {
      const bytes = heavy.reduce((s, e, i) => s + (boxes[i]?.checked ? e.size : 0), 0);
      overlay.querySelector('#shareSize').textContent = bytes > 512 * 1024
        ? `~${fmtMB(bytes)} ${L`МБ`}`
        : L`несколько КБ`;
    };
    boxes.forEach((b) => b.addEventListener('change', paintSize));
    paintSize();

    const done = (v) => { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) done(null); });
    overlay.querySelector('[data-c="no"]').addEventListener('click', () => done(null));
    overlay.querySelector('[data-c="yes"]').addEventListener('click', () => done({
      skip: boxes.filter((b) => !b.checked).map((b) => b.dataset.skip),
      author: overlay.querySelector('#shareAuthor').value.trim(),
      note: overlay.querySelector('#shareNote').value.trim(),
    }));
    const onKey = (e) => { if (e.key === 'Escape') done(null); };
    document.addEventListener('keydown', onKey);
  });
}

// Copy feedback in place of a dialog: the button goes green and says so for a few
// seconds. The original markup is stashed on the element so a double click can't lose it.
function flashCopied(btn) {
  clearTimeout(btn._copiedTimer);
  if (!btn._copiedOriginal) btn._copiedOriginal = btn.innerHTML;
  btn.classList.add('copied');
  btn.innerHTML = `<span class="ms">check</span>${L`Скопировано`}`;
  btn._copiedTimer = setTimeout(() => {
    btn.classList.remove('copied');
    btn.innerHTML = btn._copiedOriginal;
  }, 5000);
}

// a received preset that hasn't been installed yet
function sharedPresetCardHtml(p) {
  const s = p.status || { installed: 0, download: 0, embedded: 0, unavailable: [] };
  const total = s.installed + s.download + s.embedded + s.unavailable.length;
  const bits = [];
  if (s.installed) bits.push(L`${s.installed} уже стоят`);
  if (s.download) bits.push(L`${s.download} скачать из каталога`);
  if (s.embedded) bits.push(L`${s.embedded} внутри файла`);
  return `
    <div class="preset-head">
      <div class="preset-name">${esc(p.name)}</div>
      <span class="lib-tag">${L`получен`}${p.source?.author ? ` · ${esc(p.source.author)}` : ''}</span>
      <span style="font-size:12px;color:var(--text-muted)">${total} ${plural(total, 'мод', 'мода', 'модов')}</span>
      <button class="btn btn-sm btn-primary" data-resolve="${p.id}"><span class="ms">download</span>${L`Установить`}</button>
      <button class="btn btn-sm btn-danger" data-pdel="${p.id}">${L`Удалить`}</button>
    </div>
    ${p.source?.note ? `<div class="preset-note">${esc(p.source.note)}</div>` : ''}
    <div class="preset-mods">${bits.join(' · ') || L`нечего устанавливать`}</div>
    ${s.unavailable.length ? `
      <div class="preset-warn"><span class="ms">warning</span>${L`Не найдены ни у тебя, ни в файле:`} ${esc(s.unavailable.slice(0, 5).join(', '))}${s.unavailable.length > 5 ? '…' : ''}</div>` : ''}`;
}

async function renderPresets() {
  const presets = await window.api.presets.list();
  const { installed } = await window.api.mods.list();
  const byId = new Map(installed.map((m) => [m.id, m]));

  viewRoot.innerHTML = `
    <div class="view-header"><h1 class="view-title">${L`Пресеты`}</h1></div>
    <div style="color:var(--text-muted);font-size:13px;margin-bottom:14px">
      ${L`Пресет запоминает, какие моды включены. Применение пресета включает его моды и выключает остальные. Готовым пресетом можно поделиться файлом — перетащи полученный .d2mm сюда.`}
    </div>
    <div class="preset-new">
      <input class="input" id="presetName" placeholder="${L`Название пресета (напр. «Анимешный», «Минимал»)`}">
      <button class="btn btn-primary" id="savePresetBtn"><span class="ms">save</span>${L`Сохранить текущее состояние`}</button>
      <button class="btn" id="importPresetBtn"><span class="ms">upload_file</span>${L`Открыть .d2mm`}</button>
    </div>
    <div id="presetList">
      ${presets.length ? '' : `<div class="empty-note">${L`Пресетов пока нет`}</div>`}
    </div>
  `;

  const list = $('#presetList');
  presets.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = `preset-card ${p.wanted ? 'shared' : ''}`;
    card.style.setProperty('--i', i);
    if (p.wanted) {
      card.innerHTML = sharedPresetCardHtml(p);
    } else {
      const names = p.modIds.map((id) => byId.get(id)?.name).filter(Boolean);
      card.innerHTML = `
        <div class="preset-head">
          <div class="preset-name">${esc(p.name)}</div>
          <span style="font-size:12px;color:var(--text-muted)">${names.length} ${plural(names.length, 'мод', 'мода', 'модов')}</span>
          <button class="btn btn-sm btn-primary" data-apply="${p.id}">${L`Применить`}</button>
          ${p.shareable ? `<button class="btn btn-sm" data-link="${p.id}" title="${L`Скопировать короткую ссылку — работает, пока в пресете только моды из каталога`}"><span class="ms">link</span>${L`Ссылка`}</button>` : ''}
          <button class="btn btn-sm" data-share="${p.id}" title="${L`Сохранить пресет файлом, чтобы отправить другому`}"><span class="ms">ios_share</span>${L`Файл`}</button>
          <button class="btn btn-sm btn-danger" data-pdel="${p.id}">${L`Удалить`}</button>
        </div>
        <div class="preset-mods">${names.length ? esc(names.join(' · ')) : L`пусто (всё будет выключено)`}</div>`;
    }
    list.appendChild(card);
  });

  $('#savePresetBtn').addEventListener('click', async () => {
    const name = $('#presetName').value.trim();
    if (!name) { toast(L`Введи название пресета`, 'warn'); return; }
    await window.api.presets.save(name);
    toast(L`Пресет «${name}» сохранён`);
    renderPresets();
  });
  $('#importPresetBtn').addEventListener('click', async () => handlePresetImport(await window.api.presets.importDialog()));

  list.querySelectorAll('[data-apply]').forEach((b) => {
    b.addEventListener('click', async () => {
      const r = await window.api.presets.apply(b.dataset.apply);
      if (r.error) toast(r.error, 'error', 6000);
      else toast(L`Пресет применён`);
      refreshInstalledIndex();
    });
  });
  list.querySelectorAll('[data-link]').forEach((b) => {
    b.addEventListener('click', async () => {
      const r = await window.api.presets.shareLink(b.dataset.link);
      if (r.error) { toast(r.error, 'warn', 7000); return; }
      navigator.clipboard.writeText(r.web);
      flashCopied(b);
    });
  });
  list.querySelectorAll('[data-share]').forEach((b) => {
    b.addEventListener('click', async () => {
      const plan = await window.api.presets.exportPlan(b.dataset.share);
      if (plan.error) { toast(plan.error, 'error', 6000); return; }
      if (!plan.entries.length) { toast(L`В пресете нет модов`, 'warn'); return; }
      const opts = await shareDialog(plan);
      if (!opts) return;
      const r = await window.api.presets.exportFile(b.dataset.share, opts);
      if (r.cancelled) return;
      if (r.error) toast(r.error, 'error', 6000);
      else toast(L`Пресет сохранён · ${fmtMB(r.size)} МБ`);
    });
  });
  list.querySelectorAll('[data-resolve]').forEach((b) => {
    b.addEventListener('click', async () => {
      b.disabled = true;
      const r = await window.api.presets.resolve(b.dataset.resolve);
      if (r.error) toast(r.error, 'error', 7000);
      else {
        toast(L`Установлено и применено: ${r.installed} ${plural(r.installed, 'мод', 'мода', 'модов')}`);
        for (const err of (r.errors || []).slice(0, 3)) toast(err, 'warn', 7000);
      }
      await refreshInstalledIndex();
      renderPresets();
    });
  });
  list.querySelectorAll('[data-pdel]').forEach((b) => {
    b.addEventListener('click', async () => {
      const p = presets.find((x) => x.id === b.dataset.pdel);
      if (!await confirmDialog(L`Удалить пресет «${p?.name || ''}»?`)) return;
      await window.api.presets.delete(b.dataset.pdel);
      renderPresets();
    });
  });
}

async function handlePresetImport(r) {
  if (!r || r.cancelled) return;
  if (r.error) { toast(r.error, 'error', 6000); return; }
  toast(L`Пресет «${r.preset.name}» добавлен — нажми «Установить»`);
  if (state.view !== 'presets') switchView('presets');
  else renderPresets();
}

// ===== Tools =====

async function renderTools() {
  const tools = state.catalog?.mods?.modsData?.tools || [];
  const { installed } = await window.api.mods.list();
  const toolRecs = new Map(installed.filter((m) => m.categoryId === 'tools').map((m) => [m.name, m]));

  viewRoot.innerHTML = `
    <div class="view-header"><h1 class="view-title">${L`Инструменты`}</h1></div>
    <div class="tool-grid">
      ${tools.map((t, i) => {
        const dl = t.file && /\.(zip|exe)$/i.test(t.file);
        const rec = toolRecs.get(t.name);
        return `
        <div class="tool-card" style="--i:${i}">
          <div class="tool-name">${esc(t.name)}</div>
          <div class="tool-actions">
            ${dl ? (rec
              ? `<button class="btn btn-sm btn-primary" data-run="${esc(rec.files[0]?.relPath || '')}"><span class="ms">play_arrow</span>${L`Запустить`}</button>
                 <button class="btn btn-sm" data-open="${esc(rec.files[0]?.relPath || '')}">${L`Папка`}</button>
                 <button class="btn btn-sm btn-danger" data-tdel="${rec.id}">${L`Удалить`}</button>`
              : `<button class="btn btn-sm btn-primary" data-get="${i}"><span class="ms">download</span>${L`Скачать`}</button>`)
              : (t.file ? `<button class="btn btn-sm" data-url="${esc(t.file)}"><span class="ms">open_in_new</span>${L`Открыть сайт`}</button>` : '')}
            ${t.guideId && state.catalog?.guides?.[t.guideId] ? `<button class="btn btn-sm btn-ghost" data-guide="${esc(t.guideId)}">${L`Гайд`}</button>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>
  `;

  viewRoot.querySelectorAll('[data-get]').forEach((b) => {
    b.addEventListener('click', async () => {
      const t = tools[Number(b.dataset.get)];
      b.disabled = true;
      b.textContent = L`Скачивание…`;
      const r = await window.api.mods.install({ categoryId: 'tools', name: t.name, styleLabel: null, fileRef: t.file, preview: t.preview });
      if (r.error && !r.already) toast(`${t.name}: ${r.error}`, 'error', 6000);
      else toast(L`${t.name} готов`);
      renderTools();
    });
  });
  viewRoot.querySelectorAll('[data-run]').forEach((b) => {
    b.addEventListener('click', async () => {
      const r = await window.api.misc.runTool(b.dataset.run);
      if (r.error) toast(r.error, 'error');
    });
  });
  viewRoot.querySelectorAll('[data-open]').forEach((b) => {
    b.addEventListener('click', () => window.api.misc.openToolsFolder(b.dataset.open));
  });
  viewRoot.querySelectorAll('[data-tdel]').forEach((b) => {
    b.addEventListener('click', async () => {
      await window.api.mods.remove(b.dataset.tdel);
      renderTools();
    });
  });
  viewRoot.querySelectorAll('[data-url]').forEach((b) => {
    b.addEventListener('click', () => window.api.misc.openExternal(b.dataset.url));
  });
  viewRoot.querySelectorAll('[data-guide]').forEach((b) => {
    b.addEventListener('click', () => {
      switchView('guides');
      setTimeout(() => {
        const el = document.querySelector(`[data-guide="${b.dataset.guide}"]`);
        if (el) { el.classList.add('open'); el.scrollIntoView({ behavior: 'smooth' }); }
      }, 80);
    });
  });
}

// ===== Guides =====

function renderGuideSteps(steps) {
  let html = '<ol>';
  for (const s of steps) {
    if (typeof s === 'string') {
      html += `<li>${s}</li>`; // guide content is trusted repo HTML (code/spans)
    } else if (s && s.text) {
      html += `</ol><div class="g-info ${s.icon === 'error' || s.icon === 'warning' ? 'g-warn' : ''}">${s.text}</div><ol>`;
    }
  }
  html += '</ol>';
  return html.replace(/<ol><\/ol>/g, '');
}

function renderGuides() {
  const guides = state.catalog?.guides || {};
  viewRoot.innerHTML = `
    <div class="view-header"><h1 class="view-title">${L`Гайды`}</h1></div>
    <div style="color:var(--text-muted);font-size:13px;margin-bottom:16px">
      ${L`Гайды из репозитория Dota2PornFx. Менеджер делает бóльшую часть шагов автоматически — гайды пригодятся для ручной установки и решения проблем.`}
    </div>
    ${Object.entries(guides).map(([id, g]) => {
      const content = (window.I18N_LANG === 'en' ? (g.content?.en || g.content?.ru) : (g.content?.ru || g.content?.en)) || [];
      return `
      <div class="guide-card" data-guide="${esc(id)}">
        <div class="guide-title">
          <span class="ms chev">chevron_right</span>
          ${esc(g.title)}
        </div>
        <div class="guide-body">
          ${content.map((block) => `
            ${block.info && block.infoPosition !== 'bottom' ? `<div class="g-info">${block.info}</div>` : ''}
            ${block.steps ? renderGuideSteps(block.steps) : ''}
            ${block.warning ? `<div class="g-info g-warn">${block.warning}</div>` : ''}
            ${block.info && block.infoPosition === 'bottom' ? `<div class="g-info">${block.info}</div>` : ''}
          `).join('')}
        </div>
      </div>`;
    }).join('')}
  `;

  viewRoot.querySelectorAll('.guide-title').forEach((t) => {
    t.addEventListener('click', () => t.closest('.guide-card').classList.toggle('open'));
  });
  viewRoot.querySelectorAll('.guide-body a[href]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      window.api.misc.openExternal(a.href);
    });
  });
}

// ===== Settings =====

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
  const cacheSize = await window.api.misc.cacheSize();
  const appVersion = await window.api.update.version();

  viewRoot.innerHTML = `
    <div class="view-header"><h1 class="view-title">${L`Настройки`}</h1></div>

    <div class="settings-block">
      <h3>${L`Язык приложения`}</h3>
      <div class="settings-row">
        <span class="settings-label">${L`Язык приложения`}</span>
        <div class="select-wrap">
          <span class="ms">translate</span>
          <select class="input" id="uiLangSelect" style="padding-left:30px">
            <option value="en" ${s.uiLang === 'en' ? 'selected' : ''}>English</option>
            <option value="ru" ${s.uiLang === 'ru' ? 'selected' : ''}>Русский</option>
          </select>
        </div>
      </div>
      <div style="font-size:12.5px;color:var(--text-muted);margin-top:8px">
        ${L`Меняет только язык этого приложения. Папка модов от него больше не зависит — она следует за языком озвучки Dota.`}
      </div>
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
        <b>${L`Английский интерфейс`}</b>${L`: в самой Dota — Настройки → Language: English, а Audio Language оставь тем языком, чья папка указана выше. Язык текста и язык озвучки теперь независимы, так что моды при этом работают.`}
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
    </div>
  `;
  $('#repoLink').addEventListener('click', () => window.api.misc.openExternal('https://github.com/TheFleece/dota2-mod-manager'));

  $('#uiLangSelect').addEventListener('change', async (e) => {
    await applyLanguage(e.target.value);
    toast(e.target.value === 'ru' ? L`Язык переключён на Русский` : L`Язык переключён на English`);
    renderSettings();
  });
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

// ---------- boot ----------

const CATALOG_MAX_AGE = 30 * 60 * 1000;

async function loadCatalog(force = false) {
  if (force) toast(L`Обновляю каталог…`);
  state.catalog = null;
  if (state.view === 'catalog') renderCatalog();
  state.catalog = await window.api.catalog.load(force);
  if (!state.catalog.error) buildModIndex();
  if (state.view === 'catalog') renderCatalog();
  if (force && !state.catalog.error) toast(L`Каталог обновлён`);

  // cached catalog goes stale fast (new mods appear upstream) — refresh in the background
  if (!force && !state.catalog.error && Date.now() - (state.catalog.fetchedAt || 0) > CATALOG_MAX_AGE) {
    window.api.catalog.load(true).then((fresh) => {
      if (fresh.error) return;
      state.catalog = fresh;
      buildModIndex();
      if (state.view === 'catalog') renderCatalog();
    });
  }
}

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
  window.I18N_LANG = cfg.uiLang === 'ru' ? 'ru' : 'en';
  try { localStorage.setItem('uiLang', window.I18N_LANG); } catch { /* ignore */ }
  applyStaticI18n();
  paintAccount();

  // Dota's language change moved the mods folder under us at startup — say so once
  if (cfg.langMigration) {
    toast(L`Моды перенесены в dota_${cfg.langMigration.to}: игра больше не подхватывает папку dota_${cfg.langMigration.from}`, 'warn', 9000);
  }

  await refreshSidebarStatus();
  await refreshMasterSwitch();
  await refreshInstalledIndex();
  await loadCatalog();

  // first launch, or first launch after this release — let the user pick a language
  if (!cfg.langPromptSeen) await showLanguagePicker();
})();
