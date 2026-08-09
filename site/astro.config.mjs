// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/**
 * dota2modmanager.com
 *
 * English lives at the root and Russian under /ru/, because the app's own audience is split
 * the same way and English is what a search engine and a stranger land on first. The default
 * locale carries no prefix, so the address people share is the short one.
 *
 * The site is static: Cloudflare Pages serves the built folder and nothing runs on a server.
 */
export default defineConfig({
  site: 'https://dota2modmanager.com',
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
    }),
  ],
  build: { format: 'directory' },
});
