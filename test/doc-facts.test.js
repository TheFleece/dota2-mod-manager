/* The sentences in the READMEs that are generated from the repository.
 *
 * "`package.json` lists exactly four" stayed in both READMEs for five days after eslint became the
 * fifth dependency. The sentence is now written by tools/gen-doc-facts.js, and this fails the moment
 * the README and the repository disagree.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const { render, apply, FILES } = require('../tools/gen-doc-facts.js');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

test('every facts block in the READMEs says what the repository says', () => {
  const facts = render(pkg);
  for (const rel of FILES) {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(apply(text, facts), text, `${rel} is out of date: run node tools/gen-doc-facts.js`);
  }
});

test('the dependency sentence is a generated block in both languages', () => {
  const en = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const ru = fs.readFileSync(path.join(ROOT, 'README.ru.md'), 'utf8');
  assert.match(en, /<!-- facts:deps-en -->/);
  assert.match(ru, /<!-- facts:deps-ru -->/);
  assert.doesNotMatch(en, /exactly four/, 'the typed sentence is back');
  assert.doesNotMatch(ru, /ровно четыре/, 'the typed sentence is back');
});

test('the sentence follows package.json, not the other way round', () => {
  const five = render({ dependencies: { 'adm-zip': '1', 'electron-updater': '1' }, devDependencies: { electron: '1', 'electron-builder': '1', eslint: '1' } });
  assert.equal(five['deps-en'], '`package.json` lists five: `adm-zip` and `electron-updater` ship inside the app, `electron`, `electron-builder` and `eslint` only build or check it.');
  const four = render({ dependencies: { 'adm-zip': '1', 'electron-updater': '1' }, devDependencies: { electron: '1', 'electron-builder': '1' } });
  assert.match(four['deps-en'], /lists four/);
  assert.match(four['deps-ru'], /их четыре/);
});
