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

/** The app's version, read from the repository at build time so it cannot go stale. */
function appVersion(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const pkg = path.resolve(here, '..', '..', '..', 'package.json');
  return JSON.parse(fs.readFileSync(pkg, 'utf-8')).version;
}

export function landingSchema(lang: 'en' | 'ru', origin = 'https://dota2modmanager.com') {
  const url = lang === 'en' ? `${origin}/` : `${origin}/${lang}/`;
  const t = landing[lang];

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
    image: `${origin}/og.png`,
    screenshot: [`${origin}/screenshots/${lang}-catalog.webp`, `${origin}/screenshots/${lang}-library.webp`],
    featureList: t.cards.map(([title]) => title),
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: { '@type': 'Person', name: 'Mykhailo Lynnyk', url: 'https://github.com/TheFleece' },
    about: {
      '@type': 'VideoGame',
      name: 'Dota 2',
      publisher: { '@type': 'Organization', name: 'Valve Corporation' },
    },
  };

  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Dota 2 Mod Manager',
    url: `${origin}/`,
    inLanguage: lang,
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

  return [software, website, faq];
}
