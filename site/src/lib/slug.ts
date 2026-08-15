/**
 * A mod or hero name turned into something that can be a file name and a URL.
 *
 * Catalog names are mostly Latin but not reliably: one mod is spelled "Visage Grimfeather
 * Сorpse" with a Cyrillic С that looks exactly like the Latin one, and a slug that silently
 * drops it produces "visage-grimfeather-orpse". So Cyrillic is transliterated rather than
 * stripped, and the homoglyphs come out as the letters they were meant to be.
 */
const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

export function slugify(name: string): string {
  const lower = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let out = '';
  for (const ch of lower) out += CYRILLIC[ch] ?? ch;
  return out
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'mod';
}

/** Same, but guaranteed unique inside one run: a second "cosmic-zeus" becomes "cosmic-zeus-2". */
export function uniqueSlug(name: string, taken: Set<string>): string {
  const base = slugify(name);
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  taken.add(slug);
  return slug;
}
