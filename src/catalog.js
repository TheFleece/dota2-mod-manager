// Catalog: fetch + cache mods.json / constants.json / guides.json from the Dota2PornFx repo
const fs = require('fs');
const path = require('path');
const { fetchText } = require('./net');

const RAW_BASE = 'https://raw.githubusercontent.com/h6rd/Dota2PornFxWeb/main';
const DATA_FILES = ['mods.json', 'constants.json', 'guides.json'];

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

  async refresh() {
    for (const name of DATA_FILES) {
      // through the mirrors: this is the one fetch that has to work before the app can show
      // anything at all, and raw.githubusercontent is not reachable everywhere
      const text = await fetchText(`${RAW_BASE}/assets/data/${name}`);
      JSON.parse(text); // validate before persisting
      fs.writeFileSync(this.cachePath(name), text);
    }
    fs.writeFileSync(this.cachePath('meta.json'), JSON.stringify({ fetchedAt: Date.now() }));
  }

  async load({ forceRefresh = false } = {}) {
    if (forceRefresh || !this.hasCache()) {
      await this.refresh();
    }
    const out = { fetchedAt: this.cacheInfo().fetchedAt };
    for (const name of DATA_FILES) {
      out[name.replace('.json', '')] = JSON.parse(fs.readFileSync(this.cachePath(name), 'utf-8'));
    }
    normalizeCatalog(out.mods);
    return out;
  }
}

module.exports = { Catalog, RAW_BASE, normalizeCatalog };
