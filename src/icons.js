// Pictures for the cosmetics picker.
//
// The game keeps its own icons as compiled Source 2 textures inside pak01, which the app
// cannot draw. The Dota wiki hosts a PNG for most cosmetics under a name built from the
// item's own (and its search finds the rest), so that is where they come from - fetched in
// the main process and handed to the renderer as data URIs, the same way the Discord avatar
// is handled: no third-party host in the page's CSP, and nothing about the user leaves with
// the request.
//
// Everything is cached on disk, misses included: 2000 loading screens must not turn into
// 2000 requests every time the picker opens.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WIKI = 'https://dota2.fandom.com/wiki/Special:FilePath/';
const API = 'https://dota2.fandom.com/api.php';
// Fandom answers 403 without a browser agent
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const MAX_BYTES = 512 * 1024;
const MISS_TTL = 7 * 24 * 3600 * 1000; // retry a missing picture next week, not next second
// How many pictures are fetched at once. The wiki starts refusing a burst of a hundred,
// and a refusal used to be remembered as "no such picture" for a week.
const CONCURRENCY = 6;

// Names compared without spacing, punctuation or case: the wiki and the game write those
// their own ways, and none of it changes which item is meant. Nor does the trailing "Skin"
// the schema gives some HUDs and the wiki does not.
const plain = (s) => String(s).replace(/\bHUD[ _]Skin$/i, 'HUD').toLowerCase().replace(/[^a-z0-9]+/g, '');

// The parts a typo check must never forgive: "Loading Screen VI" and "Loading Screen IV"
// are two different pictures one swapped letter apart.
const numbering = (s) => (String(s).match(/\d+|\b[IVXLC]{1,6}\b/g) || []).join(' ');

// Levenshtein distance, only ever asked about strings that are nearly the same already.
function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

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
    // v3: the older files hold names that only missed because the app looked for them under
    // the game's spelling and gave up there (see searchFileName), so they are not carried over
    this.missFile = path.join(this.dir, 'misses.v3.json');
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
   * @returns {Promise<object|undefined>} parsed answer, or undefined when the wiki did not
   *   answer at all (which is never a "no such file")
   */
  async ask(params) {
    try {
      const res = await this.fetch(`${API}?${new URLSearchParams({ format: 'json', ...params })}`,
        { headers: { 'User-Agent': UA } });
      if (!res.ok) return undefined;
      return await res.json();
    } catch {
      return undefined;
    }
  }

  /**
   * Files whose name starts with the item's first word or two. Exact and always answered,
   * unlike the search, which returns nothing at all for half of these names.
   */
  async filesByPrefix(name) {
    const words = String(name).replace(/[^\w\s'.-]/g, '').split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const head = words.slice(0, words[0].length < 5 ? 2 : 1).join('_');
    const json = await this.ask({ action: 'query', list: 'allimages', aiprefix: `Cosmetic_icon_${head}`, ailimit: '100' });
    return json && (json.query?.allimages || []).map((i) => String(i.name));
  }

  /** The wiki's own full-text search, for names whose first word is spelled its own way. */
  async filesBySearch(name) {
    const json = await this.ask({ action: 'query', list: 'search', srnamespace: '6', srlimit: '10', srsearch: `Cosmetic icon ${name}` });
    return json && (json.query?.search || []).map((s) => String(s.title).replace(/^File:/i, ''));
  }

  /**
   * Which file the wiki keeps this item under, when it is not the name the game uses -
   * "Aghanim's Labryinth 2021 HUD" is the schema's own typo, and some HUDs carry a "Skin"
   * the wiki leaves off. A title counts only when it is the same name give or take a typo:
   * a loose match would put a stranger's picture on the card, which is worse than an empty
   * tile, so an extra word ("… Bundle") or a different number is enough to rule it out.
   * @returns {Promise<string|null|undefined>} file name · null = no such picture ·
   *   undefined = the wiki never answered, so it said nothing either way
   */
  async searchFileName(name) {
    const want = plain(name);
    const pick = (titles) => {
      let best = null;
      for (const title of titles) {
        const m = /^Cosmetic[ _]icon[ _](.+)\.(?:png|jpe?g|webp)$/i.exec(title);
        if (!m || numbering(m[1]) !== numbering(name)) continue;
        const got = plain(m[1]);
        // a typo swaps or replaces letters, it does not add or drop words: same length only,
        // which is what keeps "Alliance HUD Bundle" away from "Alliance HUD"
        const d = got === want ? 0 : got.length === want.length ? editDistance(got, want) : Infinity;
        if (d <= 2 && (!best || d < best.d)) best = { d, file: title.replace(/ /g, '_') };
      }
      return best ? best.file : null;
    };

    let silent = false;
    // the search only runs when the prefix listing came back without the item
    for (const ask of [() => this.filesByPrefix(name), () => this.filesBySearch(name)]) {
      const list = await ask();
      if (!list) { silent = true; continue; }
      const hit = pick(list);
      if (hit) return hit;
    }
    return silent ? undefined : null;
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
      const fetchFile = async (wikiName) => {
        let res;
        try {
          res = await this.fetch(WIKI + encodeURIComponent(wikiName), { headers: { 'User-Agent': UA } });
        } catch {
          answered = false;
          return null;
        }
        if (res.status === 404) return null;
        if (!res.ok) { answered = false; return null; }
        const buf = Buffer.from(await res.arrayBuffer());
        const mime = buf.length && buf.length <= MAX_BYTES ? sniff(buf) : null;
        return mime ? { buf, mime } : null;
      };

      try {
        let hit = null;
        for (const wikiName of Icons.fileNames(name)) {
          hit = await fetchFile(wikiName);
          if (hit) break;
        }
        if (!hit) {
          const found = await this.searchFileName(name);
          if (found === undefined) answered = false;
          else if (found) hit = await fetchFile(found);
        }
        if (hit) {
          fs.writeFileSync(file, hit.buf);
          this.misses.delete(name);
          return `data:${hit.mime};base64,` + hit.buf.toString('base64');
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
