/* The switch that can turn a feature off after a release.
 *
 * Small enough that it had lived as a helper inside another file, which is how the call to it
 * ended up in a third file with nothing behind it and two releases went out where no mod could
 * be installed. It has its own file now, so it gets its own test.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { createGate } = require('../src/feature-gate.js');

const gate = (feature, lang = 'ru') => createGate({
  remoteConfig: { feature: (name, l) => feature(name, l) },
  settings: { get: (k) => (k === 'uiLang' ? lang : null) },
});

test('a feature nobody switched off answers with nothing to say', () => {
  const blocked = gate(() => ({ off: false }));
  assert.equal(blocked('install'), null);
});

test('a feature switched off answers with the note it was switched off with', () => {
  const blocked = gate(() => ({ off: true, note: 'Installing is paused while the catalog moves' }));
  assert.deepEqual(blocked('install'), { error: 'Installing is paused while the catalog moves' });
});

test('switched off with nothing to say still says something', () => {
  // an empty note is the common case: the switch is flipped in a hurry and the text comes later
  const blocked = gate(() => ({ off: true }));
  const answer = blocked('cosmetics');
  assert.ok(answer && typeof answer.error === 'string' && answer.error.length > 0);
});

test('the switch is asked in the language the window is in', () => {
  const seen = [];
  const blocked = createGate({
    remoteConfig: { feature: (name, lang) => { seen.push([name, lang]); return { off: false }; } },
    settings: { get: () => 'ru' },
  });
  blocked('install');
  assert.deepEqual(seen, [['install', 'ru']]);
});

test('any language that is not Russian is asked for in English', () => {
  // the setting holds whatever was last written to it; the remote config knows two languages
  const seen = [];
  const blocked = createGate({
    remoteConfig: { feature: (name, lang) => { seen.push(lang); return { off: false }; } },
    settings: { get: () => 'de' },
  });
  blocked('install');
  assert.deepEqual(seen, ['en']);
});
