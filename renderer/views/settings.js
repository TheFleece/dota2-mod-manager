/* Settings: everything the app itself remembers.
 *
 * The page is mostly other modules' knobs - the scales belong to ui/chrome.js, the language
 * to ui/language.js, the mods folder to the status bar - because a setting is a thing the
 * whole window obeys, not a thing this screen owns. What is genuinely here is the wiring:
 * which control writes which value, and what has to be repainted once it does.
 *
 * The one import from another screen is loadCatalog, for the button that re-fetches the
 * catalog. It asks the catalog for its data, not for a drawing, so the router is not what
 * that call wants.
 */
import { $ } from '../core/dom.js';
import { state } from '../core/store.js';
import { registerView } from '../core/router.js';
import { refreshInstalledIndex } from '../core/installed.js';
import { esc, fmtMB, plural } from '../ui/format.js';
import { toast } from '../ui/toast.js';
import { showWhatsNew, confirmDialog } from '../ui/dialog.js';
import { refreshSidebarStatus } from '../ui/statusbar.js';
import { clampScale, currentScalePct, paintScale, applyScalePct, clampPanelZoom, paintPanels, savePanels } from '../ui/chrome.js';
import { applyLanguage } from '../ui/language.js';
import { loadCatalog } from './catalog.js';
import { paint } from '../ui/transitions.js';

const viewRoot = $('#view-root');

// Whether the two folded blocks on the page are open. Nothing outside this screen has ever
// asked, so they are no longer in the shared store.
let scaleOpen = false;     // the per-part scale block
let gameLangOpen = false;  // the per-language Dota block

registerView('settings', () => renderSettings());

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

export async function renderSettings() {
  const s = await window.api.settings.get();
  state.settings = s;
  const gl = s.gameLang || {};
  const scalePct = Math.round((Number(s.uiScale) || 1) * 100);
  const pz = state.panels;
  const cacheSize = await window.api.misc.cacheSize();
  const appVersion = await window.api.update.version();

  paint(() => { viewRoot.innerHTML = `
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
      <div class="settings-hint">
        ${L`Один переключатель на всё: язык приложения, текст в самой Dota и её озвучку (за языком озвучки следует папка модов). Dota при этом должна быть закрыта — иначе она перезапишет настройку при выходе.`}
      </div>
      <div class="settings-row spaced">
        <span class="settings-label">${L`Масштаб всего`}</span>
        <div class="scale-ctl">
          <button class="btn btn-sm scale-step" id="masterDown" aria-label="${L`Мельче`}"><span class="ms">remove</span></button>
          <input type="range" class="scale-range" id="masterRange" min="70" max="160" step="5" value="${scalePct}" aria-label="${L`Масштаб всего`}">
          <span class="scale-val" id="masterRangeVal">${scalePct}%</span>
          <button class="btn btn-sm scale-step" id="masterUp" aria-label="${L`Крупнее`}"><span class="ms">add</span></button>
          <button class="btn btn-sm" id="masterReset">${L`Сбросить всё`}</button>
        </div>
      </div>
      <div class="settings-hint">
        ${L`Двигает содержимое и панели сразу. Ниже каждый масштаб можно задать по отдельности. Те же клавиши: Ctrl + и Ctrl − меняют содержимое, Ctrl + колесо над панелью — эту панель, Ctrl 0 возвращает 100%. За границу панели можно потянуть, чтобы изменить её размер.`}
      </div>
      <details class="settings-adv" ${scaleOpen ? 'open' : ''} id="scaleAdv">
        <summary>${L`Масштаб по частям`}</summary>
        ${[
          { id: 'Content', label: L`Содержимое`, icon: 'grid_view', value: scalePct, min: 70, max: 160 },
          { id: 'Top', label: L`Верхняя панель`, icon: 'toolbar', value: Math.round(pz.topZoom * 100), min: 60, max: 180 },
          { id: 'Rail', label: L`Список категорий`, icon: 'view_sidebar', value: Math.round(pz.railZoom * 100), min: 60, max: 180 },
          { id: 'Bottom', label: L`Нижняя панель`, icon: 'bottom_panel_open', value: Math.round(pz.bottomZoom * 100), min: 60, max: 180 },
        ].map((row) => `
        <div class="settings-row">
          <span class="settings-label"><span class="ms">${row.icon}</span>${row.label}</span>
          <div class="scale-ctl">
            <input type="range" class="scale-range" id="zoom${row.id}" min="${row.min}" max="${row.max}" step="5" value="${row.value}" aria-label="${esc(row.label)}">
            <span class="scale-val" id="zoom${row.id}Val">${row.value}%</span>
            <button class="btn btn-sm" data-zoom-reset="${row.id}">${L`Сбросить`}</button>
          </div>
        </div>`).join('')}
      </details>
      <details class="settings-adv" ${gameLangOpen ? 'open' : ''} id="gameLangAdv">
        <summary>${L`Задать языки Dota по отдельности`}</summary>
        <div class="settings-row">
          <span class="settings-label">${L`Текст`}</span>
          <div class="select-wrap">
            <span class="ms">translate</span>
            <select class="input" id="gameTextLang">
              ${gameLangOptions(gl.languages, gl.uiLanguage || 'english')}
            </select>
          </div>
        </div>
        <div class="settings-row">
          <span class="settings-label">${L`Озвучка`}</span>
          <div class="select-wrap">
            <span class="ms">campaign</span>
            <select class="input" id="gameAudioLang">
              ${gameLangOptions(gl.languages, s.langSuffix)}
            </select>
          </div>
        </div>
        <div class="settings-row">
          <button class="btn btn-sm btn-primary" id="applyGameLang">${L`Применить`}</button>
          <span class="settings-hint" id="gameLangHint"></span>
        </div>
        <div class="settings-hint">
          ${L`Dota хранит эти языки отдельно: моды подхватываются из папки языка озвучки, а текст на них не влияет. Отсюда, например, английский интерфейс игры при русской озвучке.`}
        </div>
      </details>
    </div>

    <div class="settings-block" style="--i:1">
      <h3>Discord</h3>
      <div class="settings-row">
        <span class="settings-label">${L`Показывать в Discord, что ты в Mod Manager`}</span>
        <button class="toggle ${s.discordPresence === false ? '' : 'on'}" id="presenceToggle" role="switch"
                aria-checked="${s.discordPresence !== false}" aria-label="${L`Показывать в Discord, что ты в Mod Manager`}"></button>
      </div>
      <div class="settings-hint">
        ${L`Друзья увидят «Играет в Dota 2 Mod Manager», текущую вкладку и сколько модов включено. В самом Discord это работает, только если включено «Отображать текущую активность как статус».`}
      </div>
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
      <h3>${L`Папка модов`}</h3>
      <div class="settings-row">
        <span class="settings-label">${L`Куда ставятся моды`}</span>
        <span class="mono grow">dota_${esc(s.langSuffix)}</span>
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
          <select class="input" id="langSelect">
            ${langOptions(s, gl)}
          </select>
        </div>
      </div>` : ''}
      <div class="settings-hint">
        ${L`Dota монтирует только папку своего языка озвучки, поэтому придуманные папки вроде dota_123 больше не подхватываются. Параметр -language ни на что не влияет — его можно убрать из свойств Steam.`}
      </div>
      <div class="modal-note">
        <b>${L`Английский интерфейс`}</b>${L`: открой «Задать языки Dota по отдельности» в блоке «Интерфейс», поставь Текст = English, а Озвучку оставь той, чья папка уже используется. Языки независимы, моды продолжат работать.`}
      </div>
      ${gl.selfMade ? `
      <div class="modal-note warn">
        <b>${L`Папку dota_${s.langSuffix} создаёт приложение`}</b>${L`: Valve её не поставляет, и гарантии, что игра её смонтирует, нет. Если моды не появились в игре — выбери в настройках Dota другой Audio Language, например Russian.`}
      </div>` : ''}
      ${(gl.stranded || []).map((f) => `
      <div class="modal-note warn">
        <b>${L`Папка dota_${f.suffix} больше не работает`}</b>${L`: в ней ${f.modFiles} ${plural(f.modFiles, 'мод', 'мода', 'модов')}, игра их не видит.`}
        <button class="btn btn-sm" data-move-from="${esc(f.suffix)}">${L`Перенести сюда`}</button>
      </div>`).join('')}
      ${s.minifyDetected ? `
      <div class="modal-note">
        <b>${L`Обнаружен Minify`}</b>${L` (папка `}<code class="text-accent">dota_minify</code>${L` рядом). Если Minify ставит моды в ту же папку, что и менеджер, их файлы будут перекрывать друг друга — ставь моды через что-то одно.`}
      </div>` : ''}
    </div>

    <div class="settings-block" style="--i:4">
      <h3>${L`Кэш загрузок`}</h3>
      <div class="settings-row">
        <span class="settings-label">${L`Размер`}</span>
        <span class="num">${fmtMB(cacheSize)} MB</span>
        <button class="btn btn-sm" id="clearCacheBtn">${L`Очистить`}</button>
      </div>
      <div class="settings-hint">
        ${L`Скачанные архивы модов. Нужны для быстрой переустановки — удаление ничего не сломает.`}
      </div>
    </div>

    <div class="settings-block" style="--i:5">
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

    <div class="settings-block" style="--i:6">
      <h3>${L`Диагностика`}</h3>
      <div class="settings-hint">
        ${L`Один файл с путём и настройками Dota, списком модов, состоянием патча и последними записями журнала приложения — без личных данных, кроме имени в Discord, если ты вошёл. Пришли его вместо скриншотов, если что-то не работает.`}
      </div>
      <div class="settings-row spaced">
        <button class="btn btn-sm" id="diagExportBtn"><span class="ms">bug_report</span>${L`Экспортировать отчёт`}</button>
      </div>
    </div>

    <div class="settings-block" style="--i:7">
      <h3>${L`О программе`}</h3>
      <div class="settings-row">
        <span class="settings-label">${L`Версия`}</span>
        <span class="num">v${esc(appVersion)}</span>
        <a class="settings-link" id="repoLink">github.com/TheFleece/dota2-mod-manager</a>
      </div>
      <div class="settings-hint">
        ${L`Обновления скачиваются автоматически из GitHub Releases — когда новая версия готова, появится кнопка установки.`}
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
  $('#scaleAdv')?.addEventListener('toggle', (e) => { scaleOpen = e.target.open; });
  $('#gameLangAdv')?.addEventListener('toggle', (e) => { gameLangOpen = e.target.open; });
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
