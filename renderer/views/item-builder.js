/* The item builder in the catalog: a hero's items, each built from one of its wearables with an
 * effect on top. The hub lists heroes, a hero opens its item slots, and a slot opens the picker of
 * wearables and effects. What a pick does to the game is src/item-builder.js; this is the screen.
 *
 * Written by h6rd (https://github.com/h6rd) in #117, developed further with TheFleece
 * (https://github.com/TheFleece).
 * Copyright (C) 2026 h6rd
 * Copyright (C) 2026 TheFleece
 * SPDX-License-Identifier: GPL-3.0-or-later
 * The additional terms in NOTICE apply: whoever carries this code keeps both names here and in
 * the credits of the program it goes into.
 *
 * It lives beside the catalog rather than inside it, and reaches the catalog only through what
 * bindItemBuilder hands over: the window, the slot data, the pick itself, the filters and search.
 */
import { $ } from '../core/dom.js';
import { state } from '../core/store.js';
import { COSMETIC_PREFIX } from '../core/constants.js';
import { catName } from '../core/categories.js';
import { pickedIn, refreshCosmeticSlots } from '../core/installed.js';
import { pane } from '../core/router.js';
import { esc, plural } from '../ui/format.js';
import { paint } from '../ui/transitions.js';
import { cosmeticIcon, loadCosmeticIcons, paintCosmeticIcons, watchCosmeticIcons } from '../ui/cosmetic-icons.js';

const viewRoot = pane('catalog');

/** What the catalog hands over; set once by bindItemBuilder before anything here runs. */
let cat = null;

/**
 * @param {{ slotData: Function, cosmeticSlotList: Function, pickCosmetic: Function, openModal: Function,
 *   closeModal: Function, resetModalState: Function, filters: () => object, search: () => string,
 *   setSearch: (v: string) => void }} ctx
 */
export function bindItemBuilder(ctx) {
  cat = ctx;
}

export function itemCosmeticSlots() {
  return cat.cosmeticSlotList().filter((s) => s.kind === 'item-effect' || String(s.slot || '').startsWith('item:'));
}

export function hasItemCosmeticPick() {
  return itemCosmeticSlots().some((s) => pickedIn(s.slot));
}

export function isItemCosmeticSlot(slot) {
  return cat.slotData(slot)?.kind === 'item-effect' || String(slot || '') === 'items' || String(slot || '').startsWith('item:');
}

export function cosmeticFavValue(slot, o) {
  return isItemCosmeticSlot(slot) ? o.id : o.name;
}

let itemSlotModalState = null;

let itemSlotPickerIo = null;

let itemHubIo = null;

function selectedItemSlotOption(stateObj) {
  const data = cat.slotData(stateObj?.slot);
  if (!data) return null;
  return data.options.find((o) => o.id === stateObj.selectedId) || data.options[0] || null;
}

function cosmeticThumbSpanHtml(name, fallbackIcon, cls = 'card-thumb') {
  const icon = name ? cosmeticIcon(name) : null;
  return `<span class="${cls}"${name ? ` data-name="${esc(name)}"` : ''}>${icon
    ? `<img src="${esc(icon)}" alt="" loading="lazy">`
    : `<div class="noimg"><span class="ms">${esc(fallbackIcon || 'checkroom')}</span></div>`}</span>`;
}

function itemSlotOptionCardHtml(slot, o, i, selectedId, live, selectedEffects) {
  const selected = o.id === selectedId;
  const installed = live?.itemId === o.id;
  const isNone = o.id === '';
  const uniqueTags = [...new Set((o.tags || []).map((t) => String(t).toLowerCase()))];
  return `<button class="card item-pick-card ${selected ? 'picked' : ''} ${installed ? 'installed' : ''}" data-item-option="${esc(o.id)}" style="--i:${Math.min(i, 24)}">
    <div class="card-media">
      ${isNone ? `<div class="noimg"><span class="ms">block</span></div>` : cosmeticThumbSpanHtml(o.name, cat.slotData(slot)?.icon || 'checkroom')}
    </div>
    <div class="card-body">
      <div class="card-name">${esc(o.name)}</div>
      <div class="card-meta"><span>${selected ? L`Выбрано` : installed ? L`Установлено` : uniqueTags.length ? esc(uniqueTags.join(', ')) : '&nbsp;'}</span></div>
    </div>
  </button>`;
}

function itemSlotTileHtml(s) {
  const live = pickedIn(s.slot);
  const previewName = live?.name || '';
  return `<button class="card item-slot-card ${live ? 'installed' : ''}" data-item-slot="${esc(s.slot)}" style="--i:0">
    <div class="card-media">
      ${previewName ? cosmeticThumbSpanHtml(previewName, s.icon || 'checkroom', 'item-slot-thumb') : `<span class="item-slot-thumb"><div class="noimg"><span class="ms">${esc(s.icon || 'checkroom')}</span></div></span>`}
      <div class="media-tags"><span class="mtag soft">${esc(s.slotLabel || s.label)}</span></div>
    </div>
    <div class="card-body">
      <div class="card-name">${esc(s.slotLabel || s.label)}</div>
      <div class="card-meta"><span>${live ? esc(live.name) : `${s.options.length} ${plural(s.options.length, 'вариант', 'варианта', 'вариантов')}`}</span></div>
    </div>
  </button>`;
}

function openItemSlotModal(slot, from) {
  const data = cat.slotData(slot);
  if (!data) return;
  const live = pickedIn(slot);
  const selectedId = live?.itemId || '';
  // a record keeps its effects as one comma separated string (src/item-builder.js effectKey)
  const selectedEffects = live?.effectId ? String(live.effectId).split(',').filter(Boolean) : [];
  itemSlotModalState = { slot, selectedId, effectIds: selectedEffects, query: '' };
  cat.resetModalState();
  cat.openModal(drawItemSlotModal, from);
  const firstVisible = data.options.slice(0, 36).map((o) => o.name).filter(Boolean);
  loadCosmeticIcons(firstVisible, () => {
    if (itemSlotModalState?.slot === slot) {
      paintCosmeticIcons($('#itemPickGrid'));
      paintCosmeticIcons($('#modalContent'));
    }
  });
}

function drawItemSlotModal() {
  const { slot, query = '' } = itemSlotModalState;
  const data = cat.slotData(slot);
  if (!data) return;
  const live = pickedIn(slot);
  const slotLabel = data.label || catName(COSMETIC_PREFIX + slot);
  const effectOptions = (data.effects || []).filter((fx) => {
    const name = (fx.name || '').toLowerCase();
    const id = (fx.id || '').toLowerCase();
    return name !== 'no effect' && name !== 'none' && id !== 'no effect' && id !== 'none' && id !== '';
  });
  const selectedEffects = Array.isArray(itemSlotModalState.effectIds) ? itemSlotModalState.effectIds : [];

  // Add "None" option as the first entry
  const noneOption = { id: '', name: L`Нет`, tags: [] };
  const allOptions = [noneOption, ...data.options];

  const q = query.trim().toLowerCase();
  const options = q ? allOptions.filter((o) => o.name.toLowerCase().includes(q)) : allOptions;
  const selected = options.find((o) => o.id === itemSlotModalState.selectedId)
    || allOptions.find((o) => o.id === itemSlotModalState.selectedId)
    || options[0]
    || allOptions[0]
    || null;
  if (selected && itemSlotModalState.selectedId !== selected.id) itemSlotModalState.selectedId = selected.id;
  const shown = options;

  $('#modalContent').classList.add('item-picker-modal');
  $('#modalContent').innerHTML = `
    <div class="modal-body item-picker-body">
      <div class="modal-title-row item-picker-head">
        <div>
          <div class="modal-title">${esc(slotLabel)}</div>
          <div class="modal-sub">
            ${selected ? `<span>${esc(selected.name)}</span>` : ''}
            <span>· ${data.options.length} ${plural(data.options.length, 'вариант', 'варианта', 'вариантов')}</span>
          </div>
        </div>
        <button class="modal-close" id="modalCloseBtn" aria-label="${L`Закрыть`}"><span class="ms">close</span></button>
      </div>
      <div class="item-picker-toolbar">
        <div class="modal-note modal-field item-picker-search">
          <div class="modal-field-label">${L`Предмет`}</div>
          <input class="input" id="itemSlotSearch" type="text" placeholder="${L`Поиск…`}" value="${esc(query)}" autocomplete="off">
        </div>
        <div class="modal-actions item-picker-actions">
          ${live ? `<button class="btn btn-danger" id="cosRemoveBtn"><span class="ms">delete</span>${L`Убрать`}</button>` : ''}
        </div>
      </div>
      <div class="item-pick-grid" id="itemPickGrid">
        ${shown.length
          ? shown.map((o, i) => itemSlotOptionCardHtml(slot, o, i, selected?.id || '', live, selectedEffects)).join('')
          : `<div class="empty-note">${L`Ничего не найдено — сбрось фильтры`}</div>`}
      </div>
      ${effectOptions.length ? `
        <div class="section-h" style="margin-top: 24px;"><span class="ms">auto_awesome</span>${L`Эффекты (можно несколько)`}</div>
        <div class="modal-note warn">${L`Некоторые эффекты (например, frostbloom, snow) могут не прикрепляться ко всем моделям.`}</div>
        <div class="item-pick-grid" id="effectGrid">
          <button class="card item-pick-card ${selectedEffects.length === 0 ? 'picked' : ''}" data-effect-none="true" style="--i:0">
            <div class="card-media">
              <div class="noimg"><span class="ms">block</span></div>
            </div>
            <div class="card-body">
              <div class="card-name">${L`Без эффектов`}</div>
              <div class="card-meta"><span>${selectedEffects.length === 0 ? L`Выбрано` : L`Эффект`}</span></div>
            </div>
          </button>
          ${effectOptions.map((fx, idx) => {
            const isSelected = selectedEffects.includes(fx.id);
            const effectIconPath = getEffectIconPath(fx.id);
            return `<button class="card item-pick-card ${isSelected ? 'picked' : ''}" data-effect-id="${esc(fx.id)}" style="--i:${idx + 1}">
              <div class="card-media">
                ${effectIconPath
                  ? `<span class="card-thumb"><img src="${esc(effectIconPath)}" alt="${esc(fx.name)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'noimg\\'><span class=\\'ms\\'>auto_awesome</span></div>'"></span>`
                  : `<div class="noimg"><span class="ms">auto_awesome</span></div>`}
              </div>
              <div class="card-body">
                <div class="card-name">${esc(fx.name)}</div>
                <div class="card-meta"><span>${isSelected ? L`Выбрано` : L`Эффект`}</span></div>
              </div>
            </button>`;
          }).join('')}
        </div>` : ''}
      <div class="modal-note">
        ${selected
          ? L`Стандартный предмет героя сохранит свои id, name и prefab=default_item. Остальная часть блока берётся у выбранного предмета, а выбранные эффекты добавляются в visuals.`
          : L`Ничего не найдено — сбрось фильтры`}
      </div>
    </div>`;

  itemSlotPickerIo?.disconnect();
  itemSlotPickerIo = null;
  $('#modalCloseBtn').addEventListener('click', () => cat.closeModal());
  $('#itemSlotSearch')?.addEventListener('input', (e) => {
    itemSlotModalState.query = e.target.value;
    drawItemSlotModal();
  });

  // Handle effect card clicks (multi-select)
  const effectGrid = $('#effectGrid');

  // Handle "No effects" card
  effectGrid?.querySelector('[data-effect-none]')?.addEventListener('click', () => {
    itemSlotModalState.effectIds = [];
    drawItemSlotModal();
    // Persist immediately if there's a live item pick
    if (live && itemSlotModalState.selectedId) {
      const pick = data.options.find((o) => o.id === itemSlotModalState.selectedId) || null;
      if (pick) {
        cat.pickCosmetic(slot, pick, false, '');
      }
    }
  });

  // Handle individual effect cards
  effectGrid?.querySelectorAll('[data-effect-id]').forEach((card) => {
    card.addEventListener('click', () => {
      const effectId = card.dataset.effectId;
      const currentEffects = itemSlotModalState.effectIds || [];
      if (currentEffects.includes(effectId)) {
        itemSlotModalState.effectIds = currentEffects.filter((id) => id !== effectId);
      } else {
        itemSlotModalState.effectIds = [...currentEffects, effectId];
      }
      drawItemSlotModal();
      // Persist immediately if there's a live item pick
      if (live && itemSlotModalState.selectedId) {
        const pick = data.options.find((o) => o.id === itemSlotModalState.selectedId) || null;
        if (pick) {
          cat.pickCosmetic(slot, pick, false, itemSlotModalState.effectIds.join(','));
        }
      }
    });
  });

  $('#itemPickGrid')?.querySelectorAll('[data-item-option]').forEach((card) => {
    card.addEventListener('click', () => {
      const pickId = card.dataset.itemOption;

      // Handle "None" option - remove the slot and clear effects
      if (pickId === '') {
        itemSlotModalState.selectedId = '';
        itemSlotModalState.effectIds = [];
        drawItemSlotModal(); // Redraw to clear selected effects visually
        if (live) {
          cat.pickCosmetic(slot, { id: '', name: L`Нет` }, true, '');
        }
        return;
      }

      const pick = data.options.find((o) => o.id === pickId) || null;
      if (!pick) return;
      itemSlotModalState.selectedId = pickId;
      const nextEffectIds = itemSlotModalState.effectIds || [];
      const alreadyLive = live?.itemId === pick.id && JSON.stringify(String(live.effectId || '').split(',').filter(Boolean).sort()) === JSON.stringify([...nextEffectIds].sort());
      if (alreadyLive) {
        drawItemSlotModal();
        return;
      }
      loadCosmeticIcons([pick.name], () => {
        if (itemSlotModalState?.slot === slot) paintCosmeticIcons($('#itemPickGrid'));
      });
      cat.pickCosmetic(slot, pick, false, nextEffectIds.join(','));
    });
  });
  paintCosmeticIcons($('#itemPickGrid'));
  itemSlotPickerIo = watchCosmeticIcons($('#itemPickGrid'), null);
  $('#cosRemoveBtn')?.addEventListener('click', () => {
    const pick = selectedItemSlotOption(itemSlotModalState) || { id: live?.itemId || '', name: live?.name || slotLabel };
    cat.pickCosmetic(slot, pick, true, '');
  });
}

export async function renderItemCosmeticHub(restoreScrollTop = null) {
  await paint(() => { viewRoot.innerHTML = `<div class="view-header"><h1 class="view-title">${esc(catName(COSMETIC_PREFIX + 'items'))}</h1></div><div class="empty-note">${L`Читаем схему игры…`}</div>`; });
  if (!state.cosmeticSlots) await refreshCosmeticSlots();
  if (state.activeCategory !== COSMETIC_PREFIX + 'items') return;

  const heroes = new Map();
  for (const s of itemCosmeticSlots()) {
    const key = s.heroLabel || s.label || s.slot;
    if (!heroes.has(key)) heroes.set(key, []);
    heroes.get(key).push(s);
  }
  const list = [...heroes.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  await loadHeroPortraits(list);
  if (!list.length) {
    await paint(() => { viewRoot.innerHTML = `<div class="view-header"><h1 class="view-title">${esc(catName(COSMETIC_PREFIX + 'items'))}</h1></div><div class="empty-note">${L`Схема игры не прочиталась — проверь путь к Dota 2 в настройках.`}</div>`; });
    return;
  }

  const paintHub = (filteredList) => {
    const count = filteredList.length;
    $('#cosCount').textContent = (cat.search() || cat.filters().installedOnly)
      ? `${count} ${plural(count, 'герой', 'героя', 'героев')}`
      : '';
    $('#itemHub').innerHTML = filteredList.length
      ? `<div class="grid">${filteredList.map(([hero, slots], i) => itemHeroCardHtml(hero, slots, i)).join('')}</div>`
      : `<div class="empty-note">${L`Ничего не найдено — сбрось фильтры`}</div>`;
    viewRoot.querySelectorAll('[data-item-hero]').forEach((btn) => {
      const heroName = btn.dataset.itemHero;
      const heroSlots = heroes.get(heroName) || [];
      btn.addEventListener('click', () => openItemHeroModal(heroName, heroSlots, btn));
    });
    itemHubIo?.disconnect();
    itemHubIo = null;
    paintCosmeticIcons($('#itemHub'));
    itemHubIo = watchCosmeticIcons($('#itemHub'), null);
  };

  const applyHubFilters = () => {
    const q = cat.search().trim().toLowerCase();
    const filtered = list.filter(([hero, slots]) => {
      if (q && !hero.toLowerCase().includes(q)) return false;
      if (cat.filters().installedOnly && !slots.some((s) => pickedIn(s.slot))) return false;
      return true;
    });
    paintHub(filtered);
  };

  await paint(() => { viewRoot.innerHTML = `
    <div class="view-header">
      <h1 class="view-title">${esc(catName(COSMETIC_PREFIX + 'items'))}</h1>
    </div>
    <div class="toolbar">
      <div class="tb-line">
        <div class="tb-search cat-search"><span class="ms">search</span><input type="text" id="cosSearch" placeholder="${L`Поиск…`}" value="${esc(cat.search())}" autocomplete="off"></div>
        <div class="sep"></div>
        <button class="fchip ${cat.filters().installedOnly ? 'active' : ''}" id="cosInstalledChip"><span class="ms">check_circle</span>${L`Установленные`}</button>
        <span class="count" id="cosCount"></span>
      </div>
    </div>
    <div id="itemHub"></div>`; });

  cat.filters().favOnly = false;

  $('#cosSearch').addEventListener('input', (e) => { cat.setSearch(e.target.value); applyHubFilters(); });
  $('#cosInstalledChip').addEventListener('click', (e) => {
    cat.filters().installedOnly = !cat.filters().installedOnly;
    e.currentTarget.classList.toggle('active', cat.filters().installedOnly);
    applyHubFilters();
  });
  applyHubFilters();
  if (restoreScrollTop !== null && $('#main')) $('#main').scrollTop = restoreScrollTop;
}

// A hero's portrait, read out of the installed game (src/game-icons.js heroPortraits): the game
// keeps them as plain PNG, so this needs no toolchain and no network. Keyed by the label the hub
// shows. They used to ship inside the app, 132 of Valve's pictures in a GPL repository.
const heroPortraits = new Map();

async function loadHeroPortraits(heroes) {
  const want = new Map(); // hero id -> the labels that show it
  for (const [label, slots] of heroes) {
    const id = slots[0]?.heroIds?.[0];
    if (id && !heroPortraits.has(label)) want.set(id, [...(want.get(id) || []), label]);
  }
  if (!want.size) return;
  let got = {};
  try { got = await window.api.cosmetics.heroPortraits([...want.keys()]); } catch { /* no game: glyphs */ }
  for (const [id, labels] of want) for (const label of labels) heroPortraits.set(label, got[id] || null);
}

function getHeroIconPath(label) {
  return heroPortraits.get(label) || null;
}

// The effects that have a picture. A fixed set, the same ids src/item-builder.js offers, so the
// screen never has to ask what is in a folder.
const EFFECT_PICTURES = new Set(['bubbles', 'fire', 'frostbloom', 'ghost', 'lightnings', 'sand-storm', 'snow']);

function getEffectIconPath(effectId) {
  return EFFECT_PICTURES.has(effectId) ? `./assets/effects/${effectId}.webp` : null;
}

function itemHeroCardHtml(hero, slots, i) {
  const hasInstalled = slots.some((s) => pickedIn(s.slot));
  const iconPath = getHeroIconPath(hero);
  return `
    <div class="card ${hasInstalled ? 'installed' : ''}" data-item-hero="${esc(hero)}" style="--i:${Math.min(i, 28)}">
      <div class="card-media">
        ${iconPath
          ? `<span class="card-thumb"><img src="${esc(iconPath)}" alt="${esc(hero)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'noimg\\'><span class=\\'ms\\'>person</span></div>'"></span>`
          : `<span class="card-thumb"><div class="noimg"><span class="ms">person</span></div></span>`}
      </div>
      <div class="card-body">
        <div class="card-name">${esc(hero)}</div>
        <div class="card-meta"><span>${slots.length} ${plural(slots.length, 'слот', 'слота', 'слотов')}</span></div>
      </div>
    </div>`;
}

function openItemHeroModal(heroName, slots, from) {
  cat.resetModalState();
  itemSlotModalState = null;
  itemSlotPickerIo?.disconnect();
  itemSlotPickerIo = null;
  cat.openModal(() => drawItemHeroModal(heroName, slots), from);
  const firstVisible = slots.slice(0, 12).flatMap((s) => [
    pickedIn(s.slot)?.name || s.options[0]?.name || ''
  ].filter(Boolean));
  loadCosmeticIcons(firstVisible, () => {
    paintCosmeticIcons($('#modalContent'));
  });
}

function drawItemHeroModal(heroName, slots) {
  $('#modalContent').classList.remove('item-picker-modal');
  $('#modalContent').innerHTML = `
    <div class="modal-body">
      <div class="modal-title-row">
        <div class="modal-title">${esc(heroName)}</div>
        <button class="modal-close" id="modalCloseBtn" aria-label="${L`Закрыть`}"><span class="ms">close</span></button>
      </div>
      <div class="modal-sub">
        <span>${esc(catName(COSMETIC_PREFIX + 'items'))}</span>
        <span>· ${slots.length} ${plural(slots.length, 'слот', 'слота', 'слотов')}</span>
      </div>
      <div class="item-slot-grid" style="margin-top: 16px;">
        ${slots.map((s) => itemSlotTileHtml(s)).join('')}
      </div>
    </div>`;
  $('#modalCloseBtn').addEventListener('click', () => cat.closeModal());
  $('#modalContent').querySelectorAll('[data-item-slot]').forEach((btn) => {
    btn.addEventListener('click', () => {
      cat.closeModal();
      setTimeout(() => openItemSlotModal(btn.dataset.itemSlot, null), 200);
    });
  });
  paintCosmeticIcons($('#modalContent'));
}

/** Stop watching the hub's icons: the catalog is drawing something else. */
export function forgetItemHub() {
  itemHubIo?.disconnect();
  itemHubIo = null;
}

/** Let go of an open item slot window: another window is taking the overlay, or it closed. */
export function forgetItemSlotModal() {
  itemSlotPickerIo?.disconnect();
  itemSlotPickerIo = null;
  itemSlotModalState = null;
}

/** Draw the item slot window again, when one is open: its pick changed. */
export function redrawItemSlotModal() {
  if (itemSlotModalState) drawItemSlotModal();
}
