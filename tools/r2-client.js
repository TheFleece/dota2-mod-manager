// Talking to R2, which speaks S3, which wants SigV4.
//
// No SDK: SigV4 is a hash of a canonical string, and eighty lines of crypto beats a dependency
// tree for a bucket this project writes to from two scripts. It was one script until
// 2026-09-10, when the release assets needed a second home as well as the mods, and a second
// copy of this is how the catalog walk came to be wrong in one of the three places that had it.
//
// Credentials come from the environment: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.
const crypto = require('crypto');

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const hmac = (k, s) => crypto.createHmac('sha256', k).update(s).digest();

/* RFC 3986, not encodeURIComponent.
 *
 * SigV4 hashes a canonical request containing the encoded path, and S3 builds its own copy of
 * that string from what arrives. encodeURIComponent leaves ! ' ( ) * alone where S3 percent-
 * encodes them, so the two strings differ and the request comes back 403 SignatureDoesNotMatch.
 * One mod in the catalog is called "Techies Bismillah Blast Off!.zip" and it had never once
 * been mirrored.
 */
const rfc3986 = (segment) => encodeURIComponent(segment)
  .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** The path as SigV4 wants it: every segment encoded, separators left alone. */
const encodePath = (key) => `/${key.split('/').map(rfc3986).join('/')}`;

/**
 * A bucket you can list, put to and delete from.
 *
 * @param {object} [env]  where to read credentials from; the process environment by default
 * @returns {{ bucket: string, list: Function, put: Function, remove: Function, url: Function }}
 */
function createR2({ env = process.env, bucket = env.R2_BUCKET || 'd2mm-mods' } = {}) {
  const account = env.R2_ACCOUNT_ID || '';
  const key = env.R2_ACCESS_KEY_ID || '';
  const secret = env.R2_SECRET_ACCESS_KEY || '';
  const host = `${account}.r2.cloudflarestorage.com`;

  /** SigV4, all of it. R2 wants region "auto" and service "s3". */
  function sign({ method, path: objectPath, payloadHash, headers = {}, query = '' }) {
    const stamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = stamp.slice(0, 8);
    const all = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': stamp, ...headers };
    const names = Object.keys(all).map((n) => n.toLowerCase()).sort();
    const canonicalHeaders = names
      .map((n) => `${n}:${String(all[Object.keys(all).find((k) => k.toLowerCase() === n)]).trim()}\n`)
      .join('');
    const signedHeaders = names.join(';');
    const canonical = [method, encodePath(objectPath), query, canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const scope = `${date}/auto/s3/aws4_request`;
    const toSign = ['AWS4-HMAC-SHA256', stamp, scope, sha(canonical)].join('\n');
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${secret}`, date), 'auto'), 's3'), 'aws4_request');
    const signature = hmac(signingKey, toSign).toString('hex');
    return {
      ...all,
      Authorization: `AWS4-HMAC-SHA256 Credential=${key}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
  }

  const url = (objectPath, query) => `https://${host}${encodePath(objectPath)}${query ? `?${query}` : ''}`;

  /**
   * Every object under `prefix`, as a Map of key to size.
   * Paged, because a bucket with a thousand mods in it does not answer in one response.
   */
  async function list(prefix = '') {
    const have = new Map();
    let token = '';
    do {
      const q = new URLSearchParams({ 'list-type': '2', 'max-keys': '1000' });
      if (prefix) q.set('prefix', prefix);
      if (token) q.set('continuation-token', token);
      q.sort();
      const query = q.toString();
      const res = await fetch(url(bucket, query), { headers: sign({ method: 'GET', path: bucket, payloadHash: sha(''), query }) });
      const xml = await res.text();
      if (!res.ok) throw new Error(`list: HTTP ${res.status} ${xml.slice(0, 300)}`);
      for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>[\s\S]*?<Size>(\d+)<\/Size>/g)) {
        have.set(m[1], Number(m[2]));
      }
      token = /<NextContinuationToken>([^<]+)</.exec(xml)?.[1] ?? '';
    } while (token);
    return have;
  }

  /** Writes one object. `body` is a Buffer, because everything here is already in memory. */
  async function put(objectKey, body, contentType = 'application/octet-stream') {
    const full = `${bucket}/${objectKey}`;
    const payloadHash = sha(body);
    const headers = sign({
      method: 'PUT',
      path: full,
      payloadHash,
      headers: { 'content-length': String(body.length), 'content-type': contentType },
    });
    const res = await fetch(url(full), { method: 'PUT', headers, body });
    if (!res.ok) throw new Error(`put ${objectKey}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  }

  /** Removes one object. A key that is not there is not an error worth stopping for. */
  async function remove(objectKey) {
    const full = `${bucket}/${objectKey}`;
    const headers = sign({ method: 'DELETE', path: full, payloadHash: sha('') });
    const res = await fetch(url(full), { method: 'DELETE', headers });
    if (!res.ok && res.status !== 404) {
      throw new Error(`delete ${objectKey}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
  }

  return { bucket, list, put, remove, url, sign, configured: Boolean(account && key && secret) };
}

module.exports = { createR2, encodePath, rfc3986, sha };
