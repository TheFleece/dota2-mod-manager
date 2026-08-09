/* Which hero the window is wearing.
 *
 * Eight palettes, the same eight the catalog's own site has, switched by clicking the mascot
 * in the title bar - h6rd let us bring both across (2026-08-01). The colours themselves live
 * in styles/themes.css; all this does is put the name on <html> and keep the picture in step.
 *
 * The mascots are animated GIFs from the catalog repository, listed there in GIF_CONFIG. We
 * fetch them the same way as every other picture in the app, so the first switch after a
 * fresh install needs the network and everything after it comes out of the cache.
 */
import { $ } from '../core/dom.js';
import { state } from '../core/store.js';
import { RAW_BASE } from '../core/constants.js';

export const THEMES = ['ursa', 'brew', 'fura', 'storm', 'invoker', 'meepo', 'bh', 'axe'];

function mascotUrl(theme) {
  const cfg = state.catalog?.constants?.GIF_CONFIG;
  const i = THEMES.indexOf(theme);
  const fromCatalog = cfg?.themes?.indexOf(theme) >= 0 ? cfg.gifs?.[cfg.themes.indexOf(theme)] : null;
  return `${RAW_BASE}/${fromCatalog || `assets/previews/hueta/${THEMES[i < 0 ? 0 : i]}.gif`}`;
}

/** Put a theme on the window. Unknown names fall back to the one the app ships on. */
export function applyTheme(name) {
  const theme = THEMES.includes(name) ? name : THEMES[0];
  document.documentElement.dataset.theme = theme;
  const img = $('#themeMascot img');
  if (img) img.src = mascotUrl(theme);
  return theme;
}

export function initTheme() {
  applyTheme(state.settings?.theme);
  const mascot = $('#themeMascot');
  mascot?.addEventListener('click', () => {
    if (mascot.classList.contains('spinning')) return;
    const now = document.documentElement.dataset.theme;
    const next = THEMES[(THEMES.indexOf(now) + 1) % THEMES.length];
    // The hero turns away and the new one turns back: the window changes colour at the point
    // of the spin where the face is smallest, so the two look like one event rather than a
    // recolour with a spin thrown over it. Same trick the catalog's own site uses.
    mascot.classList.add('spinning');
    let swapped = false;
    const swap = () => {
      if (swapped) return;
      swapped = true;
      applyTheme(next);
      window.api.settings.set('theme', next);
    };
    setTimeout(swap, spinMs() / 2);
    mascot.addEventListener('animationend', () => {
      mascot.classList.remove('spinning');
      swap();
    }, { once: true });
  });
}

// the length of the spin, read from the stylesheet so the two cannot drift apart
function spinMs() {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--dur-medium-long');
  return parseFloat(v) || 0;
}
