/* What the VPK tree walkers do with a file somebody else wrote.
 *
 * The index of a mod is read straight off disk: src/installer.js scans the whole mod folder on
 * every start, src/minify.js reads another tool's files, and neither wraps the call. The walkers
 * checked the signature and then trusted the tree: each entry's 18 bytes were read with
 * readUInt32LE/readUInt16LE at whatever offset the tree said, and a truncated or forged record
 * came back as a Node RangeError - not a refusal this app makes, and not one the callers catch.
 *
 * Measured before the fix: of 60 truncations of a valid VPK, 6 threw RangeError, and a forged
 * preload length threw it too.
 *
 * The bar these tests hold: whatever the bytes are, a walker either parses them or refuses with
 * this project's own error, in bounded time. It never escapes with an error from Node's Buffer.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { crc32 } = require('zlib');

const {
  buildVpk, listVpkPaths, listVpkPathCrcs, listVpkEntries,
} = require('../src/vpk.js');

/** A small valid VPK with entries of different shapes, to cut up. */
function sample() {
  const file = (folder, name, ext, body) => {
    const data = Buffer.from(body);
    return { ext, folder, name, data, preload: Buffer.alloc(0), crc: crc32(data) >>> 0 };
  };
  return buildVpk([
    file('materials/models/heroes/wisp', 'wisp_color', 'vtex_c', 'colour bytes'),
    file('panorama/images/heroes', 'npc_dota_hero_wisp_png', 'vtex_c', 'portrait'),
    file(' ', 'root_file', 'txt', 'at the archive root'),
  ]);
}

/* Deterministic noise. A seeded generator rather than Math.random: a failure has to be the same
   failure tomorrow, and a test that fails once a fortnight gets deleted rather than read. */
function prng(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0x100000000;
  };
}

const WALKERS = [
  ['listVpkPaths', listVpkPaths],
  ['listVpkPathCrcs', listVpkPathCrcs],
  ['listVpkEntries', listVpkEntries],
];

/**
 * Run one walker over one buffer and say what came out.
 * @returns {{ ok: true } | { ok: false, why: string }}
 */
function attempt(fn, buf) {
  const started = Date.now();
  try {
    fn(buf);
  } catch (err) {
    // The app's own refusals are Error with a message it wrote. Anything else - RangeError from
    // a Buffer read, a TypeError from an undefined - is the app failing to refuse.
    const ours = err instanceof Error && !(err instanceof RangeError) && !(err instanceof TypeError)
      && /^VPK: /.test(String(err.message));
    if (!ours) return { ok: false, why: `${err.constructor.name}: ${String(err.message).slice(0, 80)}` };
  }
  const took = Date.now() - started;
  // Generous on purpose: this is a guard against a walk that never ends, not a speed measurement.
  if (took > 2000) return { ok: false, why: `took ${took}ms` };
  return { ok: true };
}

test('a valid VPK still reads, so refusing everything cannot pass these tests', () => {
  const buf = sample();
  assert.deepEqual(listVpkPaths(buf).sort(), [
    'materials/models/heroes/wisp/wisp_color.vtex_c',
    'panorama/images/heroes/npc_dota_hero_wisp_png.vtex_c',
    'root_file.txt',
  ]);
  assert.equal(listVpkPathCrcs(buf).size, 3);
  assert.equal(listVpkEntries(buf).length, 3);
});

test('every truncation of a valid VPK is refused, not crashed on', () => {
  const buf = sample();
  const bad = [];
  for (let cut = 12; cut < buf.length; cut++) {
    for (const [name, fn] of WALKERS) {
      const r = attempt(fn, buf.subarray(0, cut));
      if (!r.ok) bad.push(`${name} at ${cut} bytes: ${r.why}`);
    }
  }
  assert.deepEqual(bad.slice(0, 8), [], `${bad.length} truncation(s) escaped with something other than a VPK refusal`);
});

test('a forged entry record is refused, not crashed on', () => {
  // preloadBytes says 65535 in a file that has nothing like that left in it
  const buf = sample();
  const forged = Buffer.from(buf);
  forged.writeUInt16LE(0xffff, forged.length - 8);
  for (const [name, fn] of WALKERS) {
    const r = attempt(fn, forged);
    assert.ok(r.ok, `${name}: ${r.ok ? '' : r.why}`);
  }
});

test('seeded byte noise in the tree is refused, not crashed on', () => {
  const buf = sample();
  const random = prng(20260916);
  const bad = [];
  for (let i = 0; i < 400; i++) {
    const copy = Buffer.from(buf);
    // Only the tree, never the signature: a broken signature is already refused and tests nothing.
    const flips = 1 + Math.floor(random() * 3);
    for (let f = 0; f < flips; f++) {
      const at = 12 + Math.floor(random() * (copy.length - 12));
      copy[at] = Math.floor(random() * 256);
    }
    for (const [name, fn] of WALKERS) {
      const r = attempt(fn, copy);
      if (!r.ok) bad.push(`${name} on mutation ${i}: ${r.why}`);
    }
  }
  assert.deepEqual(bad.slice(0, 8), [], `${bad.length} mutation(s) escaped with something other than a VPK refusal`);
});
