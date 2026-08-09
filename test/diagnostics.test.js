/* The part of a support report that gets read.
 *
 * buildReport gathers; these two decide what it means and say it in words. A wrong verdict is
 * worse than no verdict - it sends whoever is helping down the wrong path - so the checks are
 * pinned here rather than eyeballed once when they were written.
 */
const test = require('node:test');
const assert = require('node:assert');
const { findProblems, renderSummary, renderDetailed } = require('../src/diagnostics');

// A report with nothing wrong with it, which each test then breaks in exactly one way.
const healthy = () => ({
  generatedAt: '2026-08-09T12:00:00.000Z',
  app: { version: '2.0.0', platform: 'win32 10.0.26200 x64', uiLang: 'ru' },
  settings: { langSuffix: 'russian' },
  dota: {
    path: 'C:/dota/game', pathValid: true,
    detectedLang: { suffix: 'russian' },
    langFolders: [{ suffix: 'russian', modFiles: 14 }],
    activeVoiceInstalled: true,
  },
  patchAndSchema: { patched: true, schemaNeeded: false, schemaApplied: true },
  mirrors: [{ host: 'raw.githubusercontent.com', failures: 0 }],
  library: { totalRecords: 14, enabled: 14, disabled: 0, packs: 0, presets: 1, fileOverlaps: 0, byCategory: { heroes: 11 } },
  catalogCache: {},
  caches: { downloadCacheBytes: 1024, iconCacheBytes: 0 },
  disk: { freeBytes: 40 * 1024 ** 3 },
  dotaRunning: false,
});

test('a healthy install produces no verdicts at all', () => {
  assert.deepStrictEqual(findProblems(healthy()), []);
});

test('no game path is broken, not a note', () => {
  const r = healthy();
  r.dota.path = null;
  r.dota.pathValid = false;
  const p = findProblems(r);
  assert.strictEqual(p.length, 1);
  assert.strictEqual(p[0].level, 'broken');
  assert.match(p[0].what, /not found/i);
});

test('installing into a folder the game does not mount is broken', () => {
  const r = healthy();
  r.dota.detectedLang.suffix = 'english';
  const p = findProblems(r).filter((x) => x.level === 'broken');
  assert.strictEqual(p.length, 1);
  assert.match(p[0].detail, /dota_english/);
  assert.match(p[0].detail, /dota_russian/);
});

test('an unpatched game is broken', () => {
  const r = healthy();
  r.patchAndSchema.patched = false;
  assert.ok(findProblems(r).some((x) => x.level === 'broken' && /not patched/i.test(x.what)));
});

test('mods left in another language folder are a note, not a failure', () => {
  const r = healthy();
  r.dota.langFolders.push({ suffix: 'english', modFiles: 3 });
  const p = findProblems(r);
  assert.strictEqual(p.length, 1);
  assert.strictEqual(p[0].level, 'note');
  assert.match(p[0].what, /dota_english/);
});

test('all mirrors down is broken; some down is a note', () => {
  const all = healthy();
  all.mirrors = [{ host: 'a', failures: 3 }, { host: 'b', failures: 5 }];
  assert.ok(findProblems(all).some((x) => x.level === 'broken' && /every download mirror/i.test(x.what)));

  const some = healthy();
  some.mirrors = [{ host: 'a', failures: 3 }, { host: 'b', failures: 0 }];
  const p = findProblems(some);
  assert.strictEqual(p.length, 1);
  assert.strictEqual(p[0].level, 'note');
});

test('a nearly full drive is broken', () => {
  const r = healthy();
  r.disk.freeBytes = 900 * 1024 ** 2;
  assert.ok(findProblems(r).some((x) => x.level === 'broken' && /free/i.test(x.what)));
});

test('the summary leads with the verdict and never prints JSON', () => {
  const ok = healthy();
  ok.problems = findProblems(ok);
  const clean = renderSummary(ok);
  assert.match(clean, /NOTHING LOOKS WRONG/);
  assert.ok(!clean.includes('{'), 'the short report is for a human, not a parser');

  const bad = healthy();
  bad.patchAndSchema.patched = false;
  bad.problems = findProblems(bad);
  const text = renderSummary(bad);
  assert.match(text, /BROKEN \(1\)/);
  assert.ok(text.indexOf('BROKEN') < text.indexOf('THE BASICS'), 'what is wrong comes first');
});

test('the detailed report carries every section and the mod list', () => {
  const r = healthy();
  r.installedMods = [{ i: 1, slot: 10, name: 'Gopo Pudge', categoryId: 'heroes', enabled: true }];
  r.problems = findProblems(r);
  const md = renderDetailed(r, { 'app.log': 'hello' });
  for (const heading of ['Verdicts', 'App and system', 'Settings', 'Dota', 'Library', 'Installed mods', 'Files in this archive']) {
    assert.ok(md.includes(`## ${heading}`), `missing section: ${heading}`);
  }
  assert.match(md, /Gopo Pudge/);
  assert.match(md, /app\.log/);
});

test('a mod name with a pipe cannot break the table it is printed in', () => {
  const r = healthy();
  r.installedMods = [{ i: 1, slot: 10, name: 'a | b', categoryId: 'heroes', enabled: true }];
  r.problems = [];
  const row = renderDetailed(r, {}).split('\n').find((l) => l.includes('a /'));
  assert.ok(row, 'the pipe should have been replaced');
  assert.strictEqual(row.split('|').length, 7, 'six columns plus the closing bar');
});
