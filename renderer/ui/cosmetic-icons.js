/* Item pictures, fetched only for what the user can actually see.
 *
 * A cosmetic slot can hold two thousand items and every picture is a data URI from the main
 * process, so asking for all of them would stall the window. An observer collects the tiles
 * that scroll into view and fetches those in small batches.
 *
 * Both the library and the cosmetics screen draw these tiles, which is why this sits apart
 * from either of them.
 */
import { esc } from './format.js';

// Item pictures come from the main process as data URIs (src/icons.js). A slot can hold two
// thousand items, so only what is actually on screen is ever asked for: an observer collects
// the tiles that scroll into view and fetches them in small batches.
const cosIconCache = new Map();

export async function loadCosmeticIcons(names, onEach) {
  const want = [...new Set(names)].filter((n) => n && !cosIconCache.has(n));
  for (let i = 0; i < want.length; i += 24) {
    const chunk = want.slice(i, i + 24);
    const got = await window.api.cosmetics.icons(chunk);
    for (const n of chunk) cosIconCache.set(n, got[n] || null);
    onEach(chunk);
  }
}

// Fill every tile whose picture is already known.
export function paintCosmeticIcons(root) {
  for (const el of root.querySelectorAll('.card-thumb[data-name], .lib-thumb[data-name]')) {
    const src = cosIconCache.get(el.dataset.name);
    if (src && !el.querySelector('img')) el.innerHTML = `<img src="${esc(src)}" alt="" loading="lazy">`;
  }
}

/**
 * Watch a scrolling container and fetch pictures for tiles as they appear.
 * @returns {IntersectionObserver} caller disconnects it when the view goes away
 */
export function watchCosmeticIcons(root, scroller) {
  let queue = new Set();
  let timer = null;
  const flush = async () => {
    timer = null;
    const names = [...queue];
    queue = new Set();
    if (!names.length) return;
    await loadCosmeticIcons(names, () => paintCosmeticIcons(root));
  };
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const name = en.target.dataset.name;
      io.unobserve(en.target);
      if (name && !cosIconCache.has(name)) queue.add(name);
      else if (name) paintCosmeticIcons(root);
    }
    if (queue.size && !timer) timer = setTimeout(flush, 80);
  }, { root: scroller || null, rootMargin: '200px' });
  for (const el of root.querySelectorAll('.card-thumb[data-name], .lib-thumb[data-name]')) io.observe(el);
  return io;
}
