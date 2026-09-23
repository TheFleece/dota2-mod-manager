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
/* A Windows checkout turns every newline into CRLF, and the rules below are written against a bare
   newline. Without this the Windows job failed on files that were fine, which is how the pull request
   adding these tests merged with that job red. */
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\r\n/g, '\n');
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

test('no workflow lets every job write: a job that needs to write asks for it itself', () => {
  /* OpenSSF Scorecard's first run on 2026-09-15 found two: codeql.yml gave security-events: write
     and fingerprints.yml gave contents: write to the whole workflow. Every job added to either file
     would have inherited it without anybody deciding so. */
  const bad = [];
  for (const f of workflows) {
    const m = /^permissions:([^\n]*)\n((?:[ \t]+[^\n]*\n|[ \t]*#[^\n]*\n)*)/m.exec(read(f));
    if (!m) continue;
    const inline = m[1].trim();
    if (inline && !/^(read-all|\{\s*\})$/.test(inline)) bad.push(`${f}: permissions: ${inline}`);
    for (const line of m[2].split('\n')) {
      if (/^\s+[\w-]+:\s*write\b/.test(line)) bad.push(`${f}: top-level ${line.trim()}`);
    }
  }
  assert.deepEqual(bad, [], bad.join('\n'));
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

test('every secret in the registry reaches the daily check, so none is reported missing while it is set', () => {
  /* VIRUSTOTAL_API_KEY was added to the registry and to tools/check-credentials.mjs, the secret was
     created, and the morning check still called it missing: radar.yml passes each secret into that
     step by hand, and this one had not been added to the list. A secret nobody hands over cannot
     be checked, and the radar says "not set" about a key that is set. */
  const step = read('radar.yml').split('run: node tools/check-credentials.mjs')[0];
  const env = step.slice(step.lastIndexOf('env:'));
  const registry = Object.keys(json('.github/credentials.json').secrets);
  const absent = registry.filter((name) => !env.includes(`${name}: \${{ secrets.${name} }}`));
  assert.deepEqual(absent, [], `listed in .github/credentials.json but not handed to check-credentials.mjs in radar.yml: ${absent.join(', ')}`);
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

test('release.yml shows a release to nobody until both builds on it installed a mod', () => {
  /* Until 2026-09-15 the release was public the moment it was created, and the update file, the
     mirror and the Discord post followed before anything had started the build that was going
     out. A draft is invisible to /releases/latest, so no installed copy can update to it. */
  const text = read('release.yml');
  const job = (name) => (new RegExp(`\\n {2}${name}:\\n([\\s\\S]*?)(?=\\n {2}[a-z][\\w-]*:\\n|$)`).exec(text) || [])[1] || '';
  const needs = (body) => {
    const m = /(?:^|\n) {4}needs:\s*(\[[^\]]*\]|[\w-]+)/.exec(body);
    return m ? m[1].replace(/[[\]\s]/g, '').split(',') : [];
  };
  assert.match(job('build'), /gh release create[^\n]*--draft/, 'the build job opens the release in public instead of as a draft');
  // electron-builder publishes a release it has to create itself, unless it is told to make a draft
  assert.equal((text.match(/EP_DRAFT: 'true'/g) || []).length, 2, 'an electron-builder step without EP_DRAFT can publish the release');
  // Every file is fingerprinted and signed for before anything tries it (2026-09-16).
  const checksums = job('checksums');
  assert.ok(checksums, 'release.yml has no checksums job');
  for (const n of ['build', 'linux']) assert.ok(needs(checksums).includes(n), `checksums does not wait for ${n} to put its files on the draft`);
  assert.match(checksums, /id-token: write/, 'checksums cannot sign without id-token: write');
  assert.match(checksums, /attestations: write/, 'checksums cannot store an attestation without attestations: write');
  assert.match(checksums, /actions\/attest-build-provenance@[0-9a-f]{40}[^\n]*\n\s+with:\n\s+subject-checksums: SHA256SUMS/, 'the provenance attestation does not cover every file in SHA256SUMS');
  assert.match(checksums, /gh release upload[^\n]*SHA256SUMS[^\n]*SHA256SUMS\.intoto\.jsonl/, 'SHA256SUMS and its signed bundle do not go on the release');
  for (const [name, after] of [['try-windows', 'build'], ['try-linux', 'linux']]) {
    const body = job(name);
    assert.ok(body, `release.yml has no ${name} job`);
    assert.match(body, /node tools\/e2e\.mjs --app /, `${name} does not click through the build it downloaded`);
    assert.ok(needs(body).includes(after), `${name} does not wait for ${after} to put its build on the draft`);
    assert.ok(needs(body).includes('checksums'), `${name} can try a file before it was fingerprinted`);
    assert.match(body, /not the one SHA256SUMS lists/, `${name} does not check its download against SHA256SUMS`);
  }
  const publish = job('publish');
  assert.ok(publish, 'release.yml has no publish job');
  for (const n of ['checksums', 'try-windows', 'try-linux']) assert.ok(needs(publish).includes(n), `publish does not wait for ${n}`);
  assert.match(publish, /-F draft=false/, 'the publish job does not take the release out of draft');
  for (const n of ['mirror-update', 'notify']) assert.ok(needs(job(n)).includes('publish'), `${n} can run before the release is public`);
  // the API call, not the words: comments and error messages above publish name the endpoint on purpose
  assert.ok(!/repos\/\$REPO\/releases\/latest/.test(text.split(/\n {2}publish:\n/)[0]), 'a job before publish asks /releases/latest, which cannot show a draft');
});

test('a beta tag is published as a prerelease, and never as the latest release', () => {
  /* Everybody on the stable channel follows /releases/latest. A beta that took that endpoint would
     be handed to every installed copy, which is the opposite of a beta. */
  const yml = read('release.yml');
  assert.match(yml, /\*-beta\.\*\) echo 'beta=true'/, 'nothing decides what a beta tag looks like');
  assert.match(yml, /-F prerelease=true -f make_latest=false/, 'a beta is published like a release');
  assert.match(yml, /beta\.yml beta-linux\.yml portable\.yml/, 'the beta feed is not checked after publishing');
  assert.match(yml, /is a beta - installed copies follow that endpoint/, 'nothing checks that the stable endpoint was left alone');
});

test('a beta reaches the mirror in its own folder, and is not announced', () => {
  /* A tester whose GitHub is down needs the second route as much as anybody. What a beta must
     never do is land beside the release: the file names carry no version, so it would replace the
     installer latest.yml describes. */
  const jobs = read('release.yml').split(/\n {2}(?=[a-z][\w-]*:\n)/);
  const mirror = jobs.find((j) => j.startsWith('mirror-update:')) || '';
  assert.ok(mirror, 'no mirror-update job');
  assert.equal(/needs\.gate\.outputs\.beta != 'true'/.test(mirror), false, 'a beta has no second route');
  assert.match(mirror, /Dota-2-Mod-Manager-Setup-beta\.exe/, 'the check does not know the beta carries its own names');
  assert.match(mirror, /WANT="latest\.yml latest-linux\.yml portable\.yml beta\.yml beta-linux\.yml/,
    'a release has to leave the beta feed pointing at itself');

  const notify = jobs.find((j) => j.startsWith('notify:')) || '';
  assert.match(notify, /needs\.gate\.outputs\.beta != 'true'/, 'a beta would be announced to everybody');
});

test('a release points the beta channel at itself, so a tester is not left behind it', () => {
  const jobs = read('release.yml').split(/\n {2}(?=[a-z][\w-]*:\n)/);
  const job = jobs.find((j) => j.startsWith('beta-feed:')) || '';
  assert.ok(job, 'no beta-feed job');
  assert.match(job, /needs\.gate\.outputs\.beta != 'true'/, 'a beta would republish itself as the beta feed');
  assert.match(job, /latest\.yml beta\.yml/);
  assert.match(job, /latest-linux\.yml beta-linux\.yml/, 'Linux testers would stay on the beta for ever');
});

test('RELEASING.md names every job release.yml runs', () => {
  /* The runbook gets read on the day a release went wrong, which is the worst day to find it
     describing a workflow that has changed since. */
  const jobs = [...(read('release.yml').split(/\njobs:\n/)[1] || '').matchAll(/^ {2}([a-z][\w-]*):\s*$/gm)].map((m) => m[1]);
  assert.ok(jobs.length >= 8, `found only ${jobs.length} jobs in release.yml`);
  const doc = fs.readFileSync(path.join(ROOT, 'RELEASING.md'), 'utf8');
  const missing = jobs.filter((j) => !doc.includes(`\`${j}\``));
  assert.deepEqual(missing, [], `RELEASING.md does not mention: ${missing.join(', ')}`);
});

test('a dependency update queues itself to merge only when it is minor or patch, and only through the checks', () => {
  /* Majors changed the runtime and the site generator under the project twice in a month
     (Electron 43 to 44, Astro 5 to 7), and the Astro one built green while the site came out
     broken. A merge that is not limited to minor and patch, or that skips the required checks,
     would put the next one straight into main. */
  const text = read('dependency-updates.yml');
  assert.match(text, /user\.login == 'dependabot\[bot\]'/, 'the policy does not check that Dependabot opened the pull request');
  assert.match(text, /github\.actor == 'dependabot\[bot\]'/, 'a person pushing to a Dependabot branch could set off the merge');
  const step = /\n {6}- name:[^\n]*\n((?: {8}[^\n]*\n)*? {8}run: gh pr merge[^\n]*)/.exec(text);
  assert.ok(step, 'no step merges the update');
  assert.match(step[1], /--auto\b/, 'the merge does not wait for the required checks');
  assert.ok(!/--admin/.test(step[1]), 'the merge goes around the required checks');
  const cond = /if: ([^\n]*)/.exec(step[1]);
  assert.ok(cond, 'the merge step runs for every update');
  assert.ok(/semver-minor/.test(cond[1]) && /semver-patch/.test(cond[1]) && !/semver-major|!=/.test(cond[1]),
    `the merge step is not limited to minor and patch updates: ${cond[1]}`);
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

test('the release asks for the antivirus check by name, because the event never comes', () => {
  /* virustotal.yml listens for `release: published`, and that event is never raised: the release
     is published by a workflow using GITHUB_TOKEN, and GitHub refuses to start workflows from
     events its own token created. On its first chance, 2.7.0, it did not run, and the changelog
     of that release said every release is scanned. */
  const release = read('release.yml');
  const publish = release.split(/^  publish:$/m)[1] || '';
  assert.match(publish, /gh workflow run virustotal\.yml -f tag="\$TAG"/,
    'publish does not start the antivirus check, and nothing else will');
  assert.match(publish, /permissions:[\s\S]{0,120}actions: write/,
    'starting another workflow needs actions: write');
  assert.match(read('virustotal.yml'), /workflow_dispatch:[\s\S]{0,200}tag:/,
    'virustotal.yml no longer takes the tag it is asked about');
});

