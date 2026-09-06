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
  // Stripping tags once is enough for the copy this runs on, which is our own, and not enough
  // in general: "<<a>a>" survives a single pass and comes out as a tag again. Nothing here is
  // load-bearing for security - the output goes into JSON-LD, which Astro escapes - but a
  // function whose whole job is removing markup should not leave any behind, so it repeats
  // until the string stops changing.
  let out = html.replace(TRAILING_LINK, '');
  for (let before = ''; before !== out;) {
    before = out;
    out = out.replace(/<[^>]*>/g, '');
  }
  return out.replace(/\s+/g, ' ').trim();
}
