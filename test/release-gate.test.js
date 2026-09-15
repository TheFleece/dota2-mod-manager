/* The gate in front of release.yml.
 *
 * 2.6.11 was built from a commit whose Tests run was red, because the release workflow never asked.
 * These pin the one decision the gate makes: given the check runs GitHub recorded for a commit,
 * may it be released yet, must it wait, or is it refused.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../tools/release-gate.mjs');
const REQUIRED = ['test', 'windows', 'Analyse JavaScript and TypeScript', 'Build the AppImage', 'Start it against the sandbox'];

const run = (name, conclusion, extra = {}) => ({
  id: extra.id || Math.floor(Math.random() * 1e6) + 10,
  name,
  status: conclusion ? 'completed' : 'in_progress',
  conclusion: conclusion || null,
  app: { slug: 'github-actions' },
  ...extra,
});

test('a commit whose required checks all passed may be released', async () => {
  const { evaluate } = await load();
  const r = evaluate(REQUIRED.map((n) => run(n, 'success')), REQUIRED);
  assert.equal(r.state, 'pass');
  assert.equal(r.passed.length, REQUIRED.length);
});

test('the 2.6.11 case: Tests failed on the tagged commit, so nothing is built', async () => {
  const { evaluate, describe } = await load();
  // What GitHub recorded for 13fb088: the Linux jobs and the site went green, Tests went red.
  const runs = [
    run('test', 'failure'),
    run('windows', 'success'),
    run('Analyse JavaScript and TypeScript', 'cancelled'),
    run('Build the AppImage', 'success'),
    run('Start it against the sandbox', 'success'),
    run('deploy', 'success'),
  ];
  const r = evaluate(runs, REQUIRED);
  assert.equal(r.state, 'fail');
  assert.deepEqual(r.failed, ['test (failure)', 'Analyse JavaScript and TypeScript (cancelled)']);
  assert.match(describe(r), /^fail\s+failed: test \(failure\)/);
});

test('a check still running, or not started yet, means wait rather than pass', async () => {
  const { evaluate } = await load();
  const running = evaluate([...REQUIRED.slice(1).map((n) => run(n, 'success')), run('test', null)], REQUIRED);
  assert.equal(running.state, 'wait');
  assert.deepEqual(running.pending, ['test']);

  const absent = evaluate(REQUIRED.slice(0, 3).map((n) => run(n, 'success')), REQUIRED);
  assert.equal(absent.state, 'wait');
  assert.deepEqual(absent.missing, ['Build the AppImage', 'Start it against the sandbox']);
});

test('a failure wins over anything still running', async () => {
  const { evaluate } = await load();
  const r = evaluate([run('test', 'failure'), run('windows', null)], REQUIRED);
  assert.equal(r.state, 'fail');
});

test('a re-run replaces the run before it', async () => {
  const { evaluate } = await load();
  const runs = [...REQUIRED.slice(1).map((n) => run(n, 'success')), run('test', 'failure', { id: 100 }), run('test', 'success', { id: 200 })];
  assert.equal(evaluate(runs, REQUIRED).state, 'pass');
  const reversed = [...REQUIRED.slice(1).map((n) => run(n, 'success')), run('test', 'success', { id: 100 }), run('test', 'failure', { id: 200 })];
  assert.equal(evaluate(reversed, REQUIRED).state, 'fail');
});

test('skipped is not passed, and another app cannot vouch for a check', async () => {
  const { evaluate } = await load();
  const skipped = evaluate(REQUIRED.map((n) => run(n, n === 'windows' ? 'skipped' : 'success')), REQUIRED);
  assert.equal(skipped.state, 'fail');

  const foreign = evaluate([...REQUIRED.slice(1).map((n) => run(n, 'success')), run('test', 'success', { app: { slug: 'some-other-app' } })], REQUIRED);
  assert.equal(foreign.state, 'wait');
  assert.deepEqual(foreign.missing, ['test']);
});

test('the release list is read from the file the ruleset follows', async () => {
  const { requiredChecks } = await load();
  const list = requiredChecks('release');
  assert.ok(list.includes('test') && list.includes('windows'), 'the suite on both platforms gates a release');
  const onlyOnPullRequests = new Set(requiredChecks('pullRequestOnly'));
  for (const name of requiredChecks('branch')) {
    if (onlyOnPullRequests.has(name)) continue;
    assert.ok(list.includes(name), `"${name}" is required to merge but not to release`);
  }
});
