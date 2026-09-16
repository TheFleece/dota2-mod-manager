#!/usr/bin/env node
/**
 * The suite, with coverage that is allowed to get better and not worse.
 *
 * The floor used to be three numbers on the command line: lines 74, branches 76, functions 72.
 * An aggregate hides the thing worth catching. On 2026-09-16 the aggregate was 76.10% while
 * src/presets-service.js sat at 13.8% and src/installer.js at 48.5%, and a new module with no
 * tests at all moves the aggregate by a fraction of a point: well inside the slack, invisible.
 *
 * So the numbers are kept per file, and a run fails when a file drops more than half a point
 * below its line, or when a file that had coverage stops being measured at all. Better is always
 * fine and says so, asking for the baseline to be raised. The same shape as the type-error
 * ratchet in tools/typecheck.mjs, and the same rule: never lower a line to make a run pass.
 *
 * Platforms measure differently, which is why this is not one number for everybody. src/steam.js
 * asks which operating system it is on and takes a different half of itself on each, so the same
 * file honestly reports 53% on one and something else on the other; measured on 2026-09-10, Linux
 * read 75.2% of lines against Windows' 74.8%, and the two swapped places on branches.
 *
 * So the baseline says which platform it was measured on, and the per-file lines are enforced
 * there. Everywhere else the comparison is printed and the run passes, because a line measured on
 * one machine is not evidence about another. The aggregate floor is enforced everywhere: it sits
 * below both platforms on purpose, which makes it a floor rather than a fingerprint.
 *
 *   node tools/coverage.mjs            run the suite, then hold the line
 *   node tools/coverage.mjs --update   write what was measured as the new baseline
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(root, '.github', 'coverage-baseline.json');
/** Rounding noise, not a licence to slip: half a point is about one line in a 200-line file. */
const TOLERANCE = 0.5;
const SEP = String.fromCharCode(92);

/** hit/found as a percentage, where nothing to cover counts as covered. */
export function pct(hit, found) {
  return found > 0 ? (hit / found) * 100 : 100;
}

/**
 * lcov as node --test writes it, into per-file counts.
 * @param {string} text
 * @returns {{ files: Record<string, { lines: number[], functions: number[], branches: number[] }> }}
 */
export function parseLcov(text) {
  const files = {};
  let cur = null;
  for (const line of String(text).split(/\r?\n/)) {
    if (line.startsWith('SF:')) {
      // Windows writes the path with its own separator; the baseline is one spelling for both.
      const name = line.slice(3).split(SEP).join('/').replace(`${root.split(SEP).join('/')}/`, '');
      cur = { lines: [0, 0], functions: [0, 0], branches: [0, 0] };
      files[name] = cur;
    } else if (!cur) continue;
    else if (line.startsWith('LH:')) cur.lines[0] = Number(line.slice(3));
    else if (line.startsWith('LF:')) cur.lines[1] = Number(line.slice(3));
    else if (line.startsWith('FNH:')) cur.functions[0] = Number(line.slice(4));
    else if (line.startsWith('FNF:')) cur.functions[1] = Number(line.slice(4));
    else if (line.startsWith('BRH:')) cur.branches[0] = Number(line.slice(4));
    else if (line.startsWith('BRF:')) cur.branches[1] = Number(line.slice(4));
  }
  return { files };
}

/** The three aggregate percentages over every measured file. */
export function aggregate(files) {
  const sum = { lines: [0, 0], functions: [0, 0], branches: [0, 0] };
  for (const f of Object.values(files)) {
    for (const kind of ['lines', 'functions', 'branches']) {
      sum[kind][0] += f[kind][0];
      sum[kind][1] += f[kind][1];
    }
  }
  return {
    lines: pct(sum.lines[0], sum.lines[1]),
    functions: pct(sum.functions[0], sum.functions[1]),
    branches: pct(sum.branches[0], sum.branches[1]),
  };
}

/**
 * What changed against the baseline.
 * @param {object} baseline  the committed file
 * @param {{ files: object }} now  what this run measured
 * @param {{ perFile: boolean }} opts  per-file lines are only enforced where they were measured
 */
export function compare(baseline, now, { perFile = true } = {}) {
  const worse = [];
  const better = [];
  const gone = [];

  const nowAgg = aggregate(now.files);
  for (const kind of ['lines', 'functions', 'branches']) {
    const floor = (baseline.global || {})[kind];
    if (typeof floor !== 'number') continue;
    if (nowAgg[kind] + TOLERANCE < floor) {
      worse.push(`all files: ${kind} ${nowAgg[kind].toFixed(2)}%, floor ${floor.toFixed(2)}%`);
    } else if (nowAgg[kind] - TOLERANCE > floor) {
      better.push(`all files: ${kind} ${nowAgg[kind].toFixed(2)}%, was ${floor.toFixed(2)}%`);
    }
  }

  if (!perFile) return { worse, better, gone, aggregate: nowAgg };

  for (const [file, was] of Object.entries(baseline.files || {})) {
    const has = now.files[file];
    if (!has) { gone.push(`${file}: no longer measured, was ${was.lines.toFixed(1)}% of its lines`); continue; }
    const mine = pct(has.lines[0], has.lines[1]);
    if (mine + TOLERANCE < was.lines) worse.push(`${file}: ${mine.toFixed(1)}% of lines, floor ${was.lines.toFixed(1)}%`);
    else if (mine - TOLERANCE > was.lines) better.push(`${file}: ${mine.toFixed(1)}% of lines, was ${was.lines.toFixed(1)}%`);
  }
  return { worse, better, gone, aggregate: nowAgg };
}

/** The aggregate floor as it stands, or the one the command line carried before this tool. */
function readGlobalFloor() {
  try {
    return JSON.parse(fs.readFileSync(BASELINE, 'utf8')).global;
  } catch {
    return { lines: 74, branches: 76, functions: 72 };
  }
}

/**
 * Run the suite once, with the human report on screen and lcov into a file.
 *
 * A red suite is not this tool's failure to report: node has already printed which test failed, so
 * it says so in one line and lets the caller decide. `--update` still writes the baseline from a
 * red run, because the numbers are what they are and the first one has to be written somehow: this
 * file's own test asks for a baseline that does not exist yet.
 * @returns {{ files: object, suiteFailed: boolean }}
 */
function runSuite() {
  const out = path.join(os.tmpdir(), `d2mm-coverage-${process.pid}.lcov`);
  const args = [
    '--test', '--experimental-test-coverage',
    '--test-reporter=spec', '--test-reporter-destination=stdout',
    '--test-reporter=lcov', `--test-reporter-destination=${out}`,
    'test/**/*.test.js',
  ];
  let suiteFailed = false;
  try {
    execFileSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  } catch {
    suiteFailed = true;
  }
  let text = '';
  try {
    text = fs.readFileSync(out, 'utf8');
  } catch {
    console.error('the suite wrote no coverage at all, so there is nothing to measure');
    process.exit(1);
  }
  fs.rmSync(out, { force: true });
  return { ...parseLcov(text), suiteFailed };
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const now = runSuite();

  if (process.argv.includes('--update')) {
    const agg = aggregate(now.files);
    const files = {};
    for (const name of Object.keys(now.files).sort()) {
      files[name] = { lines: Number(pct(...now.files[name].lines).toFixed(1)) };
    }
    fs.writeFileSync(BASELINE, `${JSON.stringify({
      _why: 'How much of each file the suite covers, and the aggregate floor. tools/coverage.mjs '
        + 'refuses a run where a file drops more than half a point below its line, or where a measured '
        + 'file stops being measured. The per-file lines hold on the platform named below, because the '
        + 'two platforms measure differently; the aggregate floor holds everywhere and sits under both. '
        + 'Raise a line by writing tests and running: node tools/coverage.mjs --update. Never lower one '
        + 'to make a run pass.',
      measured: new Date().toISOString().slice(0, 10),
      platform: process.platform,
      // The floor does not move because somebody re-measured: it moves when somebody decides to
      // move it. On the first run it is the three numbers the command line used to carry.
      global: readGlobalFloor(),
      files,
    }, null, 2)}\n`);
    console.log(`\nbaseline written: ${Object.keys(files).length} files, lines ${agg.lines.toFixed(2)}%`);
    if (now.suiteFailed) console.log('the suite was red while this was measured: read what failed above');
    process.exit(0);
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  // A line measured on one machine is not evidence about another, so the per-file half runs only
  // where the baseline says it was measured. Everywhere else this prints and the aggregate holds.
  const measuredHere = process.platform === baseline.platform;
  const { worse, better, gone, aggregate: agg } = compare(baseline, now, { perFile: measuredHere });

  for (const line of better) console.log(`better  ${line}`);
  for (const line of gone) console.log(`GONE    ${line}`);
  for (const line of worse) console.log(`WORSE   ${line}`);

  console.log(`\ncoverage: lines ${agg.lines.toFixed(2)}%, branches ${agg.branches.toFixed(2)}%, functions ${agg.functions.toFixed(2)}%`
    + `${measuredHere ? '' : ` (per-file lines were measured on ${baseline.platform}; this is ${process.platform}, so they are printed, not held)`}`);

  if (now.suiteFailed) {
    console.error('\nthe suite failed; coverage is beside the point until it passes');
    process.exit(1);
  }
  if (worse.length || gone.length) {
    console.error(`\ncoverage fell in ${worse.length + gone.length} place(s). Write the test, do not lower the line.`);
    process.exit(1);
  }
  if (better.length) console.log('Better than the baseline. Lock it in: node tools/coverage.mjs --update');
}
