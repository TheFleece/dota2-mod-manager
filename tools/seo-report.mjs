#!/usr/bin/env node
/**
 * What the search engines are actually seeing, once a week, as a comment on one issue.
 *
 * Reading a webmaster console by hand happens twice and then stops. This pulls the numbers,
 * compares them with last week's, and writes the difference somewhere that arrives by itself.
 * A single number is nearly useless here - "position 14" means nothing without last week's
 * position 21 - so almost everything below is printed as a delta.
 *
 * Bing first because its API needs one key from a settings page. Yandex wants an OAuth app and
 * Google a service account with a delegated user; both fit the same shape and go in later, each
 * as another block() in the report.
 *
 * Read-only. Nothing here submits a URL, asks for a recrawl or changes a setting: those are
 * worth doing deliberately, not on a schedule while nobody is looking.
 *
 * Credentials come from the environment and are never printed, including in error messages -
 * an API key in a public build log is a key that has to be rotated.
 *
 * Usage:
 *   node tools/seo-report.mjs              # write report.md and update the state
 *   node tools/seo-report.mjs --dry        # print it, touch nothing
 *   node tools/seo-report.mjs --raw GetQueryStats   # dump one endpoint, for when a shape surprises us
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const STATE = path.join(root, 'seo-state.json');
const OUT = path.join(root, 'seo-report.md');

const SITE = process.env.SEO_SITE_URL || 'https://dota2modmanager.com';
const BING_KEY = process.env.BING_API_KEY || '';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const rawAt = args.indexOf('--raw');

/** Bing's JSON API: one key, one site, everything as a GET. */
async function bing(method, params = {}) {
  if (!BING_KEY) throw new Error('BING_API_KEY is not set');
  const url = new URL(`https://ssl.bing.com/webmaster/api.svc/json/${method}`);
  url.searchParams.set('apikey', BING_KEY);
  url.searchParams.set('siteUrl', SITE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const body = await res.text();
  if (!res.ok) {
    // The key rides in the query string, so the URL never goes into the message.
    throw new Error(`${method}: HTTP ${res.status} ${body.slice(0, 200)}`);
  }
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    throw new Error(`${method}: answer was not JSON (${body.slice(0, 120)})`);
  }
  // Bing wraps everything in { d: ... }, and d is sometimes a list and sometimes an object.
  return json.d ?? json;
}

/** Bing dates arrive as /Date(1723680000000)/. */
const asDate = (v) => {
  const m = typeof v === 'string' && /\/Date\((\d+)/.exec(v);
  return m ? new Date(Number(m[1])).toISOString().slice(0, 10) : null;
};

const num = (v) => (typeof v === 'number' ? v : 0);
const fmt = (n) => new Intl.NumberFormat('en-US').format(Math.round(n));

/** "1,240 (+180)" - the number, and what it did since last week. */
function delta(now, before) {
  if (before === undefined || before === null) return fmt(now);
  const d = now - before;
  if (Math.abs(d) < 0.005) return `${fmt(now)} (=)`;
  const sign = d > 0 ? '+' : '';
  const rounded = Number.isInteger(now) && Number.isInteger(before) ? fmt(d) : d.toFixed(1);
  return `${fmt(now)} (${sign}${rounded})`;
}

/** Just the movement, for a column that sits next to the number itself. */
function movement(now, before) {
  if (before === undefined || before === null) return 'first week';
  const d = now - before;
  if (Math.abs(d) < 0.005) return 'no change';
  const sign = d > 0 ? '+' : '';
  return Number.isInteger(now) && Number.isInteger(before) ? `${sign}${fmt(d)}` : `${sign}${d.toFixed(1)}`;
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE, 'utf-8'));
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------

// --raw is a hand-run debugging path and stops here. It is the one place that exits rather
// than falling through, because everything below it is the report it does not want to write.
if (rawAt >= 0) {
  const method = args[rawAt + 1];
  if (!method) {
    console.error('--raw needs a method name, e.g. --raw GetQueryStats');
    process.exit(1);
  }
  console.log(JSON.stringify(await bing(method), null, 2).slice(0, 8000));
  process.exit(0);
}

const was = loadState();
const now = { checkedAt: new Date().toISOString().slice(0, 10) };
const lines = [];
const notes = [];

lines.push(`## Search, week of ${now.checkedAt}`);
lines.push('');

// --- Bing -------------------------------------------------------------------

if (!BING_KEY) {
  lines.push('### Bing');
  lines.push('');
  lines.push('No `BING_API_KEY` set, so nothing was read. Add it as a repository secret and this fills in.');
  lines.push('');
} else {
  try {
    /* Traffic. Bing returns a row per day; the last seven are the week, and the seven before
       them are what the week is compared against, so a slow Tuesday does not read as a trend. */
    const traffic = await bing('GetRankAndTrafficStats');
    const rows = (Array.isArray(traffic) ? traffic : [])
      .map((r) => ({ date: asDate(r.Date), clicks: num(r.Clicks), impressions: num(r.Impressions) }))
      .filter((r) => r.date)
      .sort((a, b) => a.date.localeCompare(b.date));

    const week = rows.slice(-7);
    const clicks = week.reduce((n, r) => n + r.clicks, 0);
    const impressions = week.reduce((n, r) => n + r.impressions, 0);
    now.bing = { clicks, impressions };

    lines.push('### Bing');
    lines.push('');
    lines.push('| | last 7 days | vs the week before |');
    lines.push('|---|---|---|');
    lines.push(`| Clicks | ${fmt(clicks)} | ${movement(clicks, was.bing?.clicks)} |`);
    lines.push(`| Impressions | ${fmt(impressions)} | ${movement(impressions, was.bing?.impressions)} |`);
    lines.push('');

    /* Queries. The interesting part is not the top ten, which barely move, but what appeared
       for the first time: those are the pages that just started ranking for something. */
    const queries = await bing('GetQueryStats');
    const list = (Array.isArray(queries) ? queries : [])
      .map((q) => ({
        query: q.Query,
        clicks: num(q.Clicks),
        impressions: num(q.Impressions),
        position: num(q.AvgImpressionPosition),
      }))
      .filter((q) => q.query)
      .sort((a, b) => b.impressions - a.impressions);

    now.queries = Object.fromEntries(list.map((q) => [q.query, { i: q.impressions, p: q.position }]));

    if (list.length) {
      lines.push('<details><summary>Top queries</summary>');
      lines.push('');
      lines.push('| Query | Impressions | Clicks | Position (lower is better) |');
      lines.push('|---|---|---|---|');
      for (const q of list.slice(0, 25)) {
        const before = was.queries?.[q.query];
        lines.push(
          `| ${q.query} | ${delta(q.impressions, before?.i)} | ${fmt(q.clicks)} | ${delta(q.position, before?.p)} |`,
        );
      }
      lines.push('');
      lines.push('</details>');
      lines.push('');

      const fresh = list.filter((q) => was.queries && !(q.query in was.queries)).slice(0, 15);
      if (fresh.length) {
        lines.push(`**New this week:** ${fresh.map((q) => `\`${q.query}\``).join(', ')}`);
        lines.push('');
      }
      const lost = Object.keys(was.queries ?? {}).filter((q) => !(q in now.queries)).slice(0, 15);
      if (lost.length) {
        lines.push(`**Stopped showing:** ${lost.map((q) => `\`${q}\``).join(', ')}`);
        lines.push('');
      }
    }

    /* How much of the site Bing actually holds. The site went from 14 addresses to 358, and
       the question that matters is how many of them it has taken. */
    /* Field names read off the API rather than guessed: the first version asked for
       CrawledCount and HttpCode404, which do not exist, so both printed a confident zero.
       They are CrawledPages and Code4xx. Dump the shape with --raw before adding more. */
    const crawl = await bing('GetCrawlStats');
    const crawlRows = (Array.isArray(crawl) ? crawl : [])
      .map((r) => ({
        date: asDate(r.Date),
        crawled: num(r.CrawledPages),
        inIndex: num(r.InIndex),
        blocked: num(r.BlockedByRobotsTxt),
        notFound: num(r.Code4xx),
        serverErrors: num(r.Code5xx),
        errors: num(r.CrawlErrors) + num(r.DnsFailures) + num(r.ConnectionTimeout),
      }))
      .filter((r) => r.date)
      .sort((a, b) => a.date.localeCompare(b.date));

    const last = crawlRows.at(-1);
    if (last) {
      // Crawling is a rate, so the week's worth of it says more than the last day's.
      const crawledWeek = crawlRows.slice(-7).reduce((n, r) => n + r.crawled, 0);
      now.bingIndex = last.inIndex;
      now.bingCrawled = crawledWeek;

      lines.push('| Crawl | value | vs last week |');
      lines.push('|---|---|---|');
      lines.push(`| In the index | ${fmt(last.inIndex)} | ${movement(last.inIndex, was.bingIndex)} |`);
      lines.push(`| Pages crawled in 7 days | ${fmt(crawledWeek)} | ${movement(crawledWeek, was.bingCrawled)} |`);
      lines.push(`| 4xx | ${fmt(last.notFound)} | |`);
      lines.push(`| 5xx | ${fmt(last.serverErrors)} | |`);
      lines.push(`| Blocked by robots.txt | ${fmt(last.blocked)} | |`);
      lines.push('');

      if (last.inIndex < 300) notes.push(`Bing holds ${fmt(last.inIndex)} pages of the 358 in the sitemap.`);
      if (last.notFound > 0) notes.push(`${fmt(last.notFound)} pages answered 4xx.`);
      if (last.serverErrors > 0) notes.push(`${fmt(last.serverErrors)} pages answered 5xx, which is ours to fix.`);
      if (last.errors > 0) notes.push(`${fmt(last.errors)} crawl failures (DNS, timeouts).`);
      if (last.blocked > 0) notes.push(`${fmt(last.blocked)} pages blocked by robots.txt.`);
    }
  } catch (err) {
    lines.push('### Bing');
    lines.push('');
    lines.push(`Could not read it: \`${err.message}\``);
    lines.push('');
  }
}

// --- Yandex, Google ---------------------------------------------------------

lines.push('### Yandex, Google');
lines.push('');
lines.push('Not connected yet. Yandex needs an OAuth app, Google a service account added as a user in Search Console.');
lines.push('');

if (notes.length) {
  lines.push('### Worth a look');
  lines.push('');
  for (const n of notes) lines.push(`- ${n}`);
  lines.push('');
}

const report = lines.join('\n');

// Ending by falling off the bottom rather than by process.exit: the sockets fetch leaves open
// are still closing, and killing the process out from under them makes libuv complain.
if (dry) {
  console.log(report);
} else {
  fs.writeFileSync(OUT, report);
  fs.writeFileSync(STATE, JSON.stringify(now, null, 0));
  console.log(`wrote ${path.relative(root, OUT)} and ${path.relative(root, STATE)}`);
}
