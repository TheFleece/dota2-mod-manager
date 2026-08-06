/* The three overlays the app owns: what's new after an update, a confirm before anything
 * destructive, and a prompt for a name. All three resolve a promise, close on Escape and on
 * a click outside, and clean up their key listener - a dialog that leaks one of those breaks
 * the next dialog rather than itself, which is why they are together. */
import { esc } from './format.js';
import { toast } from './toast.js';

// ---------- "what's new" after an update ----------

// The changelog is markdown, but only ever the three shapes this app writes: "### heading",
// "- bullet" and **bold** inside a line. A full parser would be a library for nothing.
export function notesHtml(md) {
  const inline = (s) => esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  const out = [];
  let list = null;
  const closeList = () => { if (list) { out.push(`<ul>${list.join('')}</ul>`); list = null; } };
  for (const raw of String(md).split('\n')) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }
    if (line.startsWith('###')) { closeList(); out.push(`<h4>${inline(line.replace(/^#+\s*/, ''))}</h4>`); continue; }
    if (line.startsWith('- ')) { (list = list || []).push(`<li>${inline(line.slice(2))}</li>`); continue; }
    // a wrapped bullet or paragraph line continues whatever came before it
    if (list) list[list.length - 1] = list[list.length - 1].replace('</li>', ' ' + inline(line) + '</li>');
    else if (out.length && out[out.length - 1].startsWith('<p>')) {
      out[out.length - 1] = out[out.length - 1].replace('</p>', ' ' + inline(line) + '</p>');
    } else out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return out.join('');
}

/* Anything the app was told from the network since it shipped, above the release notes.
 * A notice is dismissed from its banner and stays here afterwards, which is where somebody
 * goes when they half-remember a message about a Dota patch and want to read it again. */
function noticesHtml(notices) {
  if (!notices || !notices.length) return '';
  return `
    <div class="notes-notices">
      ${notices.map((n) => `
        <div class="notes-notice ${n.level === 'warn' ? 'warn' : ''}">
          ${n.date ? `<span class="notes-notice-date">${esc(n.date)}</span>` : ''}
          <span>${esc(n.text)}</span>
          ${n.url ? ` <a href="#" class="notice-link" data-url="${esc(n.url)}">${L`Подробнее`}</a>` : ''}
        </div>`).join('')}
    </div>`;
}

export function whatsNewDialog(version, md, notices = []) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box notes-box">
        <div class="notes-head">
          <span class="ms">auto_awesome</span>
          <div>
            <div class="notes-title">${L`Что нового`}</div>
            <div class="notes-ver">${L`версия ${esc(version)}`}</div>
          </div>
        </div>
        <div class="notes-body">${noticesHtml(notices)}${notesHtml(md)}</div>
        <div class="confirm-actions">
          <button class="btn btn-primary" data-c="ok">${L`Понятно`}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const done = () => { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) done(); });
    overlay.querySelector('[data-c="ok"]').addEventListener('click', done);
    overlay.querySelectorAll('.notice-link').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      window.api.misc.openExternal(a.dataset.url);
    }));
    const onKey = (e) => { if (e.key === 'Escape') done(); };
    document.addEventListener('keydown', onKey);
  });
}

// Show it once per version, and only for a version the user did not install by hand.
export async function showWhatsNew({ force = false } = {}) {
  let r = null;
  try { r = await window.api.update.notes(window.I18N_LANG); } catch { return; }
  if (!r || !r.notes) { if (force) toast(L`Для этой версии заметок нет`, 'warn'); return; }
  if (!force && !r.unseen) { window.api.update.notesSeen(); return; }
  let notices = [];
  try { notices = (await window.api.config.state()).notices || []; } catch { /* offline: the release notes alone */ }
  await whatsNewDialog(r.version, r.notes, notices);
  window.api.update.notesSeen();
}

// ---------- custom confirm dialog ----------

export function confirmDialog(message, { okLabel = L`Удалить`, danger = true } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box">
        <div class="confirm-msg">${esc(message)}</div>
        <div class="confirm-actions">
          <button class="btn" data-c="no">${L`Отмена`}</button>
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

// text-input dialog (returns the entered string, or null if cancelled)
export function promptDialog(message, { placeholder = '', value = '', okLabel = L`ОК` } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box">
        <div class="confirm-msg">${esc(message)}</div>
        <input class="input prompt-input" id="promptInput" placeholder="${esc(placeholder)}" value="${esc(value)}">
        <div class="confirm-actions">
          <button class="btn" data-c="no">${L`Отмена`}</button>
          <button class="btn btn-primary" data-c="yes">${esc(okLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('#promptInput');
    const done = (v) => { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) done(null); });
    overlay.querySelector('[data-c="no"]').addEventListener('click', () => done(null));
    overlay.querySelector('[data-c="yes"]').addEventListener('click', () => done(input.value.trim() || null));
    const onKey = (e) => {
      if (e.key === 'Escape') done(null);
      if (e.key === 'Enter') done(input.value.trim() || null);
    };
    document.addEventListener('keydown', onKey);
    input.focus();
    input.select();
  });
}
