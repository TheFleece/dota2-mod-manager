// Fingerprint index: fetch + cache the fp -> mod identity map published alongside the
// app, so a foreign vpk sitting in the game folder can be recognised as a specific
// catalog mod (see tools/gen-fingerprints.js). Dormant until the map is hosted.
const fs = require('fs');
const path = require('path');

const FP_URL = 'https://raw.githubusercontent.com/TheFleece/dota2-mod-manager/main/fingerprints.json';

class Fingerprints {
  constructor(userDataDir) {
    this.file = path.join(userDataDir, 'fingerprints.json');
    this.map = null; // fp -> { name, categoryId, styleLabel }
  }

  loadCache() {
    try {
      this.map = JSON.parse(fs.readFileSync(this.file, 'utf-8')).mods || {};
    } catch { this.map = {}; }
    return this.map;
  }

  ensure() {
    if (this.map === null) this.loadCache();
    return this.map;
  }

  async refresh() {
    try {
      const res = await fetch(FP_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      this.map = JSON.parse(text).mods || {}; // validate before persisting
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, text);
    } catch {
      // no hosted map yet, or offline — keep whatever cache we have
      this.ensure();
    }
    return this.map;
  }

  // -> array of matching catalog identities (a fingerprint can map to several entries
  // that share the same file, e.g. GLaDOS + Ru GLaDOS), or null when unknown.
  match(fp) {
    if (!fp) return null;
    const v = this.ensure()[fp];
    if (!v) return null;
    return Array.isArray(v) ? v : [v]; // tolerate the older object-valued format
  }
}

module.exports = { Fingerprints, FP_URL };
