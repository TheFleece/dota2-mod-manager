/*
 * Sign the catalog files, so that a proxy cannot rewrite them on the way to anyone's machine.
 *
 * For whoever publishes the catalog. Two commands, no dependencies, Node 18 or newer:
 *
 *   node tools/sign-catalog.js --keygen
 *       Makes an ed25519 key pair. catalog-key.pem is the private half: keep it, never
 *       commit it, never send it. The public half is printed as one line of base64 - that
 *       line goes to the app authors, who bake it into the client.
 *
 *   node tools/sign-catalog.js assets/data/*.json
 *       Writes <file>.sig next to each file. Commit the .sig files together with the data.
 *       Run it again whenever the data changes; a stale signature reads as a bad one.
 *
 * The client fetches <file>.sig alongside <file> and refuses anything that does not verify
 * against the pinned public key. Nothing else about publishing changes.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KEY_FILE = process.env.CATALOG_KEY || 'catalog-key.pem';

function keygen() {
  if (fs.existsSync(KEY_FILE)) {
    console.error(`${KEY_FILE} already exists. Delete it first if you really mean to replace the key.`);
    process.exit(1);
  }
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(KEY_FILE, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  const spki = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  console.log(`private key written to ${KEY_FILE} - keep this file, it is the whole secret`);
  console.log('\npublic key (give this line to the client authors):\n');
  console.log(spki);
}

function sign(files) {
  if (!fs.existsSync(KEY_FILE)) {
    console.error(`no ${KEY_FILE} here. Run --keygen first, or point CATALOG_KEY at the key.`);
    process.exit(1);
  }
  const key = crypto.createPrivateKey(fs.readFileSync(KEY_FILE, 'utf-8'));
  for (const file of files) {
    const data = fs.readFileSync(file);
    const sig = crypto.sign(null, data, key).toString('base64');
    fs.writeFileSync(`${file}.sig`, `${sig}\n`);
    console.log(`${path.basename(file)} -> ${path.basename(file)}.sig`);
  }
  console.log(`\n${files.length} file(s) signed. Commit the .sig files next to the data.`);
}

const args = process.argv.slice(2);
if (args[0] === '--keygen') keygen();
else if (args.length) sign(args);
else {
  console.log('usage: node tools/sign-catalog.js --keygen');
  console.log('       node tools/sign-catalog.js <file> [file...]');
}
