#!/usr/bin/env node
/**
 * Throw broken files at the parsers that read other people's files, for as long as you like.
 *
 * test/vpk-fuzz.test.js runs a few hundred cases on every push, which is the right size for a
 * gate. This is the same generator with the brakes off: give it a seed and a number of iterations
 * and leave it running. Anything that escapes as a Node error rather than one of this project's
 * own refusals, or that takes longer than the budget, is written to fuzz-output/ with the seed
 * that produced it, so it can be replayed exactly.
 *
 *   node tools/fuzz-parsers.mjs                        20000 cases from a random seed
 *   node tools/fuzz-parsers.mjs --seed 20260916        the same cases every time
 *   node tools/fuzz-parsers.mjs --iterations 500000    a long run
 *
 * Exit code 1 means it found something. The file it wrote is the test case; add it to
 * test/vpk-fuzz.test.js before fixing the parser, so the fix has proof.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'fuzz-output');

const { buildVpk, listVpkPaths, listVpkPathCrcs, listVpkEntries } = require('../src/vpk.js');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : fallback;
};

const SEED = arg('--seed', (Date.now() ^ (process.pid << 16)) >>> 0);
const ITERATIONS = arg('--iterations', 20000);
const BUDGET_MS = arg('--budget', 2000);

/** The same xorshift the test uses, so a seed means the same bytes in both places. */
function prng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0x100000000;
  };
}

function sample() {
  const file = (folder, name, ext, body) => {
    const data = Buffer.from(body);
    return { ext, folder, name, data, preload: Buffer.alloc(0), crc: crc32(data) >>> 0 };
  };
  return buildVpk([
    file('materials/models/heroes/wisp', 'wisp_color', 'vtex_c', 'colour bytes'),
    file('panorama/images/heroes', 'npc_dota_hero_wisp_png', 'vtex_c', 'portrait'),
    file(' ', 'root_file', 'txt', 'at the archive root'),
  ]);
}

const WALKERS = [
  ['listVpkPaths', listVpkPaths],
  ['listVpkPathCrcs', listVpkPathCrcs],
  ['listVpkEntries', listVpkEntries],
];

/** @returns {string|null} why this input is a finding, or null if the parser behaved */
function check(fn, buf) {
  const started = Date.now();
  try {
    fn(buf);
  } catch (err) {
    const ours = err instanceof Error && !(err instanceof RangeError) && !(err instanceof TypeError)
      && /^VPK: /.test(String(err.message));
    if (!ours) return `${err.constructor.name}: ${String(err.message).slice(0, 120)}`;
  }
  const took = Date.now() - started;
  return took > BUDGET_MS ? `took ${took}ms` : null;
}

/** One mutated copy: some bytes flipped, sometimes cut short. */
function mutate(base, random) {
  let buf = Buffer.from(base);
  if (random() < 0.35) buf = buf.subarray(0, 12 + Math.floor(random() * (buf.length - 12)));
  const flips = 1 + Math.floor(random() * 4);
  for (let f = 0; f < flips && buf.length > 12; f++) {
    const at = 12 + Math.floor(random() * (buf.length - 12));
    buf[at] = Math.floor(random() * 256);
  }
  return buf;
}

const random = prng(SEED);
const base = sample();
const findings = [];
console.log(`seed ${SEED}, ${ITERATIONS} iterations, budget ${BUDGET_MS}ms per call`);

for (let i = 0; i < ITERATIONS; i++) {
  const buf = mutate(base, random);
  for (const [name, fn] of WALKERS) {
    const why = check(fn, buf);
    if (!why) continue;
    fs.mkdirSync(OUT, { recursive: true });
    const file = path.join(OUT, `${name}-seed${SEED}-${i}.vpk`);
    fs.writeFileSync(file, buf);
    findings.push(`${name} on iteration ${i}: ${why} (${path.relative(root, file)})`);
  }
  if (findings.length >= 20) break;
}

for (const line of findings) console.log(`FOUND  ${line}`);
console.log(findings.length
  ? `\n${findings.length} finding(s). Add one to test/vpk-fuzz.test.js, then fix the parser.`
  : `no findings in ${ITERATIONS} iterations`);
process.exitCode = findings.length ? 1 : 0;
