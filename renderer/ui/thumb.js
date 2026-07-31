/* Pictures for a mod, wherever it came from.
 *
 * Four sources, tried in order: the catalog's own preview, a preview the record carries,
 * a frame lifted from the file itself, and finally the hero portrait the name implies. A
 * mod with no picture is a card the eye slides off, so the fallbacks are worth the code.
 *
 * Shared by the catalog and the library, which is why it lives here rather than in either. */
import { state } from '../core/store.js';
import { isCursorRec } from '../core/records.js';
import { esc } from './format.js';
import { previewUrl, isVideo, isMedia, mediaHtml } from './media.js';

// The catalog's own picture for a mod, by the name it is filed under. Styles have one each,
// so the record's file (or its style label) says which of them is this one's.
export function catalogPreviewUrl(categoryId, name, styleLabel, fileRef) {
  const hit = state.modIndex.get(String(name || '').toLowerCase());
  if (!hit || hit.categoryId !== categoryId) return null;
  const styles = hit.mod.styles || [];
  const style = styles.find((s) => fileRef && s.file === fileRef)
    || styles.find((s) => (s.label || null) === (styleLabel || null));
  const preview = style?.preview || hit.mod.preview || styles[0]?.preview;
  return preview ? previewUrl(categoryId, preview) : null;
}

// Picture for one library entry — a row or a pack member: its own, else the catalog's for
// the same mod. The fallback is what gives a record installed without a preview (and an
// import recognised by its fingerprint) a thumbnail instead of an empty box.
export function recPreviewUrl(rec) {
  if (rec.preview) return previewUrl(rec.categoryId, rec.preview);
  if (rec.match) {
    const cp = catalogPreviewFor(rec.match);
    if (cp) return previewUrl(rec.match[0].categoryId, cp);
  }
  return catalogPreviewUrl(rec.categoryId, rec.name, rec.styleLabel, rec.fileRef);
}

// A library thumbnail: a still for a picture, the first frame for a clip (a few catalog
// entries only ship an .mp4), an empty box when there is nothing to show.
export function thumbHtml(cls, url) {
  if (!url) return `<div class="${cls}"></div>`;
  if (isVideo(url)) return `<video class="${cls}" src="${esc(url)}" muted playsinline preload="metadata"></video>`;
  return `<img class="${cls}" src="${esc(url)}" loading="lazy" alt="">`;
}

// A stand-in for a record with no picture of its own and no catalog match: a cursor set
// (whatever its category - a data gap in the catalog is as blank as an unmatched import), an
// imported mod recognised as skinning exactly one hero (see installer.analyzeRecord), or an
// unsplit bundle of several heroes at once. Each is a real thing the wiki itself illustrates
// with one picture; a font, or anything the app cannot place in one of these, stays a plain
// icon rather than guess.
export function wikiFallbackKey(rec) {
  if (isCursorRec(rec)) return { key: 'generic:cursor', icon: 'arrow_selector_tool' };
  if (rec.categoryId !== 'imported' || !Array.isArray(rec.heroNames) || !rec.heroNames.length) return null;
  return rec.heroNames.length === 1
    ? { key: 'hero:' + rec.heroNames[0], icon: 'person' }
    : { key: 'generic:pack', icon: 'auto_awesome' };
}

// A tile for a fixed fallback key (a hero's portrait, a category's stand-in): whatever is
// already known client-side, or a placeholder icon with the data-name the list's own
// IntersectionObserver picks up for free (see watchCosmeticIcons) once it scrolls into view.
export function fallbackThumbHtml(key, icon, cls) {
  if (cosIconCache.has(key)) {
    const cached = cosIconCache.get(key);
    return cached ? `<img class="${cls}" src="${esc(cached)}" loading="lazy" alt="">` : `<div class="${cls}"></div>`;
  }
  return `<div class="${cls}" data-name="${esc(key)}"><span class="ms" style="font-size:18px;color:var(--text-faint)">${icon}</span></div>`;
}

// thumbHtml, with the wiki-picture fallback layered on for a record with no picture of its
// own or the catalog's.
export function libThumbHtml(rec, cls) {
  const url = recPreviewUrl(rec);
  if (url) return thumbHtml(cls, url);
  const fb = wikiFallbackKey(rec);
  return fb ? fallbackThumbHtml(fb.key, fb.icon, cls) : `<div class="${cls}"></div>`;
}

// A foreign file's tile, from the same sources a library row uses: the catalog's picture
// when the file is recognised, otherwise the wiki portrait of the hero it turned out to be
// about. A file in the mods folder is a mod — it should not look emptier than one the app
// installed itself just because nobody clicked "adopt" yet.
export function extThumbHtml(f) {
  const cls = 'lib-thumb';
  if (f.kind === 'cursor') return fallbackThumbHtml('generic:cursor', 'arrow_selector_tool', cls);
  if (f.kind === 'font') return `<div class="${cls}"><span class="ms" style="font-size:18px;color:var(--text-faint)">text_fields</span></div>`;
  const cp = catalogPreviewFor(f.match);
  if (cp) return thumbHtml(cls, previewUrl(f.match[0].categoryId, cp));
  const heroes = f.heroNames || [];
  if (heroes.length === 1) return fallbackThumbHtml('hero:' + heroes[0], 'person', cls);
  if (heroes.length > 1) return fallbackThumbHtml('generic:pack', 'auto_awesome', cls);
  return `<div class="${cls}"><span class="ms" style="font-size:18px;color:var(--text-faint)">folder_zip</span></div>`;
}

// catalog thumbnail for a fingerprint match, resolved from the loaded catalog index
export function catalogPreviewFor(match) {
  const m = match && match[0];
  if (!m) return null;
  const hit = state.modIndex.get(m.name.toLowerCase());
  if (!hit) return null;
  const mod = hit.mod;
  if (m.styleLabel && mod.styles) {
    const st = mod.styles.find((s) => s.label === m.styleLabel);
    if (st && st.preview) return st.preview;
  }
  return mod.preview || (mod.styles && mod.styles[0] && mod.styles[0].preview) || null;
}
