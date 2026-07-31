/* The Catalog: everything on offer, and the one screen that puts it on screen.
 *
 * Four lists share this file because they are one screen. The rail down the left, the
 * category grids, the mod modal that opens off a card, and the cosmetic slots the game's own
 * schema exposes - a slot is browsed as a category like any other, so the catalog draws it,
 * and its cards reuse the same markup, the same star and the same modal frame. Splitting
 * them apart would only mean two modules importing each other.
 *
 * What is offered comes from the upstream catalog (src/catalog.js via loadCatalog below),
 * which is why the mod index is built here: it is a reading of the same data.
 */
import { $ } from '../core/dom.js';
import { RAW_BASE, COSMETIC_SLOTS, COSMETIC_PREFIX, cosmeticMeta, RAIL_SECTIONS, CATALOG_EXCLUDE, SORTS, freshFilters } from '../core/constants.js';
import { state } from '../core/store.js';
import { registerView, render, switchView } from '../core/router.js';
import { keyOf, pickedIn, refreshInstalledIndex, refreshCosmeticSlots } from '../core/installed.js';
import { catName, catIcon } from '../core/categories.js';
import { esc, fmtDate, plural } from '../ui/format.js';
import { toast } from '../ui/toast.js';
import { confirmDialog } from '../ui/dialog.js';
import { previewUrl, isMedia, resolveUrl, mediaHtml } from '../ui/media.js';
import { openPlayer } from '../ui/player.js';
import { thumbHtml } from '../ui/thumb.js';
import { loadCosmeticIcons, paintCosmeticIcons, watchCosmeticIcons, cosmeticIcon, cosmeticIconKnown } from '../ui/cosmetic-icons.js';

const viewRoot = $('#view-root');

// This screen's own state, off the shared store now that it has somewhere to live.
let filters = freshFilters();   // sort + tag/group/hero/installed/starred narrowing
let cosSearch = '';             // search inside one cosmetic slot (its list runs to thousands)
const installing = new Set();   // mods with a download in flight, so a card can say so

registerView('catalog', () => renderCatalog());

// ---------- favorites ----------

const favKey = (cat, name) => `${cat}|${name}`;
const isFav = (cat, name) => state.favorites.has(favKey(cat, name));

async function toggleFavorite(cat, name) {
  const key = favKey(cat, name);
  if (state.favorites.has(key)) state.favorites.delete(key);
  else state.favorites.add(key);
  state.settings = await window.api.settings.set('favorites', [...state.favorites]);
  return state.favorites.has(key);
}

// starred mods resolved back to catalog entries (a mod dropped from the catalog is skipped)
function favoriteMods() {
  const out = [];
  for (const key of state.favorites) {
    if (key.startsWith(COSMETIC_PREFIX)) continue; // a look, not a mod — see favoriteCosmetics()
    const cut = key.indexOf('|');
    if (cut < 0) continue;
    const mod = findModByName(key.slice(0, cut), key.slice(cut + 1));
    if (mod) out.push(mod);
  }
  return out;
}

// Cosmetics only work with the schema patch on, so with safe mode they are not offered
// anywhere — the rail, the favourites, the search all ask here first.
function cosmeticSlotList() {
  return state.settings?.schemaPatch ? (state.cosmeticSlots || []) : [];
}

function slotData(slot) {
  return cosmeticSlotList().find((s) => s.slot === slot) || null;
}

// one look, by the id the schema gave it or by its name (favourites are stored by name)
function findCosmetic(slot, idOrName) {
  const data = slotData(slot);
  if (!data) return null;
  return data.options.find((o) => o.id === idOrName) || data.options.find((o) => o.name === idOrName) || null;
}

// starred looks resolved back to slot + option (one Valve dropped is simply skipped)
function favoriteCosmetics() {
  const out = [];
  for (const key of state.favorites) {
    if (!key.startsWith(COSMETIC_PREFIX)) continue;
    const cut = key.indexOf('|');
    if (cut < 0) continue;
    const slot = key.slice(COSMETIC_PREFIX.length, cut);
    const o = findCosmetic(slot, key.slice(cut + 1));
    if (o) out.push({ slot, o });
  }
  return out;
}

// every look whose name matches, across all slots — the global search reaches these too
function searchCosmetics(q) {
  const out = [];
  for (const s of cosmeticSlotList()) {
    for (const o of s.options) {
      if (o.name.toLowerCase().includes(q)) out.push({ slot: s.slot, o });
    }
  }
  return out;
}

// the catalog sort/"installed only"/"starred only" filters, applied to a [{slot, o}] list
function filterCosmetics(list) {
  const f = filters;
  let out = f.installedOnly ? list.filter(({ slot, o }) => pickedIn(slot)?.itemId === o.id) : list;
  if (f.favOnly) out = out.filter(({ slot, o }) => isFav(COSMETIC_PREFIX + slot, o.name));
  if (f.sort === 'name') out = [...out].sort((a, b) => a.o.name.localeCompare(b.o.name));
  else if (f.sort === 'name-desc') out = [...out].sort((a, b) => b.o.name.localeCompare(a.o.name));
  return out;
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
  const f = filters;
  let out = mods;
  if (f.group) out = out.filter((m) => m._group === f.group);
  if (f.hero) out = out.filter((m) => heroMatches(f.hero, m.name));
  if (f.tags.size) {
    out = out.filter((m) => [...f.tags].every((t) => m.tags?.[t]));
  }
  if (f.installedOnly) {
    out = out.filter((m) => isInstalled(m._cat || catForInstalled, m));
  }
  if (f.favOnly) {
    out = out.filter((m) => isFav(m._cat || catForInstalled, m.name));
  }
  const dateOf = (m) => m.meta?.date || 0;
  switch (f.sort) {
    case 'date': out = [...out].sort((a, b) => dateOf(b) - dateOf(a)); break;
    case 'name': out = [...out].sort((a, b) => a.name.localeCompare(b.name)); break;
    case 'name-desc': out = [...out].sort((a, b) => b.name.localeCompare(a.name)); break;
  }
  return out;
}

function favButtonHtml(cat, name) {
  const on = isFav(cat, name);
  return `<button class="fav-btn ${on ? 'on' : ''}" data-fav="${esc(favKey(cat, name))}"
    aria-pressed="${on}" title="${on ? L`Убрать из избранного` : L`В избранное`}"
    aria-label="${on ? L`Убрать из избранного` : L`В избранное`}"><span class="ms">${on ? 'favorite' : 'favorite_border'}</span></button>`;
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

// ===== Category rail =====

function renderRail() {
  const rail = $('#catRail');
  const cats = new Set(visibleCategories().map((c) => c.id));
  const favCount = favoriteMods().length + favoriteCosmetics().length;
  let html = `
    <button class="rail-item ${state.activeCategory === 'all' ? 'active' : ''}" data-cat="all">
      <span class="ms">apps</span>${L`Все категории`}
    </button>
    <button class="rail-item fav ${state.activeCategory === 'favorites' ? 'active' : ''}" data-cat="favorites">
      <span class="ms">favorite</span>${L`Избранное`}
      ${favCount ? `<span class="rail-cnt">${favCount}</span>` : ''}
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
  // Free cosmetics only work once safe mode is off (the patch is what lets the game read
  // them at all) — showing the section without that would just be a list of dead buttons.
  const cos = cosmeticSlotList();
  if (cos.length) {
    html += `<div class="rail-section">${L`Косметика`}</div>`;
    for (const s of cos) {
      const id = COSMETIC_PREFIX + s.slot;
      html += `
        <button class="rail-item ${state.activeCategory === id ? 'active' : ''}" data-cat="${esc(id)}">
          <span class="ms">${catIcon(id)}</span>${esc(catName(id))}
          <span class="rail-cnt">${s.options.length}</span>
          ${pickedIn(s.slot) ? '<span class="rail-dot"></span>' : ''}
        </button>`;
    }
  }
  rail.innerHTML = html;
  rail.querySelectorAll('.rail-item').forEach((b) => {
    b.addEventListener('click', () => {
      state.activeCategory = b.dataset.cat;
      filters = freshFilters();
      cosSearch = '';
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
  if (state.activeCategory === 'favorites') return renderFavorites();
  if (state.activeCategory.startsWith(COSMETIC_PREFIX)) return renderCosmeticCategory(state.activeCategory.slice(COSMETIC_PREFIX.length));
  renderCategory(state.activeCategory);
}

// --- favorites ---

function renderFavorites() {
  const all = favoriteMods();
  const mods = applyFilters(all);
  // starred looks live in the same list, kept in their own section: they install a slot of
  // the game's own schema rather than a file, so mixing them into the mod grid would lie
  const cosAll = favoriteCosmetics();
  const cos = filterCosmetics(cosAll);
  const installable = all.some(canBeInstalled) || cosAll.length > 0;
  const empty = !all.length && !cosAll.length;

  viewRoot.innerHTML = `
    <div class="view-header">
      <h1 class="view-title">${L`Избранное`}</h1>
      <span class="view-sub">${all.length} ${plural(all.length, 'мод', 'мода', 'модов')}${cosAll.length ? ` · ${cosAll.length} ${plural(cosAll.length, 'косметика', 'косметики', 'косметик')}` : ''}</span>
    </div>
    ${empty ? '' : toolbarHtml(mods.length + cos.length, { installable, fav: false })}
    ${empty ? `<div class="empty-note">${L`Здесь пусто — жми на сердечко у мода в каталоге`}</div>` : ''}
    ${all.length ? `
      ${cosAll.length ? `<div class="section-h"><span class="ms">extension</span>${L`Моды`}</div>` : ''}
      <div class="grid" id="modGrid">
        ${mods.length ? mods.map((m, i) => cardHtml(m, i, true)).join('') : `<div class="empty-note">${L`Ничего не найдено — сбрось фильтры`}</div>`}
      </div>` : ''}
    ${cosAll.length ? `
      <div class="section-h spaced"><span class="ms">auto_awesome</span>${L`Косметика`}</div>
      <div class="grid" id="cosGrid">
        ${cos.length ? cos.map(({ slot, o }, i) => cosmeticCardHtml(slot, o, i, true)).join('') : `<div class="empty-note">${L`Ничего не найдено — сбрось фильтры`}</div>`}
      </div>` : ''}
  `;
  if (!empty) bindToolbar();
  bindCards($('#modGrid'), mods);
  bindCosmeticCards($('#cosGrid'));
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
      filters = freshFilters();
      renderCatalog();
      $('#main').scrollTop = 0;
    });
  });
  bindCards(viewRoot);
}

// --- search results ---

// how many looks a search shows before it just says how many more there are: a query like
// "loading" matches a couple of thousand of them
const COS_SEARCH_LIMIT = 120;

function renderSearchResults() {
  const q = state.search.trim().toLowerCase();
  const cats = visibleCategories();
  let mods = [];
  for (const c of cats) {
    for (const m of categoryMods(c.id)) {
      if (m.name && m.name.toLowerCase().includes(q)) mods.push({ ...m, _cat: c.id });
    }
  }
  // the search reaches the free cosmetics too, in their own section below the mods
  const cosAll = searchCosmetics(q);
  // whether the "Установленные" chip makes sense at all — decided before filtering, or
  // the chip would vanish once it filtered everything out and could never be undone
  const installable = mods.some(canBeInstalled) || cosAll.length > 0;
  mods = applyFilters(mods);
  const cos = filterCosmetics(cosAll);
  const shownCos = cos.slice(0, COS_SEARCH_LIMIT);

  viewRoot.innerHTML = `
    <div class="view-header">
      <h1 class="view-title">${L`Поиск:`} <span class="accent">${esc(state.search.trim())}</span></h1>
      <span class="view-sub">${mods.length} ${plural(mods.length, 'мод', 'мода', 'модов')}${cos.length ? ` · ${cos.length} ${plural(cos.length, 'косметика', 'косметики', 'косметик')}` : ''}</span>
    </div>
    ${toolbarHtml(mods.length + cos.length, { tags: [], groups: [], installable })}
    ${!mods.length && !cos.length ? `<div class="empty-note">${L`Ничего не найдено`}</div>` : ''}
    ${mods.length ? `
      ${cos.length ? `<div class="section-h"><span class="ms">extension</span>${L`Моды`}</div>` : ''}
      <div class="grid" id="modGrid">${mods.map((m, i) => cardHtml(m, i, true)).join('')}</div>` : ''}
    ${cos.length ? `
      <div class="section-h spaced"><span class="ms">auto_awesome</span>${L`Косметика`}</div>
      <div class="grid" id="cosGrid">${shownCos.map(({ slot, o }, i) => cosmeticCardHtml(slot, o, i, true)).join('')}</div>
      ${cos.length > shownCos.length ? `<div class="search-more">${L`…и ещё ${cos.length - shownCos.length} — уточни запрос`}</div>` : ''}` : ''}
  `;
  bindToolbar();
  bindCards($('#modGrid'), mods);
  bindCosmeticCards($('#cosGrid'));
}

// --- single category ---

function renderCategory(categoryId) {
  const all = categoryMods(categoryId).map((m) => ({ ...m, _cat: categoryId }));
  const tags = collectTags(all);
  // hero dropdowns are long enough that catalog order is useless — sort them A-Z
  const groups = isGrouped(categoryId) ? collectGroups(all) : [];
  if (categoryId === 'hero-items') groups.sort((a, b) => a.localeCompare(b));
  const heroes = categoryId === 'heroes'
    ? (state.catalog?.constants?.HEROES_LIST || [])
      .filter((h) => all.some((m) => heroMatches(h, m.name)))
      .sort((a, b) => a.localeCompare(b))
    : [];
  const mods = applyFilters(all, categoryId);
  const installable = all.some(canBeInstalled);

  const grouped = isGrouped(categoryId) && !filters.group && filters.sort === 'default';

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

function toolbarHtml(resultCount, { tags = [], groups = [], heroes = [], categoryId = null, installable = true, fav = true }) {
  const f = filters;
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
      ${installable || fav ? '<div class="sep"></div>' : ''}
      ${installable ? `
      <button class="fchip ${f.installedOnly ? 'active' : ''}" id="installedChip">
        <span class="ms">check_circle</span>${L`Установленные`}
      </button>` : ''}
      ${fav ? `
      <button class="fchip ${f.favOnly ? 'active' : ''}" id="favChip">
        <span class="ms">favorite</span>${L`Избранное`}
      </button>` : ''}
      ${tags.length ? '<div class="sep"></div>' : ''}
      ${tags.map(([tag, cnt]) => `
        <button class="fchip ${f.tags.has(tag) ? 'active' : ''}" data-tag="${esc(tag)}">
          ${esc(tagLabel(categoryId, tag))}<span class="fchip-count">${cnt}</span>
        </button>`).join('')}
      <span class="count">${resultCount} ${plural(resultCount, 'результат', 'результата', 'результатов')}</span>
    </div>`;
}

function bindToolbar() {
  $('#sortSelect')?.addEventListener('change', (e) => {
    filters.sort = e.target.value;
    renderCatalog();
  });
  $('#groupSelect')?.addEventListener('change', (e) => {
    filters.group = e.target.value;
    renderCatalog();
  });
  $('#heroSelect')?.addEventListener('change', (e) => {
    filters.hero = e.target.value;
    renderCatalog();
  });
  $('#installedChip')?.addEventListener('click', () => {
    filters.installedOnly = !filters.installedOnly;
    renderCatalog();
  });
  $('#favChip')?.addEventListener('click', () => {
    filters.favOnly = !filters.favOnly;
    renderCatalog();
  });
  document.querySelectorAll('.fchip[data-tag]').forEach((c) => {
    c.addEventListener('click', () => {
      const t = c.dataset.tag;
      if (filters.tags.has(t)) filters.tags.delete(t);
      else filters.tags.add(t);
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
        ${favButtonHtml(cat, m.name)}
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
  if (!root) return;
  root.querySelectorAll('.card .fav-btn').forEach((btn) => bindFavButton(btn));
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

// star button on a card or in the modal: flips the star without disturbing the grid,
// unless the Favorites view is open — there an unstarred mod has to leave the list
function bindFavButton(btn) {
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const key = btn.dataset.fav;
    const cut = key.indexOf('|');
    const on = await toggleFavorite(key.slice(0, cut), key.slice(cut + 1));
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.querySelector('.ms').textContent = on ? 'favorite' : 'favorite_border';
    const label = on ? L`Убрать из избранного` : L`В избранное`;
    btn.title = label;
    btn.setAttribute('aria-label', label);
    if (state.view !== 'catalog') return;
    // in a list that IS the favourites, the card has to leave it
    if (state.activeCategory === 'favorites' || filters.favOnly) renderCatalog();
    else renderRail();
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
  cosModalState = null; // the two share one overlay
  modalState = { categoryId, mod, styleIdx: 0 };
  drawModal();
  $('#modalOverlay').classList.remove('hidden');
}

function closeModal() {
  $('#modalOverlay').classList.add('hidden');
  $('#modalContent').innerHTML = '';
  modalState = null;
  cosModalState = null;
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
  const busy = installing.has(keyOf(categoryId, mod.name, styleLabel));
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
        ${favButtonHtml(categoryId, mod.name)}
      </div>
      <div class="modal-sub">
        <span>${esc(catName(categoryId))}</span>
        ${mod._group ? `<span>· ${esc(mod._group)}</span>` : ''}
        ${mod._custom ? `<span>${L`· свой пак`}</span>` : ''}
        ${mod.meta?.date ? `<span>· ${fmtDate(mod.meta.date)}</span>` : ''}
        ${authorName ? `
          <button class="author-chip ${authorHref ? 'clickable' : ''}" id="authorChip" ${authorHref ? '' : 'disabled'}>
            <span class="ms">person</span>${esc(authorName)}${authorHref ? '<span class="ms ms-xs">open_in_new</span>' : ''}
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
              ${thumbHtml('pack-thumb', thumb)}
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
      ${categoryId === 'cursors' ? `<div class="modal-note">${L`Курсор ставится в game\\dota\\resource\\cursor — параметр запуска не нужен. Оригиналы сохраняются автоматически. Включать и выключать его можно в Библиотеке, но активным может быть только один курсор: новый выключит предыдущий.`}</div>` : ''}
    </div>
  `;

  $('#modalCloseBtn').addEventListener('click', closeModal);
  const favBtn = $('#modalContent .fav-btn');
  if (favBtn) bindFavButton(favBtn);

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
  if (installing.has(k)) return;
  if (!state.settings?.dotaPathValid && categoryId !== 'tools') {
    toast(L`Сначала укажи путь к Dota 2 в настройках`, 'warn');
    return;
  }
  installing.add(k);
  if (modalState) drawModal();
  const r = await window.api.mods.install({ categoryId, name: mod.name, styleLabel, fileRef, preview });
  installing.delete(k);
  if (r.error && !r.already) toast(`${mod.name}: ${r.error}`, 'error', 6000);
  else if (r.replaced?.length) toast(L`${mod.name} установлен — «${r.replaced.join(', ')}» выключен: курсор в игре может быть только один`, 'warn', 7000);
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
    // a mod with styles keeps everything per style — its file, its label and its picture
    const style = mod.file ? null : mod.styles?.[0];
    const fileRef = mod.file || style?.file;
    const styleLabel = style?.label || null;
    if (!fileRef || !/\.(vpk|zip)$/i.test(fileRef)) { skip++; continue; }
    if (state.installedIndex.has(keyOf(categoryId, mod.name, styleLabel))) { skip++; continue; }
    const r = await doInstall(categoryId, mod, styleLabel, fileRef, style?.preview || mod.preview);
    if (r?.ok) ok++;
    else if (r?.cancelled) skip++;
    else fail++;
  }
  toast(L`Пак «${pack.name}»: установлено ${ok}, пропущено ${skip}${fail ? L`, ошибок ${fail}` : ''}`, fail ? 'warn' : 'ok', 7000);
  await refreshInstalledIndex();
  render();
}

// ===== Cosmetics: free looks taken from the game's own item schema, browsed as a catalog
// category like any other (see COSMETIC_SLOTS / cosmeticMeta near the top of the file) =====


// One card per look, styled exactly like a catalog mod card (same .card/.grid classes):
// a picture, a favourite star, and an "Установлен" badge on whichever one is live.
function cosmeticCardHtml(slot, o, i, withCat = false) {
  const cat = COSMETIC_PREFIX + slot;
  const icon = cosmeticIcon(o.name);
  const picked = pickedIn(slot)?.itemId === o.id;
  return `
    <div class="card" data-cos="${esc(slot)}" data-cos-id="${esc(o.id)}" style="--i:${Math.min(i, 28)}">
      <div class="card-media">
        <span class="card-thumb" data-name="${esc(o.name)}">${icon
          ? `<img src="${esc(icon)}" alt="" loading="lazy">`
          : `<div class="noimg"><span class="ms">${cosmeticMeta(slot).icon}</span></div>`}</span>
        ${favButtonHtml(cat, o.name)}
        <div class="media-tags">${picked ? `<span class="mtag ok">${L`Установлен`}</span>` : ''}</div>
      </div>
      <div class="card-body">
        <div class="card-name">${esc(o.name)}</div>
        ${withCat ? `<div class="card-meta"><span>${esc(catName(cat))}</span></div>` : ''}
      </div>
    </div>`;
}

// Cosmetic cards behave like mod cards: a click opens the look, it does not install it.
function bindCosmeticCards(root) {
  if (!root) return;
  root.querySelectorAll('.card .fav-btn').forEach((btn) => bindFavButton(btn));
  root.querySelectorAll('.card[data-cos]').forEach((card) => {
    card.addEventListener('click', () => openCosmeticModal(card.dataset.cos, card.dataset.cosId));
  });
  paintCosmeticIcons(root);
  return watchCosmeticIcons(root, null);
}

// toggle the "Установлен" badge on visible cosmetic cards in place — same idea as
// refreshCardBadges() for mods, so a pick never costs the grid its scroll position
function refreshCosmeticBadges() {
  viewRoot.querySelectorAll('.card[data-cos]').forEach((card) => {
    const picked = pickedIn(card.dataset.cos)?.itemId === card.dataset.cosId;
    const badge = card.querySelector('.mtag.ok');
    if (picked && !badge) {
      card.querySelector('.media-tags')?.insertAdjacentHTML('afterbegin', `<span class="mtag ok">${L`Установлен`}</span>`);
    } else if (!picked && badge) {
      badge.remove();
    }
  });
}

// ---------- cosmetic modal (the mod modal's twin, same markup and classes) ----------

let cosModalState = null;

function openCosmeticModal(slot, itemId) {
  const o = findCosmetic(slot, itemId);
  if (!o) return;
  modalState = null;
  cosModalState = { slot, o };
  drawCosmeticModal();
  $('#modalOverlay').classList.remove('hidden');
  // the picture may not have been fetched yet if the card was never scrolled into view
  if (!cosmeticIconKnown(o.name)) loadCosmeticIcons([o.name], () => { if (cosModalState?.o === o) drawCosmeticModal(); });
}

function drawCosmeticModal() {
  const { slot, o } = cosModalState;
  const meta = cosmeticMeta(slot);
  const data = slotData(slot);
  const live = pickedIn(slot);
  const isLive = live?.itemId === o.id;
  const icon = cosmeticIcon(o.name);
  const busy = installing.has(COSMETIC_PREFIX + slot + '|' + o.id);

  $('#modalContent').innerHTML = `
    <div class="modal-media cos">
      ${icon
        ? `<img src="${esc(icon)}" alt="">`
        : `<div class="noimg"><span class="ms">${meta.icon}</span></div>`}
      <button class="modal-close" id="modalCloseBtn" aria-label="${L`Закрыть`}"><span class="ms">close</span></button>
    </div>
    <div class="modal-body">
      <div class="modal-title-row">
        <div class="modal-title">${esc(o.name)}</div>
        ${favButtonHtml(COSMETIC_PREFIX + slot, o.name)}
      </div>
      <div class="modal-sub">
        <span>${esc(tr(meta.label))}</span>
        <span>· ${L`бесплатная косметика`}</span>
        ${data ? `<span>· ${data.options.length} ${plural(data.options.length, 'вариант', 'варианта', 'вариантов')}</span>` : ''}
      </div>
      <div class="modal-actions">
        ${isLive
          ? `<button class="btn btn-danger" id="cosRemoveBtn"><span class="ms">delete</span>${L`Убрать`}</button>`
          : `<button class="btn btn-primary" id="cosPickBtn" ${busy ? 'disabled' : ''}><span class="ms">download</span>${busy ? L`Установка…` : L`Установить`}</button>`}
      </div>
      <div class="modal-note">
        ${isLive
          ? L`Этот вид сейчас стоит в слоте «${tr(meta.label)}». Убрать — вернуть то, что даёт игра; включить обратно можно в Библиотеке.`
          : live
            ? L`На один слот — только одна активная косметика: этот вид заменит «${live.name}». Прошлый выбор останется в Библиотеке выключенным.`
            : L`Косметика подставляется в схему предметов игры — файлы модов она не трогает, и её видно только тебе.`}
      </div>
    </div>`;

  $('#modalCloseBtn').addEventListener('click', closeModal);
  const favBtn = $('#modalContent .fav-btn');
  if (favBtn) bindFavButton(favBtn);
  $('#cosPickBtn')?.addEventListener('click', () => pickCosmetic(slot, o, false));
  $('#cosRemoveBtn')?.addEventListener('click', () => pickCosmetic(slot, o, true));
}

/**
 * Put a look on (or take the live one off) and repaint whatever is on screen.
 * @param {boolean} remove  true = back to what the game gives
 */
async function pickCosmetic(slot, o, remove) {
  const k = COSMETIC_PREFIX + slot + '|' + o.id;
  if (installing.has(k)) return;
  const live = pickedIn(slot);
  installing.add(k);
  if (cosModalState) drawCosmeticModal();
  const r = remove
    ? (live ? await window.api.mods.remove(live.id) : { ok: true })
    : await window.api.cosmetics.pick(slot, o.id, o.name);
  installing.delete(k);
  if (r.error) { toast(r.error, 'error'); if (cosModalState) drawCosmeticModal(); return; }
  toast(remove ? L`Вернули как в игре` : L`Выбрано: ${o.name}`);
  await refreshInstalledIndex();
  refreshCosmeticBadges();
  if (state.view === 'catalog') renderRail(); // the slot's "picked" dot
  if (cosModalState) drawCosmeticModal();
}

async function renderCosmeticCategory(slot) {
  const meta = cosmeticMeta(slot);
  viewRoot.innerHTML = `<div class="view-header"><h1 class="view-title">${esc(tr(meta.label))}</h1></div><div class="empty-note">${L`Читаем схему игры…`}</div>`;
  if (!state.cosmeticSlots) await refreshCosmeticSlots();
  if (state.activeCategory !== COSMETIC_PREFIX + slot) return; // moved on while reading

  const data = (state.cosmeticSlots || []).find((s) => s.slot === slot);
  if (!data) {
    viewRoot.innerHTML = `<div class="view-header"><h1 class="view-title">${esc(tr(meta.label))}</h1></div><div class="empty-note">${L`Схема игры не прочиталась — проверь путь к Dota 2 в настройках.`}</div>`;
    return;
  }

  const f = filters;
  let io = null;

  const filtered = () => {
    const q = cosSearch.trim().toLowerCase();
    let list = data.options.map((o) => ({ slot, o }));
    if (q) list = list.filter(({ o }) => o.name.toLowerCase().includes(q));
    return filterCosmetics(list);
  };

  const paintGrid = () => {
    const list = filtered();
    const shown = list.slice(0, 400); // search narrows the rest; nobody scrolls past this
    $('#cosCount').textContent = `${list.length} ${plural(list.length, 'результат', 'результата', 'результатов')}`;
    const grid = $('#cosGrid');
    grid.innerHTML = shown.length
      ? shown.map(({ o }, i) => cosmeticCardHtml(slot, o, i)).join('')
      : `<div class="empty-note">${L`Ничего не найдено — сбрось фильтры`}</div>`;
    if (io) io.disconnect();
    io = bindCosmeticCards(grid);
  };

  viewRoot.innerHTML = `
    <div class="view-header">
      <h1 class="view-title">${esc(tr(meta.label))}</h1>
      <span class="view-sub">${data.options.length} ${plural(data.options.length, 'вариант', 'варианта', 'вариантов')}</span>
    </div>
    <div class="toolbar">
      <div class="select-wrap">
        <span class="ms">sort</span>
        <select id="cosSort">
          ${SORTS.filter((s) => s.key !== 'date').map((s) => `<option value="${s.key}" ${f.sort === s.key ? 'selected' : ''}>${esc(tr(s.label))}</option>`).join('')}
        </select>
      </div>
      <div class="tb-search cat-search"><span class="ms">search</span><input type="text" id="cosSearch" placeholder="${L`Поиск…`}" value="${esc(cosSearch)}" autocomplete="off"></div>
      <div class="sep"></div>
      <button class="fchip ${f.installedOnly ? 'active' : ''}" id="cosInstalledChip"><span class="ms">check_circle</span>${L`Установленные`}</button>
      <button class="fchip ${f.favOnly ? 'active' : ''}" id="cosFavChip"><span class="ms">favorite</span>${L`Избранное`}</button>
      <span class="count" id="cosCount"></span>
    </div>
    <div class="grid" id="cosGrid"></div>`;

  $('#cosSort').addEventListener('change', (e) => { f.sort = e.target.value; paintGrid(); });
  $('#cosSearch').addEventListener('input', (e) => { cosSearch = e.target.value; paintGrid(); });
  $('#cosInstalledChip').addEventListener('click', (e) => {
    f.installedOnly = !f.installedOnly;
    e.currentTarget.classList.toggle('active', f.installedOnly);
    paintGrid();
  });
  $('#cosFavChip').addEventListener('click', (e) => {
    f.favOnly = !f.favOnly;
    e.currentTarget.classList.toggle('active', f.favOnly);
    paintGrid();
  });
  paintGrid();
}

const CATALOG_MAX_AGE = 30 * 60 * 1000;

export async function loadCatalog(force = false) {
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
