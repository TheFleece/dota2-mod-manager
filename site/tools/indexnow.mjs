/**
 * Tell Bing and Yandex that pages changed, without waiting to be crawled.
 *
 * IndexNow is one endpoint both of them read (Google does not take part). You host a file
 * whose name is a key and whose contents are the same key, then POST a list of addresses
 * signed with it. That replaces the manual "submit URL" and "переобход страниц" forms, which
 * have daily quotas and have to be filled in by hand.
 *
 * The list comes from the sitemap we just built rather than from a hardcoded array, so a page
 * added to the site is a page that gets announced. Announcing all fourteen every time is
 * within the protocol's limits and simpler than tracking what actually changed; if this site
 * ever has hundreds of pages, that stops being true and this has to diff instead.
 *
 * Failure here never fails a deploy. The site is already live at this point, and a search
 * engine that did not get the nudge will find the pages the slow way.
 *
 * Usage: node tools/indexnow.mjs [--dry]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = 'dota2modmanager.com';
const KEY = '0d68c3912b069fb327c07f6a3a5a073b';
const ENDPOINT = 'https://api.indexnow.org/IndexNow';

const here = path.dirname(fileURLToPath(import.meta.url));
const sitemap = path.resolve(here, '..', 'dist', 'sitemap-0.xml');

function urls() {
  const xml = fs.readFileSync(sitemap, 'utf-8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

const dry = process.argv.includes('--dry');

try {
  const urlList = urls();
  if (!urlList.length) throw new Error('sitemap has no URLs');

  const body = {
    host: HOST,
    key: KEY,
    keyLocation: `https://${HOST}/${KEY}.txt`,
    urlList,
  };

  if (dry) {
    console.log(`indexnow: would announce ${urlList.length} urls`);
    for (const u of urlList) console.log(`  ${u}`);
    process.exit(0);
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });

  // 200 means taken, 202 means taken but the key has not been checked yet. Both are fine.
  if (res.ok) console.log(`indexnow: ${urlList.length} urls announced (${res.status})`);
  else console.warn(`indexnow: refused with ${res.status} ${res.statusText}`);
} catch (err) {
  console.warn(`indexnow: skipped (${err.message})`);
}
