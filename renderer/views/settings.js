/* Settings: everything the app itself remembers.
 *
 * The page is mostly other modules' knobs - the scale belongs to ui/chrome.js, the language
 * to ui/language.js - because a setting is a thing the whole window obeys, not a thing this
 * screen owns. What is genuinely here is the wiring: which control writes which value, and
 * what has to be repainted once it does.
 *
 * What is deliberately not here: anything about Dota's own languages or the folder mods go
 * into. The folder is always dota_russian and the app arranges that itself, including the
 * one Dota setting that decides it (see keepRussianFolder in main.js). Dota's text language
 * is the user's, chosen when they installed the game, and no mod depends on it. Where mods
 * can go missing is news, not a setting, so it is a banner on the Library.
 *
 * The one import from another screen is loadCatalog, for the button that re-fetches the
 * catalog. It asks the catalog for its data, not for a drawing, so the router is not what
 * that call wants.
 */
import { $ } from '../core/dom.js';
import { state } from '../core/store.js';
import { registerView } from '../core/router.js';
import { esc, fmtMB } from '../ui/format.js';
import { toast } from '../ui/toast.js';
import { showWhatsNew } from '../ui/dialog.js';
import { refreshSidebarStatus } from '../ui/statusbar.js';
import { clampScale, currentScalePct, paintScale, applyScalePct, clampPanelZoom, paintPanels, savePanels } from '../ui/chrome.js';
import { applyLanguage } from '../ui/language.js';
import { loadCatalog } from './catalog.js';
import { paint } from '../ui/transitions.js';

const viewRoot = $('#view-root');

registerView('settings', () => renderSettings());

export async function renderSettings() {
  const s = await window.api.settings.get();
  state.settings = s;
  const scalePct = Math.round((Number(s.uiScale) || 1) * 100);
  const cacheSize = await window.api.misc.cacheSize();
  const appVersion = await window.api.update.version();
  // no Russian voice pack downloaded means the speech is already English: a switch with
  // nothing to switch is not shown at all
  const voice = await window.api.voice.state();

  await paint(() => { viewRoot.innerHTML = `
    <div class="view-header"><h1 class="view-title">${L`Настройки`}</h1></div>

    <div class="settings-block">
      <h3>${L`Интерфейс`}</h3>
      <div class="settings-row">
        <span class="settings-label">${L`Язык`}</span>
        <div class="select-wrap">
          <span class="ms">translate</span>
          <select class="input" id="uiLangSelect">
            <option value="en" ${s.uiLang === 'en' ? 'selected' : ''}>English</option>
            <option value="ru" ${s.uiLang === 'ru' ? 'selected' : ''}>Русский</option>
          </select>
        </div>
      </div>
      <div class="settings-row spaced">
        <span class="settings-label">${L`Масштаб`}</span>
        <div class="scale-ctl">
          <button class="btn btn-sm scale-step" id="masterDown" aria-label="${L`Мельче`}"><span class="ms">remove</span></button>
          <input type="range" class="scale-range" id="masterRange" min="70" max="160" step="5" value="${scalePct}" aria-label="${L`Масштаб`}">
          <span class="scale-val" id="masterRangeVal">${scalePct}%</span>
          <button class="btn btn-sm scale-step" id="masterUp" aria-label="${L`Крупнее`}"><span class="ms">add</span></button>
          <button class="btn btn-sm" id="masterReset">${L`Сбросить`}</button>
        </div>
      </div>
    </div>

    ${voice.state === 'absent' ? '' : `
    <div class="settings-block" style="--i:1">
      <h3>${L`Звук в игре`}</h3>
      <div class="settings-row">
        <span class="settings-label">${L`Английские голоса`}</span>
        <button class="toggle ${voice.english ? 'on' : ''}" id="voiceToggle" role="switch"
                aria-checked="${!!voice.english}" aria-label="${L`Английские голоса`}"></button>
      </div>
      <div class="settings-hint">${L`Русская озвучка выключается, моды остаются на месте. После переключения перезапусти Dota.`}</div>
    </div>`}

    <div class="settings-block" style="--i:1">
      <h3>Discord</h3>
      <div class="settings-row">
        <span class="settings-label">${L`Показывать в Discord, что ты в Mod Manager`}</span>
        <button class="toggle ${s.discordPresence === false ? '' : 'on'}" id="presenceToggle" role="switch"
                aria-checked="${s.discordPresence !== false}" aria-label="${L`Показывать в Discord, что ты в Mod Manager`}"></button>
      </div>
      <div class="settings-hint">${L`В самом Discord для этого включено «Отображать текущую активность как статус».`}</div>
    </div>

    <div class="settings-block" style="--i:2">
      <h3>${L`Путь к Dota 2`}</h3>
      <div class="settings-row">
        <span class="mono grow">${esc(s.dotaGamePath || L`не найден`)}</span>
        <span class="dot ${s.dotaPathValid ? 'ok' : 'bad'}"></span>
      </div>
      <div class="settings-row">
        <button class="btn btn-sm" id="detectBtn">${L`Найти автоматически`}</button>
        <button class="btn btn-sm" id="browseBtn">${L`Указать вручную`}</button>
      </div>
    </div>

    <div class="settings-block" style="--i:3">
      <h3>${L`Кэш загрузок`}</h3>
      <div class="settings-row">
        <span class="settings-label">${L`Размер`}</span>
        <span class="num">${fmtMB(cacheSize)} MB</span>
        <button class="btn btn-sm" id="clearCacheBtn">${L`Очистить`}</button>
      </div>
      <div class="settings-hint">${L`Скачанные архивы, чтобы не качать повторно. Удаление ничего не сломает.`}</div>
    </div>

    <div class="settings-block" style="--i:4">
      <h3>${L`Каталог`}</h3>
      <div class="settings-row">
        <span class="settings-label">${L`Обновлён`}</span>
        <span>${state.catalog?.fetchedAt ? new Date(state.catalog.fetchedAt).toLocaleString(window.i18nLocale()) : '—'}</span>
        <button class="btn btn-sm" id="refreshCatBtn2">${L`Обновить сейчас`}</button>
      </div>
      <div class="settings-row">
        <span class="settings-label">${L`Источник`}</span>
        <a class="settings-link" id="srcLink">github.com/h6rd/Dota2PornFxWeb</a>
      </div>
    </div>

    <div class="settings-block" style="--i:5">
      <h3>${L`Диагностика`}</h3>
      <div class="settings-row spaced">
        <button class="btn btn-sm" id="diagExportBtn"><span class="ms">bug_report</span>${L`Экспортировать отчёт`}</button>
      </div>
      <div class="settings-hint">${L`Путь к игре, список модов и последние записи журнала в одном файле. Пришли его, если что-то не работает.`}</div>
    </div>

    <div class="settings-block" style="--i:6">
      <h3>${L`О программе`}</h3>
      <div class="settings-row">
        <span class="settings-label">${L`Версия`}</span>
        <span class="num">v${esc(appVersion)}</span>
        <a class="settings-link" id="repoLink">github.com/TheFleece/dota2-mod-manager</a>
      </div>
      <div class="settings-row">
        <button class="btn btn-sm" id="whatsNewBtn"><span class="ms">auto_awesome</span>${L`Что нового`}</button>
      </div>
    </div>
  `; });
  $('#repoLink').addEventListener('click', () => window.api.misc.openExternal('https://github.com/TheFleece/dota2-mod-manager'));
  $('#whatsNewBtn').addEventListener('click', () => showWhatsNew({ force: true }));
  $('#diagExportBtn').addEventListener('click', async () => {
    const r = await window.api.diag.export();
    if (r?.cancelled) return;
    if (r?.error) toast(r.error, 'error', 7000);
    else toast(L`Отчёт сохранён`);
  });

  // The app language, and only the app: what somebody reads Dota in was decided when they
  // installed it, and the folder mods go into no longer depends on either (see the file header).
  $('#uiLangSelect').addEventListener('change', async (ev) => {
    const lang = ev.target.value;
    await applyLanguage(lang);
    toast(lang === 'ru' ? L`Язык переключён на Русский` : L`Язык переключён на English`);
    renderSettings();
  });

  // ----- scale -----
  // Scaling the content on every input event fights the drag: the slider moves under the
  // pointer, which feeds the next event. So the number moves while dragging and the window
  // resizes on release. One slider moves the panels with it; each panel still has its own
  // grip to drag and Ctrl + wheel of its own for anyone who wants them apart.
  const setEverything = (pct) => {
    const v = clampScale(pct);
    for (const key of ['topZoom', 'bottomZoom', 'railZoom']) state.panels[key] = clampPanelZoom(v / 100);
    paintPanels();
    savePanels();
    applyScalePct(v);
  };
  $('#masterRange')?.addEventListener('input', (ev) => paintScale(clampScale(Number(ev.target.value))));
  $('#masterRange')?.addEventListener('change', (ev) => setEverything(Number(ev.target.value)));
  $('#masterDown')?.addEventListener('click', () => setEverything(currentScalePct() - 5));
  $('#masterUp')?.addEventListener('click', () => setEverything(currentScalePct() + 5));
  $('#masterReset')?.addEventListener('click', () => setEverything(100));

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
  $('#voiceToggle')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const on = !btn.classList.contains('on');
    btn.disabled = true;
    const r = await window.api.voice.setEnglish(on);
    btn.disabled = false;
    if (r?.error) { toast(r.error, 'error', 7000); return; }
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-checked', String(on));
    toast(on ? L`Голоса в игре станут английскими — перезапусти Dota` : L`Русская озвучка вернулась — перезапусти Dota`, 'ok', 7000);
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
