// An English user must never meet a Russian string.
//
// Russian is the source language here: the text in the code is the key, and English is looked
// up from it. A key with no English entry falls back to Russian and nothing crashes, which is
// exactly why it survives review - the app works, it just speaks the wrong language in one
// dialog. tools/check-i18n.js reads every call site and every dictionary and finds those, and
// this test is what makes it run on a pull request instead of on somebody's memory.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');

test('every Russian string has an English twin', () => {
  const script = path.join(__dirname, '..', 'tools', 'check-i18n.js');
  const run = spawnSync(process.execPath, [script], { encoding: 'utf8' });

  // The checker prints the file, the line and the string for each gap, so its own output is
  // the failure message. Repeating it here in a nicer shape would only lose the line numbers.
  assert.equal(run.status, 0, `\n${run.stdout}${run.stderr}`);
});
