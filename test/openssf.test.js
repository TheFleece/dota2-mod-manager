/* The answers this project proposes for its OpenSSF Best Practices badge.
 *
 * `.bestpractices.json` is read by bestpractices.dev out of this repository and offered in the
 * form for the maintainer to accept, so it is a public claim about how this project is run. A
 * claim that names a file which no longer exists, or a number nothing measures any more, is worse
 * than an unanswered question. These hold it to the repository as it is.
 *
 * docs/openssf-answers.md is the same answers in prose, for reading; the two must name the same
 * criteria or one of them is out of date.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const answers = JSON.parse(fs.readFileSync(path.join(ROOT, '.bestpractices.json'), 'utf8'));
const doc = fs.readFileSync(path.join(ROOT, 'docs', 'openssf-answers.md'), 'utf8');

const criteria = [...new Set(Object.keys(answers).map((k) => k.replace(/_(status|justification)$/, '')))];
const statusOf = (id) => answers[`${id}_status`];
const why = (id) => answers[`${id}_justification`] || '';

test('every criterion carries both a status and the reason for it', () => {
  assert.equal(criteria.length, 67, 'the passing level has 67 criteria; one was added or dropped here');
  const wrong = [];
  for (const id of criteria) {
    if (!['Met', 'Unmet', 'N/A'].includes(statusOf(id))) wrong.push(`${id}: status "${statusOf(id)}"`);
    if (why(id).trim().length < 12) wrong.push(`${id}: no reason worth reading`);
  }
  assert.deepEqual(wrong, []);
});

test('nothing is claimed under a name the badge does not use', () => {
  /* The site keys every field as <criterion>_status and <criterion>_justification. A typo in an id
     is silently ignored there, which would leave a question unanswered while this file looks full. */
  const stray = Object.keys(answers).filter((k) => !/_(status|justification)$/.test(k));
  assert.deepEqual(stray, [], `not a badge field: ${stray.join(', ')}`);
  const odd = criteria.filter((id) => !/^[a-z][a-z0-9_]*$/.test(id));
  assert.deepEqual(odd, [], `not a criterion id: ${odd.join(', ')}`);
});

test('every file a reason names is in the repository', () => {
  /* The justifications point at CONTRIBUTING.md, the workflows, the credential registry and the
     rest. A reason that links a file somebody deleted is a claim about a guard that is gone. */
  const missing = [];
  for (const id of criteria) {
    for (const m of why(id).matchAll(/blob\/main\/([^\s)]+)/g)) {
      const file = m[1].replace(/[.,]$/, '');
      if (!fs.existsSync(path.join(ROOT, file))) missing.push(`${id}: ${file}`);
    }
    for (const m of why(id).matchAll(/tree\/main\/([^\s)]+)/g)) {
      const dir = m[1].replace(/[.,]$/, '');
      if (!fs.existsSync(path.join(ROOT, dir))) missing.push(`${id}: ${dir}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('the prose and the machine-readable answers cover the same criteria', () => {
  const inDoc = new Set([...doc.matchAll(/^\| `([a-z][a-z0-9_]*)` \|/gm)].map((m) => m[1]));
  const onlyDoc = [...inDoc].filter((id) => !criteria.includes(id));
  const onlyJson = criteria.filter((id) => !inDoc.has(id));
  assert.deepEqual(onlyDoc, [], `in docs/openssf-answers.md but not in .bestpractices.json: ${onlyDoc.join(', ')}`);
  assert.deepEqual(onlyJson, [], `in .bestpractices.json but not in docs/openssf-answers.md: ${onlyJson.join(', ')}`);
});

test('the counted claims match what the repository counts', () => {
  /* Two numbers in the answers are measured elsewhere in this repository, and both have gone stale
     in documents before: the number of test files and the coverage the ratchet holds. */
  const files = fs.readdirSync(path.join(ROOT, 'test')).filter((f) => f.endsWith('.test.js')).length;
  const said = /(\d+) test files on node:test/.exec(why('test'));
  assert.ok(said, 'the test criterion stopped saying how many test files there are');
  assert.equal(Number(said[1]), files, 'the number of test files in the answer is not the number there are');

  const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, '.github', 'coverage-baseline.json'), 'utf8'));
  const floor = /floor of (\d+)% of lines/.exec(why('test_most'));
  assert.ok(floor, 'the coverage criterion stopped naming the floor the gate holds');
  assert.equal(Number(floor[1]), baseline.global.lines,
    'the floor in the answer is not the floor in .github/coverage-baseline.json');
});
