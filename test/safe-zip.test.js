// Every zip the app opens was written by somebody else: the catalog's CDN, a stranger's
// .d2mm on Discord, whatever the user dropped on the window. An archive describes itself,
// so these tests pin what happens when it lies (a few KB claiming to unpack to 4 GB, the
// GHSA-xcpc-8h2w-3j85 shape), when it tells the truth but the truth is a bomb, and when it
// names a file so that writing it would land outside the folder we meant.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const AdmZip = require('adm-zip');

const { openZip, safeJoin, isUnsafeName } = require('../src/safe-zip.js');

const MB = 1024 * 1024;

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'd2mm-zip-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** An ordinary archive, written the way any tool would write it. */
function makeZip(entries /* Array<[string, Buffer|string]> */) {
  const zip = new AdmZip();
  for (const [name, body] of entries) zip.addFile(name, Buffer.isBuffer(body) ? body : Buffer.from(body));
  return zip.toBuffer();
}

/**
 * A zip laid out byte by byte, because the interesting archives cannot be written by a
 * well-behaved library: adm-zip cleans "../" out of a name as it stores it, and no writer
 * will put a size in the header that the data does not have. Stored (uncompressed) entries,
 * which is all these tests need.
 * @param {Array<{name: string, data: Buffer, declaredSize?: number}>} entries
 */
function rawZip(entries) {
  const parts = [];
  const central = [];
  let offset = 0;

  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf-8');
    const data = e.data;
    const crc = zlib.crc32(data);
    const claimed = e.declaredSize == null ? data.length : e.declaredSize;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);   // signature
    local.writeUInt16LE(20, 4);           // version needed
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); // compressed size
    local.writeUInt32LE(claimed, 22);     // uncompressed size, truthful or not
    local.writeUInt16LE(name.length, 26);
    parts.push(local, name, data);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);             // version made by
    cen.writeUInt16LE(20, 6);             // version needed
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(data.length, 20);
    cen.writeUInt32LE(claimed, 24);
    cen.writeUInt16LE(name.length, 28);
    cen.writeUInt32LE(offset, 42);        // where the local header sits
    central.push(cen, name);
    offset += local.length + name.length + data.length;
  }

  const dir = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, dir, end]);
}

const file = (name, body, declaredSize) => ({ name, data: Buffer.from(body), declaredSize });

test('a normal archive lists its files and hands back their bytes', () => {
  const archive = openZip(makeZip([['mod/pak01_dir.vpk', 'payload'], ['mod/readme.txt', 'hi']]));
  assert.deepEqual(archive.files.map((f) => f.path), ['mod/pak01_dir.vpk', 'mod/readme.txt']);
  assert.equal(archive.get('mod/pak01_dir.vpk').read().toString(), 'payload');
  assert.equal(archive.get('nothing/here.vpk'), null);
});

test('an archive that claims 4 GB in its header is refused, not allocated', () => {
  const buf = rawZip([file('pak01_dir.vpk', 'a few bytes pretending to be four gigabytes', 4_000_000_000)]);
  assert.throws(() => openZip(buf, { label: 'Nude Drow' }), (err) => {
    assert.equal(err.safeZip, true);
    assert.match(err.message, /Nude Drow/);
    return true;
  });
});

test('a truthful archive is read even when the same file is stored uncompressed', () => {
  const archive = openZip(rawZip([file('mod/pak01_dir.vpk', 'payload')]));
  assert.equal(archive.files[0].read().toString(), 'payload');
});

test('a bomb that tells the truth is refused too', () => {
  // 4 MB of zeros deflate to a couple of KB: nothing legitimate packs that tight at that size
  const archive = () => openZip(makeZip([['bomb.bin', Buffer.alloc(4 * MB)]]));
  assert.throws(archive, (err) => err.safeZip === true);
});

test('a file that is big but compresses like a real mod passes', () => {
  // a VPK is already-compressed game assets: it barely shrinks, the way this noise does not
  const archive = openZip(makeZip([['pak01_dir.vpk', require('crypto').randomBytes(2 * MB)]]));
  assert.equal(archive.files.length, 1);
  assert.equal(archive.files[0].read().length, 2 * MB);
});

test('names that would escape the folder never reach the caller', () => {
  const archive = openZip(rawZip([
    file('../evil.txt', 'no'),
    file('mod/../../evil2.txt', 'no'),
    file('/etc/passwd', 'no'),
    file('C:/Windows/System32/evil.dll', 'no'),
    file('mod\\..\\..\\evil3.dll', 'no'),
    file('mod/pak01_dir.vpk', 'yes'),
  ]));
  assert.deepEqual(archive.files.map((f) => f.path), ['mod/pak01_dir.vpk']);
});

test('unpacking writes under the target folder and nothing outside it', (t) => {
  const root = tempDir(t);
  const dest = path.join(root, 'tools', 'SomeTool');
  const written = openZip(rawZip([
    file('../escaped.exe', 'no'),
    file('bin/tool.exe', 'yes'),
    file('readme.txt', 'ok'),
  ])).extractTo(dest);

  assert.equal(written, 2);
  assert.equal(fs.readFileSync(path.join(dest, 'bin', 'tool.exe'), 'utf-8'), 'yes');
  assert.equal(fs.existsSync(path.join(root, 'tools', 'escaped.exe')), false);
  assert.equal(fs.existsSync(path.join(root, 'escaped.exe')), false);
});

test('safeJoin keeps a path inside its root and refuses one that climbs out', (t) => {
  const root = tempDir(t);
  assert.equal(safeJoin(root, 'a/b/c.vpk'), path.join(root, 'a', 'b', 'c.vpk'));
  assert.throws(() => safeJoin(root, '../outside.vpk'), (err) => err.safeZip === true);
  assert.throws(() => safeJoin(root, 'a/../../outside.vpk'), (err) => err.safeZip === true);
  assert.equal(isUnsafeName('a/../b'), true);
  assert.equal(isUnsafeName('a/b/c.vpk'), false);
});

test('each budget refuses on its own', (t) => {
  const three = makeZip([['a.txt', 'aaa'], ['b.txt', 'bbb'], ['c.txt', 'ccc']]);
  const refusal = (err) => err.safeZip === true;

  assert.throws(() => openZip(three, { limits: { entries: 2 } }), refusal);
  assert.throws(() => openZip(three, { limits: { entryBytes: 2 } }), refusal);
  assert.throws(() => openZip(three, { limits: { totalBytes: 5 } }), refusal);
  assert.doesNotThrow(() => openZip(three, { limits: { entries: 3, totalBytes: 9 } }));

  // the file on disk is weighed before adm-zip reads it into memory
  const dir = tempDir(t);
  const onDisk = path.join(dir, 'big.zip');
  fs.writeFileSync(onDisk, three);
  assert.throws(() => openZip(onDisk, { limits: { archiveBytes: 10 } }), refusal);
});
