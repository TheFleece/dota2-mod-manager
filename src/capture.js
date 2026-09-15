/**
 * Take a screenshot of the window, and try again when Chromium has no frame to hand over yet.
 *
 * Under xvfb on a CI runner, webContents.capturePage() now and then rejects with UnknownVizError:
 * the compositor has nothing to give at that moment. On 2026-09-15 that failed the Linux start
 * check on a pull request that had not touched the app, after seven green runs in a row. A
 * required check that fails at random for reasons outside the change gets rerun without being
 * read, and then it guards nothing. So a capture gets a few tries, and every failed try goes to
 * the log, which keeps a capture that never works exactly as visible as before.
 * @param {() => Promise<any>} capture  the call to make, usually () => win.webContents.capturePage()
 * @param {object} [opts]
 * @param {number} [opts.tries]  how many times to call it before giving up
 * @param {number} [opts.waitMs]  the pause between tries
 * @param {(msg: string) => void} [opts.log]  where each failed try is reported
 * @param {(ms: number) => Promise<void>} [opts.sleep]  the pause itself, replaceable in tests
 * @returns {Promise<any>} whatever the capture returned
 */
async function captureWithRetry(capture, {
  tries = 3,
  waitMs = 1500,
  log = () => {},
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  let last;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      return await capture();
    } catch (err) {
      last = err;
      log(`capture attempt ${attempt} of ${tries} failed: ${err && err.message ? err.message : err}`);
      if (attempt < tries) await sleep(waitMs);
    }
  }
  throw last;
}

module.exports = { captureWithRetry };
