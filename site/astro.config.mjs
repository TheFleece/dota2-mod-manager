// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { docs, docsIndex } from './src/i18n/docs.ts';
import {
  shotNames,
  shotUrl,
  shotAlt,
  shotTitle,
  tourUrl,
  tourPoster,
  tourText,
  TOUR_SECONDS,
  TOUR_UPLOADED,
} from './src/lib/media.ts';
import { ogPath } from './src/lib/og.ts';

/**
 * dota2modmanager.com
 *
 * English lives at the root and Russian under /ru/, because the app's own audience is split
 * the same way and English is what a search engine and a stranger land on first. The default
 * locale carries no prefix, so the address people share is the short one.
 *
 * The site is static: Cloudflare Pages serves the built folder and nothing runs on a server.
 */
const SITE = 'https://dota2modmanager.com';
const abs = (p) => `${SITE}${p}`;

/** "/ru/docs/vpk/" -> ["ru", "/docs/vpk/"]; anything else is English at the root. */
function split(url) {
  const p = new URL(url).pathname;
  return p === '/ru/' || p.startsWith('/ru/') ? ['ru', p.slice(3) || '/'] : ['en', p];
}

/** The words that belong to a page's own preview card. */
function cardText(lang, path) {
  if (path === '/') {
    return {
      title: 'Dota 2 Mod Manager',
      caption: lang === 'ru' ? 'Мод-менеджер для Доты 2' : 'A mod manager for Dota 2',
    };
  }
  if (path === '/docs/') return { title: docsIndex[lang].h1, caption: docsIndex[lang].description };
  const doc = docs[lang][path.split('/')[2]];
  return doc ? { title: doc.h1, caption: doc.description } : null;
}

export default defineConfig({
  site: SITE,
  trailingSlash: 'always',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ru'],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: { en: 'en', ru: 'ru' },
      },
      /**
       * Say out loud what is on each page besides words.
       *
       * A sitemap listing fourteen addresses tells an image crawler nothing about the pictures
       * on them, and Google Images had three results for this site because three was most of
       * what it had found. Every page now submits its own preview card, the landing submits the
       * three screenshots and the clip, and each one arrives with a title and a caption in the
       * language of the page it belongs to.
       *
       * The `img` and `video` fields are not in @astrojs/sitemap's narrowed type, but the item
       * goes straight to the `sitemap` package underneath, which is what defines them.
       */
      serialize(item) {
        const [lang, path] = split(item.url);
        const card = cardText(lang, path);

        const img = card
          ? [{ url: abs(ogPath(lang, path)), title: card.title, caption: card.caption }]
          : [];

        if (path === '/') {
          for (const name of shotNames) {
            img.push({
              url: abs(shotUrl(lang, name)),
              title: shotTitle[lang][name],
              caption: shotAlt[lang][name],
            });
          }
          item.video = [
            {
              thumbnail_loc: abs(tourPoster(lang)),
              title: tourText[lang].name,
              description: tourText[lang].description,
              content_loc: abs(tourUrl(lang)),
              duration: TOUR_SECONDS,
              publication_date: TOUR_UPLOADED,
              family_friendly: 'yes',
              live: 'no',
            },
          ];
        }

        if (img.length) item.img = img;
        return item;
      },
    }),
  ],
  build: { format: 'directory' },
});
