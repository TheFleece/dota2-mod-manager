// What tools/r2-sync.mjs decides about each object, apart from the network it runs against.
//
// On 2026-09-10 the bucket held 24 archives their authors had replaced, one since August. The
// sync skipped any object already there under the same name, while the comment at the top of it
// said the size was checked. Once 2.6.5 started measuring downloads against the published
// checksum, every one of those copies was refused. These are the two checks that were missing,
// in a form a test can hold (test/mirror-plan.test.js), since the script itself only runs in CI
// against the real bucket.
const crypto = require('crypto');

/**
 * Which objects in the bucket are a copy of something older.
 *
 * A HEAD request per object gives the size upstream serves now, and a replaced archive changes
 * size. An object whose upstream size is unknown (the HEAD failed) is left alone rather than
 * copied again: a network error is not evidence of a change.
 *
 * @param {Array<{path: string}>} present  wanted objects the bucket already has
 * @param {Map<string, number>} upstream   size upstream reports, by path
 * @param {Map<string, number>} have       size in the bucket, by path
 * @returns {Set<string>}
 */
function staleCopies(present, upstream, have) {
  return new Set(present
    .filter((item) => upstream.has(item.path) && upstream.get(item.path) !== have.get(item.path))
    .map((item) => item.path));
}

/**
 * The SHA-256 the catalog publishes for a mirrored archive, or null when it publishes none.
 *
 * `mod-hashes.json` is keyed `category/file`; the bucket keeps the same file under
 * `assets/files/category/file`. A value that is not 64 hex characters is treated as absent.
 *
 * @param {Record<string, unknown>} published  the parsed mod-hashes.json
 * @param {string} objectPath
 * @returns {string|null}
 */
function publishedHash(published, objectPath) {
  const m = /^assets\/files\/(.+?)\/([^/]+)$/.exec(objectPath);
  const value = m && published[`${m[1]}/${m[2]}`];
  return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value) ? value.toLowerCase() : null;
}

/**
 * Whether bytes fetched from the source are worth uploading. With no published hash the copy is
 * still a copy, only unverified; with one, a mismatch is refused, because the app would refuse
 * the same bytes after downloading all of them.
 *
 * @param {Buffer} body
 * @param {string|null} want
 * @returns {{ok: boolean, got: string|null}}
 */
function checkBody(body, want) {
  if (!want) return { ok: true, got: null };
  const got = crypto.createHash('sha256').update(body).digest('hex');
  return { ok: got === want, got };
}

/* ---------- the release mirror ---------- */

/** What an updater reads, and the binaries those files point at. */
const BINARIES = [
  ['Dota-2-Mod-Manager-Setup.exe', 'application/octet-stream'],
  ['Dota-2-Mod-Manager-Portable.exe', 'application/octet-stream'],
  ['Dota-2-Mod-Manager.AppImage', 'application/octet-stream'],
];

const UPDATES = 'updates/';
const BETA_FOLDER = `${UPDATES}beta/`;

/**
 * Where a release goes on the mirror and which files go with it.
 *
 * A beta lives in a folder of its own. The file names carry no version, so a beta uploaded beside
 * a release would sit where the stable installer sits while latest.yml still described the stable
 * one: every copy that cannot reach GitHub would fetch a build it was never offered and fail its
 * checksum. Its own folder costs another copy of the binaries and nothing else.
 *
 * A release writes both: its own files under updates/, and the same files again under
 * updates/beta/ with the feed named the way the beta channel reads it. Without that, a tester
 * whose GitHub is unreachable would sit on the beta after the release that replaced it.
 *
 * @param {string} version  2.7.0 or 2.7.0-beta.1
 * @returns {{beta: boolean, uploads: Array<{prefix: string, asset: string, name: string, type: string}>}}
 */
function releasePlan(version) {
  const beta = /-/.test(version);
  const yml = (feed) => [[`${feed}.yml`, 'text/yaml'], [`${feed}-linux.yml`, 'text/yaml'], ['portable.yml', 'text/yaml']];
  const at = (prefix, files, rename = {}) => files.concat(BINARIES)
    .map(([asset, type]) => ({ prefix, asset, name: rename[asset] || asset, type }));

  if (beta) return { beta, uploads: at(BETA_FOLDER, yml('beta')) };
  return {
    beta,
    uploads: [
      ...at(UPDATES, yml('latest')),
      // the release, named the way the beta channel reads it
      ...at(BETA_FOLDER, yml('latest'), { 'latest.yml': 'beta.yml', 'latest-linux.yml': 'beta-linux.yml' }),
    ],
  };
}

/**
 * Which of the objects already there this run is responsible for clearing out. A run only ever
 * touches its own folder, so a beta cannot delete the release everybody else updates from, and a
 * release cannot delete a beta it knows nothing about.
 * @param {string[]} keys      everything under updates/
 * @param {Set<string>} kept   keys this run uploaded
 * @param {boolean} beta
 */
function staleReleaseFiles(keys, kept, beta) {
  return keys.filter((key) => {
    if (kept.has(key)) return false;
    const inBeta = key.startsWith(BETA_FOLDER);
    // a release owns both folders: it publishes into each of them
    return beta ? inBeta : true;
  });
}

module.exports = {
  staleCopies, publishedHash, checkBody, releasePlan, staleReleaseFiles, UPDATES, BETA_FOLDER,
};
