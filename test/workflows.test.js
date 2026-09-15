/* The workflows, held to the rules nobody should have to remember.
 *
 * Each of these was a real gap on 2026-09-15, found by reading the repository the way an outside
 * reviewer does: 33 of 33 actions referenced by a movable tag, 4 of 9 workflows with no statement of
 * what their token may do, a release workflow that built any tag whether or not its commit had
 * passed, a list of required checks written in a comment, and a personal token the catalog bot
 * pushed with that expired the same day. None of them needs a person to notice, so none of them is
 * left to one.
 *
 * The files are read as text rather than parsed: the tests and tools of this project use no
 * dependencies, and every rule below is about a line that is either there or not.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, '.github', 'workflows');
const workflows = fs.readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f)).sort();
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const json = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

test('there are workflows to check', () => {
  assert.ok(workflows.length >= 9, `found ${workflows.length} workflow files`);
});

test('every action is pinned to a full commit SHA, with its version beside it', () => {
  /* A tag like v7 can be moved to other code by whoever controls the action, and the next run
     executes it with this repository's secrets. A SHA cannot move. The comment keeps it readable
     and is what Dependabot updates the pin by. */
  const bad = [];
  for (const f of workflows) {
    read(f).split('\n').forEach((line, i) => {
      const m = /^\s*(?:-\s*)?uses:\s*([^\s#]+)\s*(#\s*(\S+))?/.exec(line);
      if (!m || m[1].startsWith('./') || m[1].startsWith('docker://')) return;
      if (!/@[0-9a-f]{40}$/.test(m[1])) bad.push(`${f}:${i + 1} ${m[1]} is not pinned to a commit`);
      else if (!m[3]) bad.push(`${f}:${i + 1} ${m[1]} has no "# vX" comment naming the version`);
    });
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});

test('every workflow says what its token may do', () => {
  /* Without a top-level permissions block the token gets whatever the repository default is, and
     the next step somebody adds inherits it. A job that needs more asks for it by itself. */
  const bad = workflows.filter((f) => !/^permissions:/m.test(read(f)));
  assert.deepEqual(bad, [], `no top-level permissions: ${bad.join(', ')}`);
});

test('every secret a workflow reads is in the registry, and the registry lists nothing unused', () => {
  const registry = json('.github/credentials.json').secrets;
  const used = new Map();
  for (const f of workflows) {
    for (const m of read(f).matchAll(/secrets\.([A-Z0-9_]+)/g)) {
      if (m[1] === 'GITHUB_TOKEN') continue;
      used.set(m[1], [...(used.get(m[1]) || []), f]);
    }
  }
  const unlisted = [...used.keys()].filter((name) => !registry[name]).map((name) => `${name} (${[...new Set(used.get(name))].join(', ')})`);
  const unused = Object.keys(registry).filter((name) => !used.has(name));
  assert.deepEqual(unlisted, [], `read by a workflow but missing from .github/credentials.json: ${unlisted.join(', ')}`);
  assert.deepEqual(unused, [], `listed in .github/credentials.json but no workflow reads it: ${unused.join(', ')}`);
});

test('the registry says what each secret is, when it expires and how to replace it', () => {
  const registry = json('.github/credentials.json').secrets;
  const bad = [];
  for (const [name, s] of Object.entries(registry)) {
    for (const field of ['what', 'kind', 'expires', 'rotate']) {
      if (typeof s[field] !== 'string' || !s[field].trim()) bad.push(`${name}: no ${field}`);
    }
    if (s.expires && !/^(never|unknown|\d{4}-\d{2}-\d{2})$/.test(s.expires)) bad.push(`${name}: expires "${s.expires}" is not a date, never or unknown`);
    /* The one kind that is refused. A personal token expires on a schedule nobody watches and can
       do anything the account can; the catalog bot's ran out on 2026-09-15. */
    if (/personal/i.test(s.kind) || /(^|_)PAT$|PERSONAL/.test(name)) bad.push(`${name}: personal access tokens are not used here, use a deploy key or the workflow token`);
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});

test('release.yml builds nothing before the gate says the commit passed', () => {
  const text = read('release.yml');
  const build = /\n {2}build:\n([\s\S]*?)(?=\n {2}[a-z][\w-]*:\n)/.exec(text);
  assert.ok(build, 'release.yml has no build job');
  assert.match(build[1], /(?:^|\n) {4}needs:\s*(\[\s*)?gate\b/, 'the build job does not wait for the gate');
  const gate = /\n {2}gate:\n([\s\S]*?)(?=\n {2}[a-z][\w-]*:\n)/.exec(text);
  assert.ok(gate, 'release.yml has no gate job');
  assert.match(gate[1], /node tools\/release-gate\.mjs/, 'the gate job does not run tools/release-gate.mjs');
  assert.match(gate[1], /checks:\s*read/, 'the gate cannot read check runs without checks: read');
});

test('every required check is a job that exists, under the name GitHub will show', () => {
  /* The ruleset waits for a check by name. Rename the job, or turn it into a matrix, and a merge
     waits for ever for a check that no longer exists; the comment in test.yml was the only thing
     that remembered this. */
  const names = new Set();
  for (const f of workflows) {
    const text = read(f);
    const jobs = text.split(/\njobs:\n/)[1] || '';
    for (const m of jobs.matchAll(/^ {2}([A-Za-z0-9_-]+):\s*$/gm)) names.add(m[1]);
    for (const m of jobs.matchAll(/^ {4}name:\s*['"]?(.+?)['"]?\s*$/gm)) names.add(m[1]);
  }
  const checks = json('.github/required-checks.json');
  const missing = [...new Set([...checks.branch, ...checks.release])].filter((n) => !names.has(n));
  assert.deepEqual(missing, [], `required but no job is called that: ${missing.join(', ')}`);
});

test('CI runs the same gate as a person and the commit hook', () => {
  const pkg = json('package.json');
  assert.ok(pkg.scripts.verify, 'package.json has no verify script');
  assert.match(pkg.scripts.verify, /lint/, 'npm run verify does not lint');
  assert.match(pkg.scripts.verify, /test:coverage/, 'npm run verify does not run the suite with its coverage floor');
  assert.match(read('test.yml'), /npm run verify/, 'test.yml runs its own list of steps instead of npm run verify');
});
