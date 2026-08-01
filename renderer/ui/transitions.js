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
 *
 * **Await it.** An animated paint hands the markup to the browser, which writes it a frame
 * later, so until this promise settles the page still shows the old screen. A screen that
 * goes looking for its own elements before then finds the ones it just replaced: its buttons
 * are wired to markup nobody can click, and a list that renders into a container by id
 * throws outright. Both went unnoticed for a while because a machine asking for reduced
 * motion sends every paint down the synchronous branch, and that was the machine we tested on.
 *
 * @param {() => void} update writes the new markup; must be synchronous
 * @returns {Promise<void>} settles once the markup is on the page
 */
export function paint(update) {
  const wanted = armed;
  armed = false;
  if (!wanted || !supported || stillness.matches) { update(); return Promise.resolve(); }
  // Counted, not a plain flag: starting a transition abandons any transition still running,
  // and that one's cleanup would otherwise strip the class off the transition replacing it -
  // which is exactly what happens when somebody clicks two tabs in a row.
  running++;
  document.documentElement.classList.add('vt-screen');
  const vt = document.startViewTransition(update);
  // an abandoned transition rejects; that is a normal end here, not a fault to report
  vt.finished.catch(() => {}).finally(() => {
    if (--running === 0) document.documentElement.classList.remove('vt-screen');
  });
  // the update, not the animation: the screen carries on as soon as its markup exists
  return vt.updateCallbackDone;
}

/* A mod's window used to grow out of the card it was clicked on, as one named box the
   browser moved and resized. It was one movement on paper and two on screen: the picture
   travelled across the window while the frame did something else, and no amount of matching
   the curves fixed the impression. The window now opens where windows open and the picture
   arrives inside it - plain CSS, see the top of modal.css for the clock. */
