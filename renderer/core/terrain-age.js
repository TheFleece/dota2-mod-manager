/* Whole-map terrains built for an older map than the game's own (src/terrain-age.js): the mark on
 * a catalog card and on a My mods row, and the one toast when the app switched some off.
 *
 * Such a terrain is the whole map as it was on the day it was built. Once Valve changes the map,
 * the old copy it keeps serving loses its trees, costs frames, and can get matchmaking refused
 * (issue #122). It stays installable: the mark says what it will do, and the author's next
 * build clears it. */
import { state } from './store.js';
import { render } from './router.js';
import { esc } from '../ui/format.js';
import { toast } from '../ui/toast.js';

let asked = false;

const why = () => L`Ландшафт собран под карту старше той, что сейчас в игре. С ним могут пропасть деревья, упасть FPS и заблокироваться поиск матча, пока автор его не обновит.`;

// Asked once, a few kilobytes per terrain archive; the terrains are drawn again when it answers.
function askCatalog() {
  if (asked) return;
  asked = true;
  window.api.catalog.terrainAges().then((r) => {
    state.terrainAges = r || { stale: {} };
    if (state.view === 'catalog' && state.activeCategory === 'terrains') render();
  }).catch(() => { state.terrainAges = { stale: {} }; });
}

/** The mark on a catalog card: '' for anything but a whole-map terrain older than the game's map. */
export function staleTerrainPillHtml(categoryId, m) {
  if (categoryId !== 'terrains' || !m || !/\.zip$/i.test(m.file || '')) return '';
  if (!state.terrainAges) { askCatalog(); return ''; }
  return state.terrainAges.stale?.[m.file]
    ? `<span class="mtag warn" title="${esc(why())}">${L`старая карта`}</span>` : '';
}

/** The same mark on a My mods row, which main works out when it lists the mods (staleMap). */
export function staleMapTagHtml(rec) {
  if (!rec || !rec.staleMap) return '';
  return ` <span class="lib-tag stale" title="${esc(why())}"><span class="ms">history</span>${L`старая карта`}</span>`;
}

/**
 * Once per map the game has, main switches off the whole-map terrains older than it; this says
 * which. Called at start and after a game update, which is also when the catalog's marks may
 * have changed.
 */
export async function switchOffStaleTerrains() {
  asked = false;
  state.terrainAges = null;
  try {
    const { names = [] } = await window.api.mods.switchOffStaleTerrains();
    if (names.length) {
      toast(L`Выключено: ${names.join(', ')}. Игра обновила карту, а этот ландшафт собран под прежнюю: с ним пропадают деревья и может не работать поиск матча.`, 'warn', 10000);
    }
    return names;
  } catch {
    return [];
  }
}
