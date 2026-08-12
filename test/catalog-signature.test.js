// The catalog arrives over mirrors that can rewrite it, so a signature is the only thing that
// can say the bytes are the author's. What matters here is the failure side: a check that
// passes when it should not is worse than no check at all.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { verify, configured } = require('../src/catalog-signature.js');

function keypair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  return { privateKey, pub: publicKey.export({ type: 'spki', format: 'der' }).toString('base64') };
}

const signWith = (key, data) => crypto.sign(null, Buffer.from(data), key).toString('base64');

test('a file signed by the pinned key verifies', () => {
  const { privateKey, pub } = keypair();
  const data = '{"modsData":{}}';
  assert.equal(verify(data, signWith(privateKey, data), pub), true);
});

test('a signature file with newlines and spaces around it still verifies', () => {
  const { privateKey, pub } = keypair();
  const data = 'catalog';
  assert.equal(verify(data, `\n  ${signWith(privateKey, data)}  \n`, pub), true);
});

test('one changed byte fails the check', () => {
  const { privateKey, pub } = keypair();
  const sig = signWith(privateKey, '{"mods":1}');
  assert.equal(verify('{"mods":2}', sig, pub), false);
});

test('a signature by another key fails, however valid it is on its own', () => {
  const { pub } = keypair();
  const attacker = keypair();
  const data = 'rewritten by a proxy';
  assert.equal(verify(data, signWith(attacker.privateKey, data), pub), false);
  assert.equal(verify(data, signWith(attacker.privateKey, data), attacker.pub), true, 'valid for its own key');
});

test('a missing, empty or malformed signature is a failure and never an exception', () => {
  const { pub } = keypair();
  for (const bad of [undefined, null, '', '   ', 'not base64 at all!', 'AAAA']) {
    assert.equal(verify('data', bad, pub), false, `refused: ${JSON.stringify(bad)}`);
  }
});

test('a malformed public key refuses everything rather than throwing', () => {
  const { privateKey } = keypair();
  const data = 'catalog';
  assert.equal(verify(data, signWith(privateKey, data), 'this-is-not-a-key'), false);
});

// Until the catalog's author publishes a key there is nothing to check against, and refusing
// every fetch would take the app down for everyone while protecting no one.
test('with no key pinned the check stands aside instead of failing shut', () => {
  assert.equal(configured(''), false);
  assert.equal(verify('anything', 'anything', ''), true);
  assert.equal(configured('AAAA'), true);
});
