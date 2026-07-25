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
// How many pictures are fetched at once. The wiki starts refusing a burst of a hundred,
// and a refusal used to be remembered as "no such picture" for a week.
const CONCURRENCY = 6;

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
    // v2: the old file also holds names that failed for a reason that was never the wiki's
    // (a refused burst), so it is not carried over
    this.missFile = path.join(this.dir, 'misses.v2.json');
    this.misses = new Map();
    this.inflight = new Map();
    try {
      for (const [k, at] of Object.entries(JSON.parse(fs.readFileSync(this.missFile, 'utf8')))) this.misses.set(k, at);
    } catch { /* no misses recorded yet */ }
  }

  /**
   * Wiki file names to try for a cosmetic: "Weather Rain" -> Cosmetic_icon_Weather_Rain.png.
   * The schema's own name is right about nine times out of ten; the rest differ by
   * punctuation the wiki spells its own way, so a couple of spellings follow before the
   * picture counts as missing. "Mega-Kills: Axe" is filed as both Mega-Kills_Axe and
   * Mega-Kills-_Axe, and the game's typographic apostrophe is a plain one there.
   * @returns {string[]}
   */
  static fileNames(name) {
    const clean = String(name).replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
    const out = [];
    for (const form of [clean, clean.replace(/:/g, ''), clean.replace(/:/g, '-'), String(name).trim()]) {
      const file = 'Cosmetic_icon_' + form.replace(/\s+/g, '_') + '.png';
      if (form && !out.includes(file)) out.push(file);
    }
    return out;
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
      // Only a 404 means the wiki really has no such picture. A refused or dropped request
      // says nothing about the name, so it must not be remembered as a miss for a week —
      // that is how a slot ends up permanently half-empty after one bad burst.
      let answered = true;
      try {
        for (const wikiName of Icons.fileNames(name)) {
          let res;
          try {
            res = await this.fetch(WIKI + encodeURIComponent(wikiName), { headers: { 'User-Agent': UA } });
          } catch {
            answered = false;
            continue;
          }
          if (res.status === 404) continue;
          if (!res.ok) { answered = false; continue; }
          const buf = Buffer.from(await res.arrayBuffer());
          const mime = buf.length && buf.length <= MAX_BYTES ? sniff(buf) : null;
          if (!mime) continue;
          fs.writeFileSync(file, buf);
          this.misses.delete(name);
          return `data:${mime};base64,` + buf.toString('base64');
        }
        if (answered) {
          this.misses.set(name, Date.now());
          this.saveMisses();
        }
        return null;
      } catch {
        return null;
      } finally {
        this.inflight.delete(name);
      }
    })();
    this.inflight.set(name, job);
    return job;
  }

  /**
   * Pictures for a batch of names, a few requests at a time.
   * @returns {Promise<Record<string, string|null>>}
   */
  async getMany(names) {
    const list = [...new Set((Array.isArray(names) ? names : []).filter(Boolean))];
    const out = {};
    let next = 0;
    const worker = async () => {
      while (next < list.length) {
        const name = list[next++];
        out[name] = await this.get(name);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, worker));
    return out;
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
