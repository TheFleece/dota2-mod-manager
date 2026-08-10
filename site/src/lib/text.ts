/**
 * Turning a string of copy into the plain text that structured data carries.
 *
 * Both places that emit JSON-LD used to strip tags and keep whatever text was inside them.
 * That works for a link sitting in the middle of a sentence, whose words the sentence needs,
 * and fails for the kind this site writes most: a pointer bolted onto the end, reading
 * "The longer answer." on its own. Yandex's markup validator prints the flattened text, which
 * is where the orphans showed up.
 *
 * So a link at the very end goes, and a link anywhere else keeps its words.
 */
const TRAILING_LINK = /\s*<a\b[^>]*>.*?<\/a>\s*[.!?]?\s*$/i;

export function plainText(html: string): string {
  return html
    .replace(TRAILING_LINK, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
