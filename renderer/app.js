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
};

const $ = (sel) => document.querySelector(sel);
const viewRoot = $('#view-root');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtMB(bytes) { return (bytes / 1024 / 1024).toFixed(1); }

function fmtDate(unix) {
  if (!unix) return '';
  return new Date(unix * 1000).toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' });
}

function plural(n, one, few, many) {
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

function confirmDialog(message, { okLabel = 'Удалить', danger = true } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box">
        <div class="confirm-msg">${esc(message)}</div>
        <div class="confirm-actions">
          <button class="btn" data-c="no">Отмена</button>
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
      <button class="player-close" aria-label="Закрыть"><span class="ms">close</span></button>
      <div class="player-controls">
        <button class="pl-btn" data-act="play" aria-label="Пауза"><span class="ms">pause</span></button>
        <div class="pl-progress"><div class="pl-fill"></div><div class="pl-knob"></div></div>
        <span class="pl-time">0:00 / 0:00</span>
        <button class="pl-btn" data-act="mute" aria-label="Звук"><span class="ms">volume_up</span></button>
        ${audio ? '' : '<button class="pl-btn" data-act="fs" aria-label="На весь экран"><span class="ms">fullscreen</span></button>'}
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

async function refreshInstalledIndex() {
  const { installed } = await window.api.mods.list();
  state.installedIndex.clear();
  for (const rec of installed) {
    state.installedIndex.set(keyOf(rec.categoryId, rec.name, rec.styleLabel), rec);
  }
  $('#libCount').textContent = installed.length || '';
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
  if (id === 'all') return 'Все категории';
  return CAT_RU[id] || state.catalog?.constants?.translations?.[id] || id;
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
  render();
}

$('#openModsFolderBtn').addEventListener('click', async () => {
  const r = await window.api.misc.openLangFolder();
  if (r.error) toast(r.error, 'error');
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
      <span class="ms">apps</span>Все категории
    </button>`;
  for (const [label, ids] of RAIL_SECTIONS) {
    const present = ids.filter((id) => cats.has(id));
    if (!present.length) continue;
    html += `<div class="rail-section">${esc(label)}</div>`;
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
    viewRoot.innerHTML = `<div class="empty-note">Загрузка каталога…</div>`;
    return;
  }
  if (state.catalog.error) {
    viewRoot.innerHTML = `
      <div class="empty-note">
        Не удалось загрузить каталог: ${esc(state.catalog.error)}<br><br>
        <button class="btn btn-primary" id="retryCat">Повторить</button>
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
      <h1>Моды для Dota 2</h1>
      <p>${cats.reduce((n, c) => n + categoryMods(c.id).length, 0)} модов в ${cats.length} категориях · каталог Dota2PornFx${state.catalog.fetchedAt ? ' · обновлён ' + new Date(state.catalog.fetchedAt).toLocaleDateString('ru') : ''}</p>
    </div>
    ${recent.length ? `
      <div class="section-h"><span class="ms">new_releases</span>Недавно добавленные</div>
      <div class="recent-row">${recent.map((m, i) => cardHtml(m, i, true)).join('')}</div>` : ''}
    <div class="section-h"><span class="ms">apps</span>Категории</div>
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
      <h1 class="view-title">Поиск: <span class="accent">${esc(state.search.trim())}</span></h1>
    </div>
    ${toolbarHtml(mods.length, { tags: [], groups: [], installable })}
    <div class="grid" id="modGrid">
      ${mods.length ? mods.map((m, i) => cardHtml(m, i, true)).join('') : `<div class="empty-note">Ничего не найдено</div>`}
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
    gridHtml = '<div class="empty-note">Ничего не найдено — сбрось фильтры</div>';
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
          ${SORTS.map((s) => `<option value="${s.key}" ${f.sort === s.key ? 'selected' : ''}>${s.label}</option>`).join('')}
        </select>
      </div>
      ${heroes.length ? `
        <div class="select-wrap">
          <span class="ms">person</span>
          <select id="heroSelect">
            <option value="">Все герои</option>
            ${heroes.map((h) => `<option value="${esc(h)}" ${f.hero === h ? 'selected' : ''}>${esc(h)}</option>`).join('')}
          </select>
        </div>` : ''}
      ${groups.length ? `
        <div class="select-wrap">
          <span class="ms">${categoryId === 'hero-items' ? 'person' : catIcon(categoryId) || 'group'}</span>
          <select id="groupSelect">
            <option value="">${GROUP_LABEL[categoryId] || 'Все группы'}</option>
            ${groups.map((g) => `<option value="${esc(g)}" ${f.group === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}
          </select>
        </div>` : ''}
      ${installable ? `
      <div class="sep"></div>
      <button class="fchip ${f.installedOnly ? 'active' : ''}" id="installedChip">
        <span class="ms">check_circle</span>Установленные
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
          ${installed ? '<span class="mtag ok">Установлен</span>' : ''}
          ${isPack ? `<span class="mtag">Пак · ${(m.mods || []).length}</span>` : ''}
          ${m._custom ? '<span class="mtag custom">Свой</span>' : ''}
          ${external ? '<span class="mtag">Ссылка</span>' : ''}
          ${tags.map((t) => `<span class="mtag">${esc(tagLabel(cat, t))}</span>`).join('')}
        </div>
        ${playable ? `
          <button class="mtag-play" data-play="${esc(playable)}" data-title="${esc(m.name)}" aria-label="Смотреть превью">
            <span class="ms">play_arrow</span>Превью
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
      card.querySelector('.media-tags')?.insertAdjacentHTML('afterbegin', '<span class="mtag ok">Установлен</span>');
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
      <button class="modal-close" id="modalCloseBtn" aria-label="Закрыть"><span class="ms">close</span></button>
      ${playable ? `
        <button class="preview-toggle" id="previewPlayBtn">
          <span class="ms">play_circle</span>Смотреть превью
        </button>` : ''}
    </div>
    <div class="modal-body">
      <div class="modal-title-row">
        <div class="modal-title">${esc(mod.name)}</div>
      </div>
      <div class="modal-sub">
        <span>${esc(catName(categoryId))}</span>
        ${mod._group ? `<span>· ${esc(mod._group)}</span>` : ''}
        ${mod._custom ? '<span>· свой пак</span>' : ''}
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
                <div class="pack-mod-cat">${x.hit ? esc(catName(x.hit.categoryId)) : 'не найден в каталоге'}${inst ? ' · установлен' : ''}</div>
              </div>
              <button class="pack-x" data-toggle="${esc(x.name)}" aria-label="${excluded ? 'Вернуть' : 'Убрать'}">
                <span class="ms">${excluded ? 'add' : 'close'}</span>
              </button>
            </div>`;
          }).join('')}
        </div>
        <div class="pack-save-row">
          <input class="input" id="packSaveName" placeholder="Название своего пака…" value="${mod._custom ? esc(mod.name) : ''}">
          <button class="btn btn-sm" id="packSaveBtn"><span class="ms">bookmark_add</span>Сохранить пак</button>
          ${mod._custom ? `<button class="btn btn-sm btn-danger" id="packDeleteBtn">Удалить пак</button>` : ''}
        </div>` : ''}
      <div class="modal-actions">
        ${isPack ? `<button class="btn btn-primary" id="installPackBtn" ${activeCount ? '' : 'disabled'}><span class="ms">download</span>Установить пак (${activeCount})</button>` : ''}
        ${!isPack && target ? (installedRec
          ? `<button class="btn btn-danger" id="uninstallBtn"><span class="ms">delete</span>Удалить</button>`
          : `<button class="btn btn-primary" id="installBtn" ${busy ? 'disabled' : ''}><span class="ms">download</span>${busy ? 'Установка…' : 'Установить'}</button>`) : ''}
        ${!isPack && !target && mod.file ? `<button class="btn" id="openLinkBtn"><span class="ms">open_in_new</span>Открыть ссылку</button>` : ''}
      </div>
      ${otherLinks.length || guide ? `
        <div class="modal-links">
          ${guide ? `<button class="btn btn-sm" id="modalGuideLink"><span class="ms">menu_book</span>Гайд: ${esc(guide.title)}</button>` : ''}
          ${otherLinks.map((l) => `<button class="btn btn-sm" data-link="${links.indexOf(l)}"><span class="ms">open_in_new</span>${esc(LINK_LABEL[l.type] || l.type || 'Ссылка')}</button>`).join('')}
        </div>` : ''}
      ${categoryId === 'fonts' ? `<div class="modal-note">Шрифт ставится в файлы игры (game\\dota\\panorama\\fonts) — параметр запуска не нужен. Оригиналы сохраняются автоматически.</div>` : ''}
      ${categoryId === 'cursors' ? `<div class="modal-note">Курсор ставится в game\\dota\\resource\\cursor — параметр запуска не нужен. Оригиналы сохраняются автоматически.</div>` : ''}
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
      if (!name) { toast('Введи название пака', 'warn'); return; }
      const modNames = members.filter((x) => !modalState.packExcluded.has(x.name)).map((x) => x.name);
      if (!modNames.length) { toast('В паке не осталось модов', 'warn'); return; }
      const packs = customPacks().filter((p) => p.name !== name && p.name !== (mod._custom ? mod.name : null));
      packs.push({ name, mods: modNames });
      saveCustomPacks(packs);
      toast(`Пак «${name}» сохранён — он появился в категории Паки`);
      if (state.view === 'catalog' && state.activeCategory === 'packs') { closeModal(); renderCatalog(); }
    });
  }
  const packDeleteBtn = $('#packDeleteBtn');
  if (packDeleteBtn) {
    packDeleteBtn.addEventListener('click', async () => {
      if (!await confirmDialog(`Удалить пак «${mod.name}»?`)) return;
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
      if (!await confirmDialog(`Удалить «${mod.name}»?`)) return;
      const r = await window.api.mods.remove(installedRec.id);
      if (r.error) toast(r.error, 'error');
      else toast(`${mod.name} удалён`);
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
    toast('Сначала укажи путь к Dota 2 в настройках', 'warn');
    return;
  }
  state.installing.add(k);
  if (modalState) drawModal();
  const chk = await window.api.mods.checkConflicts({ categoryId, name: mod.name, fileRef });
  if (chk.conflicts?.length) {
    const c = chk.conflicts[0];
    const rest = chk.conflicts.length > 1 ? ` (и ещё ${chk.conflicts.length - 1})` : '';
    const what = c.summary
      ? `оба меняют ${c.summary}`
      : `перекрываются ${c.count} ${plural(c.count, 'файл', 'файла', 'файлов')}`;
    const proceed = await confirmDialog(
      `«${mod.name}» и уже установленный «${c.name}»${rest} конфликтуют — ${what}. Одновременно работать не будут, победит тот, что грузится приоритетнее. Установить всё равно?`,
      { okLabel: 'Установить', danger: false }
    );
    if (!proceed) {
      state.installing.delete(k);
      if (modalState) drawModal();
      return { cancelled: true };
    }
  }
  const r = await window.api.mods.install({ categoryId, name: mod.name, styleLabel, fileRef, preview });
  state.installing.delete(k);
  if (r.error && !r.already) toast(`${mod.name}: ${r.error}`, 'error', 6000);
  else if (!r.error) toast(`${mod.name} установлен`);
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
  toast(`Пак «${pack.name}»: установлено ${ok}, пропущено ${skip}${fail ? `, ошибок ${fail}` : ''}`, fail ? 'warn' : 'ok', 7000);
  await refreshInstalledIndex();
  render();
}

// ===== Library =====

async function renderLibrary() {
  const { installed, external } = await window.api.mods.list();
  const enabledCount = installed.filter((m) => m.enabled).length;

  viewRoot.innerHTML = `
    <div class="view-header">
      <h1 class="view-title">Библиотека</h1>
    </div>
    <div class="lib-toolbar">
      <span class="lib-stats">${installed.length} ${plural(installed.length, 'мод', 'мода', 'модов')} · ${enabledCount} включено</span>
      <button class="btn btn-sm" id="enableAllBtn">Включить всё</button>
      <button class="btn btn-sm" id="disableAllBtn">Отключить всё</button>
      <button class="btn btn-sm" id="importVpkBtn"><span class="ms">upload_file</span>Импорт VPK</button>
      <button class="btn btn-sm" id="openFolderBtn2"><span class="ms">folder_open</span>Папка модов</button>
    </div>
    <div class="lib-list" id="libList">
      ${installed.length ? '' : '<div class="empty-note">Пока ничего не установлено — загляни в Каталог</div>'}
    </div>
    ${external.length ? `
      <div class="section-h" style="margin-top:26px"><span class="ms">folder_zip</span>Внешние файлы в папке модов</div>
      <div style="color:var(--text-muted);font-size:12.5px;margin-bottom:10px">Файлы, установленные не через менеджер</div>
      <div class="lib-list" id="extList"></div>` : ''}
  `;

  const libList = $('#libList');
  installed.forEach((rec, i) => {
    const row = document.createElement('div');
    row.className = `lib-row ${rec.enabled ? '' : 'disabled'}`;
    row.style.setProperty('--i', Math.min(i, 20));
    const prev = previewUrl(rec.categoryId, rec.preview);
    const fileNames = rec.files.filter((f) => f.root === 'lang').map((f) => f.relPath);
    row.innerHTML = `
      ${prev && !isVideo(prev) ? `<img class="lib-thumb" src="${esc(prev)}" loading="lazy" alt="">` : `<div class="lib-thumb"></div>`}
      <div class="lib-info">
        <div class="lib-name">${esc(rec.name)}${rec.styleLabel ? ` <span style="color:var(--primary-soft);font-size:12px">(${esc(rec.styleLabel)})</span>` : ''}${rec.match ? ` <span class="lib-tag match">${esc(matchLabel(rec.match))}</span>` : rec.info ? ` <span class="lib-tag">${esc(rec.info)}</span>` : ''}</div>
        <div class="lib-meta">
          <span>${esc(catName(rec.categoryId))}</span>
          ${fileNames.length ? `<span>${esc(fileNames.slice(0, 3).join(', '))}${fileNames.length > 3 ? '…' : ''}</span>` : ''}
          <span>${new Date(rec.installedAt).toLocaleDateString('ru')}</span>
        </div>
      </div>
      <div class="lib-actions">
        ${['fonts', 'cursors'].includes(rec.categoryId)
          ? '<span style="font-size:11.5px;color:var(--text-muted)">всегда активен</span>'
          : `<button class="toggle ${rec.enabled ? 'on' : ''}" data-id="${rec.id}" role="switch" aria-checked="${rec.enabled}" aria-label="Включить/выключить"></button>`}
        ${rec.match
          ? `<button class="btn btn-sm btn-primary" data-adopt="${rec.id}" title="Привязать к каталогу"><span class="ms">library_add_check</span>Привязать</button>`
          : ''}
        ${rec.heroes >= 2
          ? `<button class="btn btn-sm" data-split="${rec.id}" title="Разбить на отдельные моды по героям"><span class="ms">call_split</span>Разобрать</button>`
          : ''}
        ${rec.files.some((f) => f.root === 'lang' && /_dir\.vpk$/i.test(f.relPath))
          ? `<button class="btn btn-sm" data-export="${rec.id}" title="Сохранить мод одним .vpk файлом (для отправки автору каталога)"><span class="ms">save</span>Экспорт</button>`
          : ''}
        <button class="btn btn-sm btn-danger" data-del="${rec.id}">Удалить</button>
      </div>
    `;
    libList.appendChild(row);
  });

  libList.querySelectorAll('.toggle').forEach((t) => {
    t.addEventListener('click', async () => {
      const rec = installed.find((m) => m.id === t.dataset.id);
      const r = await window.api.mods.setEnabled(rec.id, !rec.enabled);
      if (r.error) toast(r.error, 'error');
      renderLibrary();
      refreshInstalledIndex();
    });
  });
  libList.querySelectorAll('[data-export]').forEach((b) => {
    b.addEventListener('click', async () => {
      const rec = installed.find((m) => m.id === b.dataset.export);
      b.disabled = true;
      const prev = b.innerHTML;
      b.innerHTML = '<span class="ms">hourglass_empty</span>Собираю…';
      const r = await window.api.mods.exportSingle(rec.id);
      b.disabled = false;
      b.innerHTML = prev;
      if (r.error) toast(`${rec.name}: ${r.error}`, 'error', 6000);
      else if (r.ok) toast(`${rec.name} сохранён одним файлом (${fmtMB(r.size)} MB)`, 'ok', 6000);
    });
  });
  libList.querySelectorAll('[data-adopt]').forEach((b) => {
    b.addEventListener('click', async () => {
      b.disabled = true;
      const r = await window.api.mods.adoptMod(b.dataset.adopt);
      if (r.error) toast(r.error, 'error', 6000);
      else toast(`Привязан к каталогу: «${r.name}»`, 'ok');
      renderLibrary();
      refreshInstalledIndex();
    });
  });
  libList.querySelectorAll('[data-split]').forEach((b) => {
    b.addEventListener('click', async () => {
      const rec = installed.find((m) => m.id === b.dataset.split);
      if (!await confirmDialog(`Разбить «${rec.name}» на отдельные моды по героям? Исходный файл заменится на отдельные, каждый можно будет включать и удалять по отдельности.`, { okLabel: 'Разобрать' })) return;
      b.disabled = true;
      const r = await window.api.mods.splitMod(rec.id);
      if (r.error) toast(r.error, 'error', 6000);
      else toast(`Разобрано на ${r.count}: ${r.names.join(', ')}`, 'ok', 6000);
      renderLibrary();
      refreshInstalledIndex();
    });
  });
  libList.querySelectorAll('[data-del]').forEach((b) => {
    b.addEventListener('click', async () => {
      const rec = installed.find((m) => m.id === b.dataset.del);
      if (!await confirmDialog(`Удалить «${rec.name}»?`)) return;
      const r = await window.api.mods.remove(rec.id);
      if (r.error) toast(r.error, 'error');
      else toast(`${rec.name} удалён`);
      renderLibrary();
      refreshInstalledIndex();
    });
  });

  $('#enableAllBtn').addEventListener('click', () => bulkToggle(installed, true));
  $('#disableAllBtn').addEventListener('click', () => bulkToggle(installed, false));
  $('#importVpkBtn').addEventListener('click', async () => handleImportResult(await window.api.mods.importDialog()));
  $('#openFolderBtn2').addEventListener('click', () => window.api.misc.openLangFolder());

  if (external.length) {
    const extList = $('#extList');
    for (const f of external) {
      const row = document.createElement('div');
      row.className = `lib-row ${f.enabled ? '' : 'disabled'}`;
      const label = f.match ? `<span class="lib-tag match">${esc(matchLabel(f.match))}</span>`
        : f.info ? `<span class="lib-tag">${esc(f.info)}</span>` : '';
      const simple = f.kind === 'cursor' || f.kind === 'font'; // full-folder/subset sets — adopt only
      const displayName = f.kind === 'cursor' ? 'Курсор в игре' : f.name;
      const sub = f.kind === 'cursor' ? 'resource/cursor'
        : f.kind === 'font' ? 'шрифт · panorama/fonts'
        : f.match ? 'мод из каталога' : f.info ? 'опознан по содержимому' : 'внешний файл';
      const size = simple ? '' : `<span>${fmtMB(f.size)} MB</span>`;
      row.innerHTML = `
        <div class="lib-thumb"></div>
        <div class="lib-info">
          <div class="lib-name">${esc(displayName)}${label ? ' ' + label : ''}</div>
          <div class="lib-meta">${size}<span>${sub}</span></div>
        </div>
        <div class="lib-actions">
          ${simple ? '' : `<button class="toggle ${f.enabled ? 'on' : ''}" data-ext="${esc(f.key)}" role="switch" aria-checked="${f.enabled}"></button>`}
          ${f.match ? `<button class="btn btn-sm btn-primary" data-adopt="${esc(f.key)}" title="Привязать к каталогу и управлять как обычным модом"><span class="ms">library_add_check</span>Принять</button>` : ''}
          ${f.heroes >= 2 ? `<button class="btn btn-sm" data-extsplit="${esc(f.key)}" title="Разбить на отдельные моды по героям"><span class="ms">call_split</span>Разобрать</button>` : ''}
          ${simple ? '' : `<button class="btn btn-sm btn-danger" data-extdel="${esc(f.key)}">Удалить</button>`}
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
        const r = f.kind === 'cursor' ? await window.api.mods.adoptCursor()
          : f.kind === 'font' ? await window.api.mods.adoptFont(f.name)
          : await window.api.mods.adoptExternal(f.key);
        if (r.error) toast(r.error, 'error', 6000);
        else toast(`«${r.name}» принят из каталога`, 'ok');
        await refreshInstalledIndex();
        renderLibrary();
      });
    });
    extList.querySelectorAll('[data-extsplit]').forEach((b) => {
      b.addEventListener('click', async () => {
        const f = byKey(b.dataset.extsplit);
        if (!await confirmDialog(`Разбить «${f.name}» на отдельные моды по героям? Файл заменится на отдельные управляемые моды.`, { okLabel: 'Разобрать' })) return;
        b.disabled = true;
        const r = await window.api.mods.splitExternal(f.key);
        if (r.error) toast(r.error, 'error', 6000);
        else toast(`Разобрано на ${r.count}: ${r.names.join(', ')}`, 'ok', 6000);
        await refreshInstalledIndex();
        renderLibrary();
      });
    });
    extList.querySelectorAll('[data-extdel]').forEach((b) => {
      b.addEventListener('click', async () => {
        const f = byKey(b.dataset.extdel);
        if (!await confirmDialog(`Удалить файл ${f.name}?`)) return;
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
  if (n) toast(`Импортировано: ${n} ${plural(n, 'мод', 'мода', 'модов')}`);
  for (const imp of r.imported || []) {
    if (imp.conflicts?.length) {
      toast(`«${imp.name}» перекрывается с: ${imp.conflicts.slice(0, 2).join(', ')}${imp.conflicts.length > 2 ? '…' : ''}`, 'warn', 7000);
    }
  }
  await refreshInstalledIndex();
  if (state.view === 'library') renderLibrary();
}

// drag & drop of .vpk files anywhere in the window -> import
let dragDepth = 0;
document.addEventListener('dragover', (e) => e.preventDefault());
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
document.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('dropping');
  const files = [...(e.dataTransfer?.files || [])];
  const paths = files.map((f) => {
    try { return window.api.mods.pathForFile(f); } catch { return null; }
  }).filter((p) => p && /\.vpk$/i.test(p));
  if (!paths.length) {
    if (files.length) toast('Импортировать можно только .vpk файлы', 'warn');
    return;
  }
  handleImportResult(await window.api.mods.importPaths(paths));
});

async function bulkToggle(installed, enabled) {
  for (const rec of installed) {
    if (['fonts', 'cursors'].includes(rec.categoryId)) continue;
    if (rec.enabled !== enabled) await window.api.mods.setEnabled(rec.id, enabled);
  }
  renderLibrary();
  refreshInstalledIndex();
}

// ===== Presets =====

async function renderPresets() {
  const presets = await window.api.presets.list();
  const { installed } = await window.api.mods.list();
  const byId = new Map(installed.map((m) => [m.id, m]));

  viewRoot.innerHTML = `
    <div class="view-header"><h1 class="view-title">Пресеты</h1></div>
    <div style="color:var(--text-muted);font-size:13px;margin-bottom:14px">
      Пресет запоминает, какие моды включены. Применение пресета включает его моды и выключает остальные.
    </div>
    <div class="preset-new">
      <input class="input" id="presetName" placeholder="Название пресета (напр. «Анимешный», «Минимал»)">
      <button class="btn btn-primary" id="savePresetBtn"><span class="ms">save</span>Сохранить текущее состояние</button>
    </div>
    <div id="presetList">
      ${presets.length ? '' : '<div class="empty-note">Пресетов пока нет</div>'}
    </div>
  `;

  const list = $('#presetList');
  presets.forEach((p, i) => {
    const names = p.modIds.map((id) => byId.get(id)?.name).filter(Boolean);
    const card = document.createElement('div');
    card.className = 'preset-card';
    card.style.setProperty('--i', i);
    card.innerHTML = `
      <div class="preset-head">
        <div class="preset-name">${esc(p.name)}</div>
        <span style="font-size:12px;color:var(--text-muted)">${names.length} ${plural(names.length, 'мод', 'мода', 'модов')}</span>
        <button class="btn btn-sm btn-primary" data-apply="${p.id}">Применить</button>
        <button class="btn btn-sm btn-danger" data-pdel="${p.id}">Удалить</button>
      </div>
      <div class="preset-mods">${names.length ? esc(names.join(' · ')) : 'пусто (всё будет выключено)'}</div>
    `;
    list.appendChild(card);
  });

  $('#savePresetBtn').addEventListener('click', async () => {
    const name = $('#presetName').value.trim();
    if (!name) { toast('Введи название пресета', 'warn'); return; }
    await window.api.presets.save(name);
    toast(`Пресет «${name}» сохранён`);
    renderPresets();
  });

  list.querySelectorAll('[data-apply]').forEach((b) => {
    b.addEventListener('click', async () => {
      const r = await window.api.presets.apply(b.dataset.apply);
      if (r.error) toast(r.error, 'error', 6000);
      else toast('Пресет применён');
      refreshInstalledIndex();
    });
  });
  list.querySelectorAll('[data-pdel]').forEach((b) => {
    b.addEventListener('click', async () => {
      const p = presets.find((x) => x.id === b.dataset.pdel);
      if (!await confirmDialog(`Удалить пресет «${p?.name || ''}»?`)) return;
      await window.api.presets.delete(b.dataset.pdel);
      renderPresets();
    });
  });
}

// ===== Tools =====

async function renderTools() {
  const tools = state.catalog?.mods?.modsData?.tools || [];
  const { installed } = await window.api.mods.list();
  const toolRecs = new Map(installed.filter((m) => m.categoryId === 'tools').map((m) => [m.name, m]));

  viewRoot.innerHTML = `
    <div class="view-header"><h1 class="view-title">Инструменты</h1></div>
    <div class="tool-grid">
      ${tools.map((t, i) => {
        const dl = t.file && /\.(zip|exe)$/i.test(t.file);
        const rec = toolRecs.get(t.name);
        return `
        <div class="tool-card" style="--i:${i}">
          <div class="tool-name">${esc(t.name)}</div>
          <div class="tool-actions">
            ${dl ? (rec
              ? `<button class="btn btn-sm btn-primary" data-run="${esc(rec.files[0]?.relPath || '')}"><span class="ms">play_arrow</span>Запустить</button>
                 <button class="btn btn-sm" data-open="${esc(rec.files[0]?.relPath || '')}">Папка</button>
                 <button class="btn btn-sm btn-danger" data-tdel="${rec.id}">Удалить</button>`
              : `<button class="btn btn-sm btn-primary" data-get="${i}"><span class="ms">download</span>Скачать</button>`)
              : (t.file ? `<button class="btn btn-sm" data-url="${esc(t.file)}"><span class="ms">open_in_new</span>Открыть сайт</button>` : '')}
            ${t.guideId && state.catalog?.guides?.[t.guideId] ? `<button class="btn btn-sm btn-ghost" data-guide="${esc(t.guideId)}">Гайд</button>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>
  `;

  viewRoot.querySelectorAll('[data-get]').forEach((b) => {
    b.addEventListener('click', async () => {
      const t = tools[Number(b.dataset.get)];
      b.disabled = true;
      b.textContent = 'Скачивание…';
      const r = await window.api.mods.install({ categoryId: 'tools', name: t.name, styleLabel: null, fileRef: t.file, preview: t.preview });
      if (r.error && !r.already) toast(`${t.name}: ${r.error}`, 'error', 6000);
      else toast(`${t.name} готов`);
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
    <div class="view-header"><h1 class="view-title">Гайды</h1></div>
    <div style="color:var(--text-muted);font-size:13px;margin-bottom:16px">
      Гайды из репозитория Dota2PornFx. Менеджер делает бóльшую часть шагов автоматически — гайды пригодятся для ручной установки и решения проблем.
    </div>
    ${Object.entries(guides).map(([id, g]) => {
      const content = g.content?.ru || g.content?.en || [];
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

async function renderSettings() {
  const s = await window.api.settings.get();
  state.settings = s;
  const cacheSize = await window.api.misc.cacheSize();
  const appVersion = await window.api.update.version();

  viewRoot.innerHTML = `
    <div class="view-header"><h1 class="view-title">Настройки</h1></div>

    <div class="settings-block">
      <h3>Путь к Dota 2</h3>
      <div class="settings-row">
        <span class="mono" style="flex:1">${esc(s.dotaGamePath || 'не найден')}</span>
        <span class="dot ${s.dotaPathValid ? 'ok' : 'bad'}"></span>
      </div>
      <div class="settings-row">
        <button class="btn btn-sm" id="detectBtn">Найти автоматически</button>
        <button class="btn btn-sm" id="browseBtn">Указать вручную</button>
      </div>
    </div>

    <div class="settings-block" style="animation-delay:60ms">
      <h3>Папка модов и параметры запуска</h3>
      <div class="settings-row">
        <span class="settings-label">Языковая папка</span>
        <div class="select-wrap">
          <span class="ms">folder</span>
          <select class="input" id="langSelect" style="padding-left:30px">
            ${['123', 'minify', 'russian', 'test'].map((v) => `<option value="${v}" ${s.langSuffix === v ? 'selected' : ''}>dota_${v}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="settings-row">
        <span class="settings-label">Параметр запуска Steam</span>
        <span class="launch-code">-language ${esc(s.langSuffix)}
          <button class="btn btn-sm" id="copyLaunchBtn">Копировать</button>
        </span>
      </div>
      <div style="font-size:12.5px;color:var(--text-muted);margin-top:8px">
        Steam → Библиотека → ПКМ по Dota 2 → Свойства → Параметры запуска → вставь строку выше.
        Моды (кроме шрифтов и курсоров) работают только с этим параметром.
      </div>
      <div class="modal-note" style="margin-top:10px">
        <b>Дота на русском?</b> Выбирай <code style="background:none;color:var(--primary-soft)">dota_russian</code> и параметр
        <code style="background:none;color:var(--primary-soft)">-language russian</code> — тогда игра останется русской.
        С <code style="background:none;color:var(--primary-soft)">-language 123</code> игра переключается на английский.
        При смене папки установленные моды переезжают автоматически.
      </div>
      ${s.minifyDetected ? `
      <div class="modal-note" style="margin-top:10px">
        <b>Обнаружен Minify</b> (папка <code style="background:none;color:var(--primary-soft)">dota_minify</code> рядом).
        Если Minify настроен на ту же языковую папку, что и менеджер, их моды будут перекрывать друг друга —
        используй разные папки или ставь моды через что-то одно.
      </div>` : ''}
    </div>

    <div class="settings-block" style="animation-delay:120ms">
      <h3>Кэш загрузок</h3>
      <div class="settings-row">
        <span class="settings-label">Размер</span>
        <span style="font-variant-numeric:tabular-nums">${fmtMB(cacheSize)} MB</span>
        <button class="btn btn-sm" id="clearCacheBtn">Очистить</button>
      </div>
      <div style="font-size:12.5px;color:var(--text-muted)">
        Скачанные архивы модов. Нужны для быстрой переустановки — удаление ничего не сломает.
      </div>
    </div>

    <div class="settings-block" style="animation-delay:180ms">
      <h3>Каталог</h3>
      <div class="settings-row">
        <span class="settings-label">Обновлён</span>
        <span>${state.catalog?.fetchedAt ? new Date(state.catalog.fetchedAt).toLocaleString('ru') : '—'}</span>
        <button class="btn btn-sm" id="refreshCatBtn2">Обновить сейчас</button>
      </div>
      <div class="settings-row">
        <span class="settings-label">Источник</span>
        <a style="color:var(--primary-soft);cursor:pointer;font-size:12.5px" id="srcLink">github.com/h6rd/Dota2PornFxWeb</a>
      </div>
    </div>

    <div class="settings-block" style="animation-delay:240ms">
      <h3>О программе</h3>
      <div class="settings-row">
        <span class="settings-label">Версия</span>
        <span style="font-variant-numeric:tabular-nums">v${esc(appVersion)}</span>
        <a style="color:var(--primary-soft);cursor:pointer;font-size:12.5px" id="repoLink">github.com/TheFleece/dota2-mod-manager</a>
      </div>
      <div style="font-size:12.5px;color:var(--text-muted)">
        Обновления скачиваются автоматически из GitHub Releases — когда новая версия готова, появится кнопка установки.
      </div>
    </div>
  `;
  $('#repoLink').addEventListener('click', () => window.api.misc.openExternal('https://github.com/TheFleece/dota2-mod-manager'));

  $('#detectBtn').addEventListener('click', async () => {
    const found = await window.api.settings.detectDota();
    if (found) toast('Dota 2 найдена: ' + found);
    else toast('Не нашёл автоматически — укажи вручную', 'warn');
    renderSettings();
    refreshSidebarStatus();
  });
  $('#browseBtn').addEventListener('click', async () => {
    const r = await window.api.settings.browseDota();
    if (r?.error) toast(r.error, 'error');
    if (r?.path) toast('Путь сохранён');
    renderSettings();
    refreshSidebarStatus();
  });
  $('#langSelect').addEventListener('change', async (e) => {
    await window.api.settings.set('langSuffix', e.target.value);
    toast(`Папка модов: dota_${e.target.value}. Не забудь сменить параметр запуска!`, 'warn', 6000);
    renderSettings();
    refreshSidebarStatus();
  });
  $('#copyLaunchBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(`-language ${s.langSuffix}`);
    toast('Скопировано в буфер');
  });
  $('#clearCacheBtn').addEventListener('click', async () => {
    await window.api.misc.clearCache();
    toast('Кэш очищен');
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
    txtEl.textContent = `Dota 2 подключена · dota_${s.langSuffix} · параметр: -language ${s.langSuffix}`;
  } else {
    dotEl.className = 'dot bad';
    txtEl.textContent = 'Dota 2 не найдена — укажи путь в настройках';
  }
}

// ---------- progress ----------

let progressHideTimer = null;
window.api.onProgress((evt) => {
  const bar = $('#progressBar');
  if (evt.type === 'download') {
    bar.classList.remove('hidden');
    $('#progressLabel').textContent = `Скачивание: ${evt.label}`;
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
    toast(`Найдено обновление v${evt.version} — скачиваю в фоне…`, 'ok', 6000);
  } else if (evt.type === 'downloaded') {
    const bar = document.createElement('div');
    bar.className = 'update-bar';
    bar.innerHTML = `
      <span class="ms">system_update_alt</span>
      <span>Обновление <b>v${esc(evt.version)}</b> готово к установке</span>
      <button class="btn btn-sm btn-primary" id="updateNowBtn">Перезапустить и обновить</button>
      <button class="btn btn-sm btn-ghost" id="updateLaterBtn">Позже</button>`;
    document.body.appendChild(bar);
    bar.querySelector('#updateNowBtn').addEventListener('click', () => window.api.update.install());
    bar.querySelector('#updateLaterBtn').addEventListener('click', () => bar.remove());
  }
});

// ---------- boot ----------

const CATALOG_MAX_AGE = 30 * 60 * 1000;

async function loadCatalog(force = false) {
  if (force) toast('Обновляю каталог…');
  state.catalog = null;
  if (state.view === 'catalog') renderCatalog();
  state.catalog = await window.api.catalog.load(force);
  if (!state.catalog.error) buildModIndex();
  if (state.view === 'catalog') renderCatalog();
  if (force && !state.catalog.error) toast('Каталог обновлён');

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

(async function boot() {
  const maxed = await window.api.win.isMaximized();
  if (maxed) $('#winMax').innerHTML = '<svg viewBox="0 0 12 12" width="12" height="12"><rect x="2" y="3.5" width="6.5" height="6.5" fill="none" stroke="currentColor" stroke-width="1.1" rx="1"/><path d="M4 3.5V2.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-1" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>';
  await refreshSidebarStatus();
  await refreshInstalledIndex();
  await loadCatalog();
})();
