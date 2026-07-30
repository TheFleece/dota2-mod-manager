// VPK reader/writer. Everything the app knows about a mod comes through here: what it
// contains, which hero it touches, and the content fingerprint used to recognise a foreign
// file as a catalog mod. The writer is exercised against the reader, so a change that breaks
// the round trip fails here instead of producing paks the game silently ignores.
const test = require('node:test');
const assert = require('node:assert/strict');
const { crc32 } = require('node:zlib');

const vpk = require('../src/vpk.js');

/** One inline-data entry in the shape buildVpk() wants. */
function entry(relPath, body) {
  const data = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const norm = relPath.replace(/\\/g, '/').toLowerCase();
  const slash = norm.lastIndexOf('/');
  const file = slash === -1 ? norm : norm.slice(slash + 1);
  const dot = file.lastIndexOf('.');
  return {
    ext: dot === -1 ? ' ' : file.slice(dot + 1),
    folder: slash === -1 ? ' ' : norm.slice(0, slash),
    name: dot === -1 ? file : file.slice(0, dot),
    data,
    preload: Buffer.alloc(0),
    crc: crc32(data) >>> 0,
  };
}

const SAMPLE = [
  ['models/heroes/crystal_maiden/crystal_maiden.vmdl_c', 'base model'],
  ['models/items/crystal_maiden/cm_screeauk/cm_screeauk_head.vmdl_c', 'head piece'],
  ['materials/models/heroes/crystal_maiden/crystal_maiden.vmat_c', 'material'],
  ['particles/econ/items/crystal_maiden/frost_arcana.vpcf_c', 'particles'],
  ['scripts/items/items_game.txt', '"items_game" { }'],
];

const buildSample = () => vpk.buildVpk(SAMPLE.map(([p, b]) => entry(p, b)));

test('a built VPK reads back with every path intact', () => {
  const paths = vpk.listVpkPaths(buildSample());
  assert.deepEqual(paths.sort(), SAMPLE.map(([p]) => p).sort());
});

test('a built VPK reads back with every file byte for byte', () => {
  const buf = buildSample();
  const entries = vpk.readVpkEntries(buf);
  const byPath = new Map(entries.map((e) => [vpk.entryPath(e), e.data.toString()]));

  assert.equal(byPath.size, SAMPLE.length);
  for (const [p, body] of SAMPLE) assert.equal(byPath.get(p), body, p);
});

test('a file at the archive root survives the round trip', () => {
  const buf = vpk.buildVpk([entry('readme.txt', 'top level')]);
  assert.deepEqual(vpk.listVpkPaths(buf), ['readme.txt']);
  assert.equal(vpk.readVpkEntries(buf)[0].data.toString(), 'top level');
});

test('an empty file survives the round trip', () => {
  const buf = vpk.buildVpk([entry('materials/blank.vtex_c', '')]);
  assert.deepEqual(vpk.listVpkPaths(buf), ['materials/blank.vtex_c']);
  assert.equal(vpk.readVpkEntries(buf)[0].data.length, 0);
});

test('the recorded CRC is the CRC of the bytes', () => {
  const buf = buildSample();
  for (const e of vpk.listVpkEntries(buf)) {
    const [, body] = SAMPLE.find(([p]) => p === e.path);
    assert.equal(e.crc >>> 0, crc32(Buffer.from(body)) >>> 0, e.path);
  }
});

test('anything that is not a VPK is rejected rather than parsed', () => {
  assert.throws(() => vpk.listVpkPaths(Buffer.from('not a vpk at all')));
  assert.throws(() => vpk.listVpkPaths(Buffer.alloc(4)));
});

test('the fingerprint ignores packaging and depends only on content', () => {
  const forward = vpk.buildVpk(SAMPLE.map(([p, b]) => entry(p, b)));
  const reversed = vpk.buildVpk([...SAMPLE].reverse().map(([p, b]) => entry(p, b)));

  // Same files, different order inside the archive: the same mod, so the same fingerprint.
  assert.equal(vpk.fingerprintVpk(forward), vpk.fingerprintVpk(reversed));
});

test('the fingerprint changes when any file content changes', () => {
  const base = buildSample();
  const tweaked = vpk.buildVpk(
    SAMPLE.map(([p, b]) => entry(p, p.endsWith('.vmat_c') ? `${b} edited` : b))
  );

  assert.notEqual(vpk.fingerprintVpk(base), vpk.fingerprintVpk(tweaked));
});

test('loose-file fingerprints are order independent', () => {
  const files = [
    { path: 'cursor/arrow.ani', data: Buffer.from('a') },
    { path: 'cursor/hand.ani', data: Buffer.from('b') },
  ];
  assert.equal(vpk.fingerprintFiles(files), vpk.fingerprintFiles([...files].reverse()));
});

test('a base hero model is read as a base override, an item as a slot', () => {
  const analysis = vpk.analyzeVpkPaths(SAMPLE.map(([p]) => p));
  const cm = analysis.heroes.find((h) => h.id === 'crystal_maiden');

  assert.ok(cm, 'crystal_maiden should be recognised');
  assert.equal(cm.base, true, 'models/heroes/<hero>/<hero>.vmdl_c replaces the base model');
  assert.ok(cm.slots.length > 0, 'the item piece contributes a slot');
});

test('analysis of an empty path list says so instead of guessing a hero', () => {
  const analysis = vpk.analyzeVpkPaths([]);
  assert.deepEqual(analysis.heroes, []);
  assert.equal(analysis.pathCount, 0);
});

test('folders the game uses for non-hero content are not read as heroes', () => {
  // "models/heroes/announcer/..." and friends are content buckets, not heroes; treating them
  // as one would put an announcer pack under a hero name in the library.
  const analysis = vpk.analyzeVpkPaths([
    'models/heroes/announcer/announcer.vmdl_c',
    'models/heroes/terrain/terrain.vmdl_c',
  ]);
  assert.deepEqual(analysis.heroes.map((h) => h.id), []);
});
