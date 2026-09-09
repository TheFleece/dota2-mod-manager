// Catalog: fetch + cache mods.json / constants.json / guides.json from the Dota2PornFx repo
const fs = require('fs');
const path = require('path');
const { fetchText } = require('./net');
const signature = require('./catalog-signature');

const RAW_BASE = 'https://raw.githubusercontent.com/h6rd/Dota2PornFxWeb/main';
const DATA_FILES = ['mods.json', 'constants.json', 'guides.json'];

/* The published sha256 of every archive in the catalog, signed like the data.
 *
 * Deliberately not one of DATA_FILES. Those are the files the app cannot start without, and
 * this one it has never had: until 2026-09-09 an archive was trusted on first sight and
 * checked against that first copy afterwards, which catches a substitution on every download
 * except the one that matters. So it is fetched beside them and a failure costs the old
 * behaviour rather than the catalog.
 */
const HASH_FILE = 'mod-hashes.json';

// Walk every mod in a mods.json, whatever shape its category is in: a plain array, or a
// group list for the categories that are sorted by hero.
function eachMod(modsData, fn) {
  for (const category of Object.values(modsData || {})) {
    if (!category) continue;
    const lists = Array.isArray(category)
      ? [category]
      : Array.isArray(category.groups)
        ? category.groups.map((g) => g.mods || [])
        : [category.mods || []];
    for (const list of lists) {
      for (const mod of list) if (mod && typeof mod === 'object') fn(mod);
    }
  }
}

/**
 * The catalog describes a mod's links two ways: a `links` array, and an older pair of fields
 * on the mod itself. 32 mods still carry the old pair and 26 of those are previews - the
 * whole TI battle-pass row - so a reader that knows only the array shows them with no
 * preview at all. The site reads both; folding one into the other here means the rest of the
 * app only ever sees the array. The cache on disk keeps whatever the author wrote.
 */
function normalizeCatalog(mods) {
  eachMod(mods && mods.modsData, (mod) => {
    if (!mod.linkType || !mod.linkUrl) return;
    const link = { type: mod.linkType, url: mod.linkUrl };
    if (mod.senderName) link.name = mod.senderName;
    if (!Array.isArray(mod.links)) mod.links = [link];
    else if (!mod.links.some((l) => l.type === link.type && l.url === link.url)) mod.links.push(link);
  });
  return mods;
}

class Catalog {
  constructor(userDataDir) {
    this.cacheDir = path.join(userDataDir, 'catalog-cache');
    fs.mkdirSync(this.cacheDir, { recursive: true });
  }

  cachePath(name) {
    return path.join(this.cacheDir, name);
  }

  cacheInfo() {
    const metaFile = this.cachePath('meta.json');
    try {
      return JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
    } catch {
      return { fetchedAt: null };
    }
  }

  hasCache() {
    return DATA_FILES.every((f) => fs.existsSync(this.cachePath(f)));
  }

  /** Fetches one published file and, when a key is pinned, refuses bytes it did not sign. */
  async fetchSigned(name) {
    const text = await fetchText(`${RAW_BASE}/assets/data/${name}`);
    // A mirror can rewrite anything it carries, so what decides whether these bytes are the
    // author's is his signature over them.
    //
    // The signatures sit in a folder of their own rather than beside the data. They were
    // published as assets/data/<name>.sig on 2026-09-09 and moved to assets/signatures/ the
    // same day, which is why this is built from a path and not from a suffix glued onto the
    // data URL: a layout that has already moved once can move again.
    if (signature.configured()) {
      const sig = await fetchText(`${RAW_BASE}/${signature.SIG_DIR}/${name}${signature.SIG_SUFFIX}`);
      if (!signature.verify(text, sig)) throw new Error(`${name}: signature does not match the catalog's key`);
    }
    JSON.parse(text); // validate before persisting
    return text;
  }

  async refresh() {
    for (const name of DATA_FILES) {
      // through the mirrors: this is the one fetch that has to work before the app can show
      // anything at all, and raw.githubusercontent is not reachable everywhere
      // through the mirrors: this is the one fetch that has to work before the app can show
      // anything at all, and raw.githubusercontent is not reachable everywhere
      fs.writeFileSync(this.cachePath(name), await this.fetchSigned(name));
    }

    // and the hashes, which the app is allowed to do without
    try {
      fs.writeFileSync(this.cachePath(HASH_FILE), await this.fetchSigned(HASH_FILE));
    } catch (e) {
      this.hashes = undefined; // re-read whatever is on disk next time it is asked
    }
    fs.writeFileSync(this.cachePath('meta.json'), JSON.stringify({ fetchedAt: Date.now() }));
  }

  async load({ forceRefresh = false } = {}) {
    let stale = null;
    if (forceRefresh || !this.hasCache()) {
      try {
        await this.refresh();
      } catch (e) {
        // A catalog that could not be fetched is not the same as no catalog. GitHub was down
        // for three hours on 2026-08-17 and the window came up empty for everyone whose cache
        // had passed half an hour, when yesterday's list of mods would have done fine. With
        // nothing on disk there is still nothing to show, and that error goes up as before.
        if (!this.hasCache()) throw e;
        stale = String(e.message || e);
      }
    }
    const out = { fetchedAt: this.cacheInfo().fetchedAt };
    if (stale) out.stale = stale;
    for (const name of DATA_FILES) {
      out[name.replace('.json', '')] = JSON.parse(fs.readFileSync(this.cachePath(name), 'utf-8'));
    }
    normalizeCatalog(out.mods);
    return out;
  }
  /**
   * What the catalog says this archive should hash to, or null when it does not say.
   *
   * Null is the common case for a mod added since the list was last rebuilt - 21 of 992 on the
   * day this was written - and it means the old behaviour, not a refusal. A list that has not
   * caught up must never be a reason a mod cannot be installed.
   *
   * @param {string} categoryId  e.g. "heroes"
   * @param {string} file        the archive's name in the catalog, e.g. "Bare Brewmaster.zip"
   * @returns {string|null} sha256 in lower-case hex
   */
  publishedHash(categoryId, file) {
    if (this.hashes === undefined) {
      try { this.hashes = JSON.parse(fs.readFileSync(this.cachePath(HASH_FILE), 'utf-8')); } catch { this.hashes = null; }
    }
    if (!this.hashes || !categoryId || !file) return null;
    const value = this.hashes[`${categoryId}/${file}`];
    return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value) ? value.toLowerCase() : null;
  }
}

module.exports = { Catalog, RAW_BASE, HASH_FILE, normalizeCatalog };
