// Walking the catalog, and the shape that cost a quarter of the mirror.
//
// mods.json keeps most categories as an array and five of them as { groups: [ { mods: [...] } ] }.
// tools/r2-sync.mjs walked the arrays and skipped everything else, so 313 mods of 1,336 were
// never copied to the bucket the app falls back to when GitHub is unreachable. Nobody saw it:
// the site and the fingerprint index each had their own copy of this knowledge and each was
// right, so every page and every fingerprint looked complete while a quarter of the catalog was
// uninstallable during an outage.
//
// One walker now, and these are the shapes it has to survive.
const test = require('node:test');
const assert = require('node:assert/strict');

const { iterMods, modsUnder } = require('../tools/catalog-mods.js');

const mod = (file) => ({ name: file.replace(/\.\w+$/, ''), file });
const files = (data, opts) => [...iterMods(data, opts)].map(({ categoryId, mod: m }) => `${categoryId}/${m.file}`);

test('a category that is a plain array gives up its mods', () => {
  assert.deepEqual(files({ heroes: [mod('A.zip'), mod('B.zip')] }), ['heroes/A.zip', 'heroes/B.zip']);
});

test('a category wrapped in groups gives up its mods too', () => {
  // the exact shape of hero-items, item-effects, creeps, creep-deny and towers
  const data = {
    'hero-items': {
      groups: [
        { id: 'abaddon', name: 'Abaddon', mods: [] },
        { id: 'alchemist', name: 'Alchemist', mods: [mod('Alchemist Radiance Blades.zip')] },
      ],
    },
  };
  assert.deepEqual(files(data), ['hero-items/Alchemist Radiance Blades.zip']);
});

test('both shapes in one catalog, which is what the real one is', () => {
  const data = {
    heroes: [mod('Hero.zip')],
    'item-effects': { groups: [{ id: 'x', mods: [mod('Effect.zip')] }] },
  };
  assert.deepEqual(files(data).sort(), ['heroes/Hero.zip', 'item-effects/Effect.zip']);
});

test('a shape nobody has seen yet is walked rather than skipped', () => {
  // The five grouped categories appeared without warning. The next rearrangement should cost
  // nothing, so this is a walk and not a list of the three shapes that exist today.
  const data = { odd: { by: { hero: { list: [{ deeper: [mod('Buried.zip')] }] } } } };
  assert.deepEqual(files(data), ['odd/Buried.zip']);
});

test('skipped categories are skipped', () => {
  const data = { heroes: [mod('A.zip')], tools: [mod('vpkedit.zip')], news: [mod('n.zip')] };
  assert.deepEqual(files(data, { skip: ['tools', 'news'] }), ['heroes/A.zip']);
});

test('scaffolding is not mistaken for a mod', () => {
  // group headers carry an id and a name and no file, and must not become entries of their own
  const data = { 'hero-items': { groups: [{ id: 'abaddon', name: 'Abaddon', mods: [] }] } };
  assert.deepEqual(files(data), []);
});

test('rubbish where a catalog should be gives nothing rather than throwing', () => {
  for (const bad of [null, undefined, 'a string', 42, []]) {
    assert.deepEqual([...iterMods(bad)], [], `${JSON.stringify(bad)} should walk to nothing`);
  }
  assert.deepEqual(modsUnder(null), []);
});

test('a mod is found by carrying a file, whatever else is around it', () => {
  const m = { name: 'X', file: 'X.zip', tags: { effects: true }, meta: { date: 1 } };
  assert.deepEqual(modsUnder({ groups: [{ mods: [m] }] }), [m]);
});
