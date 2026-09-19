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

// ---------- the release mirror ----------

test('a beta goes to a folder of its own, so it cannot sit where the stable installer sits', async () => {
  /* The file names carry no version. A beta uploaded beside the release would replace the
     installer latest.yml still describes, and every copy that cannot reach GitHub would fetch a
     build it was never offered and fail its checksum. */
  const { releasePlan } = require('../tools/mirror-plan.js');
  const beta = releasePlan('2.7.0-beta.1');

  assert.equal(beta.beta, true);
  assert.deepEqual(beta.uploads.map((u) => u.prefix + u.name), [
    'updates/beta/beta.yml',
    'updates/beta/beta-linux.yml',
    'updates/beta/portable.yml',
    'updates/beta/Dota-2-Mod-Manager-Setup.exe',
    'updates/beta/Dota-2-Mod-Manager-Portable.exe',
    'updates/beta/Dota-2-Mod-Manager.AppImage',
  ]);
  assert.equal(beta.uploads.every((u) => u.asset === u.name), true, 'a beta release carries the beta names already');
});

test('a release fills both folders, so a tester with no GitHub is not left on the beta', () => {
  const { releasePlan } = require('../tools/mirror-plan.js');
  const out = releasePlan('2.7.0');
  const at = (prefix) => out.uploads.filter((u) => u.prefix === prefix).map((u) => `${u.asset} -> ${u.name}`);

  assert.equal(out.beta, false);
  assert.deepEqual(at('updates/'), [
    'latest.yml -> latest.yml',
    'latest-linux.yml -> latest-linux.yml',
    'portable.yml -> portable.yml',
    'Dota-2-Mod-Manager-Setup.exe -> Dota-2-Mod-Manager-Setup.exe',
    'Dota-2-Mod-Manager-Portable.exe -> Dota-2-Mod-Manager-Portable.exe',
    'Dota-2-Mod-Manager.AppImage -> Dota-2-Mod-Manager.AppImage',
  ]);
  assert.deepEqual(at('updates/beta/').slice(0, 2), ['latest.yml -> beta.yml', 'latest-linux.yml -> beta-linux.yml'],
    "the release's own feed, under the name the beta channel reads");
  assert.equal(at('updates/beta/').length, 6, 'and the binaries it points at, or the feed leads nowhere');
});

test('clearing out the last version never reaches across the two folders', () => {
  const { staleReleaseFiles } = require('../tools/mirror-plan.js');
  const there = [
    'updates/latest.yml', 'updates/Dota-2-Mod-Manager-Setup.exe',
    'updates/beta/beta.yml', 'updates/beta/Dota-2-Mod-Manager-Setup.exe',
  ];

  const afterBeta = staleReleaseFiles(there, new Set(['updates/beta/beta.yml', 'updates/beta/Dota-2-Mod-Manager-Setup.exe']), true);
  assert.deepEqual(afterBeta, [], 'a beta leaves the release alone, whatever else is there');
  assert.deepEqual(
    staleReleaseFiles([...there, 'updates/beta/old.yml'], new Set(['updates/beta/beta.yml', 'updates/beta/Dota-2-Mod-Manager-Setup.exe']), true),
    ['updates/beta/old.yml'], 'and clears out only what the previous beta left',
  );

  const afterRelease = staleReleaseFiles(there, new Set(['updates/latest.yml', 'updates/beta/beta.yml']), false);
  assert.deepEqual(afterRelease, ['updates/Dota-2-Mod-Manager-Setup.exe', 'updates/beta/Dota-2-Mod-Manager-Setup.exe'],
    'a release owns both folders, because it publishes into both');
});
