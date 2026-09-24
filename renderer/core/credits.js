/* Who made a mod, as the catalog credits them.
 *
 * The catalog names people in a mod's links, in three roles: "author", "modded" (somebody who
 * reworked another author's mod) and "sender" (who brought it to the catalog). Each carries a
 * name rather than an address, and the catalog's constants map a name to a page (MOD_AUTHOR,
 * MOD_SENDER) where it has one.
 *
 * The mod window used to show the first author and nobody else, and put the other roles among
 * the link buttons, where a name was opened as an address and answered 404. On 2026-09-24, 40
 * mods in the catalog credited two people or more: Earthshaker Arcana names two authors, and
 * 24 mods name a modder beside the author whose work they changed.
 */

/** The roles, in the order they are shown: whoever made it before whoever changed or sent it. */
export const CREDIT_ROLES = ['author', 'modded', 'sender'];

/**
 * @param {object} mod        a catalog mod: its `links`, and the older `author` / `sender` fields
 * @param {object} [constants] the catalog's constants, for MOD_AUTHOR and MOD_SENDER
 * @returns {{ role: string, name: string, href: string|null }[]}
 */
export function modCredits(mod, constants = {}) {
  const pageOf = (name) => constants?.MOD_AUTHOR?.[name] || constants?.MOD_SENDER?.[name] || null;
  const out = [];
  const seen = new Set();
  const add = (role, raw, label) => {
    const url = String(raw || '').trim();
    if (!url) return;
    const isUrl = /^https?:\/\//i.test(url);
    // an address with no name beside it is still somebody: say where it goes
    const name = isUrl ? (String(label || '').trim() || hostOf(url)) : url;
    const key = `${role}\n${name.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ role, name, href: isUrl ? url : pageOf(name) });
  };
  const links = Array.isArray(mod?.links) ? mod.links : [];
  for (const role of CREDIT_ROLES) {
    if (role === 'author' && mod?.author) add('author', mod.author);
    for (const l of links) if (l && l.type === role) add(role, l.url, l.name);
    if (role === 'sender' && mod?.sender) add('sender', mod.sender);
  }
  return out;
}

function hostOf(url) {
  try { return new URL(url).host.replace(/^www\./, ''); } catch { return url; }
}
