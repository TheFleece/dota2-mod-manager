#!/usr/bin/env node
/**
 * Asks the service each secret belongs to whether that secret still works, and when it stops.
 *
 * .github/credentials.json was typed by hand. On the day it was written five of its expiry dates
 * were "unknown", and a token expired anyway: the personal token the catalog bot pushed with ran
 * out on 2026-09-15. A date copied from a dashboard is out of date the next time somebody edits
 * the token, and a token can stop doing its job long before its date: the same afternoon, adding
 * Cache Purge to the site's Cloudflare token replaced the Pages permission the site deploys with.
 *
 * So radar.yml runs this every morning inside Actions, with the secrets in its environment. Each
 * check uses the secret itself on the cheapest call that proves what the workflows rely on: the
 * Cloudflare token can still reach Pages and purge the zone, the R2 key can still list the bucket,
 * the GitLab token is active and says when it expires, each Discord webhook still exists, the
 * search consoles accept their keys, the deploy key still opens this repository over SSH. The one
 * call that changes anything is a purge of an address nothing ever caches.
 *
 * It writes credentials-status.json (state, the expiry a service reports, and one sentence on what
 * failed) for tools/radar.mjs. No secret, and no URL carrying one, is printed or written; details
 * pass through scrub() before they leave. test/credentials-check.test.js fails when
 * .github/credentials.json lists a secret this file has no check for.
 *
 * Usage: node tools/check-credentials.mjs   (with the secrets in the environment)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { googleAccessToken } from './google-auth.mjs';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const REPO = process.env.GITHUB_REPOSITORY || 'TheFleece/dota2-mod-manager';
const SITE = 'https://dota2modmanager.com';
const CF = 'https://api.cloudflare.com/client/v4';

/** The zone id lives in r2.yml, next to the purge that needs it, and is read from there. */
export function zoneIdFromWorkflow(text) {
  const source = text !== undefined ? text : fs.readFileSync(path.join(root, '.github', 'workflows', 'r2.yml'), 'utf8');
  const m = /CLOUDFLARE_ZONE_ID:\s*([0-9a-f]{32})\b/.exec(source);
  return m ? m[1] : null;
}

const day = (iso) => (iso ? String(iso).slice(0, 10) : undefined);
const ok = (detail, expires) => ({ state: 'ok', detail, ...(expires ? { expires: day(expires) } : {}) });
const failed = (detail) => ({ state: 'failed', detail });
const missing = (name) => ({ state: 'missing', detail: `${name} is not set in the repository's secrets` });

/** Replaces every secret value in a sentence, so an error that quotes a URL cannot leak one. */
export function scrub(text, secrets) {
  let out = String(text);
  for (const value of Object.values(secrets || {})) {
    if (typeof value === 'string' && value.length >= 8) out = out.split(value).join('***');
  }
  return out;
}

async function webhook(name, url, { http }) {
  if (!url) return missing(name);
  const res = await http(url);
  if (res.status === 200 && res.json && res.json.id) return ok('the webhook exists');
  return failed(`Discord answers HTTP ${res.status}: the webhook was deleted or the address is wrong`);
}

/**
 * One check per secret. Each takes the environment and the ways out to the world (`http`, `r2`,
 * `ssh`, `google`), so the tests can stand in for every service.
 */
export const CHECKS = {
  async CLOUDFLARE_API_TOKEN(env, { http }) {
    const token = env.CLOUDFLARE_API_TOKEN;
    if (!token) return missing('CLOUDFLARE_API_TOKEN');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const verify = await http(`${CF}/user/tokens/verify`, { headers });
    const status = verify.json && verify.json.result && verify.json.result.status;
    if (verify.status !== 200 || !verify.json || !verify.json.success || status !== 'active') {
      return failed(`Cloudflare rejects the token (HTTP ${verify.status}${status ? `, status ${status}` : ''})`);
    }
    const problems = [];
    if (!env.CLOUDFLARE_ACCOUNT_ID) {
      problems.push('CLOUDFLARE_ACCOUNT_ID is not set, so Pages could not be checked');
    } else {
      const pages = await http(`${CF}/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/pages/projects`, { headers });
      if (pages.status !== 200 || !pages.json || !pages.json.success) {
        problems.push(`it cannot reach Cloudflare Pages (HTTP ${pages.status}), so the site cannot be deployed; it needs Account, Cloudflare Pages, Edit`);
      }
    }
    const zone = env.CLOUDFLARE_ZONE_ID || zoneIdFromWorkflow();
    if (!zone) {
      problems.push('r2.yml has no zone id, so the cache purge could not be checked');
    } else {
      const purge = await http(`${CF}/zones/${zone}/purge_cache`, { method: 'POST', headers, body: JSON.stringify({ files: [`${SITE}/.well-known/radar-purge-probe`] }) });
      if (purge.status !== 200 || !purge.json || !purge.json.success) {
        problems.push(`it cannot purge the cache (HTTP ${purge.status}), so replaced mirror files stay stale; it needs Zone, Cache Purge, Purge on dota2modmanager.com`);
      }
    }
    if (problems.length) return failed(`the token is active, but ${problems.join('; and ')}`);
    return ok('active, reaches Pages and purges the zone', verify.json.result.expires_on);
  },

  async CLOUDFLARE_ACCOUNT_ID(env) {
    return env.CLOUDFLARE_ACCOUNT_ID ? ok('set; used by the Pages check above') : missing('CLOUDFLARE_ACCOUNT_ID');
  },

  async R2_ACCOUNT_ID(env, io) {
    return env.R2_ACCOUNT_ID ? io.r2() : missing('R2_ACCOUNT_ID');
  },

  async R2_ACCESS_KEY_ID(env, io) {
    return env.R2_ACCESS_KEY_ID ? io.r2() : missing('R2_ACCESS_KEY_ID');
  },

  async R2_SECRET_ACCESS_KEY(env, io) {
    return env.R2_SECRET_ACCESS_KEY ? io.r2() : missing('R2_SECRET_ACCESS_KEY');
  },

  async R2_PUBLIC_BASE(env, { http }) {
    if (!env.R2_PUBLIC_BASE) return missing('R2_PUBLIC_BASE');
    const res = await http(`${env.R2_PUBLIC_BASE.replace(/\/$/, '')}/index.json`, { method: 'HEAD' });
    return res.status === 200 ? ok('the public mirror answers') : failed(`the public mirror answered HTTP ${res.status} for index.json`);
  },

  async MIRROR_PUSH_URL(env, { http }) {
    if (!env.MIRROR_PUSH_URL) return missing('MIRROR_PUSH_URL');
    let token = '';
    try {
      token = decodeURIComponent(new URL(env.MIRROR_PUSH_URL).password);
    } catch {
      return failed('MIRROR_PUSH_URL is not a URL');
    }
    if (!token) return failed('MIRROR_PUSH_URL carries no token');
    const res = await http('https://gitlab.com/api/v4/personal_access_tokens/self', { headers: { 'PRIVATE-TOKEN': token } });
    if (res.status !== 200 || !res.json) return failed(`GitLab rejects the token (HTTP ${res.status})`);
    if (res.json.revoked || res.json.active === false) return failed('GitLab reports the token as revoked or no longer active');
    return ok('active', res.json.expires_at);
  },

  async DISCORD_WEBHOOK_URL(env, io) {
    return webhook('DISCORD_WEBHOOK_URL', env.DISCORD_WEBHOOK_URL, io);
  },

  async RADAR_DISCORD_WEBHOOK(env, io) {
    return webhook('RADAR_DISCORD_WEBHOOK', env.RADAR_DISCORD_WEBHOOK, io);
  },

  async BING_API_KEY(env, { http }) {
    if (!env.BING_API_KEY) return missing('BING_API_KEY');
    const res = await http(`https://ssl.bing.com/webmaster/api.svc/json/GetUserSites?apikey=${encodeURIComponent(env.BING_API_KEY)}`, { headers: { Accept: 'application/json' } });
    return res.status === 200 ? ok('Bing accepts the key') : failed(`Bing rejects the key (HTTP ${res.status})`);
  },

  async GOOGLE_SERVICE_ACCOUNT_JSON(env, { google }) {
    if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) return missing('GOOGLE_SERVICE_ACCOUNT_JSON');
    try {
      await google(env.GOOGLE_SERVICE_ACCOUNT_JSON);
      return ok('Google issues an access token for it');
    } catch (err) {
      return failed(`Google refuses the key: ${err.message}`);
    }
  },

  async YANDEX_OAUTH_TOKEN(env, { http }) {
    if (!env.YANDEX_OAUTH_TOKEN) return missing('YANDEX_OAUTH_TOKEN');
    const res = await http('https://api.webmaster.yandex.net/v4/user', { headers: { Authorization: `OAuth ${env.YANDEX_OAUTH_TOKEN}` } });
    return res.status === 200 ? ok('Yandex accepts the token') : failed(`Yandex rejects the token (HTTP ${res.status})`);
  },

  async FINGERPRINTS_DEPLOY_KEY(env, { ssh }) {
    if (!env.FINGERPRINTS_DEPLOY_KEY) return missing('FINGERPRINTS_DEPLOY_KEY');
    const said = await ssh(env.FINGERPRINTS_DEPLOY_KEY);
    if (String(said).includes(`Hi ${REPO}!`)) return ok('opens this repository over SSH');
    return failed('GitHub does not accept the key over SSH: it was removed from the repository, or the secret holds something else');
  },
};

/** Runs every named check. A check that throws is a failed secret, never a crashed run. */
export async function checkAll(names, env, io) {
  const results = {};
  for (const name of names) {
    const check = CHECKS[name];
    if (!check) {
      results[name] = { state: 'unchecked', detail: 'no check exists for this secret yet' };
      continue;
    }
    try {
      results[name] = await check(env, io);
    } catch (err) {
      results[name] = failed(`the check itself failed: ${err.message}`);
    }
    results[name].detail = scrub(results[name].detail, env);
  }
  return results;
}

// ---------------------------------------------------------------------------------------------

async function realHttp(url, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(url, { method, headers, body });
  const text = method === 'HEAD' ? '' : await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

async function realR2(env) {
  const { createR2 } = require('./r2-client.js');
  const r2 = createR2({ env });
  if (!r2.configured) return failed('the R2 key pair or account id is incomplete');
  try {
    const listed = await r2.list('index.json');
    return Array.isArray(listed) ? ok('lists the mirror bucket') : failed('the R2 key did not list the bucket');
  } catch (err) {
    const code = (/\b([45]\d\d)\b/.exec(String(err.message)) || [])[1];
    return failed(`the R2 key can no longer list the bucket${code ? ` (HTTP ${code})` : ''}`);
  }
}

async function realSsh(privateKey) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-key-'));
  const keyFile = path.join(dir, 'key');
  try {
    fs.writeFileSync(keyFile, privateKey.endsWith('\n') ? privateKey : `${privateKey}\n`, { mode: 0o600 });
    try {
      execFileSync('ssh', ['-i', keyFile, '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new', '-o', `UserKnownHostsFile=${path.join(dir, 'known_hosts')}`, '-T', 'git@github.com'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 });
      return '';
    } catch (err) {
      // GitHub greets a valid key and then closes with exit code 1, so the greeting is in stderr
      return `${err.stdout || ''}${err.stderr || ''}`;
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const registry = JSON.parse(fs.readFileSync(path.join(root, '.github', 'credentials.json'), 'utf8')).secrets;
  const names = Object.keys(registry);
  const env = Object.fromEntries(names.map((n) => [n, process.env[n] || '']));
  let r2Result = null;
  const io = {
    http: realHttp,
    google: (json) => googleAccessToken(json, 'https://www.googleapis.com/auth/webmasters.readonly'),
    ssh: realSsh,
    r2: () => {
      if (!r2Result) r2Result = realR2(env);
      return r2Result;
    },
  };
  const results = await checkAll(names, env, io);
  fs.writeFileSync(path.join(root, 'credentials-status.json'), `${JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2)}\n`);
  for (const [name, r] of Object.entries(results)) {
    console.log(`${r.state.padEnd(9)} ${name}${r.expires ? ` (expires ${r.expires})` : ''}: ${r.detail}`);
  }
  const bad = Object.entries(results).filter(([, r]) => r.state !== 'ok').map(([n]) => n);
  if (bad.length) console.log(`::warning::${bad.length} secret(s) need attention: ${bad.join(', ')}`);
}
