/**
 * The numbers on the landing, counted at build time instead of typed in.
 *
 * They were typed in once, on 2026-08-07, and by 2026-08-10 all four had drifted: the page
 * claimed 1150 mods when the catalog held 1090, and 27 releases when there were 29. A page
 * whose trust section says the numbers are checkable cannot afford numbers that fail the
 * check, so now the build does the counting.
 *
 * Two sources. The catalog comes from the same mods.json the app reads, so the site and the
 * app can never disagree. Downloads and releases come from the GitHub API.
 *
 * On downloads, only the installer counts. Every release also carries latest.yml, which the
 * app fetches on every update check, and a .blockmap for differential updates: summing all
 * assets gives 70,022 where 19,227 people actually downloaded the thing. The inflated figure
 * is the more flattering one, which is exactly why it is not the one used.
 *
 * A static site's number is "as of the last build" no matter what, so the fallback below is
 * not a different kind of thing from a fetched one, only older. It is what an offline build
 * prints, and it is rounded down rather than up.
 */

const CATALOG = 'https://raw.githubusercontent.com/h6rd/Dota2PornFxWeb/main/assets/data/mods.json';
const RELEASES = 'https://api.github.com/repos/TheFleece/dota2-mod-manager/releases?per_page=100';
const UA = { 'User-Agent': 'dota2modmanager-site' };

export interface SiteStats {
  mods: number;
  categories: number;
  releases: number;
  /** Installer downloads across every release. */
  downloads: number;
  /** Category id -> how many mods are in it. */
  byCategory: Record<string, number>;
  /** False when the build could not reach one of the sources and fell back. */
  live: boolean;
}

/** Counted on 2026-08-10. Only reached when a build has no network. */
const FALLBACK: SiteStats = {
  mods: 1090,
  categories: 41,
  releases: 29,
  downloads: 19227,
  byCategory: {
    heroes: 466, 'hero-items': 126, backgrounds: 63, 'mega-kill': 35, cursors: 34,
    shaders: 32, 'hero-sounds': 29, couriers: 25, 'item-effects': 22, terrains: 20,
    river: 20, trees: 18, emblems: 16, music: 15, sounds: 12, roshan: 10, fonts: 10,
    announcers: 7, wards: 5,
  },
  live: false,
};

async function catalogCounts() {
  const res = await fetch(CATALOG, { headers: UA });
  if (!res.ok) throw new Error(`catalog ${res.status}`);
  const { modsData } = await res.json();
  if (!modsData || typeof modsData !== 'object') throw new Error('catalog: no modsData');

  const byCategory: Record<string, number> = {};
  for (const [id, value] of Object.entries<any>(modsData)) {
    // A category is usually an array of mods and occasionally an object of sub-lists.
    byCategory[id] = Array.isArray(value)
      ? value.length
      : Object.values(value ?? {}).reduce<number>((n, sub) => n + (Array.isArray(sub) ? sub.length : 0), 0);
  }
  const mods = Object.values(byCategory).reduce((a, b) => a + b, 0);
  if (!mods) throw new Error('catalog: counted zero mods');
  return { mods, categories: Object.keys(byCategory).length, byCategory };
}

async function releaseCounts() {
  const res = await fetch(RELEASES, { headers: UA });
  if (!res.ok) throw new Error(`releases ${res.status}`);
  const list = await res.json();
  if (!Array.isArray(list) || !list.length) throw new Error('releases: empty');
  const downloads = list
    .flatMap((r: any) => r.assets ?? [])
    .filter((a: any) => a.name?.toLowerCase().endsWith('.exe'))
    .reduce((n: number, a: any) => n + (a.download_count ?? 0), 0);
  return { releases: list.length, downloads };
}

let pending: Promise<SiteStats> | null = null;

/** Both language pages ask for this, so the fetch happens once per build. */
export function siteStats(): Promise<SiteStats> {
  pending ??= (async () => {
    try {
      const [catalog, releases] = await Promise.all([catalogCounts(), releaseCounts()]);
      return { ...catalog, ...releases, live: true };
    } catch (err) {
      console.warn(`stats: using the committed fallback (${(err as Error).message})`);
      return FALLBACK;
    }
  })();
  return pending;
}
