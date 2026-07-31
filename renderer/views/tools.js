/* Tools: the utilities the catalog ships alongside the mods.
 *
 * A short list because it is somebody else's software - VPK editors, model viewers and the
 * like. The app downloads one, unpacks it and opens the folder; running it is the user's
 * business, and a tool with a guide sends them to the Guides screen through the router
 * rather than drawing it here.
 */
import { $ } from '../core/dom.js';
import { state } from '../core/store.js';
import { registerView, switchView } from '../core/router.js';
import { esc } from '../ui/format.js';
import { toast } from '../ui/toast.js';

const viewRoot = $('#view-root');

registerView('tools', () => renderTools());

export async function renderTools() {
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
