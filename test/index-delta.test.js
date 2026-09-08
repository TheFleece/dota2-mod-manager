// The subject line the scheduled catalog run writes.
//
// Every commit that workflow has ever made says "Update mod fingerprints and hero pages", so
// a reader scrolling the history sees a quarter of it as one repeated sentence.
// tools/index-delta.js counts the difference between the committed index and the new one and
// names it. What it must never do is guess: a message claiming three new mods on a run that
// added none is worse than the sentence it replaced.
const test = require('node:test');
const assert = require('node:assert/strict');

const { deltaMessage, identities } = require('../tools/index-delta.js');

/** The shape gen-fingerprints.js writes: fingerprint -> the catalog entries sharing that file. */
const index = (mods, fonts = []) => ({
  count: Object.keys(mods).length,
  mods,
  fonts,
});

const mod = (name, categoryId = 'heroes', styleLabel = null) => ({ name, categoryId, styleLabel, type: 'vpk' });

test('a run that added mods says how many', () => {
  const before = index({ a: [mod('One')] });
  const after = index({ a: [mod('One')], b: [mod('Two')], c: [mod('Three')] });
  assert.equal(deltaMessage(before, after), 'Index 2 new mods from the catalog');
});

test('one mod is a mod, not 1 mods', () => {
  const before = index({ a: [mod('One')] });
  const after = index({ a: [mod('One')], b: [mod('Two')] });
  assert.equal(deltaMessage(before, after), 'Index 1 new mod from the catalog');
});

test('a mod that left the catalog is reported as a loss, not as nothing', () => {
  const before = index({ a: [mod('One')], b: [mod('Two')] });
  const after = index({ a: [mod('One')] });
  assert.equal(deltaMessage(before, after), 'Drop 1 mod the catalog no longer has');
});

test('a run that both gained and lost says both, because either alone would mislead', () => {
  const before = index({ a: [mod('One')], b: [mod('Two')] });
  const after = index({ a: [mod('One')], c: [mod('Three')], d: [mod('Four')] });
  assert.equal(deltaMessage(before, after), 'Index 2 new mods, drop 1 that left the catalog');
});

test('a re-uploaded archive changes the fingerprint but not the mods, and says so', () => {
  // same mod, new bytes: the key moves, the identity does not. Counting keys would have
  // called this one arrival and one departure.
  const before = index({ oldfp: [mod('One')] });
  const after = index({ newfp: [mod('One')] });
  assert.equal(deltaMessage(before, after), 'Refresh the catalog index');
});

test('two entries sharing one file count as two mods, not one', () => {
  const before = index({ a: [mod('GLaDOS')] });
  const after = index({ a: [mod('GLaDOS'), mod('Ru GLaDOS')] });
  assert.equal(deltaMessage(before, after), 'Index 1 new mod from the catalog');
});

test('a style of a mod already there is its own arrival', () => {
  const before = index({ a: [mod('Pudge')] });
  const after = index({ a: [mod('Pudge')], b: [mod('Pudge', 'heroes', 'Red')] });
  assert.equal(deltaMessage(before, after), 'Index 1 new mod from the catalog');
});

test('fonts are mods too - they live in their own list and were counted nowhere', () => {
  const before = index({ a: [mod('One')] });
  const after = index({ a: [mod('One')] }, [{ name: 'Monocraft', categoryId: 'fonts', styleLabel: null, files: {} }]);
  assert.equal(deltaMessage(before, after), 'Index 1 new mod from the catalog');
});

test('nothing to compare against says nothing, rather than calling the whole catalog new', () => {
  // `git show HEAD:fingerprints.json` failing must not produce "Index 1,308 new mods"
  assert.equal(deltaMessage(null, index({ a: [mod('One')] })), 'Refresh the catalog index');
  assert.equal(deltaMessage(null, null), 'Refresh the catalog index');
  assert.equal(deltaMessage(index({}), index({})), 'Refresh the catalog index');
});

test('an identity is category, name and style together', () => {
  const set = identities(index({ a: [mod('Pudge', 'heroes', 'Red')] }));
  assert.deepEqual([...set], ['heroes|Pudge|Red']);
});
