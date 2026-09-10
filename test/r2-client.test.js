// Signing a request to R2, where getting it wrong is silent until it is a 403.
//
// SigV4 hashes a canonical request that contains the encoded object path, and S3 rebuilds that
// string from what arrives. If the two differ by one character the answer is
// "SignatureDoesNotMatch" and nothing says which character. That happened here: encodeURIComponent
// leaves ! ' ( ) * alone and S3 percent-encodes them, so the one mod in the catalog with an
// exclamation mark in its name had never been mirrored, and the next name with a bracket in it
// would have gone the same way.
const test = require('node:test');
const assert = require('node:assert/strict');

const { createR2, encodePath, rfc3986 } = require('../tools/r2-client.js');

const env = {
  R2_ACCOUNT_ID: 'account',
  R2_ACCESS_KEY_ID: 'key',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET: 'bucket',
};

test('the characters S3 encodes and encodeURIComponent does not', () => {
  assert.equal(rfc3986("Blast Off!.zip"), 'Blast%20Off%21.zip');
  assert.equal(rfc3986("a'b(c)d*e"), "a%27b%28c%29d%2Ae");
});

test('unreserved characters are left alone, or every key would change at once', () => {
  // A-Z a-z 0-9 - _ . ~ are unreserved in RFC 3986 and must survive untouched, otherwise the
  // 969 objects already in the bucket stop matching the paths that put them there.
  assert.equal(rfc3986('Abc-123_x.y~z'), 'Abc-123_x.y~z');
});

test('separators stay separators', () => {
  assert.equal(encodePath('assets/files/heroes/Bare Brewmaster.zip'), '/assets/files/heroes/Bare%20Brewmaster.zip');
});

test('a signed request carries the four things S3 checks', () => {
  const r2 = createR2({ env });
  const headers = r2.sign({ method: 'GET', path: 'bucket', payloadHash: 'e3b0c442' });

  assert.match(headers.Authorization, /^AWS4-HMAC-SHA256 Credential=key\/\d{8}\/auto\/s3\/aws4_request, SignedHeaders=[a-z0-9;-]+, Signature=[0-9a-f]{64}$/);
  assert.match(headers['x-amz-date'], /^\d{8}T\d{6}Z$/);
  assert.equal(headers.host, 'account.r2.cloudflarestorage.com');
  assert.equal(headers['x-amz-content-sha256'], 'e3b0c442');
});

test('the path is part of what is signed, or any key could be swapped for any other', () => {
  const r2 = createR2({ env });
  const a = r2.sign({ method: 'GET', path: 'bucket/one.zip', payloadHash: 'x' }).Authorization;
  const b = r2.sign({ method: 'GET', path: 'bucket/two.zip', payloadHash: 'x' }).Authorization;
  assert.notEqual(a.split('Signature=')[1], b.split('Signature=')[1]);
});

test('the secret is part of what is signed', () => {
  const one = createR2({ env }).sign({ method: 'GET', path: 'bucket', payloadHash: 'x' }).Authorization;
  const two = createR2({ env: { ...env, R2_SECRET_ACCESS_KEY: 'other' } })
    .sign({ method: 'GET', path: 'bucket', payloadHash: 'x' }).Authorization;
  assert.notEqual(one.split('Signature=')[1], two.split('Signature=')[1]);
});

test('a client with no credentials says so instead of signing rubbish', () => {
  assert.equal(createR2({ env: {} }).configured, false);
  assert.equal(createR2({ env }).configured, true);
});

test('the public URL is the signed path, so what is sent is what was signed', () => {
  const r2 = createR2({ env });
  assert.equal(r2.url('bucket/x!y.zip'), 'https://account.r2.cloudflarestorage.com/bucket/x%21y.zip');
});
