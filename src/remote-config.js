// The one thing the app can be told after it has shipped.
//
// A Dota patch can break a whole category of mods in an afternoon, and the app in front of
// the user was built weeks ago. Waiting for a release to say "don't install cosmetics today,
// the game crashes" is too slow, and answering it forty times in Discord is not a plan. So
// there is one small file on the same repository the catalog comes from, fetched through the
// same mirrors, that can do two things: turn a feature off with a reason, and put a dated
// notice in front of people.
//
// Everything about it is default-safe. No file, no network, malformed JSON, a field of the
// wrong type: the app behaves exactly as it does today, with everything on and nothing to
// say. A remote switch that fails open is a feature; one that fails closed is an outage.
//
// Shape:
//   {
//     "version": 1,
//     "features": { "install": { "off": true, "ru": "…", "en": "…" } },
//     "notices": [ { "id": "2026-08-dota-patch", "date": "2026-08-07", "level": "warn",
//                    "ru": "…", "en": "…", "url": "https://…",
//                    "minVersion": "2.0.0", "maxVersion": "2.1.0" } ]
//   }
const fs = require('fs');
const path = require('path');
const { fetchText } = require('./net');

const CONFIG_URL = 'https://raw.githubusercontent.com/TheFleece/dota2-mod-manager/main/config/app.json';
// What the app is willing to be told to switch off. A name that is not on this list is
// ignored: a typo in the config must not disable something at random, and this list is the
// contract between the file and the code that honours it.
const SWITCHABLE = ['install', 'cosmetics', 'voice'];
const MAX_NOTICES = 20;
const MAX_TEXT = 500;

const str = (v, max = MAX_TEXT) => (typeof v === 'string' ? v.slice(0, max) : '');

// "2.0.1" -> [2, 0, 1]; anything odd sorts as 0 so a broken bound never hides a notice
const parts = (v) => String(v || '').split('.').map((n) => parseInt(n, 10) || 0);
function cmpVersion(a, b) {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0) ? -1 : 1;
  }
  return 0;
}

function normalize(raw) {
  const out = { features: {}, notices: [] };
  if (!raw || typeof raw !== 'object') return out;

  const features = raw.features && typeof raw.features === 'object' ? raw.features : {};
  for (const name of SWITCHABLE) {
    const f = features[name];
    if (!f || typeof f !== 'object' || f.off !== true) continue;
    out.features[name] = { off: true, ru: str(f.ru), en: str(f.en) };
  }

  const notices = Array.isArray(raw.notices) ? raw.notices.slice(0, MAX_NOTICES) : [];
  for (const n of notices) {
    if (!n || typeof n !== 'object') continue;
    const id = str(n.id, 80);
    if (!id) continue;
    out.notices.push({
      id,
      date: str(n.date, 20),
      level: n.level === 'warn' ? 'warn' : 'info',
      ru: str(n.ru),
      en: str(n.en),
      url: /^https:\/\//i.test(n.url || '') ? str(n.url, 300) : null,
      minVersion: str(n.minVersion, 20) || null,
      maxVersion: str(n.maxVersion, 20) || null,
    });
  }
  return out;
}

/**
 * @param {object} deps
 * @param {string} deps.userDataDir
 * @param {() => string} deps.appVersion   so a notice can be aimed at the builds it is about
 * @param {(msg: string) => void} [deps.log]
 */
function createRemoteConfig({ userDataDir, appVersion, log = () => {} }) {
  const file = path.join(userDataDir, 'remote-config.json');
  let cache = null;

  function read() {
    if (cache) return cache;
    try { cache = normalize(JSON.parse(fs.readFileSync(file, 'utf-8'))); } catch { cache = normalize(null); }
    return cache;
  }

  /** Fetch and cache. Never throws: being offline is the normal case, not an error. */
  async function refresh() {
    try {
      const text = await fetchText(CONFIG_URL);
      const parsed = normalize(JSON.parse(text));
      fs.writeFileSync(file, JSON.stringify(parsed, null, 2));
      cache = parsed;
      log(`remote config: ${Object.keys(parsed.features).length} switch(es) off, ${parsed.notices.length} notice(s)`);
    } catch (err) {
      log(`remote config not fetched: ${err.message || err}`);
      read();
    }
    return cache;
  }

  /**
   * Is this feature off right now, and what should the user be told?
   * @returns {{ off: boolean, note: string }}
   */
  function feature(name, lang = 'en') {
    const f = read().features[name];
    if (!f) return { off: false, note: '' };
    return { off: true, note: (lang === 'ru' ? f.ru : f.en) || f.en || f.ru || '' };
  }

  /** Notices meant for this build, newest first, with the text already in one language. */
  function notices(lang = 'en') {
    const version = appVersion();
    return read().notices
      .filter((n) => (!n.minVersion || cmpVersion(version, n.minVersion) >= 0)
        && (!n.maxVersion || cmpVersion(version, n.maxVersion) <= 0))
      .map((n) => ({ id: n.id, date: n.date, level: n.level, url: n.url, text: (lang === 'ru' ? n.ru : n.en) || n.en || n.ru || '' }))
      .filter((n) => n.text)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  return { refresh, feature, notices, url: CONFIG_URL, SWITCHABLE };
}

module.exports = { createRemoteConfig, normalize, cmpVersion, SWITCHABLE, CONFIG_URL };
