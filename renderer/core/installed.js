/* What the user already has, indexed so any screen can ask about one mod.
 *
 * The catalog asks to grey out an install button, the library asks to draw a row, the
 * cosmetics screen asks what currently dresses a slot. All three read the same index, and
 * it is rebuilt from one call rather than each screen fetching its own list.
 */
import { state } from './store.js';
import { $ } from './dom.js';

/** How a mod is identified across the catalog and the library: category, name, style. */
export function keyOf(categoryId, name, styleLabel) {
  return `${categoryId}|${name}|${styleLabel || ''}`;
}

// label for a fingerprint match (array of catalog identities that share the content)
export function matchLabel(matches) {
  return matches.map((m) => m.name + (m.styleLabel ? ` · ${m.styleLabel}` : '')).join(' / ');
}

// refresh the catalog "installed" lookup + the library tab counter from a list
export function applyInstalled(installed) {
  state.installedIndex.clear();
  state.cosmeticPicks.clear();
  for (const rec of installed) {
    state.installedIndex.set(keyOf(rec.categoryId, rec.name, rec.styleLabel), rec);
    // What is live in a cosmetic slot is read from the records themselves, not from the
    // slot list: the option lists only change when the game does, while a pick can be
    // deleted or switched off from the Library at any moment.
    if (rec.categoryId === 'cosmetic' && rec.slot && rec.enabled !== false) state.cosmeticPicks.set(rec.slot, rec);
  }
  $('#libCount').textContent = installed.length || '';
}

// the record that currently dresses a cosmetic slot, if any
export function pickedIn(slot) {
  return state.cosmeticPicks.get(slot) || null;
}

export async function refreshInstalledIndex() {
  const { installed } = await window.api.mods.list();
  applyInstalled(installed);
}
