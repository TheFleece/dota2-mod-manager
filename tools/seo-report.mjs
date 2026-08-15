#!/usr/bin/env node
/**
 * What the search engines are actually seeing, once a week, as a comment on one issue.
 *
 * Reading a webmaster console by hand happens twice and then stops. This pulls the numbers,
 * compares them with last week's, and writes the difference somewhere that arrives by itself.
 * A single number is nearly useless here - "position 14" means nothing without last week's
 * position 21 - so almost everything below is printed as a delta.
 *
 * Three consoles, one comment. Bing takes a key from a settings page, Google a service account
 * added as a user in Search Console, Yandex an OAuth token. Each reads on its own and prints its
 * own block, so a console nobody has connected yet, or one having a bad morning, costs its
 * section and not the report.
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
 *   node tools/seo-report.mjs --raw GetQueryStats        # dump one Bing method
 *   node tools/seo-report.mjs --raw google:sites         # dump one Search Console path
 *   node tools/seo-report.mjs --raw yandex:user          # dump one Webmaster path
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const STATE = path.join(root, 'seo-state.json');
const OUT = path.join(root, 'seo-report.md');

const SITE = process.env.SEO_SITE_URL || 'https://dota2modmanager.com';
const HOST = new URL(SITE).hostname;
const BING_KEY = process.env.BING_API_KEY || '';
const GOOGLE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
const YANDEX_TOKEN = process.env.YANDEX_OAUTH_TOKEN || '';

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

/**
 * A Google service account key, signed into an access token. No library for this: the exchange
 * is one JWT and one POST, and pulling in a dependency to make a single signature would put a
 * supply chain between us and a weekly report.
 *
 * The account has to be added under Settings, Users and permissions in Search Console before any
 * of this returns anything but 403 - owning the project the key came from grants nothing.
 */
let googleAccess = null;
async function googleToken() {
  if (googleAccess) return googleAccess;
  let key;
  try {
    key = JSON.parse(GOOGLE_KEY);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not JSON');
  }
  if (!key.client_email || !key.private_key) throw new Error('that JSON has no client_email or private_key');

  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const iat = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat,
    exp: iat + 3600,
  })}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(key.private_key).toString('base64url')}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const json = await res.json().catch(() => ({}));
  // The assertion carries the private key's signature, so it stays out of the message.
  if (!json.access_token) throw new Error(`token: HTTP ${res.status} ${String(json.error_description || json.error || '').slice(0, 160)}`);
  googleAccess = json.access_token;
  return googleAccess;
}

/** Search Console. A body makes it a POST, which is how searchAnalytics wants to be asked. */
async function google(pathname, body) {
  const token = await googleToken();
  const res = await fetch(`https://www.googleapis.com/webmasters/v3/${pathname}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${pathname}: HTTP ${res.status} ${text.slice(0, 200)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${pathname}: answer was not JSON (${text.slice(0, 120)})`);
  }
}

/**
 * Which property to read. Search Console keeps a domain property as "sc-domain:example.com" and
 * a URL property as the address with its trailing slash, and asking for the wrong one is a 403,
 * so the list of what the account can see decides rather than a guess in a constant.
 */
async function googleProperty() {
  const { siteEntry = [] } = await google('sites');
  const exact = [`sc-domain:${HOST}`, `${SITE}/`, SITE];
  const found = siteEntry.find((s) => exact.includes(s.siteUrl)) || siteEntry.find((s) => (s.siteUrl || '').includes(HOST));
  if (!found) {
    throw new Error(`the service account can see ${siteEntry.length} properties and none of them is ${HOST}. Add it under Settings, Users and permissions`);
  }
  return found.siteUrl;
}

/** Yandex Webmaster v4. The token is a header, so nothing secret can end up in a logged URL. */
async function yandex(pathname, params = {}) {
  if (!YANDEX_TOKEN) throw new Error('YANDEX_OAUTH_TOKEN is not set');
  const url = new URL(`https://api.webmaster.yandex.net/v4/${pathname}`);
  for (const [k, v] of Object.entries(params)) {
    for (const one of Array.isArray(v) ? v : [v]) url.searchParams.append(k, one);
  }
  const res = await fetch(url, { headers: { Authorization: `OAuth ${YANDEX_TOKEN}`, Accept: 'application/json' } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${pathname}: HTTP ${res.status} ${text.slice(0, 200)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${pathname}: answer was not JSON (${text.slice(0, 120)})`);
  }
}

/** The host id is "https:example.com:443", colons and all, and it travels inside a path. */
async function yandexHost() {
  const { user_id: userId } = await yandex('user');
  if (!userId) throw new Error('the token did not resolve to a user');
  const { hosts = [] } = await yandex(`user/${userId}/hosts`);
  const mine = hosts.filter((h) => (h.ascii_host_url || '').includes(HOST));
  // A site is usually listed under several addresses; the main mirror is the one with the data.
  const main = mine.find((h) => h.main_mirror?.host_id === h.host_id) || mine[0];
  if (!main) throw new Error(`the token sees ${hosts.length} sites and none of them is ${HOST}`);
  if (!main.verified) throw new Error(`${HOST} is in the account but not verified`);
  return { userId, hostId: main.host_id };
}

/** YYYY-MM-DD, n days back. Both consoles want plain dates and no time. */
const dayAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

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
    console.error('--raw needs a method, e.g. --raw GetQueryStats, --raw google:sites, --raw yandex:user');
    process.exit(1);
  }
  let out;
  if (method.startsWith('google:')) {
    const what = method.slice(7);
    // The one shape worth dumping is the one that needs a body, so it gets a name of its own.
    out = what === 'query'
      ? await google(`sites/${encodeURIComponent(await googleProperty())}/searchAnalytics/query`, {
          startDate: dayAgo(9),
          endDate: dayAgo(3),
          dimensions: ['query'],
          rowLimit: 10,
        })
      : await google(what);
  } else if (method.startsWith('yandex:')) {
    // {u} and {h} save looking the ids up by hand: user/{u}/hosts/{h}/summary reads as it runs.
    let where = method.slice(7);
    if (where.includes('{u}') || where.includes('{h}')) {
      const { userId, hostId } = await yandexHost();
      where = where.replaceAll('{u}', userId).replaceAll('{h}', encodeURIComponent(hostId));
    }
    out = await yandex(where);
  } else {
    out = await bing(method);
  }
  console.log(JSON.stringify(out, null, 2).slice(0, 8000));
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

// --- Google -----------------------------------------------------------------

lines.push('### Google');
lines.push('');

if (!GOOGLE_KEY) {
  lines.push('No `GOOGLE_SERVICE_ACCOUNT_JSON` set, so nothing was read. Add the service account key as a repository secret, and add its address as a user in Search Console.');
  lines.push('');
} else {
  try {
    const property = await googleProperty();
    /* Search Console keeps counting a day for two to three more days, so the week that ended
       three days ago is the last one that will not quietly change between reports. */
    const startDate = dayAgo(9);
    const endDate = dayAgo(3);
    const ask = (body) =>
      google(`sites/${encodeURIComponent(property)}/searchAnalytics/query`, { startDate, endDate, ...body });

    const totals = await ask({ dimensions: [] });
    const row = totals.rows?.[0];
    const clicks = num(row?.clicks);
    const impressions = num(row?.impressions);
    const position = num(row?.position);
    now.google = { clicks, impressions, position };

    lines.push(`| | ${startDate} to ${endDate} | vs the week before |`);
    lines.push('|---|---|---|');
    lines.push(`| Clicks | ${fmt(clicks)} | ${movement(clicks, was.google?.clicks)} |`);
    lines.push(`| Impressions | ${fmt(impressions)} | ${movement(impressions, was.google?.impressions)} |`);
    lines.push(`| Average position (lower is better) | ${position.toFixed(1)} | ${movement(position, was.google?.position)} |`);
    lines.push('');

    /* How much of the site Google shows at all. There is no index count in this API, and the
       URL inspection endpoint answers one address at a time, so the honest measure is how many
       pages were put in front of somebody this week. */
    const pages = await ask({ dimensions: ['page'], rowLimit: 1000 });
    const shown = (pages.rows ?? []).length;
    now.googlePages = shown;
    lines.push(`Pages shown in results this week: **${fmt(shown)}** of 358 (${movement(shown, was.googlePages)}).`);
    lines.push('');

    const queries = await ask({ dimensions: ['query'], rowLimit: 25 });
    const list = (queries.rows ?? []).map((r) => ({
      query: r.keys?.[0],
      clicks: num(r.clicks),
      impressions: num(r.impressions),
      position: num(r.position),
    })).filter((q) => q.query);

    now.gQueries = Object.fromEntries(list.map((q) => [q.query, { i: q.impressions, p: q.position }]));

    if (list.length) {
      lines.push('<details><summary>Top queries</summary>');
      lines.push('');
      lines.push('| Query | Impressions | Clicks | Position (lower is better) |');
      lines.push('|---|---|---|---|');
      for (const q of list) {
        const before = was.gQueries?.[q.query];
        lines.push(`| ${q.query} | ${delta(q.impressions, before?.i)} | ${fmt(q.clicks)} | ${delta(q.position, before?.p)} |`);
      }
      lines.push('');
      lines.push('</details>');
      lines.push('');

      const fresh = list.filter((q) => was.gQueries && !(q.query in was.gQueries)).slice(0, 15);
      if (fresh.length) {
        lines.push(`**New this week:** ${fresh.map((q) => `\`${q.query}\``).join(', ')}`);
        lines.push('');
      }
    } else {
      lines.push('No queries came back for the week, which is what a property that was added days ago looks like.');
      lines.push('');
    }

    if (shown > 0 && shown < 300) notes.push(`Google showed ${fmt(shown)} pages of the 358 in the sitemap.`);
  } catch (err) {
    lines.push(`Could not read it: \`${err.message}\``);
    lines.push('');
  }
}

// --- Yandex -----------------------------------------------------------------

lines.push('### Yandex');
lines.push('');

if (!YANDEX_TOKEN) {
  lines.push('No `YANDEX_OAUTH_TOKEN` set, so nothing was read. Add the token as a repository secret and this fills in.');
  lines.push('');
} else {
  try {
    const { userId, hostId } = await yandexHost();
    const host = `user/${userId}/hosts/${encodeURIComponent(hostId)}`;
    const dateFrom = dayAgo(8);
    const dateTo = dayAgo(1);

    /* Numbers that are missing print as n/a rather than as zero. Bing taught this the hard way:
       a field name that does not exist reads as a confident nothing and nobody questions it. */
    const summary = await yandex(`${host}/summary`);
    const cell = (v) => (typeof v === 'number' ? fmt(v) : 'n/a');
    const moved = (v, before) => (typeof v === 'number' ? movement(v, before) : '');
    now.yandex = {
      sqi: summary.sqi,
      inSearch: summary.searchable_pages_count,
      excluded: summary.excluded_pages_count,
    };

    lines.push('| | value | vs last week |');
    lines.push('|---|---|---|');
    lines.push(`| Site quality index | ${cell(summary.sqi)} | ${moved(summary.sqi, was.yandex?.sqi)} |`);
    lines.push(`| Pages in search | ${cell(summary.searchable_pages_count)} | ${moved(summary.searchable_pages_count, was.yandex?.inSearch)} |`);
    lines.push(`| Excluded | ${cell(summary.excluded_pages_count)} | ${moved(summary.excluded_pages_count, was.yandex?.excluded)} |`);
    lines.push('');

    const popular = await yandex(`${host}/search-queries/popular`, {
      order_by: 'TOTAL_SHOWS',
      query_indicator: ['TOTAL_SHOWS', 'TOTAL_CLICKS', 'AVG_SHOW_POSITION'],
      date_from: dateFrom,
      date_to: dateTo,
      limit: 100,
    });
    const list = (popular.queries ?? []).map((q) => ({
      query: q.query_text,
      impressions: num(q.indicators?.TOTAL_SHOWS),
      clicks: num(q.indicators?.TOTAL_CLICKS),
      position: num(q.indicators?.AVG_SHOW_POSITION),
    })).filter((q) => q.query);

    /* Yandex answers per query, not per site, so this is the sum of what came back and the
       table says so. A hundred queries covers a site this size; the label keeps it honest if
       it ever stops covering it. */
    const shows = list.reduce((n, q) => n + q.impressions, 0);
    const clicks = list.reduce((n, q) => n + q.clicks, 0);
    now.yandexTraffic = { shows, clicks };
    now.yQueries = Object.fromEntries(list.slice(0, 40).map((q) => [q.query, { i: q.impressions, p: q.position }]));

    lines.push(`| Across the top ${list.length} queries, ${dateFrom} to ${dateTo} | | |`);
    lines.push('|---|---|---|');
    lines.push(`| Impressions | ${fmt(shows)} | ${movement(shows, was.yandexTraffic?.shows)} |`);
    lines.push(`| Clicks | ${fmt(clicks)} | ${movement(clicks, was.yandexTraffic?.clicks)} |`);
    lines.push('');

    if (list.length) {
      lines.push('<details><summary>Top queries</summary>');
      lines.push('');
      lines.push('| Query | Impressions | Clicks | Position (lower is better) |');
      lines.push('|---|---|---|---|');
      for (const q of list.slice(0, 25)) {
        const before = was.yQueries?.[q.query];
        lines.push(`| ${q.query} | ${delta(q.impressions, before?.i)} | ${fmt(q.clicks)} | ${delta(q.position, before?.p)} |`);
      }
      lines.push('');
      lines.push('</details>');
      lines.push('');

      const fresh = list.slice(0, 40).filter((q) => was.yQueries && !(q.query in was.yQueries)).slice(0, 15);
      if (fresh.length) {
        lines.push(`**New this week:** ${fresh.map((q) => `\`${q.query}\``).join(', ')}`);
        lines.push('');
      }
    }

    /* Yandex counts its own problems and grades them itself, so they are worth repeating rather
       than re-deriving: FATAL is the site being dropped, CRITICAL is on its way there. */
    for (const [grade, count] of Object.entries(summary.site_problems ?? {})) {
      if (num(count) > 0) notes.push(`Yandex reports ${count} ${grade.toLowerCase()} site problem(s), listed in the console under Diagnostics.`);
    }
    if (typeof summary.searchable_pages_count === 'number' && summary.searchable_pages_count < 300) {
      notes.push(`Yandex holds ${fmt(summary.searchable_pages_count)} pages of the 358 in the sitemap.`);
    }
  } catch (err) {
    lines.push(`Could not read it: \`${err.message}\``);
    lines.push('');
  }
}

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
