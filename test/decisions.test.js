// DECISIONS.md, held to the repository it describes.
//
// That file answers reviews with numbers - how long main.js is, how many test files there are,
// what the app depends on - and its whole argument is that a claim with a check next to it beats
// a claim without one. A document like that going stale is worse than not having written it: the
// next reviewer runs one command, finds it disagrees, and stops trusting the rest.
//
// So the countable claims are asserted here. Every failure message carries the current value, so
// fixing one is copying a number across rather than going to find it.
//
// Deliberately not asserted: the "last gone over" date and the version beside it. Those record
// when a person read the whole file, and a test that kept them current would be forging a review
// nobody did. Same for the prose - no test can tell whether "the interval is not lowered" is
// still the decision.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const doc = fs.readFileSync(path.join(root, 'DECISIONS.md'), 'utf-8');

/** How many lines a file in the repository has, counted the way `wc -l` counts them. */
const lineCount = (file) => fs.readFileSync(path.join(root, file), 'utf-8').split('\n').length - 1;

test('the line count it gives for main.js is the line count main.js has', () => {
  const real = lineCount('main.js');
  const claimed = doc.match(/\|\s*([\d,]+) lines since 2026-09-06/);
  assert.ok(claimed, 'the corrections table no longer carries a line count for main.js');
  assert.equal(
    Number(claimed[1].replace(/,/g, '')),
    real,
    `DECISIONS.md says ${claimed[1]} lines, main.js has ${real.toLocaleString('en-US')}`,
  );
});

test('the number of test files it gives is the number of test files there are', () => {
  const real = fs.readdirSync(path.join(root, 'test')).filter((f) => f.endsWith('.test.js')).length;
  const claimed = doc.match(/\|\s*(\d+) of them, run on every push/);
  assert.ok(claimed, 'the corrections table no longer carries a test file count');
  assert.equal(Number(claimed[1]), real, `DECISIONS.md says ${claimed[1]} test files, test/ holds ${real}`);
});

test('the dependencies it names are the dependencies package.json declares', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
  const ships = Object.keys(pkg.dependencies ?? {});
  const builds = Object.keys(pkg.devDependencies ?? {});

  // The entry names all four and says which two of them reach a user's machine. A fifth arriving
  // without the paragraph changing is exactly the drift this catches.
  for (const name of [...ships, ...builds]) {
    assert.ok(doc.includes(`\`${name}\``), `DECISIONS.md does not mention the dependency ${name}`);
  }
  assert.equal(ships.length, 2, `the entry says the app ships two dependencies, package.json declares ${ships.length}`);
  assert.equal(builds.length, 2, `the entry says two more only build it, package.json declares ${builds.length}`);
});

test('the fingerprint index is still fetched from the path the entry says it cannot leave', () => {
  // The claim is that the file cannot move out of the repository root because installed copies
  // fetch it from main. If the URL ever changes, the entry becomes an argument for nothing.
  const { FP_URL } = require('../src/fingerprints.js');
  assert.match(FP_URL, /\/main\/fingerprints\.json$/, `src/fingerprints.js now fetches ${FP_URL}`);
  assert.ok(doc.includes('`FP_URL`'), 'the entry no longer points at the constant that proves it');
});

test('the eleven co-authored commits it describes are the eleven that are there', () => {
  // Counted from the history rather than remembered. If somebody does rewrite it one day, the
  // entry explaining why nobody did should fail rather than sit there being wrong.
  const { execFileSync } = require('child_process');
  let count;
  try {
    const out = execFileSync('git', ['log', '--grep=Co-Authored-By', '--format=%h'], { cwd: root, encoding: 'utf-8' });
    count = out.split('\n').filter(Boolean).length;
  } catch {
    return; // no git here (a tarball, or a shallow checkout): nothing to compare against
  }
  assert.equal(count, 11, `DECISIONS.md says eleven such commits, git finds ${count}`);
});

test('every entry offers a way to check it', () => {
  // The file's promise is one check per entry. A new entry added without one is the failure this
  // catches, because that entry is then just an assertion in a document full of evidence.
  const sections = doc.split(/^## /m).filter((s) => !s.startsWith('Claims that keep coming back'));
  for (const section of sections) {
    const entries = section.split(/^### /m).slice(1);
    for (const entry of entries) {
      const title = entry.split('\n')[0];
      assert.ok(/^\*Check:\*/m.test(entry) || /```/.test(entry), `no check under "${title}"`);
    }
  }
});

test('the corrections table gives a command for every claim it answers', () => {
  const table = doc.split('## Claims that keep coming back')[1] ?? '';
  const rows = table.split('\n').filter((l) => l.startsWith('| "'));
  assert.ok(rows.length >= 5, 'the corrections table lost most of its rows');
  for (const row of rows) {
    const cells = row.split('|').map((c) => c.trim());
    assert.ok(cells[3] && cells[3].length > 3, `no check in the row for ${cells[1]}`);
  }
});
