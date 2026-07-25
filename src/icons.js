// Pictures for the cosmetics picker.
//
// The game keeps its own icons as compiled Source 2 textures inside pak01, which the app
// cannot draw. The Dota wiki hosts a PNG for every cosmetic under a predictable name, so
// that is where they come from - fetched in the main process and handed to the renderer as
// data URIs, the same way the Discord avatar is handled: no third-party host in the page's
// CSP, and nothing about the user leaves with the request.
//
// Everything is cached on disk, misses included: 2000 loading screens must not turn into
// 2000 requests every time the picker opens.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WIKI = 'https://dota2.fandom.com/wiki/Special:FilePath/';
// Fandom answers 403 without a browser agent
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const MAX_BYTES = 512 * 1024;
const MISS_TTL = 7 * 24 * 3600 * 1000; // retry a missing picture next week, not next second

// The wiki serves WebP to a browser and PNG to anything else; both render in the app.
function sniff(buf) {
  const hex = buf.slice(0, 4).toString('hex');
  if (hex === '89504e47') return 'image/png';
  if (hex === '52494646' && buf.slice(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  return null;
}

class Icons {
  /**
   * @param {string} userDataDir
   * @param {typeof fetch} [fetchImpl]  Electron's net.fetch in the app: the wiki sits behind
   *   a bot check that plain Node requests do not pass, while the browser stack does.
   */
  constructor(userDataDir, fetchImpl) {
    this.fetch = fetchImpl || globalThis.fetch;
    this.dir = path.join(userDataDir, 'icons');
    fs.mkdirSync(this.dir, { recursive: true });
    this.missFile = path.join(this.dir, 'misses.json');
    this.misses = new Map();
    this.inflight = new Map();
    try {
      for (const [k, at] of Object.entries(JSON.parse(fs.readFileSync(this.missFile, 'utf8')))) this.misses.set(k, at);
    } catch { /* no misses recorded yet */ }
  }

  // Wiki file name for a cosmetic: "Weather Rain" -> Cosmetic_icon_Weather_Rain.png
  static fileName(name) {
    return 'Cosmetic_icon_' + String(name).trim().replace(/\s+/g, '_') + '.png';
  }

  cachePath(name) {
    return path.join(this.dir, crypto.createHash('sha1').update(String(name)).digest('hex').slice(0, 16) + '.img');
  }

  saveMisses() {
    try { fs.writeFileSync(this.missFile, JSON.stringify(Object.fromEntries(this.misses))); } catch { /* cache only */ }
  }

  /**
   * @returns {Promise<string|null>} data URI, or null when the wiki has no such picture
   */
  async get(name) {
    if (!name) return null;
    const file = this.cachePath(name);
    try {
      if (fs.existsSync(file)) {
        const buf = fs.readFileSync(file);
        const mime = sniff(buf);
        if (mime) return `data:${mime};base64,` + buf.toString('base64');
      }
    } catch { /* unreadable cache entry: refetch */ }

    const missedAt = this.misses.get(name);
    if (missedAt && Date.now() - missedAt < MISS_TTL) return null;
    if (this.inflight.has(name)) return this.inflight.get(name);

    const job = (async () => {
      try {
        const res = await this.fetch(WIKI + encodeURIComponent(Icons.fileName(name)), { headers: { 'User-Agent': UA } });
        if (!res.ok) throw new Error(String(res.status));
        const buf = Buffer.from(await res.arrayBuffer());
        const mime = buf.length && buf.length <= MAX_BYTES ? sniff(buf) : null;
        if (!mime) throw new Error('not an image');
        fs.writeFileSync(file, buf);
        this.misses.delete(name);
        return `data:${mime};base64,` + buf.toString('base64');
      } catch {
        this.misses.set(name, Date.now());
        this.saveMisses();
        return null;
      } finally {
        this.inflight.delete(name);
      }
    })();
    this.inflight.set(name, job);
    return job;
  }

  size() {
    let total = 0;
    try {
      for (const f of fs.readdirSync(this.dir)) total += fs.statSync(path.join(this.dir, f)).size;
    } catch { /* nothing cached */ }
    return total;
  }

  clear() {
    try { fs.rmSync(this.dir, { recursive: true, force: true }); } catch { /* noop */ }
    fs.mkdirSync(this.dir, { recursive: true });
    this.misses.clear();
  }
}

module.exports = { Icons };
