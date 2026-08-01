/* The Library screen: what is installed, and in the order the game loads it.
 *
 * The widest screen in the app, because a row here is rarely just a row. It can be a pack
 * that folds open into its members, a cosmetic pick, a font that has no switch at all, or a
 * file somebody dropped into the mods folder by hand. Each kind draws its own row and
 * answers to its own rules, yet all of them share one selection and one bulk bar, so they
 * are built together rather than in four places.
 *
 * The ticked rows, the search box, the open packs and the loaded records live here instead
 * of in the shared store: no other screen has ever read them.
 */
import { $ } from '../core/dom.js';
import { COSMETIC_PREFIX, cosmeticMeta } from '../core/constants.js';
import { state } from '../core/store.js';
import { registerView, render } from '../core/router.js';
import { matchLabel, applyInstalled, refreshInstalledIndex } from '../core/installed.js';
import { catName, catIcon } from '../core/categories.js';
import { isCursorRec, isFontRec, isCosmeticRec, isPackableRec } from '../core/records.js';
import { esc, fmtMB, plural } from '../ui/format.js';
import { toast } from '../ui/toast.js';
import { confirmDialog, promptDialog } from '../ui/dialog.js';
import { isVideo } from '../ui/media.js';
import { recPreviewUrl, fallbackThumbHtml, libThumbHtml, extThumbHtml, catalogPreviewFor } from '../ui/thumb.js';
import { refreshPatchState, paintMasterSwitch } from '../ui/statusbar.js';
import { paintCosmeticIcons, watchCosmeticIcons } from '../ui/cosmetic-icons.js';
import { paint } from '../ui/transitions.js';

const viewRoot = $('#view-root');

// This screen's own state, moved off the shared store now that it has a module to sit in.
const librarySel = new Set();  // ids of rows ticked for bulk actions ("m:<pack>:<member>" for members)
const packsOpen = new Set();   // ids of packs folded open
let libSearch = '';            // library-scoped search query
let libRecords = [];           // records as of the last draw
let libExternal = [];          // foreign files found in the mods folder
let slotCount = 0;             // mods occupying a numbered pak, so the order arrows know the ends

registerView('library', () => renderLibrary());

// does a record match the current library search (by its name or any member name)?
function libMatchesSearch(rec) {
  const q = libSearch.trim().toLowerCase();
  return !q || rec.name.toLowerCase().includes(q) || (rec.members || []).some((m) => m.name.toLowerCase().includes(q));
}


// 2x2 preview grid built from a pack's first members. When not one of them has a picture of
// its own, four empty boxes say nothing a single "several heroes in one" stand-in wouldn't
// say better - the same generic image an unsplit multi-hero import falls back to.
function packThumbGridHtml(rec) {
  const members = rec.members || [];
  if (!members.some((m) => recPreviewUrl(m))) return fallbackThumbHtml('generic:pack', 'auto_awesome', 'lib-thumb');
  const cells = members.slice(0, 4).map((m) => {
    const p = recPreviewUrl(m);
    if (!p) return `<div class="pack-thumb-cell"><span class="ms">${catIcon(m.categoryId)}</span></div>`;
    return isVideo(p)
      ? `<video src="${esc(p)}" muted playsinline preload="metadata"></video>`
      : `<img src="${esc(p)}" loading="lazy" alt="">`;
  });
  while (cells.length < 4) cells.push('<div class="pack-thumb-cell"></div>');
  return `<div class="lib-thumb pack-thumb-grid">${cells.join('')}</div>`;
}

function memberRowHtml(rec, m, masterOff) {
  const key = memberKey(rec.id, m.id);
  const sel = librarySel.has(key);
  const thumb = libThumbHtml(m, 'member-thumb');
  return `
    <div class="member-row ${m.enabled ? '' : 'disabled'} ${sel ? 'selected' : ''}">
      <input type="checkbox" class="lib-check" data-check="${esc(key)}" ${sel ? 'checked' : ''} aria-label="${L`Выбрать мод в паке`}">
      ${thumb}
      <div class="member-info">
        <div class="member-name">${esc(m.name)}${m.styleLabel ? ` <span class="lib-style-label">(${esc(m.styleLabel)})</span>` : ''}</div>
        <div class="member-meta">${esc(m.info || catName(m.categoryId))}</div>
      </div>
      <div class="member-actions">
        <button class="toggle sm ${m.enabled ? 'on' : ''}" data-mtoggle="${esc(m.id)}" data-pack="${esc(rec.id)}" role="switch" aria-checked="${m.enabled}" aria-label="${L`Включить/выключить мод в паке`}" ${masterOff ? 'disabled' : ''}></button>
        <button class="member-x" data-mremove="${esc(m.id)}" data-pack="${esc(rec.id)}" aria-label="${L`Удалить из пака`}" title="${L`Удалить из пака`}"><span class="ms">close</span></button>
      </div>
    </div>`;
}

function packRowHtml(rec, i, masterOff) {
  const selected = librarySel.has(rec.id);
  const open = packsOpen.has(rec.id);
  const members = rec.members || [];
  const onCount = members.filter((m) => m.enabled).length;
  const langDir = (rec.files || []).find((f) => f.root === 'lang' && /_dir\.vpk$/i.test(f.relPath));
  return `
    <div class="lib-row pack-row ${rec.enabled ? '' : 'disabled'} ${selected ? 'selected' : ''}" data-row="${esc(rec.id)}" style="--i:${Math.min(i, 20)}">
      <input type="checkbox" class="lib-check" data-check="${esc(rec.id)}" ${selected ? 'checked' : ''} aria-label="${L`Выбрать пак`}">
      <button class="pack-expand ${open ? 'open' : ''}" data-expand="${esc(rec.id)}" aria-expanded="${open}" aria-label="${L`Развернуть состав пака`}"><span class="ms">chevron_right</span></button>
      ${packThumbGridHtml(rec)}
      <div class="lib-info">
        <div class="lib-name">${esc(rec.name)} <span class="lib-tag pack">${L`Пак · ${members.length} ${plural(members.length, 'мод', 'мода', 'модов')}`}</span></div>
        <div class="lib-meta">
          <span>${L`${onCount} из ${members.length} включено`}</span>
          <span>${langDir ? esc(langDir.relPath) : L`пусто`}</span>
        </div>
      </div>
      <div class="lib-actions">
        <button class="toggle ${rec.enabled ? 'on' : ''}" data-id="${esc(rec.id)}" role="switch" aria-checked="${rec.enabled}" aria-label="${L`Включить/выключить пак целиком`}" ${masterOff ? 'disabled' : ''}></button>
        ${orderBtnsHtml(rec)}
        <button class="btn btn-sm" data-addto="${esc(rec.id)}" title="${L`Добавить моды в пак`}"><span class="ms">add</span>${L`Добавить`}</button>
        <button class="btn btn-sm" data-disband="${esc(rec.id)}" title="${L`Разобрать пак обратно на отдельные моды`}"><span class="ms">call_split</span>${L`Разобрать`}</button>
        ${langDir ? `<button class="btn btn-sm" data-export="${esc(rec.id)}" title="${L`Сохранить пак одним .vpk файлом (войдут включённые моды)`}"><span class="ms">save</span>${L`Экспорт`}</button>` : ''}
        <button class="btn btn-sm btn-danger" data-del="${esc(rec.id)}">${L`Удалить`}</button>
      </div>
    </div>
    <div class="pack-members ${open ? 'open' : ''}" data-members="${esc(rec.id)}">
      ${members.map((m) => memberRowHtml(rec, m, masterOff)).join('')}
    </div>`;
}

// The pak slot a record occupies, which is its place in the load order (null for mods that
// live outside a numbered pak: fonts, cursors, cosmetic picks).
function slotOf(rec) {
  const dir = (rec.files || []).find((f) => f.root === 'lang' && /^pak\d+_dir\.vpk$/i.test(f.relPath));
  return dir ? Number(dir.relPath.slice(3, dir.relPath.indexOf('_'))) : null;
}

// Arrows that move a mod through the load order. The game mounts pakNN_dir.vpk in numeric
// order and the first copy of a shared file wins, so moving a mod up is the whole mechanism
// behind "wear these arms over that set".
//
// The app used to work this out by itself: compare what every mod ships, decide who covers
// whom, put a "covered" badge on the loser. It was wrong far too often — two mods touching
// one stock file are not fighting over anything — and being told a working mod is covered
// is worse than being told nothing at all. The order is shown, the arrows are here, and
// which mod wins is a call only the person looking at the game can make.
function orderBtnsHtml(rec) {
  if (rec.slotIndex == null) return '';
  return `
    <span class="lib-order">
      <button class="btn btn-sm btn-icon" data-up="${esc(rec.id)}" ${rec.slotIndex === 0 ? 'disabled' : ''} title="${L`Загружать раньше: при общих файлах победит этот мод`}" aria-label="${L`Выше в порядке загрузки`}"><span class="ms">keyboard_arrow_up</span></button>
      <button class="btn btn-sm btn-icon" data-down="${esc(rec.id)}" ${rec.slotIndex === slotCount - 1 ? 'disabled' : ''} title="${L`Загружать позже`}" aria-label="${L`Ниже в порядке загрузки`}"><span class="ms">keyboard_arrow_down</span></button>
    </span>`;
}

// Mods that carry item-schema changes: their model installs like any other, but the
// effects and icons only exist once the schema patch is on. Say which of the two it is.
function schemaTagHtml(rec) {
  if (!rec.schemaCount) return '';
  return rec.schemaLive
    ? ` <span class="lib-tag schema" title="${esc(L`Мод меняет схему предметов: его эффекты и иконки собраны в общую таблицу`)}"><span class="ms">auto_awesome</span>${L`эффекты`}</span>`
    : ` <span class="lib-tag schema off" title="${esc(L`Мод меняет схему предметов. Без правок схемы встанет только модель — эффекты и иконки работать не будут.`)}"><span class="ms">error</span>${L`нужны правки`}</span>`;
}

function normalRowHtml(rec, i, masterOff) {
  const cosmetic = isCosmeticRec(rec);
  const selectable = !isFontRec(rec);
  const selected = librarySel.has(rec.id);
  // own preview, else the catalog's for the same mod, else a recognised hero's own portrait
  // (see libThumbHtml); a cosmetic pick's picture is fetched lazily by the same loader the
  // catalog cards use
  const fileNames = rec.files.filter((f) => f.root === 'lang').map((f) => f.relPath);
  const catLabel = cosmetic ? catName(COSMETIC_PREFIX + rec.slot) : catName(rec.categoryId);
  return `
    <div class="lib-row ${rec.enabled ? '' : 'disabled'} ${selected ? 'selected' : ''}" data-row="${esc(rec.id)}" style="--i:${Math.min(i, 20)}">
      ${selectable ? `<input type="checkbox" class="lib-check" data-check="${esc(rec.id)}" ${selected ? 'checked' : ''} aria-label="${L`Выбрать мод`}">` : '<span class="lib-check-gap"></span>'}
      ${cosmetic
        ? `<div class="lib-thumb" data-name="${esc(rec.name)}"><span class="ms thumb-glyph">${cosmeticMeta(rec.slot).icon}</span></div>`
        : libThumbHtml(rec, 'lib-thumb')}
      <div class="lib-info">
        <div class="lib-name">${esc(rec.name)}${rec.styleLabel ? ` <span class="lib-style-label">(${esc(rec.styleLabel)})</span>` : ''}${rec.match ? ` <span class="lib-tag match">${esc(matchLabel(rec.match))}</span>` : rec.info ? ` <span class="lib-tag">${esc(rec.info)}</span>` : ''}${schemaTagHtml(rec)}</div>
        <div class="lib-meta">
          <span>${esc(catLabel)}</span>
          ${fileNames.length ? `<span>${esc(fileNames.slice(0, 3).join(', '))}${fileNames.length > 3 ? '…' : ''}</span>` : ''}
          <span>${new Date(rec.installedAt).toLocaleDateString(window.i18nLocale())}</span>
        </div>
      </div>
      <div class="lib-actions">
        ${isFontRec(rec)
          ? `<span class="text-meta">${L`всегда активен`}</span>`
          : `<button class="toggle ${rec.enabled ? 'on' : ''}" data-id="${esc(rec.id)}" role="switch" aria-checked="${rec.enabled}" aria-label="${L`Включить/выключить`}" ${isCursorRec(rec) ? `title="${L`Курсор в игре может быть только один — этот выключит остальные`}"` : cosmetic ? `title="${L`На один слот — только одна активная косметика`}"` : ''} ${masterOff ? 'disabled' : ''}></button>`}
        ${orderBtnsHtml(rec)}
        ${rec.match ? `<button class="btn btn-sm btn-primary" data-adopt="${esc(rec.id)}" title="${L`Привязать к каталогу`}"><span class="ms">library_add_check</span>${L`Привязать`}</button>` : ''}
        ${rec.subjects >= 2 ? `<button class="btn btn-sm" data-split="${esc(rec.id)}" title="${L`Разбить на отдельные моды по героям`}"><span class="ms">call_split</span>${L`Разобрать`}</button>` : ''}
        ${isCursorRec(rec)
          ? `<button class="btn btn-sm" data-export="${esc(rec.id)}" title="${L`Сохранить курсор архивом (для отправки или на память)`}"><span class="ms">save</span>${L`Экспорт`}</button>`
          : rec.files.some((f) => f.root === 'lang' && /_dir\.vpk$/i.test(f.relPath)) ? `<button class="btn btn-sm" data-export="${esc(rec.id)}" title="${L`Сохранить мод одним .vpk файлом (для отправки автору каталога)`}"><span class="ms">save</span>${L`Экспорт`}</button>` : ''}
        <button class="btn btn-sm btn-danger" data-del="${esc(rec.id)}">${L`Удалить`}</button>
      </div>
    </div>`;
}

// selection keys: a plain record id, or "m:<packId>:<memberId>" for a pack member
function isMemberKey(k) { return typeof k === 'string' && k.startsWith('m:'); }
function memberKey(packId, memberId) { return `m:${packId}:${memberId}`; }

// units that can be combined into one pack: standalone packable mods AND existing packs
function countCombinableSelected() {
  const recs = libRecords || [];
  let n = 0;
  for (const k of librarySel) {
    if (isMemberKey(k)) continue;
    const r = recs.find((x) => x.id === k);
    if (r && (isPackableRec(r) || r.kind === 'pack')) n++;
  }
  return n;
}

// selected top-level records that are recognised catalog mods (can be adopted)
function countAdoptableSelected() {
  const recs = libRecords || [];
  let n = 0;
  for (const k of librarySel) {
    if (isMemberKey(k)) continue;
    const r = recs.find((x) => x.id === k);
    if (r && r.match) n++;
  }
  return n;
}

// adopt every recognised mod at once — installed records and foreign files alike
async function adoptAll() {
  const recs = libRecords.filter((r) => r.match);
  // a foreign file that is a copy of an installed mod would land as a second row for the
  // same thing — it wants deleting, not adopting
  const exts = libExternal.filter((f) => f.match && !f.duplicateOf);
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

// The two lists have a "select all" each, so ticking every mod never drags a dozen
// cosmetic picks along with it (and the other way round).
function selectableRecordIds() {
  return libRecords
    .filter((r) => !isFontRec(r) && !isCosmeticRec(r) && libMatchesSearch(r))
    .map((r) => r.id);
}

function selectableCosmeticIds() {
  return libRecords
    .filter((r) => isCosmeticRec(r) && libMatchesSearch(r))
    .map((r) => r.id);
}


function paintSelectAll(cb, ids) {
  if (!cb) return;
  const sel = ids.filter((id) => librarySel.has(id)).length;
  cb.checked = ids.length > 0 && sel === ids.length;
  cb.indeterminate = sel > 0 && sel < ids.length;
}

function syncSelectAll() {
  paintSelectAll($('#selAll'), selectableRecordIds());
  paintSelectAll($('#selAllCos'), selectableCosmeticIds());
}

function updateBulkBar() {
  const bar = $('#bulkBar');
  if (!bar) return;
  const n = librarySel.size;
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
  for (const k of librarySel) if (isMemberKey(k)) n++;
  return n;
}

// list body (filtered by the library search) — rebuilt on its own so typing in the
// search box never re-creates the input and steals focus
function libraryListHtml(masterOff) {
  const all = libRecords || [];
  if (!all.length) return `<div class="empty-note">${L`Пока ничего не установлено — загляни в Каталог`}</div>`;
  const installed = all.filter(libMatchesSearch);
  if (!installed.length) return `<div class="empty-note">${L`Ничего не найдено по запросу`}</div>`;
  const row = (rec, i) => (rec.kind === 'pack' ? packRowHtml(rec, i, masterOff) : normalRowHtml(rec, i, masterOff));
  // cosmetics are mods too, but listed after everything else so the "your own mods" list
  // above stays exactly what it always was — with a select-all and a bulk switch of its own
  // shown in the order the game loads them, which is the order the arrows change
  const mods = installed.filter((r) => !isCosmeticRec(r))
    .sort((a, b) => (a.slotIndex ?? 1e9) - (b.slotIndex ?? 1e9));
  const cosmetics = installed.filter(isCosmeticRec);
  let html = mods.map(row).join('');
  if (cosmetics.length) {
    const on = cosmetics.filter((r) => r.enabled !== false).length;
    html += `
      <div class="lib-section-head">
        <label class="lib-selectall" title="${L`Выбрать всю косметику`}"><input type="checkbox" class="lib-check" id="selAllCos"><span class="ms">auto_awesome</span>${L`Косметика`}</label>
        <span class="lib-section-cnt">${cosmetics.length} ${plural(cosmetics.length, 'вид', 'вида', 'видов')} · ${on} ${L`вкл`}</span>
        <button class="btn btn-ghost btn-xs" id="disableAllCos" ${masterOff || !on ? 'disabled' : ''} title="${L`Вернуть все слоты к тому, что даёт игра`}">${L`Выключить все`}</button>
      </div>`;
    html += cosmetics.map((rec, i) => normalRowHtml(rec, i, masterOff)).join('');
  }
  return html;
}

let libCosIconWatcher = null;
let libExtIconWatcher = null;
function paintLibraryList() {
  const libList = $('#libList');
  if (!libList) return;
  libList.innerHTML = libraryListHtml(state.masterOff);
  syncSelectAll();
  updateBulkBar();
  // cosmetic rows' pictures, same lazy loader as the catalog grid
  paintCosmeticIcons(libList);
  if (libCosIconWatcher) libCosIconWatcher.disconnect();
  libCosIconWatcher = watchCosmeticIcons(libList, null);
}

// modal picker: choose standalone packable mods (returns array of ids, or null)
function pickModsDialog(candidates, { title = L`Выбери моды`, okLabel = L`Готово` } = {}) {
  return new Promise((resolve) => {
    if (!candidates.length) { toast(L`Нет отдельных модов для добавления`, 'warn'); resolve(null); return; }
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box wide">
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
  return libRecords.filter(isPackableRec).map((r) => ({
    id: r.id, name: r.name + (r.styleLabel ? ` (${r.styleLabel})` : ''), sub: r.info || catName(r.categoryId),
  }));
}

// combine a selection (standalone mods and/or existing packs) into one pack
async function combineSelection(ids) {
  if (!ids || ids.length < 2) { toast(L`Выбери минимум 2 элемента`, 'warn'); return; }
  const recs = libRecords.filter((r) => ids.includes(r.id));
  const existingPack = recs.find((r) => r.kind === 'pack');
  const name = await promptDialog(existingPack ? L`Название объединённого пака:` : L`Название пака:`, {
    placeholder: L`напр. «Анимешный сет»`, value: existingPack ? existingPack.name : '', okLabel: L`Объединить`,
  });
  if (name === null) return;
  const r = await window.api.packs.combine(name, ids);
  if (r.error) { toast(r.error, 'error', 6000); return; }
  librarySel.clear();
  toast(L`Пак «${r.pack.name}»: ${r.pack.members.length} ${plural(r.pack.members.length, 'мод', 'мода', 'модов')}`, 'ok', 6000);
  if (r.conflicts?.length) toast(L`Пересечения файлов: ${r.conflicts.length} (победил тот, что раньше в паке)`, 'warn', 6000);
  await refreshInstalledIndex();
  renderLibrary();
}

export async function renderLibrary() {
  const res = await window.api.mods.list();
  // A tool is not a mod: it sits in the app's own folder, the game never mounts it, and its
  // switch here only ever moved a flag in the manifest (the installer skips files with
  // root: 'tools'). Everything a tool needs is on its card in the catalog now. The index
  // below still gets the full list - that is what tells the card it is already downloaded.
  const installedAll = res.installed.filter((r) => r.categoryId !== 'tools');
  const externalAll = res.external || [];
  libRecords = installedAll;
  applyInstalled(res.installed); // keep the tab counter + catalog badges in sync with the folder
  try { const ms = await window.api.mods.masterState(); state.masterOff = !!ms.off; } catch { state.masterOff = false; }
  paintMasterSwitch();
  const masterOff = state.masterOff;
  await refreshPatchState(); // schema conflicts / foreign-patcher banner below

  // drop selection for records (and members whose pack) that no longer exist
  const valid = new Set(installedAll.map((r) => r.id));
  for (const k of [...librarySel]) {
    if (isMemberKey(k)) { if (!valid.has(k.split(':')[1])) librarySel.delete(k); }
    else if (!valid.has(k)) librarySel.delete(k);
  }

  const enabledCount = installedAll.filter((m) => m.enabled).length;
  const slots = res.slots || 0;
  const slotCeil = res.slotCeil || 98;
  const nearLimit = slots >= 90;
  const external = externalAll;
  libExternal = externalAll;
  const matchedCount = installedAll.filter((r) => r.match).length + externalAll.filter((f) => f.match && !f.duplicateOf).length;
  const extDupes = externalAll.filter((f) => f.duplicateOf).length;

  // load order: the game mounts pakNN in numeric order, so that IS the priority. The list
  // is shown in it, and each row's arrows step through it (see orderBtnsHtml).
  const ordered = installedAll.filter((r) => slotOf(r) != null).sort((a, b) => slotOf(a) - slotOf(b));
  slotCount = ordered.length;
  ordered.forEach((r, i) => { r.slot = slotOf(r); r.slotIndex = i; });

  paint(() => { viewRoot.innerHTML = `
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
    ${nearLimit && !masterOff ? `
      <div class="lib-banner warn">
        <span class="ms">warning</span>
        <div class="banner-body">${L`Занято`} <b>${slots}</b>${L` из ${slotCeil} слотов. Игра не грузит больше ~99 отдельных паков — объедини моды в один, чтобы уместить больше.`}</div>
        <button class="btn btn-sm btn-primary" id="combineHintBtn"><span class="ms">merge</span>${L`Объединить`}</button>
      </div>` : ''}
    ${(state.patchState?.conflicts || []).length ? `
      <div class="lib-banner warn">
        <span class="ms">warning</span>
        <div class="banner-body">
          <b>${L`Моды спорят за один предмет`}</b>: ${state.patchState.conflicts.slice(0, 3).map((c) => `«${esc(c.mods.join('» / «'))}»`).join(', ')}${state.patchState.conflicts.length > 3 ? ` ${L`и ещё ${state.patchState.conflicts.length - 3}`}` : ''}${L`. В таблицу попадёт правка того мода, что установлен последним — выключи лишний.`}
        </div>
      </div>` : ''}
    ${state.patchState?.foreign ? `
      <div class="lib-banner warn">
        <span class="ms">warning</span>
        <div class="banner-body"><b>${L`В gameinfo уже прописан другой патчер`}</b>: <code>${esc(state.patchState.foreign)}</code>${L`. Два патчера в одном файле уживаются плохо — включай наш только если тем не пользуешься.`}</div>
      </div>` : ''}
    ${state.patchState && state.patchState.vanillaOk === false ? `
      <div class="lib-banner warn">
        <span class="ms">warning</span>
        <div class="banner-body"><b>${L`Файл игры не совпадает с подписью Dota`}</b>${L`. Пока так, клиент может не пускать в матчмейкинг — и моды тут ни при чём. Приложение не смогло восстановить оригинал само: проверь целостность файлов Dota 2 через Steam, это чинит за минуту.`}</div>
      </div>` : ''}
    <div class="lib-toolbar">
      <div class="lib-search">
        <span class="ms">search</span>
        <input id="libSearch" placeholder="${L`Поиск в библиотеке…`}" value="${esc(libSearch)}" spellcheck="false" autocomplete="off">
        <button class="lib-search-clear ${libSearch ? 'show' : ''}" id="libSearchClear" aria-label="${L`Очистить`}"><span class="ms">close</span></button>
      </div>
      <span class="lib-stats">${installedAll.length} ${plural(installedAll.length, 'мод', 'мода', 'модов')} · ${enabledCount} ${L`вкл`} · ${slots}/${slotCeil} ${plural(slots, 'слот', 'слота', 'слотов')}</span>
      <div class="lib-toolbar-actions">
        <button class="btn btn-sm" id="importVpkBtn"><span class="ms">upload_file</span>${L`Импорт VPK`}</button>
        <button class="btn btn-sm" id="importFolderBtn" title="${L`Импортировать все .vpk из папки — например из распакованного пака Dota 2 Skinchanger`}"><span class="ms">drive_folder_upload</span>${L`Импорт папки`}</button>
        <button class="btn btn-sm" id="openFolderBtn2"><span class="ms">folder_open</span>${L`Папка модов`}</button>
      </div>
    </div>
    ${installedAll.some((r) => !isCosmeticRec(r)) ? `
      <div class="lib-listhead">
        <label class="lib-selectall" title="${L`Выбрать всё`}"><input type="checkbox" class="lib-check" id="selAll">${L`Выбрать всё`}</label>
        <span class="lib-listhead-hint">${L`Отметь моды галочками — объединить в пак или массово управлять`}</span>
        <button class="btn btn-ghost btn-xs" id="enableAllBtn" ${masterOff ? 'disabled' : ''}>${L`Включить все`}</button>
        <button class="btn btn-ghost btn-xs" id="disableAllBtn" ${masterOff ? 'disabled' : ''}>${L`Выключить все`}</button>
      </div>` : ''}
    <div class="lib-list" id="libList"></div>
    ${external.length ? `
      <div class="section-h spaced"><span class="ms">folder_zip</span>${L`Внешние файлы в папке модов`}</div>
      <div class="view-intro">
        ${L`Моды, положенные в папку мимо менеджера. «Принять» берёт файл в библиотеку — с превью, переключателем и всем остальным.`}
        ${extDupes ? ` <b>${extDupes}</b> ${plural(extDupes, 'из них — копия уже установленного мода', 'из них — копии уже установленных модов', 'из них — копии уже установленных модов')}.` : ''}
      </div>
      <div class="lib-list" id="extList"></div>` : ''}
    <div class="bulk-bar-gap"></div>
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
  `; });

  paintLibraryList();
  bindLibrary(external);
}

async function bindLibrary(external) {
  const byId = (id) => libRecords.find((r) => r.id === id);
  const reRender = async () => { await refreshInstalledIndex(); renderLibrary(); };

  // ----- search (repaints only the list so the input never loses focus) -----
  let searchTimer = null;
  $('#libSearch')?.addEventListener('input', (e) => {
    libSearch = e.target.value;
    $('#libSearchClear')?.classList.toggle('show', !!libSearch);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => paintLibraryList(), 140);
  });
  $('#libSearchClear')?.addEventListener('click', () => {
    libSearch = '';
    const inp = $('#libSearch'); if (inp) inp.value = '';
    $('#libSearchClear')?.classList.remove('show');
    paintLibraryList();
    inp?.focus();
  });

  // ----- select all / none (tri-state checkbox) -----
  $('#selAll')?.addEventListener('change', (e) => {
    const ids = selectableRecordIds();
    if (e.target.checked) ids.forEach((id) => librarySel.add(id));
    else ids.forEach((id) => librarySel.delete(id));
    paintLibraryList();
  });

  // ----- bulk bar -----
  $('#bulkClear')?.addEventListener('click', () => { librarySel.clear(); paintLibraryList(); });
  $('#bulkEnable')?.addEventListener('click', () => bulkSetEnabled(true));
  $('#bulkDisable')?.addEventListener('click', () => bulkSetEnabled(false));
  $('#bulkRemove')?.addEventListener('click', async () => {
    const keys = [...librarySel];
    if (!keys.length) return;
    if (!await confirmDialog(L`Удалить выбранное (${keys.length})?`)) return;
    for (const k of keys) {
      if (isMemberKey(k)) { const [, packId, memberId] = k.split(':'); await window.api.packs.removeMember(packId, memberId); }
      else await window.api.mods.remove(k);
    }
    librarySel.clear();
    toast(L`Удалено`);
    reRender();
  });
  $('#bulkCombine')?.addEventListener('click', () => {
    // a pak holds VPK content; a cursor set is loose files elsewhere in the game and stays out
    const cursors = [...librarySel].filter((k) => !isMemberKey(k) && isCursorRec(byId(k)));
    if (cursors.length) toast(L`Курсоры в пак не входят — они лежат не в паках, а в resource\\cursor`, 'warn', 6000);
    combineSelection([...librarySel].filter((k) => {
      if (isMemberKey(k)) return false;
      const r = byId(k);
      return r && (isPackableRec(r) || r.kind === 'pack');
    }));
  });
  $('#combineHintBtn')?.addEventListener('click', async () => {
    const ids = await pickModsDialog(standalonePackable(), { title: L`Выбери моды для объединения в пак`, okLabel: L`Далее` });
    if (ids) combineSelection(ids);
  });
  $('#bulkExtract')?.addEventListener('click', async () => {
    // group selected member keys by their pack, extract each group in one rebuild
    const byPack = new Map();
    for (const k of librarySel) {
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
    librarySel.clear();
    toast(L`Вытащено из пака: ${total}`, 'ok');
    reRender();
  });
  $('#adoptAllBtn')?.addEventListener('click', adoptAll);
  $('#bulkAdopt')?.addEventListener('click', async () => {
    const recs = [...librarySel].filter((k) => !isMemberKey(k)).map(byId).filter((r) => r && r.match);
    if (!recs.length) return;
    for (const r of recs) await window.api.mods.adoptMod(r.id, catalogPreviewFor(r.match));
    librarySel.clear();
    toast(L`Привязано: ${recs.length}`, 'ok');
    reRender();
  });

  // ----- checkbox selection (delegated; repaint-free to keep scroll) -----
  const libList = $('#libList');
  libList?.addEventListener('change', (e) => {
    // the cosmetics section head is repainted with the list, so it is handled here too
    if (e.target.id === 'selAllCos') {
      const ids = selectableCosmeticIds();
      if (e.target.checked) ids.forEach((id) => librarySel.add(id));
      else ids.forEach((id) => librarySel.delete(id));
      paintLibraryList();
      return;
    }
    const cb = e.target.closest('.lib-check[data-check]');
    if (!cb) return;
    const key = cb.dataset.check;
    if (cb.checked) librarySel.add(key); else librarySel.delete(key);
    cb.closest('.lib-row, .member-row')?.classList.toggle('selected', cb.checked);
    syncSelectAll();
    updateBulkBar();
  });

  // ----- row / pack / member actions (delegated) -----
  libList?.addEventListener('click', async (e) => {
    if (e.target.closest('#disableAllCos')) {
      const cos = libRecords.filter((r) => isCosmeticRec(r) && r.enabled !== false);
      if (!cos.length) return;
      for (const rec of cos) await window.api.mods.setEnabled(rec.id, false);
      toast(L`Косметика выключена — слоты снова как в игре`);
      reRender();
      return;
    }
    const el = e.target.closest('[data-expand],[data-id],[data-mtoggle],[data-mremove],[data-addto],[data-disband],[data-del],[data-export],[data-adopt],[data-split],[data-up],[data-down]');
    if (!el) return;

    const moveId = el.dataset.up || el.dataset.down;
    if (moveId) {
      el.disabled = true;
      const r = await window.api.mods.move(moveId, el.dataset.up ? -1 : 1);
      if (r.error) toast(r.error, 'error', 6000);
      reRender();
      return;
    }

    if (el.dataset.expand !== undefined && el.dataset.expand) {
      const id = el.dataset.expand;
      const open = !packsOpen.has(id);
      if (open) packsOpen.add(id); else packsOpen.delete(id);
      el.classList.toggle('open', open);
      el.setAttribute('aria-expanded', String(open));
      libList.querySelector(`.pack-members[data-members="${id}"]`)?.classList.toggle('open', open);
      return;
    }
    if (el.classList.contains('toggle') && el.dataset.id) {
      const rec = byId(el.dataset.id);
      const r = await window.api.mods.setEnabled(rec.id, !rec.enabled);
      if (r.error) toast(r.error, 'error', 6000);
      // a cursor that goes on takes the place of the one that was on
      else if (r.replaced?.length) toast(L`Курсор заменён — «${r.replaced.join(', ')}» выключен`, 'warn', 6000);
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
  $('#enableAllBtn')?.addEventListener('click', () => bulkToggle(libRecords || [], true));
  $('#disableAllBtn')?.addEventListener('click', () => bulkToggle(libRecords || [], false));
  $('#importVpkBtn')?.addEventListener('click', async () => handleImportResult(await window.api.mods.importDialog()));
  $('#importFolderBtn')?.addEventListener('click', async () => handleImportResult(await window.api.mods.importFolderDialog()));
  $('#openFolderBtn2')?.addEventListener('click', () => window.api.misc.openLangFolder());

  if (external.length) {
    const extList = $('#extList');
    for (const f of external) {
      const row = document.createElement('div');
      row.className = `lib-row ${f.enabled ? '' : 'disabled'} ${f.duplicateOf ? 'dup' : ''}`;
      const simple = f.kind === 'cursor' || f.kind === 'font'; // full-folder/subset sets — adopt only
      const displayName = f.kind === 'cursor' ? L`Курсор в игре` : f.name;
      const label = f.duplicateOf
        ? `<span class="lib-tag dup" title="${esc(L`Тот же файл уже стоит как «${f.duplicateOf}» — эта копия лишняя`)}"><span class="ms">content_copy</span>${L`копия`}</span>`
        : f.match ? `<span class="lib-tag match">${esc(matchLabel(f.match))}</span>`
        : f.info ? `<span class="lib-tag">${esc(f.info)}</span>` : '';
      // what the row is, then where it lives: the file name is the useful part for a
      // foreign vpk, since that is what the user sees in the folder
      const sub = f.kind === 'cursor' ? 'resource/cursor'
        : f.kind === 'font' ? L`шрифт · panorama/fonts`
        : f.duplicateOf ? L`копия «${f.duplicateOf}»`
        : f.match ? L`мод из каталога` : f.info ? L`опознан по содержимому` : L`внешний файл`;
      const fileName = !simple && f.fileName && f.fileName !== displayName ? `<span>${esc(f.fileName)}</span>` : '';
      const size = simple ? '' : `<span>${fmtMB(f.size)} MB</span>`;
      row.innerHTML = `
        ${extThumbHtml(f)}
        <div class="lib-info">
          <div class="lib-name">${esc(displayName)}${label ? ' ' + label : ''}</div>
          <div class="lib-meta">${fileName}${size}<span>${sub}</span></div>
        </div>
        <div class="lib-actions">
          ${simple ? '' : `<button class="toggle ${f.enabled ? 'on' : ''}" data-ext="${esc(f.key)}" role="switch" aria-checked="${f.enabled}"></button>`}
          ${f.duplicateOf ? '' : `<button class="btn btn-sm btn-primary" data-adopt="${esc(f.key)}" title="${f.match ? L`Привязать к каталогу и управлять как обычным модом` : L`Взять файл в библиотеку — дальше как у обычного мода`}"><span class="ms">library_add_check</span>${L`Принять`}</button>`}
          ${f.subjects >= 2 ? `<button class="btn btn-sm" data-extsplit="${esc(f.key)}" title="${L`Разбить на отдельные моды по героям`}"><span class="ms">call_split</span>${L`Разобрать`}</button>` : ''}
          ${simple ? '' : `<button class="btn btn-sm btn-danger" data-extdel="${esc(f.key)}">${L`Удалить`}</button>`}
        </div>
      `;
      extList.appendChild(row);
    }
    // hero portraits for the placeholder tiles above, same lazy loader as the mod grid
    paintCosmeticIcons(extList);
    if (libExtIconWatcher) libExtIconWatcher.disconnect();
    libExtIconWatcher = watchCosmeticIcons(extList, null);

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
        else toast(r.matched === false ? L`«${r.name}» в библиотеке` : L`«${r.name}» принят из каталога`, 'ok');
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

export async function handleImportResult(r) {
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
  await refreshInstalledIndex();
  if (state.view === 'library') render();
}

async function bulkToggle(installed, enabled) {
  for (const rec of installed) {
    if (isFontRec(rec)) continue;
    // cosmetics answer to their own section head: only one look per slot can be live, so
    // "enable all" over them would just be a race the last one wins
    if (isCosmeticRec(rec)) continue;
    if (rec.enabled !== enabled) await window.api.mods.setEnabled(rec.id, enabled);
  }
  renderLibrary();
  refreshInstalledIndex();
}

// enable/disable exactly the ticked items — works on both top-level mods and pack members
async function bulkSetEnabled(enabled) {
  const keys = [...librarySel];
  if (!keys.length) return;
  for (const k of keys) {
    if (isMemberKey(k)) {
      const [, packId, memberId] = k.split(':');
      await window.api.packs.setMemberEnabled(packId, memberId, enabled);
    } else {
      const rec = libRecords.find((r) => r.id === k);
      if (!rec || isFontRec(rec)) continue;
      if (rec.enabled !== enabled) await window.api.mods.setEnabled(k, enabled);
    }
  }
  toast(enabled ? L`Включено` : L`Выключено`);
  await refreshInstalledIndex();
  renderLibrary();
}
