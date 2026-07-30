/* What every screen shares.
 *
 * Split by ownership rather than convenience. Of 254 reads of this object only 38 were
 * writes, and most fields turned out to belong to exactly one screen: which library rows are
 * ticked concerns nobody but the library. Those have moved into the modules that own them,
 * so no other screen can reach them at all.
 *
 * What is left here is the shared cache: what the catalog holds, what the game looks like
 * right now, what the user has installed. Written from few places, read from many.
 *
 * Deliberately a plain object rather than getters and setters. Modules export live bindings,
 * so a getter pair would let any module write any field exactly as it can now, only with
 * more ceremony; the honest fix was shrinking what is shared, not dressing it up.
 */
import { freshFilters, PANEL_DEFAULTS } from './constants.js';

export const state = {
  view: 'catalog',
  catalog: null,
  cosmeticSlots: null,     // free-cosmetics slots from the game's own schema (safe mode off)
  patchState: null,        // src/patcher.js + schema-service state: patched/signed/conflicts/foreign
  settings: null,
  activeCategory: 'all',
  search: '',
  cosSearch: '',           // search inside one cosmetic slot (its list can run to thousands)
  filters: freshFilters(),
  installedIndex: new Map(),
  cosmeticPicks: new Map(), // slot -> live library record for it (rebuilt from mods:list)
  installing: new Set(),
  modIndex: new Map(),
  librarySel: new Set(),   // ids of library records ticked for bulk actions
  libSearch: '',           // library-scoped search query
  masterOff: false,        // mods master switch state (all mods disabled at once)
  packsOpen: new Set(),    // ids of expanded pack cards
  slotCount: 0,            // mods occupying a numbered pak, so the order arrows know the ends
  favorites: new Set(),    // starred catalog mods, as "<categoryId>|<name>" keys
  gameLangOpen: false,     // Settings: the per-language Dota block is unfolded
  scaleOpen: false,        // Settings: the per-part scale block is unfolded
  panels: { ...PANEL_DEFAULTS },
};

/* Fields marked below move out with the screen that owns them, as each one is extracted:
 *   librarySel, libSearch, packsOpen  -> views/library.js
 *   cosSearch                         -> views/cosmetics.js
 *   gameLangOpen, scaleOpen           -> views/settings.js
 * Until then they sit here so the split stays reviewable one screen at a time. */
