/* The labels file, and the labels the project's own tools depend on. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const load = () => import('../tools/sync-labels.mjs');

test('every label has a unique name, a colour and a short description', async () => {
  const { desiredLabels } = await load();
  const labels = desiredLabels();
  const seen = new Set();
  for (const l of labels) {
    assert.ok(!seen.has(l.name.toLowerCase()), `${l.name} is listed twice`);
    seen.add(l.name.toLowerCase());
    assert.match(l.color, /^[0-9a-f]{6}$/i, `${l.name} has no six-digit colour`);
    assert.ok(l.description && l.description.length <= 100, `${l.name} needs a description of at most 100 characters (GitHub's limit)`);
  }
});

test('the labels the radar, the pull request rule, the issue forms and the workflows rely on exist', async () => {
  const { desiredLabels } = await load();
  const names = new Set(desiredLabels().map((l) => l.name));
  const { FIX_LABELS } = await import('../tools/pr-test-rule.mjs');
  const needed = new Set([...FIX_LABELS, 'good first issue']);
  for (const dir of ['.github/ISSUE_TEMPLATE']) {
    for (const f of fs.readdirSync(path.join(ROOT, dir)).filter((x) => /\.ya?ml$/.test(x))) {
      const m = /^labels:\s*\[([^\]]*)\]/m.exec(fs.readFileSync(path.join(ROOT, dir, f), 'utf8'));
      if (m) m[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean).forEach((l) => needed.add(l));
    }
  }
  // GitHub refuses `gh pr edit --add-label` for a label that does not exist, and the step fails
  const workflows = path.join(ROOT, '.github', 'workflows');
  for (const f of fs.readdirSync(workflows).filter((x) => /\.ya?ml$/.test(x))) {
    for (const m of fs.readFileSync(path.join(workflows, f), 'utf8').matchAll(/--add-label\s+(?:"([^"]+)"|'([^']+)'|([\w:-]+))/g)) {
      needed.add(m[1] || m[2] || m[3]);
    }
  }
  const missing = [...needed].filter((n) => !names.has(n));
  assert.deepEqual(missing, [], `used but not in .github/labels.json: ${missing.join(', ')}`);
});

test('syncing creates what is missing, updates what differs and deletes nothing', async () => {
  const { plan } = await load();
  const current = [
    { name: 'bug', color: 'd73a4a', description: 'Something does not work as it should' },
    { name: 'Enhancement', color: 'a2eeef', description: 'old words' },
    { name: 'something old', color: '000000', description: '' },
  ];
  const desired = [
    { name: 'bug', color: 'd73a4a', description: 'Something does not work as it should' },
    { name: 'enhancement', color: 'a2eeef', description: 'A new feature or an improvement' },
    { name: 'regression', color: 'b60205', description: 'Worked in an earlier release and stopped' },
  ];
  const r = plan(current, desired);
  assert.deepEqual(r.create.map((l) => l.name), ['regression']);
  assert.deepEqual(r.update.map((l) => [l.from, l.name]), [['Enhancement', 'enhancement']]);
  assert.deepEqual(r.extra, ['something old']);
});
