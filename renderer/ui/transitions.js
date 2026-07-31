/* Motion between one state of the window and the next.
 *
 * The browser can do this for us: hand it a DOM change and it animates the old picture into
 * the new one, matching up any elements that carry the same view-transition-name. Two things
 * use it here - moving between screens, and opening a mod card into its modal, where the
 * card's picture flies up and becomes the modal's.
 *
 * The catch is that the callback holds the frame: whatever runs inside it, the window is
 * frozen on the old picture until it finishes. So a transition is never wrapped around a
 * screen's data fetch, only around the paint that follows it. That is why a screen change
 * is armed here by the router and spent by whichever screen paints next, instead of the
 * router simply awaiting the render.
 *
 * Redrawing a screen in place - toggling a mod, ticking a row - deliberately gets nothing.
 * A crossfade there reads as a flicker, not as movement.
 */

const supported = typeof document.startViewTransition === 'function';
const stillness = window.matchMedia('(prefers-reduced-motion: reduce)');

// The router says a screen change is coming; the next paint spends it.
let running = 0;
let armed = false;

/** Called by the router when the user asked for a different screen. */
export function screenChanging() {
  armed = true;
}

/**
 * Run a DOM update, animated if it is the paint of a screen change.
 * @param {() => void} update writes the new markup; must be synchronous
 */
export function paint(update) {
  const wanted = armed;
  armed = false;
  if (!wanted || !supported || stillness.matches) { update(); return; }
  // Counted, not a plain flag: starting a transition abandons any transition still running,
  // and that one's cleanup would otherwise strip the class off the transition replacing it -
  // which is exactly what happens when somebody clicks two tabs in a row.
  running++;
  document.documentElement.classList.add('vt-screen');
  const vt = document.startViewTransition(update);
  vt.finished.finally(() => {
    if (--running === 0) document.documentElement.classList.remove('vt-screen');
  });
}

/**
 * Open or close something that grew out of an element on the page: the two are named the
 * same for the length of the transition, so the browser moves one into the other instead of
 * crossfading them. A name may only be on one element at a time, hence the cleanup.
 *
 * @param {Element|null} from element the new thing comes out of (null just animates in)
 * @param {() => (Element|null|undefined)} update makes the change, returns what it landed on
 */
export function morph(from, update) {
  if (!supported || stillness.matches) { update(); return; }
  const NAME = 'morph-subject';
  if (from) from.style.viewTransitionName = NAME;
  let to = null;
  const vt = document.startViewTransition(() => {
    to = update() || null;
    if (from) from.style.viewTransitionName = '';
    if (to) to.style.viewTransitionName = NAME;
  });
  vt.finished.finally(() => {
    if (to) to.style.viewTransitionName = '';
    if (from) from.style.viewTransitionName = '';
  });
}
