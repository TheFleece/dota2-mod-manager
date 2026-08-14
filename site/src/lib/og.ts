/**
 * Which card belongs to which page.
 *
 * The site had one og.png for all fourteen addresses, so a link to the guide about bans and a
 * link to the front page arrived in a Discord channel looking like the same link. The name is
 * computed from the two things a page always knows about itself, and tools/og.mjs draws the
 * files from this same function, so a card and the page it belongs to cannot drift apart.
 */
export type OgLang = 'en' | 'ru';

/** ("ru", "/docs/install/") -> "/og/ru-docs-install.png"; the root is "home". */
export function ogPath(lang: OgLang, path: string): string {
  const slug = path.replace(/^\/+|\/+$/g, '').replace(/\//g, '-') || 'home';
  return `/og/${lang}-${slug}.png`;
}
