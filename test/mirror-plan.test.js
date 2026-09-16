/* What the archive mirror decides to copy, apart from the bucket it copies into.
 *
 * On 2026-09-10 the mirror held 24 archives their authors had replaced: the sync skipped every
 * object already there under the same name. 2.6.5 had just started checking downloads against
 * the published checksum, so each of those copies was refused. tools/r2-sync.mjs runs only in
 * CI against the real bucket; these hold the two decisions it was missing.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { staleCopies, publishedHash, checkBody } = require('../tools/mirror-plan.js');

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const KRATOS = 'assets/files/heroes/Axe Kratos.zip';
const PREVIEW = 'assets/previews/heroes/axe.png';

test('a mod its author replaced is copied again, and one that did not change is left alone', () => {
  const present = [{ path: KRATOS }, { path: 'assets/files/heroes/Same.zip' }, { path: PREVIEW }];
  const have = new Map([[KRATOS, 28_000_000], ['assets/files/heroes/Same.zip', 5_000], [PREVIEW, 900]]);
  const upstream = new Map([[KRATOS, 31_500_000], ['assets/files/heroes/Same.zip', 5_000], [PREVIEW, 900]]);

  assert.deepEqual([...staleCopies(present, upstream, have)], [KRATOS]);
});

test('an object whose upstream size could not be read is not taken for a changed one', () => {
  /* The HEAD requests run sixteen at a time against GitHub. One that fails is a network error,
     and copying the object again on that evidence would spend the free tier's budget on noise. */
  const present = [{ path: KRATOS }];
  assert.equal(staleCopies(present, new Map(), new Map([[KRATOS, 28_000_000]])).size, 0);
});

test('the published hash is found under the key the catalog uses for it', () => {
  const published = {
    'heroes/Axe Kratos.zip': sha('current').toUpperCase(),
    'heroes/Broken.zip': 'not-a-hash',
    'terrains/Short.zip': 'abc123',
  };
  assert.equal(publishedHash(published, KRATOS), sha('current'), 'upper-case hex is the same hash');
  assert.equal(publishedHash(published, 'assets/files/heroes/Broken.zip'), null);
  assert.equal(publishedHash(published, 'assets/files/terrains/Short.zip'), null);
  assert.equal(publishedHash(published, 'assets/files/heroes/Unlisted.zip'), null);
  assert.equal(publishedHash(published, PREVIEW), null, 'a preview has no published hash');
});

test('bytes that do not match the published hash are not uploaded', () => {
  const want = sha('the file the author published');
  assert.deepEqual(checkBody(Buffer.from('the file the author published'), want), { ok: true, got: want });

  const stale = checkBody(Buffer.from('the file from August'), want);
  assert.equal(stale.ok, false);
  assert.equal(stale.got, sha('the file from August'), 'the log line names what the source hashed to');
});

test('with no published hash, a copy is still a copy', () => {
  assert.deepEqual(checkBody(Buffer.from('anything'), null), { ok: true, got: null });
});
