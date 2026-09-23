/**
 * The privacy policy and the terms, read from docs/ when the site is built.
 *
 * docs/privacy/index.html and docs/terms/index.html were written in July 2026 for the Discord
 * application, which asks for both, and were served from thefleece.github.io until the
 * repository moved. They stay the one copy. Each holds an English and a Russian article, and this
 * lifts the article for one language into the site's own layout, the way tools/preset-page.mjs
 * carries the preset page over. The back link goes, because the site has a header of its own.
 *
 * A heading or a date that goes missing from either file fails the build here, rather than
 * leaving a page without a title on the site.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './paths';
import type { Lang } from '../i18n/ui';

export type LegalPage = 'privacy' | 'terms';

export interface LegalDoc {
  title: string;
  /** The line under the heading, which carries the date the text was last changed. */
  date: string;
  /** The article without its heading, date and back link. Our own file, so it is used as HTML. */
  body: string;
  /** The first paragraph as plain text, cut for a meta description. */
  description: string;
}

export function legal(page: LegalPage, lang: Lang): LegalDoc {
  const file = path.join(REPO_ROOT, 'docs', page, 'index.html');
  const html = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const article = new RegExp(`<article data-lang="${lang}">([\\s\\S]*?)</article>`).exec(html);
  if (!article) throw new Error(`docs/${page}/index.html has no article for "${lang}"`);
  let body = article[1];
  const title = (/<h1>([^<]+)<\/h1>/.exec(body) || [])[1];
  const date = (/<div class="date">([^<]+)<\/div>/.exec(body) || [])[1];
  if (!title || !date) throw new Error(`docs/${page}/index.html (${lang}) lost its heading or its date line`);
  body = cut(cut(cut(body, '<h1>', '</h1>'), '<div class="date">', '</div>'), '<a class="back"', '</a>').trim();
  const first = textOf((/<p>([\s\S]*?)<\/p>/.exec(body) || [])[1] || title);
  const description = first.length > 160 ? `${first.slice(0, 157).replace(/\s+\S*$/, '')}…` : first;
  return { title, date, body, description };
}

/* The heading, the date and the back link are taken out by position rather than by a pattern.
   These are known elements of our own file, not markup being cleaned, and a pattern-based removal
   reads to CodeQL as a sanitizer that could leave half a tag behind. */
function cut(html: string, open: string, close: string): string {
  const from = html.indexOf(open);
  if (from < 0) return html;
  const to = html.indexOf(close, from);
  return to < 0 ? html : html.slice(0, from) + html.slice(to + close.length);
}

/* Plain text for a meta description: everything between a < and the next > is skipped, so no
   bracket can survive into the result whatever the markup looks like. */
function textOf(html: string): string {
  let out = '';
  let inTag = false;
  for (const ch of html) {
    if (ch === '<') inTag = true;
    else if (ch === '>') inTag = false;
    else if (!inTag) out += ch;
  }
  return out.replace(/\s+/g, ' ').trim();
}
