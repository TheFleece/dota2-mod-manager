/* The radar's judgement, against fixtures shaped like what GitHub returns.
 *
 * Every case here is one of the things that sat unnoticed before 2026-09-15: pull requests left for
 * a week, CodeQL alerts nobody decided on, a weekly report that stopped, a token that expired, and
 * a security setting the documentation depended on that was switched off.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const load = () => import('../tools/radar.mjs');
const NOW = Date.parse('2026-09-22T06:30:00Z');
const ago = (hours) => new Date(NOW - hours * 3600000).toISOString();

test('cron expressions become the interval a silence is measured against', async () => {
  const { cronIntervalHours } = await load();
  assert.equal(cronIntervalHours('*/30 * * * *'), 0.5);
  assert.equal(cronIntervalHours('0 6 * * 1'), 168);
  assert.equal(cronIntervalHours('17 5 * * *'), 24);
  assert.equal(cronIntervalHours('0 */6 * * *'), 6);
  assert.equal(cronIntervalHours('0 3,15 * * *'), 12);
  assert.equal(cronIntervalHours('nonsense'), null);
});

test('every scheduled workflow in this repository gets an interval from its own file', async () => {
  const { schedulesFrom } = await load();
  const dir = path.join(ROOT, '.github', 'workflows');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.yml')).map((f) => ({ file: f, text: fs.readFileSync(path.join(dir, f), 'utf8') }));
  const scheduled = files.filter((f) => /cron:/.test(f.text)).map((f) => f.file).sort();
  const found = schedulesFrom(files);
  assert.deepEqual(found.map((s) => s.file).sort(), scheduled, 'a workflow with a cron line was not understood');
  for (const s of found) assert.ok(s.intervalHours > 0, `${s.file} has no interval`);
  assert.equal(found.find((s) => s.file === 'fingerprints.yml').intervalHours, 0.5);
  assert.equal(found.find((s) => s.file === 'seo.yml').intervalHours, 168);
});

test('an issue waits on the project until the project has the last word', async () => {
  const { waitingSince } = await load();
  const reporter = { author_association: 'NONE', created_at: ago(100), user: { login: 'player' } };
  assert.equal(waitingSince(reporter, []), reporter.created_at, 'an unanswered report waits from when it was opened');
  assert.equal(waitingSince(reporter, [{ author_association: 'OWNER', created_at: ago(50), user: { login: 'TheFleece' } }]), null);
  const reply = { author_association: 'NONE', created_at: ago(10), user: { login: 'player' } };
  assert.equal(waitingSince(reporter, [{ author_association: 'OWNER', created_at: ago(50), user: { login: 'TheFleece' } }, reply]), reply.created_at);
  const backlog = { author_association: 'OWNER', created_at: ago(500), user: { login: 'TheFleece' } };
  assert.equal(waitingSince(backlog, []), null, "the maintainer's own issue is backlog, not a question");
  const withBot = [{ author_association: 'NONE', created_at: ago(5), user: { login: 'github-actions[bot]' } }];
  assert.equal(waitingSince(reporter, withBot), reporter.created_at, 'a bot comment is not a reply');
});

test('the week of 2026-09-15, replayed: what the radar would have said', async () => {
  const { evaluate, renderIssue, renderDiscord, MARK } = await load();
  const data = {
    pulls: [
      { number: 16, title: 'deps: bump electron from 43.4.0 to 44.3.0', html_url: 'https://github.com/x/y/pull/16', created_at: ago(8 * 24), user: { login: 'dependabot[bot]' } },
      { number: 15, title: 'Verify Linux desktop MIME registration', html_url: 'https://github.com/x/y/pull/15', created_at: ago(6 * 24), user: { login: 'Omkar-git-hub' } },
      { number: 20, title: 'Work in progress', html_url: 'https://github.com/x/y/pull/20', created_at: ago(9 * 24), draft: true, user: { login: 'TheFleece' } },
    ],
    issues: [{ number: 26, title: 'Terrain does not install', html_url: 'https://github.com/x/y/issues/26', waitingSince: ago(80) }],
    codeScanning: [{ number: 85, rule: { id: 'js/http-to-file-access', severity: 'warning' }, html_url: 'https://github.com/x/y/security/code-scanning/85', created_at: ago(5 * 24), most_recent_instance: { location: { path: 'src/catalog.js' } } }],
    privateReporting: false,
    workflows: [
      { name: 'SEO report', state: 'active', intervalHours: 168, url: 'u', lastRun: { conclusion: 'success', created_at: ago(15 * 24), url: 'r' } },
      { name: 'Fingerprints', state: 'active', intervalHours: 0.5, url: 'u', lastRun: { conclusion: 'failure', created_at: ago(0.3), url: 'r' } },
      { name: 'Tests', state: 'active', intervalHours: null, url: 'u', lastRun: { conclusion: 'success', created_at: ago(2), url: 'r' } },
    ],
    credentials: {
      BOT_PUSH_TOKEN: { what: 'the catalog bot', kind: 'deploy-key', expires: '2026-09-23', rotate: 'regenerate' },
      MIRROR_PUSH_URL: { what: 'mirror', kind: 'project-token', expires: '2027-09-09', rotate: 'gitlab' },
      R2_ACCESS_KEY_ID: { what: 'r2', kind: 'api-key', expires: 'unknown', rotate: 'cloudflare' },
    },
    searchReportAt: ago(15 * 24),
    goodFirstIssues: 2,
    communityHealth: 85,
    decisionsReviewed: '2026-08-10',
    unreleased: { tag: 'v2.6.10', count: 4, oldest: ago(9 * 24) },
  };
  const r = evaluate(data, NOW);

  const overdue = r.overdue.map((x) => x.title);
  assert.ok(overdue.includes('PR #16: deps: bump electron from 43.4.0 to 44.3.0'));
  assert.ok(overdue.includes('PR #15: Verify Linux desktop MIME registration'));
  assert.ok(!overdue.some((t) => t.startsWith('PR #20')), 'a draft is not waiting on anyone');
  assert.ok(overdue.includes('Issue #26: Terrain does not install'), '80 hours is past the 72-hour promise');
  assert.ok(overdue.some((t) => t.startsWith('Code scanning #85')));
  assert.ok(overdue.includes('Private vulnerability reporting is switched off'));
  assert.ok(overdue.some((t) => /^SEO report has not run for 15 days/.test(t)));
  assert.ok(overdue.includes('Fingerprints failed on main'));
  assert.ok(overdue.includes('BOT_PUSH_TOKEN expires on 2026-09-23'), 'a day left is inside the alert window');
  assert.ok(overdue.some((t) => /weekly search report is 15 days old/.test(t)));

  const looks = r.look.map((x) => x.title);
  assert.ok(looks.includes('No expiry date recorded for 1 secret'));
  assert.ok(looks.includes('Only 2 good first issues open'));
  assert.ok(looks.includes('Community profile at 85%'));
  assert.ok(looks.includes('DECISIONS.md is due a read-through'));
  assert.ok(looks.includes('Unreleased work'));

  const body = renderIssue(r, NOW, {});
  assert.ok(body.startsWith(MARK));
  // two pull requests, the draft (listed, never overdue), the issue and the alert
  assert.match(body, /### Needs a decision \(5\)/);
  assert.match(body, /\*\*overdue\*\*/);

  const message = renderDiscord(r, { issueUrl: 'https://github.com/x/y/issues/1' });
  assert.ok(message.length <= 2000, `Discord caps a message at 2000 characters, this is ${message.length}`);
  assert.match(message, /^\*\*Radar: \d+ overdue\*\*/);
});

test('a quiet day sends nothing and says what is in order', async () => {
  const { evaluate, renderDiscord, renderIssue } = await load();
  const r = evaluate({
    pulls: [], issues: [], codeScanning: [], privateReporting: true,
    workflows: [{ name: 'SEO report', state: 'active', intervalHours: 168, url: 'u', lastRun: { conclusion: 'success', created_at: ago(24), url: 'r' } }],
    credentials: { MIRROR_PUSH_URL: { what: 'm', kind: 'project-token', expires: '2027-09-09', rotate: 'x' } },
    searchReportAt: ago(24), goodFirstIssues: 3, communityHealth: 100, decisionsReviewed: '2026-09-20',
  }, NOW);
  assert.equal(r.overdue.length, 0);
  assert.equal(renderDiscord(r, {}), null);
  const body = renderIssue(r, NOW, {});
  assert.match(body, /Private vulnerability reporting is on/);
  assert.match(body, /next is MIRROR_PUSH_URL on 2027-09-09/);
  assert.match(body, /_Nothing is waiting\._/);
});

test('a long overdue list still fits one Discord message', async () => {
  const { evaluate, renderDiscord } = await load();
  const pulls = Array.from({ length: 80 }, (_, i) => ({ number: i + 1, title: `A pull request with a fairly long title number ${i + 1}`, html_url: `https://github.com/x/y/pull/${i + 1}`, created_at: ago(200), user: { login: 'someone' } }));
  const message = renderDiscord(evaluate({ pulls }, NOW), { issueUrl: 'https://github.com/x/y/issues/1' });
  assert.ok(message.length <= 2000, `${message.length} characters`);
  assert.match(message, /and \d+ more on the issue/);
});

test('the response times the radar enforces are the ones the documents promise', async () => {
  const { POLICY } = await load();
  const contributing = fs.readFileSync(path.join(ROOT, 'CONTRIBUTING.md'), 'utf8');
  const security = fs.readFileSync(path.join(ROOT, 'SECURITY.md'), 'utf8');
  assert.match(contributing, /## Response times/, 'CONTRIBUTING.md has no "Response times" section for the radar to link to');
  assert.match(contributing, new RegExp(`within ${POLICY.responseHours} hours`), `CONTRIBUTING.md does not promise a reply within ${POLICY.responseHours} hours`);
  assert.match(contributing, new RegExp(`${POLICY.waitingDays} days`), `CONTRIBUTING.md does not say a pull request is flagged after ${POLICY.waitingDays} days`);
  assert.match(security, new RegExp(`within ${POLICY.securityHours} hours`), `SECURITY.md does not promise a reply within ${POLICY.securityHours} hours`);
});
