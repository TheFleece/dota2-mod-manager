/**
 * /activity.svg - what has actually happened in this repository, drawn at build time.
 *
 * The README needs a picture of the project being alive, and the usual answer is a third-party
 * widget: hand a service the repository name, get back a hosted image, and accept that every
 * reader of the page now loads something from a company nobody chose. This project says in
 * PRIVACY.md that it collects nothing, and an embedded analytics image sits badly next to that.
 *
 * The other usual answer is a workflow that redraws a chart and commits it, which is how the
 * log filled up with bot noise in the first place.
 *
 * So it is generated here, from `git log` in the build checkout, and served from our own
 * domain. The site already rebuilds daily, on release and on change, so the picture is at most
 * a day old and nothing has to be committed for it to move.
 *
 * It needs history: the site workflow checks out with fetch-depth 0 for this. Without it the
 * card says so rather than drawing a flat line and calling that the truth.
 */
import type { APIRoute } from 'astro';
import { execFileSync } from 'node:child_process';

const DAYS = 60;
const W = 900;
const H = 232;

/** Commits are automation when they come from the Actions bot; everything else is a person. */
const BOT = /\[bot\]|github-actions/i;

type Day = { date: string; human: number; ci: number };

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** One entry per day in the window, oldest first, zeros included. */
function history(): { days: Day[]; total: number; human: number; ci: number; since: string } {
  const log = git(['log', '--no-merges', '--pretty=%cI\t%ae']).trim().split('\n');

  const buckets = new Map<string, Day>();
  const today = new Date();
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    buckets.set(iso(d), { date: iso(d), human: 0, ci: 0 });
  }

  let total = 0;
  let human = 0;
  let ci = 0;
  let since = '';
  for (const line of log) {
    const [when, email = ''] = line.split('\t');
    if (!when) continue;
    total += 1;
    const bot = BOT.test(email);
    if (bot) ci += 1; else human += 1;
    since = when.slice(0, 10);
    const bucket = buckets.get(when.slice(0, 10));
    if (bucket) bucket[bot ? 'ci' : 'human'] += 1;
  }

  return { days: [...buckets.values()], total, human, ci, since };
}

/** Release tags that landed inside the window, so the bars can be read against them. */
function releases(days: Day[]): { date: string; name: string }[] {
  const first = days[0].date;
  const out = git(['tag', '--sort=creatordate', '--format=%(creatordate:short)\t%(refname:short)'])
    .trim()
    .split('\n')
    .map((l) => l.split('\t'))
    .filter(([date, name]) => date && name && date >= first)
    .map(([date, name]) => ({ date, name }));
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function card(body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Project activity">
<defs>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#141218"/><stop offset="1" stop-color="#221d2f"/>
  </linearGradient>
  <style>
    .t { font-family: 'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif; }
    .m { font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  </style>
</defs>
<rect width="${W}" height="${H}" rx="10" fill="url(#g)"/>
${body}
</svg>
`;
}

function draw(): string {
  const { days, total, human, ci, since } = history();
  const tags = releases(days);

  const left = 28;
  const right = W - 28;
  const baseline = 158;
  const top = 62;
  const slot = (right - left) / days.length;
  const bar = Math.max(3, slot - 3);
  const peak = Math.max(1, ...days.map((d) => d.human + d.ci));
  const scale = (n: number) => (n / peak) * (baseline - top);

  const bars = days
    .map((d, i) => {
      const x = left + i * slot;
      const hHuman = scale(d.human);
      const hCi = scale(d.ci);
      const parts: string[] = [];
      if (d.human + d.ci === 0) {
        parts.push(`<rect x="${x.toFixed(1)}" y="${baseline - 2}" width="${bar.toFixed(1)}" height="2" rx="1" fill="#ffffff" fill-opacity="0.07"/>`);
      }
      if (hCi > 0) {
        parts.push(`<rect x="${x.toFixed(1)}" y="${(baseline - hCi).toFixed(1)}" width="${bar.toFixed(1)}" height="${hCi.toFixed(1)}" rx="2" fill="#4f378b"/>`);
      }
      if (hHuman > 0) {
        parts.push(`<rect x="${x.toFixed(1)}" y="${(baseline - hCi - hHuman).toFixed(1)}" width="${bar.toFixed(1)}" height="${hHuman.toFixed(1)}" rx="2" fill="#d0bcff"/>`);
      }
      return parts.join('');
    })
    .join('');

  const index = new Map(days.map((d, i) => [d.date, i]));
  const marks = tags
    .filter((t) => index.has(t.date))
    .map((t) => {
      const x = left + (index.get(t.date) as number) * slot + bar / 2;
      return `<circle cx="${x.toFixed(1)}" cy="${baseline + 12}" r="2.6" fill="#2bffa3" fill-opacity="0.85"/>`;
    })
    .join('');

  const last = tags[tags.length - 1];
  const firstDay = days[0].date;
  const lastDay = days[days.length - 1].date;

  return card(`
<text class="t" x="28" y="34" fill="#efe9ff" font-size="17" font-weight="700">Project activity</text>
<text class="t" x="28" y="52" fill="#8d84a6" font-size="12">Commits per day over the last ${DAYS}, read from the repository when this page was built.</text>

<g class="t" font-size="11" fill="#8d84a6">
  <rect x="${right - 232}" y="26" width="9" height="9" rx="2" fill="#d0bcff"/>
  <text x="${right - 218}" y="34">by hand</text>
  <rect x="${right - 148}" y="26" width="9" height="9" rx="2" fill="#4f378b"/>
  <text x="${right - 134}" y="34">from CI</text>
  <circle cx="${right - 62}" cy="30.5" r="3" fill="#2bffa3" fill-opacity="0.85"/>
  <text x="${right - 52}" y="34">release</text>
</g>

${bars}
<rect x="${left}" y="${baseline + 1}" width="${right - left}" height="1" fill="#ffffff" fill-opacity="0.10"/>
${marks}

<text class="m" x="${left}" y="${baseline + 32}" fill="#6b6383" font-size="10">${firstDay}</text>
<text class="m" x="${right}" y="${baseline + 32}" fill="#6b6383" font-size="10" text-anchor="end">${lastDay}</text>

<text class="t" x="${left}" y="${H - 14}" fill="#9a8fb8" font-size="12">${total} commits since ${esc(since)} <tspan fill="#5b5473">/</tspan> ${human} by hand <tspan fill="#5b5473">/</tspan> ${ci} from CI${last ? ` <tspan fill="#5b5473">/</tspan> latest release ${esc(last.name)} on ${esc(last.date)}` : ''}</text>
`);
}

export const GET: APIRoute = async () => {
  let svg: string;
  try {
    svg = draw();
  } catch {
    // A checkout with no history, or no git at all. Say that instead of drawing an empty
    // 60 days, which would read as a dead project rather than a missing input.
    svg = card(`
<text class="t" x="28" y="40" fill="#efe9ff" font-size="17" font-weight="700">Project activity</text>
<text class="t" x="28" y="66" fill="#8d84a6" font-size="12">This card is drawn from git history, and the build that made this page had none.</text>
<text class="t" x="28" y="86" fill="#8d84a6" font-size="12">The repository itself is at github.com/TheFleece/dota2-mod-manager.</text>`);
  }

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
