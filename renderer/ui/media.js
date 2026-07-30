/* Where a preview lives and how it is drawn. The catalog stores previews as repo-relative
 * paths, absolute links, or nothing at all, and each of those has to end up as one tag. */
import { RAW_BASE } from '../core/constants.js';
import { esc } from './format.js';

export function previewUrl(categoryId, preview) {
  if (!preview) return null;
  if (/^https?:\/\//i.test(preview)) return preview;
  if (preview.startsWith('assets/previews/')) return `${RAW_BASE}/${preview.split('/').map(encodeURIComponent).join('/')}`;
  return `${RAW_BASE}/assets/previews/${encodeURIComponent(categoryId)}/${encodeURIComponent(preview)}`;
}

export function isVideo(src) { return /\.(mp4|webm)$/i.test(src || ''); }
export function isAudio(src) { return /\.(mp3|wav|ogg)$/i.test(src || ''); }
export function isMedia(src) { return isVideo(src) || isAudio(src); }

// resolve a repo-relative or absolute link to a full URL
export function resolveUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${RAW_BASE}/${url.split('/').map(encodeURIComponent).join('/')}`;
}

export function mediaHtml(url, { hoverPlay = false, autoplay = false, controls = false, fallbackIcon = 'image' } = {}) {
  if (!url) {
    return `<div class="noimg"><span class="ms" style="font-size:36px">${esc(fallbackIcon)}</span></div>`;
  }
  if (isVideo(url)) {
    // preload="metadata" shows the first frame instead of a black box
    return `<video src="${esc(url)}" ${controls ? 'controls' : 'muted'} loop playsinline preload="${autoplay ? 'auto' : 'metadata'}" ${autoplay ? 'autoplay' : ''} ${hoverPlay ? 'data-hoverplay="1"' : ''}></video>`;
  }
  if (isAudio(url)) {
    return `<div class="audio-wrap"><span class="ms audio-icon">graphic_eq</span><audio src="${esc(url)}" controls preload="none"></audio></div>`;
  }
  return `<img src="${esc(url)}" loading="lazy" alt="">`;
}
