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
import { toast } from '../ui/toast.js';
import { confirmDialog, promptDialog } from '../ui/dialog.js';
import { paint } from '../ui/transitions.js';

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
    <div class="view-intro">
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
  `; });

  const list = $('#presetList');
  presets.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = `preset-card ${p.wanted ? 'shared' : ''}`;
    card.style.setProperty('--i', i);
    if (p.wanted) {
      card.innerHTML = sharedPresetCardHtml(p);
    } else {
      const names = p.modIds.map((id) => byId.get(id)?.name).filter(Boolean);
      const link = p.link || { count: 0, skipped: [] };
      const linkTitle = !link.count
        ? L`В пресете только свои моды — ссылка их не донесёт, отправь файлом`
        : link.skipped.length
          ? L`Ссылка донесёт ${link.count} из каталога; свои моды (${link.skipped.length}) в неё не влезут — для них нужен файл`
          : L`Скопировать короткую ссылку на пресет`;
      card.innerHTML = `
        <div class="preset-head">
          <div class="preset-name">${esc(p.name)}</div>
          <span class="text-meta">${names.length} ${plural(names.length, 'мод', 'мода', 'модов')}</span>
          <button class="btn btn-sm btn-primary" data-apply="${p.id}">${L`Применить`}</button>
          <button class="btn btn-sm" data-pupd="${p.id}" title="${L`Перезаписать пресет тем, что включено сейчас`}"><span class="ms">save</span>${L`Обновить`}</button>
          <button class="btn btn-sm btn-icon" data-pren="${p.id}" title="${L`Переименовать`}" aria-label="${L`Переименовать`}"><span class="ms">edit</span></button>
          <button class="btn btn-sm" data-link="${p.id}" title="${esc(linkTitle)}" ${link.count ? '' : 'disabled'}><span class="ms">link</span>${L`Ссылка`}</button>
          <button class="btn btn-sm" data-share="${p.id}" title="${L`Сохранить пресет файлом — донесёт и свои моды тоже`}"><span class="ms">ios_share</span>${L`Файл`}</button>
          <button class="btn btn-sm btn-danger" data-pdel="${p.id}">${L`Удалить`}</button>
        </div>
        <div class="preset-mods">${names.length ? esc(names.join(' · ')) : L`пусто (всё будет выключено)`}</div>
        ${link.skipped.length && link.count ? `
          <div class="preset-hint"><span class="ms">link_off</span>${L`Ссылкой не уедут: ${esc(link.skipped.slice(0, 4).join(', '))}${link.skipped.length > 4 ? '…' : ''} — их нет в каталоге. Отправь файлом, чтобы попали.`}</div>` : ''}`;
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
  list.querySelectorAll('[data-pupd]').forEach((b) => {
    b.addEventListener('click', async () => {
      const r = await window.api.presets.update(b.dataset.pupd);
      if (r.error) { toast(r.error, 'error', 6000); return; }
      toast(L`Пресет обновлён: ${r.count} ${plural(r.count, 'мод', 'мода', 'модов')}`, 'ok');
      renderPresets();
    });
  });
  list.querySelectorAll('[data-pren]').forEach((b) => {
    b.addEventListener('click', async () => {
      const cur = presets.find((p) => p.id === b.dataset.pren);
      const name = await promptDialog(L`Новое название пресета`, { value: cur?.name || '', okLabel: L`Переименовать` });
      if (!name) return;
      const r = await window.api.presets.rename(b.dataset.pren, name);
      if (r.error) { toast(r.error, 'error', 6000); return; }
      renderPresets();
    });
  });
  list.querySelectorAll('[data-link]').forEach((b) => {
    b.addEventListener('click', async () => {
      const r = await window.api.presets.shareLink(b.dataset.link);
      if (r.error) { toast(r.error, 'warn', 7000); return; }
      navigator.clipboard.writeText(r.web);
      flashCopied(b);
      // never let a partial link leave silently: the receiver would open a build missing
      // mods and have no idea any were dropped
      if (r.skipped?.length) {
        toast(L`В ссылку вошли ${r.count} ${plural(r.count, 'мод', 'мода', 'модов')} из каталога. Свои моды (${r.skipped.length}) она не несёт — отправь файлом.`, 'warn', 8000);
      }
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

export async function handlePresetImport(r) {
  if (!r || r.cancelled) return;
  if (r.error) { toast(r.error, 'error', 6000); return; }
  toast(L`Пресет «${r.preset.name}» добавлен — нажми «Установить»`);
  if (state.view !== 'presets') switchView('presets');
  else renderPresets();
}
