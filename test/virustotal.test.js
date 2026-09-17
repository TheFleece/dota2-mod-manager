/* The VirusTotal report that goes into a release's notes.
 *
 * Two false positives have reached users before anybody here knew there was anything to answer.
 * What was missing was a report to point at. The parts below are the ones that decide what the
 * notes say and whether the job goes red; the network half is thin on purpose.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../tools/virustotal.mjs');

const stats = (malicious, suspicious, harmless, undetected) => ({ malicious, suspicious, harmless, undetected });

test('the hashes come from the release\'s own SHA256SUMS, and only runnable files are checked', async () => {
  const { hashesFrom, RUNNABLE } = await load();
  const sums = [
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  Dota-2-Mod-Manager-Setup.exe',
    '5f70bf18a086007016e948b04aed3b82103a36bea41755b6cddfaf10ace3c6ef *Dota-2-Mod-Manager.AppImage',
    '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08  SHA256SUMS.intoto.jsonl',
    'not a line at all',
  ].join('\n');

  const all = hashesFrom(sums);
  assert.deepEqual(all.map((f) => f.name), ['Dota-2-Mod-Manager-Setup.exe', 'Dota-2-Mod-Manager.AppImage', 'SHA256SUMS.intoto.jsonl']);
  assert.equal(all[0].sha256, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.deepEqual(all.filter((f) => RUNNABLE.test(f.name)).map((f) => f.name),
    ['Dota-2-Mod-Manager-Setup.exe', 'Dota-2-Mod-Manager.AppImage'], 'a signature file is not something anybody runs');
});

test('a couple of engines calling an unsigned installer a trojan is not a red release', async () => {
  const { verdict, FLAG_AT } = await load();
  assert.equal(FLAG_AT >= 3, true, 'one engine is noise; the threshold is worth a morning');

  const quiet = verdict(stats(0, 0, 12, 60));
  assert.deepEqual([quiet.flagged, quiet.engines, quiet.red], [0, 72, false]);

  const usual = verdict(stats(2, 1, 10, 59));
  assert.deepEqual([usual.flagged, usual.engines, usual.red], [3, 72, false], 'two engines is the normal state of an unsigned installer');

  const loud = verdict(stats(9, 0, 5, 58));
  assert.equal(loud.red, true);
  assert.deepEqual(verdict(undefined), { malicious: 0, suspicious: 0, engines: 0, flagged: 0, red: false });
});

test('the report is a table with a link per file', async () => {
  const { reportSection } = await load();
  const section = reportSection([
    { name: 'Dota-2-Mod-Manager-Setup.exe', url: 'https://www.virustotal.com/gui/file/abc', flagged: 1, engines: 72 },
    { name: 'Dota-2-Mod-Manager.AppImage', url: null, flagged: 0, engines: 0 },
  ], new Date('2026-09-17T10:00:00Z'));

  assert.match(section, /### Checked with VirusTotal/);
  assert.match(section, /\| `Dota-2-Mod-Manager-Setup\.exe` \| 72 \| 1 of 72 \| \[open\]\(https:\/\/www\.virustotal\.com\/gui\/file\/abc\) \|/);
  assert.match(section, /not analysed yet/, 'a file VirusTotal has not finished with says so');
  assert.match(section, /Read on 2026-09-17/);
});

test('running it twice replaces the report instead of stacking two of them', async () => {
  const { reportSection, withReport, MARK } = await load();
  const notes = '### A technical release\r\n\r\nNothing in the window looks different.\r\n';
  const first = withReport(notes, reportSection([{ name: 'a.exe', url: 'u', flagged: 0, engines: 72 }]));
  const second = withReport(first, reportSection([{ name: 'a.exe', url: 'u', flagged: 2, engines: 72 }]));

  assert.equal(second.split(MARK).length, 2, 'one report, not two');
  assert.match(second, /2 of 72/);
  assert.equal(second.includes('0 of 72'), false);
  assert.ok(second.startsWith('### A technical release'), 'the release notes keep their own text');
  assert.ok(withReport('', reportSection([])).startsWith(MARK), 'notes that were empty start with the report, not with blank lines');
});
