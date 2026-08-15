/**
 * Draw the link preview card for every page.
 *
 * One og.png used to serve all fourteen addresses, and its right half was a screenshot of the
 * app shrunk to the point where no word in it could be read. In a Discord message that is a
 * card carrying a logo and a blur, and it is identical whether the link went to the front page
 * or to the guide about bans.
 *
 * So every page gets its own, and the picture is the page's own headline set large enough to
 * read at the size a chat client actually draws it. Same reason the app's screenshots are not
 * in here: a 1200x630 card is read at about a third of that, and anything with a user interface
 * in it turns to mush.
 *
 * The files are written into public/ and committed, not generated during `astro build`. The
 * site rebuilds itself on a Linux runner every night, and the fonts this depends on are the
 * ones on the machine that runs it. Drawing them once, here, on a machine with Segoe UI, is
 * the difference between a card and a row of squares.
 *
 * Titles come from the same modules the pages use, so a card cannot claim a headline the page
 * does not have. Node reads the TypeScript directly.
 *
 * Usage: npm run og
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ogPath } from '../src/lib/og.ts';
import { docs, docsIndex, docSlugs } from '../src/i18n/docs.ts';
import { facts } from '../src/i18n/facts.ts';
import { heroCopy } from '../src/i18n/heroes.ts';
import { landing } from '../src/i18n/landing.ts';
import { siteStats } from '../src/lib/stats.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.resolve(here, '..', 'public');
const out = path.join(pub, 'og');

const W = 1200;
const H = 630;
const PAD = 80;

// The app's own palette, from src/styles/site.css.
const SURFACE = '#141218';
const PRIMARY = '#d0bcff';
const TEXT = '#f2ecf6';
const FAINT = '#938f99';

const HEAD = 'Segoe UI Semibold';
const BODY = 'Segoe UI';

/** A text layer, laid out and wrapped by Pango, as its own transparent image. */
async function text(str, { font, size, color, width, spacing = 6 }) {
  const escaped = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const buf = await sharp({
    text: {
      text: `<span foreground="${color}">${escaped}</span>`,
      font: `${font} ${size}`,
      rgba: true,
      width,
      wrap: 'word',
      spacing,
    },
  })
    .png()
    .toBuffer();
  const { width: w, height: h } = await sharp(buf).metadata();
  return { input: buf, w, h };
}

/**
 * The backdrop: the site's surface with the accent bleeding in from the top right, and a hair
 * of accent along the bottom edge so the card has a horizon instead of ending.
 */
const backdrop = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="glow" cx="0.82" cy="0.12" r="0.75">
      <stop offset="0%" stop-color="${PRIMARY}" stop-opacity="0.26"/>
      <stop offset="55%" stop-color="${PRIMARY}" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="${PRIMARY}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${SURFACE}"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect y="${H - 6}" width="${W}" height="6" fill="${PRIMARY}"/>
</svg>`);

/**
 * A headline gets the largest size that still fits three lines, because a card is read in the
 * half second before somebody decides whether to click, and one that has been shrunk to fit is
 * a card nobody reads.
 */
async function headline(str, { max, min, width, color = TEXT, font = HEAD, lines = 3 }) {
  for (let size = max; size > min; size -= 4) {
    const layer = await text(str, { font, size, color, width });
    if (layer.h <= size * 1.32 * lines) return layer;
  }
  return text(str, { font, size: min, color, width });
}

const icon = await sharp(path.join(pub, 'icon.png')).resize(64, 64).png().toBuffer();

/** The row that says whose card this is: the mark, then the name. */
async function brandRow(y) {
  const name = await text('DOTA 2 MOD MANAGER', { font: HEAD, size: 27, color: PRIMARY, width: 700 });
  return [
    { input: icon, left: PAD, top: y },
    { input: name.input, left: PAD + 64 + 22, top: y + Math.round((64 - name.h) / 2) },
  ];
}

/** The line along the bottom: where this is, and what part of it. */
async function footRow(section) {
  const line = await text(section ? `dota2modmanager.com   ·   ${section}` : 'dota2modmanager.com', {
    font: BODY,
    size: 26,
    color: FAINT,
    width: W - PAD * 2,
  });
  return { input: line.input, left: PAD, top: H - PAD - line.h + 8 };
}

/** Where the headline starts, and the last row the text block may reach before the foot line. */
const TOP = 208;
const FLOOR = H - PAD - 46;

async function card({ file, title, sub, section }) {
  const parts = [...(await brandRow(72))];

  const head = await headline(title, { max: 66, min: 40, width: W - PAD * 2 });
  parts.push({ input: head.input, left: PAD, top: TOP });

  // The subtitle is the part that gives way. A headline shrunk to make room for a caption is
  // two things nobody reads instead of one thing somebody does.
  if (sub) {
    const room = FLOOR - (TOP + head.h + 26);
    const lead = await headline(sub, { max: 30, min: 24, width: W - PAD * 2, color: FAINT, font: BODY, lines: 2 });
    if (lead.h <= room) parts.push({ input: lead.input, left: PAD, top: TOP + head.h + 26 });
    else console.warn(`${file}: no room for the subtitle under a ${head.h}px headline, dropped`);
  }

  parts.push(await footRow(section));

  const png = await sharp(backdrop).composite(parts).png({ compressionLevel: 9 }).toBuffer();
  fs.writeFileSync(path.join(out, file), png);
  return png.length;
}

// ---------------------------------------------------------------------------

fs.mkdirSync(out, { recursive: true });

const stats = await siteStats();

/** "1 102 мода", not "1 102 модов": the landing already owns the three forms, so borrow them. */
function mods(lang) {
  const locale = lang === 'ru' ? 'ru-RU' : 'en-US';
  const forms = landing[lang].statWords[0];
  const form = new Intl.PluralRules(locale).select(stats.mods);
  const noun = form === 'one' ? forms[0] : form === 'few' ? forms[1] : forms[2];
  return `${new Intl.NumberFormat(locale).format(stats.mods)} ${noun}`;
}

/**
 * What the front page's card says.
 *
 * Not the page title: a chat client prints that as the embed's heading directly above the
 * picture, so a card repeating it spends its whole area saying one thing twice. This says the
 * next thing instead.
 */
const home = {
  en: {
    title: `${mods('en')} for Dota 2 and free cosmetics`,
    sub: 'One click in, one click out. Builds you can send as a link. Windows, open source, no account.',
    section: 'Free · GPL-3.0',
  },
  ru: {
    title: `${mods('ru')} для Доты 2 и бесплатная косметика`,
    sub: 'Один клик поставить, один убрать. Сборки уходят ссылкой. Windows, открытый код, без аккаунта.',
    section: 'Бесплатно · GPL-3.0',
  },
};

const jobs = [];

for (const lang of ['en', 'ru']) {
  const guides = lang === 'ru' ? 'Гайды' : 'Guides';

  jobs.push({
    file: path.basename(ogPath(lang, '/')),
    title: home[lang].title,
    sub: home[lang].sub,
    section: home[lang].section,
  });

  jobs.push({
    file: path.basename(ogPath(lang, '/docs/')),
    title: docsIndex[lang].h1,
    sub: docsIndex[lang].lead,
    section: guides,
  });

  jobs.push({
    file: path.basename(ogPath(lang, '/facts/')),
    title: facts[lang].h1,
    sub: facts[lang].lead,
    section: lang === 'ru' ? 'Цифры и факты' : 'Facts',
  });

  // The hero index gets a card; the 126 hero pages send the mod art instead, which is a
  // better picture than their own name set in type would be.
  jobs.push({
    file: path.basename(ogPath(lang, '/heroes/')),
    title: heroCopy[lang].indexH1,
    sub: heroCopy[lang].indexLead,
    section: lang === 'ru' ? 'Герои' : 'Heroes',
  });

  for (const slug of docSlugs) {
    jobs.push({
      file: path.basename(ogPath(lang, `/docs/${slug}/`)),
      title: docs[lang][slug].h1,
      sub: docs[lang][slug].card,
      section: guides,
    });
  }
}

for (const job of jobs) {
  const bytes = await card(job);
  console.log(`${job.file.padEnd(30)} ${String(bytes).padStart(7)} bytes  ${job.title}`);
}

console.log(`\n${jobs.length} cards in public/og/`);
if (!stats.live) console.warn('stats: the catalog count is the committed fallback, not a fresh read');
