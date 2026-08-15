/**
 * Tell Bing and Yandex that pages changed, without waiting to be crawled.
 *
 * IndexNow is one endpoint both of them read (Google does not take part). You host a file
 * whose name is a key and whose contents are the same key, then POST a list of addresses
 * signed with it. That replaces the manual "submit URL" and "переобход страниц" forms, which
 * have daily quotas and have to be filled in by hand.
 *
 * Only what actually changed goes out. The first version announced every address every time,
 * with a note saying that would stop being reasonable once the site had hundreds of pages.
 * It has 358, and the nightly rebuild fires whether anything changed or not, so announcing
 * the lot would be a hundred thousand submissions a year for pages nobody touched. The
 * protocol's own guidance is to send what changed.
 *
 * How "changed" is decided: each address is hashed from the HTML that was just built, and the
 * hashes are kept in indexnow.state.json at the repository root - outside site/, so the commit
 * that saves it does not match the path filter that triggers a deploy. An address that is new,
 * or whose page hashes differently than last time, goes out. Everything else stays home.
 *
 * The hash covers the whole document, so a rebuild that only moves a number on the landing
 * announces the landing and nothing else, which is exactly right.
 *
 * Failure here never fails a deploy. The site is already live at this point, and a search
 * engine that did not get the nudge will find the pages the slow way.
 *
 * Usage: node tools/indexnow.mjs [--dry] [--all]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HOST = 'dota2modmanager.com';
const KEY = '0d68c3912b069fb327c07f6a3a5a073b';
const ENDPOINT = 'https://api.indexnow.org/IndexNow';

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '..', 'dist');
const sitemap = path.join(dist, 'sitemap-0.xml');
const statePath = path.resolve(here, '..', '..', 'indexnow.state.json');

const dry = process.argv.includes('--dry');
const all = process.argv.includes('--all');

/** Every address in the sitemap, with the file that answers it. */
function pages() {
  const xml = fs.readFileSync(sitemap, 'utf-8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => {
    const url = m[1];
    const rel = new URL(url).pathname.replace(/^\/+|\/+$/g, '');
    return { url, file: path.join(dist, rel, 'index.html') };
  });
}

function hashOf(file) {
  try {
    return crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 16);
  } catch {
    return null; // an address with no page behind it: announce it and let them decide
  }
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf-8')).pages ?? {};
  } catch {
    return {};
  }
}

try {
  const list = pages();
  if (!list.length) throw new Error('sitemap has no URLs');

  const was = all ? {} : loadState();
  const now = {};
  const changed = [];

  for (const { url, file } of list) {
    const hash = hashOf(file);
    now[url] = hash;
    if (hash === null || was[url] !== hash) changed.push(url);
  }

  const gone = Object.keys(was).filter((url) => !(url in now));
  const urlList = [...changed, ...gone];

  if (!urlList.length) {
    console.log(`indexnow: nothing changed across ${list.length} pages`);
    process.exit(0);
  }

  const first = Object.keys(was).length === 0;
  console.log(
    `indexnow: ${urlList.length} of ${list.length} pages to announce` +
      `${first ? ' (no previous state, so all of them)' : ''}` +
      `${gone.length ? `, ${gone.length} gone` : ''}`,
  );

  if (dry) {
    for (const u of urlList) console.log(`  ${u}`);
    process.exit(0);
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList }),
  });

  // 200 means taken, 202 means taken but the key has not been checked yet. Both are fine.
  if (res.ok) {
    console.log(`indexnow: announced (${res.status})`);
    // Saved only on success, so a refused call is retried next time rather than forgotten.
    fs.writeFileSync(statePath, JSON.stringify({ pages: now }, null, 0));
  } else {
    console.warn(`indexnow: refused with ${res.status} ${res.statusText}`);
  }
} catch (err) {
  console.warn(`indexnow: skipped (${err.message})`);
}
