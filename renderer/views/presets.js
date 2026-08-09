/* Presets: a named set of "these mods on, everything else off", and the file that carries
 * it to somebody else.
 *
 * Sharing is the reason this screen is more than a list. A preset that only names mods is a
 * few hundred bytes and installs from the catalog on the other end; one that has to carry a
 * mod's bytes can run to hundreds of megabytes. Which of the two a given preset is depends
 * on where its mods came from, so the export asks first and shows the bill (shareDialog).
 */
import { $ } from '../core/dom.js';
import { state } from '../core/store.js';
import { registerView, switchView } from '../core/router.js';
import { refreshInstalledIndex } from '../core/installed.js';
import { esc, fmtMB, plural } from '../ui/format.js';
import { libThumbHtml } from '../ui/thumb.js';
import { catName, catIcon } from '../core/categories.js';
import { isCosmeticRec } from '../core/records.js';
import { COSMETIC_PREFIX, cosmeticMeta } from '../core/constants.js';
import { toast } from '../ui/toast.js';
import { confirmDialog, promptDialog } from '../ui/dialog.js';
import { paint } from '../ui/transitions.js';
import { bindContextMenu } from '../ui/menu.js';

const viewRoot = $('#view-root');

registerView('presets', () => renderPresets());

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
        <input class="input" id="shareAuthor" placeholder="${L`Твой ник (необязательно)`}" maxlength="80" value="${esc(state.settings?.account?.username || '')}">
        <input class="input" id="shareNote" placeholder="${L`Пара слов о сборке (необязательно)`}" maxlength="200">
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

/* One door to sharing, with both ways behind it and the difference between them stated
 * rather than implied. A link is a few hundred characters and installs from the catalog on
 * the other end; it cannot carry a mod the catalog does not have. The file carries anything,
 * and can run to hundreds of megabytes. Two equal buttons on the card made that a guess -
 * here the link is offered first, already made, and the file is one line below it.
 */
function shareSheet(preset, link) {
  const skipped = link?.skipped || [];
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box share-box">
        <div class="share-title">${L`Поделиться пресетом «${preset.name}»`}</div>

        <div class="share-way">
          <div class="share-way-head"><span class="ms">link</span>${L`Ссылка`}</div>
          ${link?.web ? `
            <div class="share-copy">
              <input class="input mono" id="shareUrl" readonly value="${esc(link.web)}">
              <button class="btn btn-primary" id="shareCopyBtn"><span class="ms">content_copy</span>${L`Скопировать`}</button>
            </div>
            <div class="share-hint">${skipped.length
              ? L`Донесёт ${link.count} из каталога. Свои моды (${skipped.length}) в неё не влезут — для них файл.`
              : L`Открывается в менеджере и ставит моды из каталога.`}</div>` : `
            <div class="share-hint">${L`В пресете только свои моды — ссылка их не донесёт.`}</div>`}
        </div>

        <div class="share-way">
          <div class="share-way-head"><span class="ms">description</span>${L`Файл`}</div>
          <button class="btn" id="shareFileBtn"><span class="ms">save</span>${L`Сохранить файлом…`}</button>
          <div class="share-hint">${L`Донесёт и те моды, которых нет в каталоге. Дальше выберешь, что положить внутрь.`}</div>
        </div>

        <div class="confirm-actions">
          <button class="btn" data-c="no">${L`Закрыть`}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const done = (v) => { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) done(null); });
    overlay.querySelector('[data-c="no"]').addEventListener('click', () => done(null));
    overlay.querySelector('#shareFileBtn').addEventListener('click', () => done('file'));
    overlay.querySelector('#shareCopyBtn')?.addEventListener('click', (e) => {
      navigator.clipboard.writeText(link.web);
      overlay.querySelector('#shareUrl').select();
      flashCopied(e.currentTarget);
    });
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

/* What a preset looks like, instead of what it used to look like.
 *
 * A preset was printed as its mod names joined by dots. At five mods that is a sentence; at
 * eighty it is a paragraph of proper nouns nobody reads, and the card that held it was a wall
 * of grey text with no shape. The names were the only thing on it, and they were the least
 * useful thing on it.
 *
 * A set of mods is recognised by its pictures and summarised by its categories, so the card
 * leads with a row of covers and a line of counts: forty heroes, three terrains, one cursor.
 * The full list is still there for anybody who wants to check a specific mod, one click away
 * and grouped, rather than in the way of everybody who does not.
 */
const STRIP = 12;

function presetThumbHtml(rec) {
  if (isCosmeticRec(rec)) {
    return `<div class="preset-thumb"><span class="ms thumb-glyph">${cosmeticMeta(rec.slot).icon}</span></div>`;
  }
  return libThumbHtml(rec, 'preset-thumb');
}

function presetBodyHtml(recs) {
  if (!recs.length) return `<div class="preset-mods">${L`пусто (всё будет выключено)`}</div>`;

  const catOf = (r) => (isCosmeticRec(r) ? COSMETIC_PREFIX + r.slot : r.categoryId);
  const groups = new Map();
  for (const r of recs) {
    const id = catOf(r) || 'other';
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(r);
  }
  // biggest group first: it is what the preset is mostly made of
  const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  const shown = recs.slice(0, STRIP);
  const rest = recs.length - shown.length;

  return `
    <div class="preset-strip">
      ${shown.map(presetThumbHtml).join('')}
      ${rest > 0 ? `<div class="preset-more">+${rest}</div>` : ''}
    </div>
    <div class="preset-cats">
      ${ordered.map(([id, list]) => `
        <span class="preset-cat"><span class="ms">${catIcon(id)}</span>${esc(catName(id))}<b>${list.length}</b></span>`).join('')}
    </div>
    <details class="preset-all">
      <summary><span class="ms">expand_more</span>${L`Что внутри`}</summary>
      ${ordered.map(([id, list]) => `
        <div class="preset-group">
          <div class="preset-group-head"><span class="ms">${catIcon(id)}</span>${esc(catName(id))}<span class="preset-group-n">${list.length}</span></div>
          <div class="preset-group-names">${list.map((r) => esc(r.name)).join(' · ')}</div>
        </div>`).join('')}
    </details>`;
}

// a received preset that hasn't been installed yet
function sharedPresetCardHtml(p) {
  const s = p.status || { installed: 0, download: 0, embedded: 0, free: 0, unavailable: [] };
  const total = s.installed + s.download + s.embedded + (s.free || 0) + s.unavailable.length;
  const bits = [];
  if (s.installed) bits.push(L`${s.installed} уже стоят`);
  if (s.download) bits.push(L`${s.download} скачать из каталога`);
  if (s.embedded) bits.push(L`${s.embedded} внутри файла`);
  if (s.free) bits.push(L`${s.free} косметика из игры`);
  return `
    <div class="preset-head">
      <div class="preset-name">${esc(p.name)}</div>
      <span class="lib-tag">${L`получен`}${p.source?.author ? ` · ${esc(p.source.author)}` : ''}</span>
      <span class="text-meta">${total} ${plural(total, 'мод', 'мода', 'модов')}</span>
      <button class="btn btn-sm btn-primary" data-resolve="${p.id}"><span class="ms">download</span>${L`Установить`}</button>
      <button class="btn btn-sm btn-danger" data-pdel="${p.id}">${L`Удалить`}</button>
    </div>
    ${p.source?.note ? `<div class="preset-note">${esc(p.source.note)}</div>` : ''}
    <div class="preset-mods">${bits.join(' · ') || L`нечего устанавливать`}</div>
    ${s.unavailable.length ? `
      <div class="preset-warn"><span class="ms">warning</span>${L`Не найдены ни у тебя, ни в файле:`} ${esc(s.unavailable.slice(0, 5).join(', '))}${s.unavailable.length > 5 ? '…' : ''}</div>` : ''}`;
}

export async function renderPresets() {
  const presets = await window.api.presets.list();
  const { installed } = await window.api.mods.list();
  const byId = new Map(installed.map((m) => [m.id, m]));

  await paint(() => { viewRoot.innerHTML = `
    <div class="view-header"><h1 class="view-title">${L`Пресеты`}</h1></div>
    <div class="preset-new">
      <input class="input" id="presetName" placeholder="${L`Название пресета (напр. «Анимешный», «Минимал»)`}">
      <button class="btn btn-primary" id="savePresetBtn"><span class="ms">save</span>${L`Сохранить текущее состояние`}</button>
      <button class="btn" id="importPresetBtn"><span class="ms">upload_file</span>${L`Открыть .d2mm`}</button>
    </div>
    <div id="presetList">
      ${presets.length ? '' : `
        <div class="empty-state">
          <span class="ms">bookmarks</span>
          <div class="empty-title">${L`Пресетов пока нет`}</div>
          <div class="empty-body">${L`Пресет запоминает, какие моды включены: применил — эти включились, остальные выключились. Готовым можно поделиться ссылкой или файлом, а полученный .d2mm достаточно перетащить сюда.`}</div>
        </div>`}
    </div>
  `; });

  const list = $('#presetList');
  presets.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = `preset-card ${p.wanted ? 'shared' : ''}`;
    card.style.setProperty('--i', i);
    if (p.wanted) {
      card.innerHTML = sharedPresetCardHtml(p);
    } else {
      const recs = p.modIds.map((id) => byId.get(id)).filter(Boolean);
      const link = p.link || { count: 0, skipped: [] };
      const linkTitle = !link.count
        ? L`В пресете только свои моды — ссылка их не донесёт, отправь файлом`
        : link.skipped.length
          ? L`Ссылка донесёт ${link.count} из каталога; свои моды (${link.skipped.length}) в неё не влезут — для них нужен файл`
          : L`Скопировать короткую ссылку на пресет`;
      card.innerHTML = `
        <div class="preset-head">
          <div class="preset-name">${esc(p.name)}</div>
          <span class="text-meta">${recs.length} ${plural(recs.length, 'мод', 'мода', 'модов')}</span>
          <button class="btn btn-sm btn-primary" data-apply="${p.id}">${L`Применить`}</button>
          <button class="btn btn-sm" data-share="${p.id}" title="${esc(linkTitle)}"><span class="ms">ios_share</span>${L`Поделиться`}</button>
        </div>
        ${presetBodyHtml(recs)}`;
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
  // the rest of what a preset can do, one right-click away as everywhere else
  bindContextMenu(list, '.preset-card:not(.shared)', (card) => {
    const p = presets.find((x) => x.id === card.querySelector('[data-apply]')?.dataset.apply);
    if (!p) return null;
    return [
      { label: L`Обновить по текущему состоянию`, icon: 'save', onPick: () => updatePreset(p.id) },
      { label: L`Переименовать`, icon: 'edit', onPick: () => renamePreset(p) },
      { separator: true },
      { label: L`Удалить`, icon: 'delete', danger: true, onPick: () => deletePreset(p) },
    ];
  });
  list.querySelectorAll('[data-share]').forEach((b) => {
    b.addEventListener('click', async () => {
      const preset = presets.find((p) => p.id === b.dataset.share);
      // the link is made up front: it is a local encode, and offering it already written
      // beats a button that might turn out to have nothing to copy
      const link = await window.api.presets.shareLink(b.dataset.share);
      const pick = await shareSheet(preset, link.error ? null : link);
      if (pick !== 'file') return;
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
  // received presets keep their own delete button: the card is a decision to make, not a
  // list entry, and the two answers to it are "install" and "no thanks"
  list.querySelectorAll('[data-pdel]').forEach((b) => {
    b.addEventListener('click', () => deletePreset(presets.find((x) => x.id === b.dataset.pdel)));
  });
}

async function updatePreset(id) {
  const r = await window.api.presets.update(id);
  if (r.error) { toast(r.error, 'error', 6000); return; }
  toast(L`Пресет обновлён: ${r.count} ${plural(r.count, 'мод', 'мода', 'модов')}`, 'ok');
  renderPresets();
}

async function renamePreset(p) {
  const name = await promptDialog(L`Новое название пресета`, { value: p.name || '', okLabel: L`Переименовать` });
  if (!name) return;
  const r = await window.api.presets.rename(p.id, name);
  if (r.error) { toast(r.error, 'error', 6000); return; }
  renderPresets();
}

async function deletePreset(p) {
  if (!p) return;
  if (!await confirmDialog(L`Удалить пресет «${p.name || ''}»?`)) return;
  await window.api.presets.delete(p.id);
  renderPresets();
}

export async function handlePresetImport(r) {
  if (!r || r.cancelled) return;
  if (r.error) { toast(r.error, 'error', 6000); return; }
  toast(L`Пресет «${r.preset.name}» добавлен — нажми «Установить»`);
  if (state.view !== 'presets') switchView('presets');
  else renderPresets();
}
