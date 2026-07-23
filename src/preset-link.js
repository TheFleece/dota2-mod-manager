// Presets as a link: "d2mm://preset/<code>", where <code> is the whole preset squeezed
// into a pasteable string. Only a preset made purely of catalog mods can travel this way —
// a mod the receiver can't fetch has to go as bytes, and bytes don't fit in a link.
//
// The payload is deliberately tiny: short keys, mods as bare arrays, deflate, base64url.
// Thirty catalog mods land around a thousand characters, which pastes into a Discord
// message; a .d2mm file stays the answer for anything with imports in it.
const zlib = require('zlib');
const { t } = require('./i18n');

const SCHEME = 'd2mm';
const LINK_RE = new RegExp(`^(?:${SCHEME}:\\/\\/preset\\/)?([A-Za-z0-9_-]+)$`);
const MAX_CODE = 64 * 1024;
const MAX_JSON = 512 * 1024;   // inflate bomb guard
const MAX_MODS = 500;

/**
 * @param {{name: string, author?: string, mods: Array<{categoryId, name, styleLabel}>}} preset
 * @returns {string} d2mm://preset/<code>
 */
function encodePresetLink({ name, author, mods }) {
  const payload = {
    v: 1,
    n: String(name || '').slice(0, 120),
    m: mods.map((m) => (m.styleLabel ? [m.categoryId, m.name, m.styleLabel] : [m.categoryId, m.name])),
  };
  if (author) payload.a = String(author).slice(0, 80);
  const code = zlib.deflateRawSync(Buffer.from(JSON.stringify(payload), 'utf-8'), { level: 9 }).toString('base64url');
  return `${SCHEME}://preset/${code}`;
}

// Accepts the full link or just the code — people paste both, chat clients love to wrap
// things in spaces, angle brackets and backticks, and Windows hands a clicked link over
// with a trailing slash.
function decodePresetLink(input) {
  const cleaned = String(input || '').trim().replace(/^[<`'"]+|[>`'"/]+$/g, '').trim();
  const m = LINK_RE.exec(cleaned);
  if (!m) throw new Error(t('Это не похоже на ссылку на пресет'));
  if (m[1].length > MAX_CODE) throw new Error(t('Ссылка слишком длинная'));

  let json;
  try {
    json = zlib.inflateRawSync(Buffer.from(m[1], 'base64url'), { maxOutputLength: MAX_JSON }).toString('utf-8');
  } catch {
    throw new Error(t('Ссылка повреждена'));
  }
  let raw;
  try { raw = JSON.parse(json); } catch { throw new Error(t('Ссылка повреждена')); }
  if (!raw || raw.v !== 1 || !Array.isArray(raw.m)) throw new Error(t('Ссылка повреждена'));
  if (raw.m.length > MAX_MODS) throw new Error(t('Слишком много модов в пресете'));

  const mods = raw.m
    .filter((e) => Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'string')
    .map((e) => ({
      kind: 'catalog',
      categoryId: e[0].slice(0, 60),
      name: e[1].slice(0, 300),
      styleLabel: typeof e[2] === 'string' ? e[2].slice(0, 300) : null,
      fp: null,
    }));
  return {
    name: (typeof raw.n === 'string' && raw.n.slice(0, 120)) || t('Пресет'),
    author: (typeof raw.a === 'string' && raw.a.slice(0, 80)) || '',
    mods,
  };
}

module.exports = { SCHEME, encodePresetLink, decodePresetLink };
