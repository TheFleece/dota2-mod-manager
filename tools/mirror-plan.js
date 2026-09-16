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

module.exports = { staleCopies, publishedHash, checkBody };
