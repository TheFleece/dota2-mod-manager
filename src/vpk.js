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

const EMPTY = Buffer.alloc(0);
const INLINE = 0x7fff; // archiveIndex meaning "data lives in the _dir file itself"

/**
 * Rewrites a multi-part VPK (_dir.vpk + _000.vpk, _001.vpk…) into one self-contained
 * single-file VPK v2 with every entry's data embedded — the format the Dota2PornFx
 * catalog uses. Data is copied byte-for-byte; CRCs and preload are preserved.
 *
 * @param {string} dirPath  path to the *_dir.vpk index file
 * @param {(idx: number) => string} [archivePathFor]  resolves external archive N to a path
 * @returns {Buffer} the merged single-file VPK
 */
function mergeVpkToSingle(dirPath, archivePathFor) {
  const dirBuf = fs.readFileSync(dirPath);
  if (dirBuf.length < 12 || dirBuf.readUInt32LE(0) !== VPK_SIGNATURE) {
    throw new Error('VPK: неверная сигнатура');
  }
  const version = dirBuf.readUInt32LE(4);
  const treeSize = dirBuf.readUInt32LE(8);
  const headerSize = version === 2 ? 28 : 12;
  const embeddedBase = headerSize + treeSize; // where inline (0x7fff) data sits in the source

  const archiveCache = new Map();
  const readArchive = (idx) => {
    if (idx === INLINE) return dirBuf;
    if (!archiveCache.has(idx)) {
      const p = archivePathFor
        ? archivePathFor(idx)
        : dirPath.replace(/_dir\.vpk$/i, `_${String(idx).padStart(3, '0')}.vpk`);
      archiveCache.set(idx, fs.readFileSync(p));
    }
    return archiveCache.get(idx);
  };

  // walk the tree, grouped ext -> folder -> [{name, crc, preload, data}], preserving order
  const tree = new Map();
  let pos = headerSize;
  for (;;) {
    const ext = readCString(dirBuf, pos); pos = ext.next; if (!ext.str) break;
    const folders = tree.get(ext.str) || new Map(); tree.set(ext.str, folders);
    for (;;) {
      const folder = readCString(dirBuf, pos); pos = folder.next; if (!folder.str) break;
      const names = folders.get(folder.str) || []; folders.set(folder.str, names);
      for (;;) {
        const name = readCString(dirBuf, pos); pos = name.next; if (!name.str) break;
        const crc = dirBuf.readUInt32LE(pos);
        const preloadBytes = dirBuf.readUInt16LE(pos + 4);
        const archiveIndex = dirBuf.readUInt16LE(pos + 6);
        const entryOffset = dirBuf.readUInt32LE(pos + 8);
        const entryLength = dirBuf.readUInt32LE(pos + 12);
        pos += 18;
        const preload = preloadBytes ? Buffer.from(dirBuf.subarray(pos, pos + preloadBytes)) : EMPTY;
        pos += preloadBytes;
        let data = EMPTY;
        if (entryLength > 0) {
          const src = readArchive(archiveIndex);
          const base = archiveIndex === INLINE ? embeddedBase : 0;
          data = src.subarray(base + entryOffset, base + entryOffset + entryLength);
        }
        names.push({ name: name.str, crc, preload, data });
      }
    }
  }

  // lay out the merged data section in tree order, assigning each entry its new offset
  const dataChunks = [];
  let dataLen = 0;
  for (const [, folders] of tree) for (const [, names] of folders) for (const en of names) {
    en.offset = dataLen;
    if (en.data.length) { dataChunks.push(en.data); dataLen += en.data.length; }
  }

  // rebuild the tree with every entry pointing inline (0x7fff) at the merged data
  const z = Buffer.from([0]);
  const cstr = (s) => Buffer.concat([Buffer.from(s, 'utf-8'), z]);
  const parts = [];
  for (const [ext, folders] of tree) {
    parts.push(cstr(ext));
    for (const [folder, names] of folders) {
      parts.push(cstr(folder));
      for (const en of names) {
        parts.push(cstr(en.name));
        const meta = Buffer.alloc(18);
        meta.writeUInt32LE(en.crc >>> 0, 0);
        meta.writeUInt16LE(en.preload.length, 4);
        meta.writeUInt16LE(INLINE, 6);
        meta.writeUInt32LE(en.offset >>> 0, 8);
        meta.writeUInt32LE(en.data.length >>> 0, 12);
        meta.writeUInt16LE(0xffff, 16);
        parts.push(meta);
        if (en.preload.length) parts.push(en.preload);
      }
      parts.push(z); // end of names in this folder
    }
    parts.push(z); // end of folders for this ext
  }
  parts.push(z); // end of extensions
  const treeBuf = Buffer.concat(parts);

  const header = Buffer.alloc(28);
  header.writeUInt32LE(VPK_SIGNATURE, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(treeBuf.length, 8);
  header.writeUInt32LE(dataLen, 12); // fileDataSectionSize; MD5/signature sections left at 0
  return Buffer.concat([header, treeBuf, ...dataChunks]);
}

module.exports = { listVpkPaths, listVpkPathsFile, mergeVpkToSingle };
