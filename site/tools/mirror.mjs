/**
 * A second place to get the files the app cannot start without.
 *
 * Everything the app reads at startup - the catalog, its constants, its guides, the
 * fingerprint map - lives in a GitHub repository, and every mirror the app knows is a proxy
 * standing in front of that same repository. On 2026-08-17 GitHub was down for three hours
 * and all of them went with it: the window opened, the catalog was empty, and there was
 * nothing anybody could do about it.
 *
 * This copies those files into the site's own deploy, so the app has one source that does not
 * share GitHub's fate. The site rebuilds daily and after every release, which makes the copy
 * at most a day behind, and a day-old list of mods beats an empty window by a distance.
 *
 * Nothing here is committed: the files are written into dist/ after the build and go out with
 * the deploy. A failure prints and returns success on purpose - a mirror that could not be
 * refreshed is a worse site, not a broken one, and blocking the deploy over it would take the
 * whole site down for a problem that only matters while GitHub is unreachable.
 */
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'dist', 'mirror');

const SOURCES = [
  ['mods.json', 'https://raw.githubusercontent.com/h6rd/Dota2PornFxWeb/main/assets/data/mods.json'],
  ['constants.json', 'https://raw.githubusercontent.com/h6rd/Dota2PornFxWeb/main/assets/data/constants.json'],
  ['guides.json', 'https://raw.githubusercontent.com/h6rd/Dota2PornFxWeb/main/assets/data/guides.json'],
  ['fingerprints.json', 'https://raw.githubusercontent.com/TheFleece/dota2-mod-manager/main/fingerprints.json'],
];

async function one(name, url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'dota2modmanager-site-mirror' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  JSON.parse(text); // a truncated download must not be published as if it were the catalog
  fs.writeFileSync(path.join(OUT, name), text);
  return text.length;
}

fs.mkdirSync(OUT, { recursive: true });

let failed = 0;
for (const [name, url] of SOURCES) {
  try {
    const bytes = await one(name, url);
    console.log(`mirror: ${name.padEnd(18)} ${(bytes / 1024).toFixed(0)} KB`);
  } catch (e) {
    failed++;
    console.log(`mirror: ${name.padEnd(18)} skipped (${e.message})`);
  }
}
console.log(failed ? `${SOURCES.length - failed} of ${SOURCES.length} mirrored` : 'all mirrored');
