/* Which screen is showing, and how to get to another one.
 *
 * Screens have to be able to send the user elsewhere - a mod card jumps to the library, an
 * empty library points at the catalog - but if each screen imported the others, the graph
 * would be a knot and nothing could be extracted from app.js without dragging the rest
 * along. So screens do not know each other: each registers its render under a name, and
 * this is the only module that holds the map. Screens import the router, never the reverse.
 */
import { state } from './store.js';
import { $ } from './dom.js';
import { screenChanging } from '../ui/transitions.js';

const screens = new Map();

/** Give a name a way to draw itself. Called once per screen, as it is loaded. */
export function registerView(name, render) {
  screens.set(name, render);
}

/** Redraw whatever is showing. A name with nothing registered draws nothing rather than
 *  throwing: a half-extracted screen should leave a blank area, not a broken window. */
export function render() {
  const draw = screens.get(state.view);
  return draw ? draw() : undefined;
}

export function switchView(view) {
  document.querySelectorAll('.tb-tab').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  state.view = view;
  const railOff = view !== 'catalog';
  $('#catRail').classList.toggle('hidden', railOff);
  $('#gripRail').classList.toggle('hidden', railOff); // nothing to resize without the rail
  document.body.classList.toggle('rail-off', railOff || !!state.panels.railFolded);
  // a scrolled-away tab must not stay out of sight once it is the active one
  document.querySelector('.tb-tab.active')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  window.api.presence.view(view); // what Discord shows the user is doing
  // The screen animates in when it paints, not now: it may have to fetch first, and a
  // transition started here would hold the old picture on screen for the whole wait.
  screenChanging();
  render();
}
