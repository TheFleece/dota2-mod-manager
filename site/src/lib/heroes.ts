/**
 * The hero dataset, as the pages see it.
 *
 * Built by tools/heroes.mjs out of two things that had never met: hero-index.json, which the
 * fingerprint job derives from the model paths inside every archive, and the catalog, which
 * knows what each mod looks like and who made it. Committed rather than fetched at build time,
 * because the pictures are committed beside it and the two have to agree.
 */
import data from '../data/heroes.json';

export interface HeroImage {
  src: string;
  width: number;
  height: number;
}

export interface HeroMod {
  name: string;
  styleLabel: string | null;
  /** Which parts of the hero this replaces: head, weapon, arms... Empty means a recolour. */
  slots: string[];
  image: HeroImage | null;
  author: string | null;
  authorUrl: string | null;
  /** Unix seconds, from the catalog. */
  date: number | null;
}

export interface Hero {
  id: string;
  name: string;
  slug: string;
  mods: HeroMod[];
}

export const heroes: Hero[] = (data as { heroes: Hero[] }).heroes;

export const heroBySlug = new Map(heroes.map((h) => [h.slug, h]));

export const totalHeroMods = heroes.reduce((n, h) => n + h.mods.length, 0);

/** A few other heroes to offer at the bottom, walking on from this one so they vary. */
export function neighbours(slug: string, count = 6): Hero[] {
  const at = heroes.findIndex((h) => h.slug === slug);
  if (at < 0) return heroes.slice(0, count);
  return Array.from({ length: count }, (_, i) => heroes[(at + i + 1) % heroes.length]);
}
