/* The list of mods waiting to be installed.
 *
 * Eighty mods used to mean eighty round trips: open a card, press Install, close it, find
 * your place in the grid again. The catalog's own site solved this with a cart years ago and
 * people have been asking us for the same. A plus on the picture puts a mod in the list, the
 * counter in the title bar says how many are in it, and one button installs the lot.
 *
 * The list is deliberately not a preset. A preset is a saved arrangement you keep and share;
 * this is a shopping trip, and it is over when the mods are installed. It lives in memory for
 * exactly that reason - closing the window is a perfectly good way to change your mind.
 *
 * Installing is not this module's business: it holds the list, draws it, and hands it to
 * whoever registered as the installer (the catalog does, since that is where the machinery
 * for one mod already lives).
 */
import { $ } from '../core/dom.js';
import { esc } from './format.js';
import { thumbHtml } from './thumb.js';

const items = new Map(); // key -> { key, cat, name, label, file, preview, title }
let installer = null;
let busy = false;

/** The catalog registers what to do with the list once the user commits to it. */
export function useInstaller(fn) { installer = fn; }

export const isQueued = (key) => items.has(key);
export const queueSize = () => items.size;

/** Put a mod in the list or take it out; returns whether it is in there now. */
export function toggleQueued(entry) {
  if (items.has(entry.key)) items.delete(entry.key);
  else items.set(entry.key, entry);
  paintBadge();
  if (!$('#queueOverlay').classList.contains('hidden')) drawPanel();
  return items.has(entry.key);
}

export function clearQueue() {
  items.clear();
  paintBadge();
  drawPanel();
}

function paintBadge() {
  const btn = $('#queueBtn');
  if (!btn) return;
  btn.classList.toggle('has', items.size > 0);
  $('#queueCount').textContent = items.size ? String(items.size) : '';
  btn.disabled = items.size === 0;
}

function drawPanel() {
  const panel = $('#queuePanel');
  if (!panel) return;
  const list = [...items.values()];
  panel.innerHTML = `
    <div class="queue-head">
      <h2>${L`Список установки`}</h2>
      <button class="queue-x" id="queueClose" aria-label="${L`Закрыть`}"><span class="ms">close</span></button>
    </div>
    ${list.length ? `
      <div class="queue-list">
        ${list.map((it) => `
          <div class="queue-row" data-row="${esc(it.key)}">
            ${thumbHtml('queue-thumb', it.preview)}
            <div class="queue-info">
              <div class="queue-name">${esc(it.title)}</div>
              <div class="queue-cat">${esc(it.catName)}</div>
            </div>
            <button class="queue-drop" data-drop="${esc(it.key)}" aria-label="${L`Убрать`}"><span class="ms">close</span></button>
          </div>`).join('')}
      </div>
      <div class="queue-foot">
        <button class="btn btn-sm" id="queueClear">${L`Очистить`}</button>
        <button class="btn btn-primary" id="queueGo" ${busy ? 'disabled' : ''}>
          <span class="ms">download</span>${busy ? L`Установка…` : L`Установить всё (${list.length})`}
        </button>
      </div>` : `<div class="empty-note">${L`Пусто. Жми плюс на карточке мода, чтобы собрать список.`}</div>`}`;

  $('#queueClose')?.addEventListener('click', closePanel);
  $('#queueClear')?.addEventListener('click', clearQueue);
  panel.querySelectorAll('[data-drop]').forEach((b) => {
    b.addEventListener('click', () => {
      items.delete(b.dataset.drop);
      paintBadge();
      drawPanel();
      // the plus on that card is out of date now
      document.querySelector(`[data-add="${CSS.escape(b.dataset.drop)}"]`)?.classList.remove('on');
    });
  });
  $('#queueGo')?.addEventListener('click', runInstall);
}

async function runInstall() {
  if (busy || !installer || !items.size) return;
  busy = true;
  drawPanel();
  const list = [...items.values()];
  try {
    await installer(list);
  } finally {
    busy = false;
    // whatever went in is no longer waiting: what failed is reported by the installer, and
    // a list that survives its own run is a list nobody trusts
    items.clear();
    paintBadge();
    closePanel();
  }
}

export function openPanel() {
  drawPanel();
  $('#queueOverlay').classList.remove('hidden');
}

export function closePanel() {
  $('#queueOverlay').classList.add('hidden');
}

export function initQueue() {
  paintBadge();
  $('#queueBtn')?.addEventListener('click', openPanel);
  $('#queueOverlay')?.addEventListener('click', (e) => {
    if (e.target === $('#queueOverlay')) closePanel();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#queueOverlay').classList.contains('hidden')) {
      e.stopPropagation();
      closePanel();
    }
  });
}
