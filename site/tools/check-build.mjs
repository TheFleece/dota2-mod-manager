#!/usr/bin/env node
/**
 * What a finished build has to contain, checked on the output instead of trusted.
 *
 * The build reads two things off the disk around it: the app's version from the repository's
 * package.json, and whether a page has its own link-preview card under public/og/. Both can go
 * wrong without an error. Astro 7 moved the build chunks those paths were worked out from, and
 * the site came out as version 0.0.0 with 32 pages wearing the front page's card. Every page still
 * built, and the whole difference was a handful of strings in 361 files. This fails the job.
 *
 * Run from site/ after `npm run build`. Reads dist/ only. This file runs under plain node rather
 * than inside a bundle, so its own import.meta.url is where it looks.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(site, 'dist');
const problems = [];

if (!fs.existsSync(dist)) {
  console.error('check-build: no dist/ folder. Run npm run build first.');
  process.exit(1);
}

const read = (rel) => {
  const file = path.join(dist, rel);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : null;
};

/* The version. The repository's package.json and nothing else: site/package.json says 0.0.0,
   which is exactly what a wrong path produces. */
const pkg = JSON.parse(fs.readFileSync(path.join(site, '..', 'package.json'), 'utf-8'));
if (pkg.name !== 'dota2-mod-manager') throw new Error('check-build: the folder above site/ is not the app repository');
const version = pkg.version;

const mustSay = [
  ['facts/index.html', version],
  ['ru/facts/index.html', version],
  ['llms.txt', version],
  ['index.html', `"softwareVersion":"${version}"`],
  ['ru/index.html', `"softwareVersion":"${version}"`],
  /* The privacy policy and the terms, which the Discord application links to. They are read out
     of docs/ at build time (src/lib/legal.ts), so a page here that lost its heading means that
     file changed shape. */
  ['privacy/index.html', '<h1>Privacy Policy</h1>'],
  ['ru/privacy/index.html', '<h1>Политика конфиденциальности</h1>'],
  ['terms/index.html', '<h1>Terms of Service</h1>'],
  ['ru/terms/index.html', '<h1>Условия использования</h1>'],
];
for (const [rel, text] of mustSay) {
  const body = read(rel);
  if (body === null) problems.push(`${rel} was not built`);
  else if (!body.includes(text)) problems.push(`${rel} does not say ${text}`);
}

/* The cards. Every card under public/og/ is drawn for a page, so every one of them has to be some
   page's og:image. A card nobody points at means a page fell back to the front page's. */
const cards = fs.readdirSync(path.join(site, 'public', 'og')).filter((f) => f.endsWith('.png'));
const used = new Set();
let pages = 0;
for (const rel of fs.readdirSync(dist, { recursive: true })) {
  if (!String(rel).endsWith('.html')) continue;
  pages++;
  const body = fs.readFileSync(path.join(dist, rel), 'utf-8');
  const m = /<meta property="og:image" content="[^"]*\/og\/([^"/]+\.png)"/.exec(body);
  if (m) used.add(m[1]);
}
const unused = cards.filter((c) => !used.has(c));
if (unused.length) {
  problems.push(`${unused.length} of ${cards.length} link-preview cards are no page's og:image: ${unused.slice(0, 8).join(', ')}${unused.length > 8 ? ', ...' : ''}`);
}

if (problems.length) {
  console.error(`check-build: ${problems.length} problem(s) in ${pages} pages`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`check-build: ${pages} pages, version ${version} where it belongs, ${used.size} of ${cards.length} cards in use`);
