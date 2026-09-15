/* The clicks the documents tell people to make are clicks the app offers.
 *
 * CONTRIBUTING.md and the bug report form both sent people to "Help, then Diagnostics" for the
 * diagnostic archive. The app has no Help menu: the export is a button in Settings, under
 * Diagnostics. Every bug report that followed the form's own instructions started with a search
 * for a menu that does not exist.
 *
 * So a documented path is checked against the app. Each step has to be a label the window really
 * shows in English, which renderer/i18n.js holds as the English twin of the Russian original.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Every English label the window shows, from the dictionary it is drawn with. */
function englishLabels() {
  const text = read('renderer/i18n.js');
  const labels = new Set();
  // pairs, wherever they sit: short labels share a line ('Инструменты': 'Tools', 'Настройки': 'Settings')
  for (const m of text.matchAll(/'(?:[^'\\\n]|\\.)*':\s*'((?:[^'\\\n]|\\.)*)'/g)) labels.add(m[1].replace(/\\'/g, "'"));
  return labels;
}

/** Where people are told to go, in the files they read before asking for help. */
const PLACES = ['CONTRIBUTING.md', 'SUPPORT.md', ...fs.readdirSync(path.join(ROOT, '.github', 'ISSUE_TEMPLATE')).map((f) => `.github/ISSUE_TEMPLATE/${f}`)];

test('the documents send people to the diagnostic archive by a path that exists', () => {
  const labels = englishLabels();
  const wanted = ['Settings', 'Diagnostics', 'Export report'];
  for (const step of wanted) assert.ok(labels.has(step), `the app no longer shows "${step}"; update the path below and the documents`);

  const bad = [];
  for (const rel of PLACES) {
    if (!fs.existsSync(path.join(ROOT, rel))) continue;
    const text = read(rel);
    if (/\bhelp menu\b|\bHelp, then\b/i.test(text)) bad.push(`${rel} mentions a Help menu, which the app does not have`);
    for (const m of text.matchAll(/([A-Z][\w ]+), Diagnostics(?:, ([A-Z][\w ]+))?/g)) {
      const steps = [m[1].split(/[:.]\s*/).pop().trim(), 'Diagnostics', m[2] && m[2].trim()].filter(Boolean);
      for (const step of steps) if (!labels.has(step)) bad.push(`${rel}: "${m[0]}" names "${step}", which is not a label in the app`);
    }
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});
