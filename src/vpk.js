// Minimal reader for the index of Source-engine VPK "_dir" files (v1/v2).
// Only walks the directory tree — enough to list which game files a mod overrides.
const fs = require('fs');

const VPK_SIGNATURE = 0x55aa1234;

function readCString(buf, pos) {
  const end = buf.indexOf(0, pos);
  if (end === -1) throw new Error('VPK: незакрытая строка в дереве');
  return { str: buf.toString('utf-8', pos, end), next: end + 1 };
}

/**
 * @param {Buffer} buf contents of a *_dir.vpk file
 * @returns {string[]} lowercased inner paths like "materials/water/water_ti10_000.vmat_c"
 */
function listVpkPaths(buf) {
  if (buf.length < 12 || buf.readUInt32LE(0) !== VPK_SIGNATURE) {
    throw new Error('VPK: неверная сигнатура');
  }
  const version = buf.readUInt32LE(4);
  let pos = version === 2 ? 28 : 12; // v2 header carries 16 extra bytes of section sizes

  const paths = [];
  for (;;) {
    const ext = readCString(buf, pos);
    pos = ext.next;
    if (!ext.str) break;
    for (;;) {
      const folder = readCString(buf, pos);
      pos = folder.next;
      if (!folder.str) break;
      for (;;) {
        const name = readCString(buf, pos);
        pos = name.next;
        if (!name.str) break;
        // entry: crc(4) preloadBytes(2) archiveIndex(2) offset(4) length(4) terminator(2)
        const preloadBytes = buf.readUInt16LE(pos + 4);
        pos += 18 + preloadBytes;
        const dir = folder.str === ' ' ? '' : folder.str + '/';
        paths.push(`${dir}${name.str}.${ext.str}`.toLowerCase());
      }
    }
  }
  return paths;
}

function listVpkPathsFile(filePath) {
  return listVpkPaths(fs.readFileSync(filePath));
}

module.exports = { listVpkPaths, listVpkPathsFile };
