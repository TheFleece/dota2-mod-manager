/* A how-to the catalog wrote, shown next to the thing it explains.
 *
 * These used to be a screen of their own, which meant reading one sentence about a courier
 * cost the user the mod they were looking at. Most of them are one sentence: of the thirty
 * mods that name a guide, twenty-one point at a three-line note. So the text comes to the
 * mod instead - a note reads where it stands, a set of steps folds away until asked for.
 *
 * The markup inside is the catalog's own HTML, written for the author's site: <fcode> is his
 * filename style and <span id="tg"> his highlight. Neither means anything here, and that id
 * would repeat a dozen times in one window, so both are turned into our own classes on the
 * way in. The rest of the HTML is trusted the same way the old screen trusted it.
 */
import { state } from '../core/store.js';
import { GUIDE_ALSO } from '../core/constants.js';
import { esc } from './format.js';

// Two guides put a sentence-long description where a heading goes. Past this length it is
// read as one and printed inside the guide instead of on the button that opens it.
const TITLE_MAX = 40;

/** Which guides belong to a mod: its own, plus any the catalog left unclaimed beside it. */
export function guideIds(mod) {
  const all = state.catalog?.guides || {};
  const own = mod?.guideId;
  if (!own) return [];
  return [own, ...(GUIDE_ALSO[own] || [])].filter((id) => all[id]);
}

// The catalog ships both languages; an English reader gets the Russian only if that is all
// there is, which is how the old screen behaved too.
function blocksOf(guide) {
  const c = guide?.content || {};
  return (window.I18N_LANG === 'en' ? (c.en || c.ru) : (c.ru || c.en)) || [];
}

function fromCatalogHtml(html) {
  return String(html)
    .replace(/<(\/?)fcode>/gi, '<$1code>')
    .replace(/<span\s+id=(["'])tg\1\s*>/gi, '<span class="g-hl">');
}

function noteHtml(icon, html, cls = '') {
  return `<div class="g-note ${cls}">${icon ? `<span class="ms">${esc(icon)}</span>` : ''}<div>${html}</div></div>`;
}

/* Numbered steps with notes wedged between them. The numbering has to survive the
 * interruption - a note after step 3 must not send the next step back to 1 - so each run of
 * steps picks up where the last one stopped. */
function stepsHtml(steps) {
  let html = '';
  let done = 0;
  let open = false;
  for (const s of steps) {
    if (typeof s === 'string') {
      if (!open) { html += `<ol class="g-steps" start="${done + 1}">`; open = true; }
      html += `<li>${fromCatalogHtml(s)}</li>`;
      done++;
    } else if (s?.text) {
      if (open) { html += '</ol>'; open = false; }
      html += noteHtml(s.icon, fromCatalogHtml(s.text));
    }
  }
  return open ? `${html}</ol>` : html;
}

function blockHtml(b, { skipTitle = false } = {}) {
  const longTitle = b.title && b.title.length > TITLE_MAX;
  return `
    ${b.title && !skipTitle ? (longTitle
      ? `<div class="g-lead">${esc(b.title)}</div>`
      : `<h4 class="g-title">${b.icon ? `<span class="ms">${esc(b.icon)}</span>` : ''}${esc(b.title)}</h4>`) : ''}
    ${b.info && b.infoPosition !== 'bottom' ? noteHtml('info', fromCatalogHtml(b.info)) : ''}
    ${b.steps ? stepsHtml(b.steps) : ''}
    ${b.result ? noteHtml('check_circle', fromCatalogHtml(b.result), 'g-result') : ''}
    ${b.warning ? noteHtml('warning', fromCatalogHtml(b.warning), 'g-warn') : ''}
    ${b.info && b.infoPosition === 'bottom' ? noteHtml('info', fromCatalogHtml(b.info)) : ''}`;
}

/* What to call it. The guide's own outer title is English whatever the reader's language is,
 * so it never shows: a single block lends its own translated heading, and anything longer is
 * just "the guide" with its parts named inside. */
function heading(blocks) {
  const one = blocks.length === 1 ? blocks[0] : null;
  return one?.title && one.title.length <= TITLE_MAX
    ? { label: one.title, icon: one.icon || 'menu_book', own: true }
    : { label: tr('Гайд'), icon: 'menu_book', own: false };
}

// Nothing to walk through - one block that only warns or explains. Folding that away behind
// a click would hide a sentence the user should simply read.
function isNote(blocks) {
  if (blocks.length !== 1) return false;
  const b = blocks[0];
  return !b.result && !(b.steps || []).some((s) => typeof s === 'string');
}

function oneGuideHtml(id, guide) {
  const blocks = blocksOf(guide);
  if (!blocks.length) return '';
  const head = heading(blocks);
  const body = blocks.map((b, i) => blockHtml(b, { skipTitle: i === 0 && head.own })).join('');

  if (isNote(blocks)) {
    return `
      <section class="guide guide-note" data-guide="${esc(id)}">
        <h4 class="g-title"><span class="ms">${esc(head.icon)}</span>${esc(head.label)}</h4>
        <div class="guide-body"><div class="guide-inner">${body}</div></div>
      </section>`;
  }
  return `
    <section class="guide" data-guide="${esc(id)}">
      <button class="guide-head" type="button" aria-expanded="false">
        <span class="ms">${esc(head.icon)}</span>
        <span class="guide-name">${esc(head.label)}</span>
        <span class="ms guide-chev">expand_more</span>
      </button>
      <div class="guide-body"><div class="guide-inner">${body}</div></div>
    </section>`;
}

/** Every guide a mod carries, ready to drop into whatever is showing that mod. */
export function modGuidesHtml(mod) {
  const all = state.catalog?.guides || {};
  return guideIds(mod).map((id) => oneGuideHtml(id, all[id])).join('');
}

/** Make the guides inside a container work: the folds open, the links leave for a browser. */
export function bindGuides(root) {
  root.querySelectorAll('.guide-head').forEach((head) => {
    head.addEventListener('click', () => {
      const open = head.closest('.guide').classList.toggle('open');
      head.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
  root.querySelectorAll('.guide-body a[href]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      window.api.misc.openExternal(a.href);
    });
  });
}
