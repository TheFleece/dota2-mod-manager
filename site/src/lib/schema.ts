/**
 * The structured data for the landing page, in one place so the two languages cannot drift.
 *
 * Three nodes rather than one: what the software is, what the site is, and the questions the
 * page already answers in its own words. The questions are read out of the landing copy
 * instead of being retyped here, because a FAQ in the markup that disagrees with the FAQ on
 * the screen is the one kind of structured data that gets a site penalised.
 *
 * Nothing here is invented. There is no aggregateRating, because nobody has rated it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { landing } from '../i18n/landing';
import { plainText } from './text';
import { ogPath } from './og';
import {
  shotNames,
  shotUrl,
  shotAlt,
  shotTitle,
  tourUrl,
  tourPoster,
  tourText,
  TOUR_ISO,
  TOUR_UPLOADED,
  SHOT_SIZE,
  TOUR_SIZE,
} from './media';

/** The app's version, read from the repository at build time so it cannot go stale. */
function appVersion(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const pkg = path.resolve(here, '..', '..', '..', 'package.json');
  return JSON.parse(fs.readFileSync(pkg, 'utf-8')).version;
}

/**
 * The one person behind this, as a node other nodes can point at.
 *
 * Given an @id, the author of a guide, the publisher of the site and the author of the app are
 * one entity rather than three copies of a name, which is the difference between a search
 * engine knowing who made this and reading the same string three times.
 */
export function authorNode(origin = 'https://dota2modmanager.com') {
  return {
    '@type': 'Person',
    '@id': `${origin}/#author`,
    name: 'Mykhailo Lynnyk',
    url: 'https://github.com/TheFleece',
    sameAs: ['https://github.com/TheFleece'],
  };
}

export function landingSchema(lang: 'en' | 'ru', origin = 'https://dota2modmanager.com') {
  const url = lang === 'en' ? `${origin}/` : `${origin}/${lang}/`;
  const t = landing[lang];
  const author = authorNode(origin);

  const software = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Dota 2 Mod Manager',
    alternateName: lang === 'ru' ? 'Менеджер модов для Dota 2' : 'Dota 2 Mods Manager',
    applicationCategory: 'GameApplication',
    applicationSubCategory: lang === 'ru' ? 'Менеджер модов' : 'Mod manager',
    operatingSystem: 'Windows 10, Windows 11',
    url,
    downloadUrl: 'https://github.com/TheFleece/dota2-mod-manager/releases/latest',
    installUrl: 'https://github.com/TheFleece/dota2-mod-manager/releases/latest',
    softwareVersion: appVersion(),
    license: 'https://www.gnu.org/licenses/gpl-3.0.html',
    isAccessibleForFree: true,
    inLanguage: lang === 'ru' ? ['ru', 'en'] : ['en', 'ru'],
    softwareHelp: { '@type': 'CreativeWork', url: `${url}docs/` },
    // The card image, not a screenshot: it is the one picture here that still reads at the
    // size a search result shows, and it is what Google is being offered as the thumbnail.
    image: `${origin}${ogPath(lang, '/')}`,
    // Every screen, as a described object rather than a bare address. A screenshot listed as a
    // URL is a file; one with a caption and a size is a picture an image search can place.
    screenshot: shotNames.map((name) => ({
      '@type': 'ImageObject',
      url: `${origin}${shotUrl(lang, name)}`,
      contentUrl: `${origin}${shotUrl(lang, name)}`,
      name: shotTitle[lang][name],
      caption: shotAlt[lang][name],
      width: SHOT_SIZE.width,
      height: SHOT_SIZE.height,
      encodingFormat: 'image/webp',
    })),
    featureList: t.cards.map(([title]) => title),
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: { '@id': author['@id'] },
    about: {
      '@type': 'VideoGame',
      name: 'Dota 2',
      publisher: { '@type': 'Organization', name: 'Valve Corporation' },
    },
  };

  /**
   * The name Google prints above a result.
   *
   * It shows "dota2modmanager" there, not "Dota 2 Mod Manager", which is what a domain three
   * weeks old gets by default: the algorithm falls back to the address until enough agrees
   * with it. Everything it reads to decide is stated here and matched by og:site_name, the
   * <title> and the H1 - name, the other names people use, and who publishes it.
   */
  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${origin}/#website`,
    name: 'Dota 2 Mod Manager',
    alternateName:
      lang === 'ru'
        ? ['Менеджер модов для Dota 2', 'Мод-менеджер для Доты 2', 'D2MM']
        : ['Dota 2 Mods Manager', 'D2MM'],
    url: `${origin}/`,
    inLanguage: lang,
    publisher: { '@id': author['@id'] },
  };

  /**
   * The clip on the landing, declared.
   *
   * Google will not put a page in the video results for having a <video> tag in it: it wants a
   * name, a description, a thumbnail and a date, and it reads them from here. The search for
   * "dota 2 mod manager" fills its video row with other people's tutorials, and this is the
   * half of the fix that lives on the site. The other half is a video sitemap, in astro.config.
   */
  const video = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: tourText[lang].name,
    description: tourText[lang].description,
    thumbnailUrl: [`${origin}${tourPoster(lang)}`],
    contentUrl: `${origin}${tourUrl(lang)}`,
    uploadDate: TOUR_UPLOADED,
    duration: TOUR_ISO,
    width: TOUR_SIZE.width,
    height: TOUR_SIZE.height,
    encodingFormat: 'video/webm',
    inLanguage: lang,
    isFamilyFriendly: true,
    author: { '@id': author['@id'] },
    publisher: { '@id': author['@id'] },
    embedUrl: url,
  };

  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: t.faq.map(([q, a]) => ({
      '@type': 'Question',
      name: plainText(q),
      acceptedAnswer: { '@type': 'Answer', text: plainText(a) },
    })),
  };

  return [{ '@context': 'https://schema.org', ...author }, software, website, video, faq];
}
