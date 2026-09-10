/* Dropping replaced objects out of the cache in front of the bucket.
 *
 * Writing a new object into R2 does not change what Cloudflare already handed somebody, and
 * .zip and .vpk are cached by default. On 2026-09-10 one of twenty-three refreshed archives
 * was still being served in its 28 August form more than an hour after the object under it had
 * changed - and before that day's fix, that copy was enough to stop the mod installing.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { purgeCache } = require('../tools/r2-client.js');

/** Stands in for the Cloudflare API and records what it was asked to drop. */
function api({ ok = true, errors = [] } = {}) {
  const calls = [];
  const real = global.fetch;
  global.fetch = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body), auth: opts.headers.authorization });
    return {
      ok,
      status: ok ? 200 : 403,
      json: async () => ({ success: ok, errors }),
    };
  };
  return { calls, restore: () => { global.fetch = real; } };
}

const env = { CLOUDFLARE_ZONE_ID: 'zone123', CLOUDFLARE_PURGE_TOKEN: 'tok' };
const quiet = () => {};

test('nothing to purge asks nobody anything', async (t) => {
  const cf = api();
  t.after(cf.restore);
  assert.deepEqual(await purgeCache([], { env, log: quiet }), { purged: 0 });
  assert.equal(cf.calls.length, 0);
});

test('the replaced urls go to the zone, once each', async (t) => {
  const cf = api();
  t.after(cf.restore);
  const urls = ['https://cdn.example/a.zip', 'https://cdn.example/b.vpk', 'https://cdn.example/a.zip'];

  const out = await purgeCache(urls, { env, log: quiet });

  assert.equal(out.purged, 2, 'the repeat is not sent twice');
  assert.equal(cf.calls.length, 1);
  assert.match(cf.calls[0].url, /zones\/zone123\/purge_cache$/);
  assert.equal(cf.calls[0].auth, 'Bearer tok');
  assert.deepEqual(cf.calls[0].body.files, ['https://cdn.example/a.zip', 'https://cdn.example/b.vpk']);
});

test('more than thirty go in batches, because that is the limit the API takes', async (t) => {
  const cf = api();
  t.after(cf.restore);
  const urls = Array.from({ length: 71 }, (_, i) => `https://cdn.example/${i}.zip`);

  const out = await purgeCache(urls, { env, log: quiet });

  assert.equal(out.purged, 71);
  assert.deepEqual(cf.calls.map((c) => c.body.files.length), [30, 30, 11]);
});

test('no credentials says so and does not pretend it purged anything', async (t) => {
  const cf = api();
  t.after(cf.restore);
  const said = [];

  const out = await purgeCache(['https://cdn.example/a.zip'], { env: {}, log: (m) => said.push(m) });

  assert.deepEqual(out, { purged: 0, skipped: 'no credentials' });
  assert.equal(cf.calls.length, 0, 'and it did not call the API without a token');
  assert.match(said.join(' '), /CLOUDFLARE_ZONE_ID/, 'the operator is told what is missing');
});

test('a refused purge is reported, not thrown', async (t) => {
  // the sync has already copied everything correctly at this point; a cache is not worth
  // turning a good run into a failed one
  const cf = api({ ok: false, errors: [{ message: 'Actor is not authorized' }] });
  t.after(cf.restore);
  const said = [];

  const out = await purgeCache(['https://cdn.example/a.zip'], { env, log: (m) => said.push(m) });

  assert.equal(out.purged, 0);
  assert.match(said.join(' '), /Actor is not authorized/);
});

test('the API throwing is reported, not thrown', async (t) => {
  const real = global.fetch;
  global.fetch = async () => { throw new Error('getaddrinfo ENOTFOUND'); };
  t.after(() => { global.fetch = real; });
  const said = [];

  const out = await purgeCache(['https://cdn.example/a.zip'], { env, log: (m) => said.push(m) });

  assert.equal(out.purged, 0);
  assert.match(said.join(' '), /ENOTFOUND/);
});
