/* Updating a copy that was never installed.
 *
 * electron-updater updates Windows by handing the download to the NSIS installer, and a
 * portable build has none, so it sits at whatever version it was downloaded at. The obvious
 * fix is to have the exe replace itself: rename the running file, drop the new one in its
 * place, restart. It works, and it is also exactly the shape of behaviour that antivirus
 * heuristics are built to notice - an unsigned executable rewriting and relaunching itself.
 * This project has already been through one Defender false positive without doing anything of
 * the sort, and a portable build is the one people pick specifically to keep their system
 * untouched.
 *
 * So the new version is downloaded and put NEXT TO the current exe, and the user is told it is
 * there. One double click instead of a trip to the website, and nothing on disk is rewritten.
 *
 * What makes it safe to download at all: CI publishes portable.yml beside the installer, with
 * the size and SHA-256 of that release's portable exe. The manifest is fetched from GitHub
 * itself with no mirrors in the way (a mirror could rewrite both the hash and the file), and
 * the download is then checked against it. A file that does not match is deleted rather than
 * offered.
 */
const fs = require('fs');
const path = require('path');
const { fetchText, downloadFile } = require('./net');

const REPO = 'TheFleece/dota2-mod-manager';
const MANIFEST = 'portable.yml';

const releaseUrl = (version, file) =>
  `https://github.com/${REPO}/releases/download/v${version}/${file}`;

/**
 * The three fields the app needs out of portable.yml, without pulling in a YAML parser for a
 * file this project writes itself. Anything missing or malformed is a manifest we refuse.
 * @returns {{ file: string, size: number, sha256: string }}
 */
function parseManifest(text) {
  const field = (name) => {
    const m = new RegExp(`^${name}:\\s*(.+)$`, 'm').exec(String(text || ''));
    return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : '';
  };
  const file = field('file');
  const size = Number(field('size'));
  const sha256 = field('sha256').toLowerCase();
  // the file is a name in the release, never a path, and the hash is a hash
  if (!/^[A-Za-z0-9._-]+\.exe$/.test(file)) throw new Error('portable.yml: bad file name');
  if (!Number.isFinite(size) || size <= 0) throw new Error('portable.yml: bad size');
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('portable.yml: bad sha256');
  return { file, size, sha256 };
}

/** Where the running portable exe actually lives, or null when this is not a portable copy. */
function portableDir() {
  return process.env.PORTABLE_EXECUTABLE_DIR || null;
}

/**
 * Fetch the new build and leave it beside the current one.
 *
 * @param {string} version           the version to fetch, without the leading v
 * @param {object} [opts]
 * @param {(loaded: number, total: number) => void} [opts.onProgress]
 * @param {string} [opts.dir]        where to put it; defaults to the folder holding the exe
 * @returns {Promise<{ path: string, name: string, bytes: number }>}
 */
async function fetchBeside(version, { onProgress = () => {}, dir = portableDir(), log = () => {} } = {}) {
  if (!dir) throw new Error('not a portable copy');
  if (!/^\d+\.\d+\.\d+$/.test(String(version || ''))) throw new Error(`bad version ${version}`);

  // trustedOnly: the manifest carries the hash everything else is checked against, so it is
  // the one file a mirror must not be able to touch
  const manifest = parseManifest(await fetchText(releaseUrl(version, MANIFEST), { trustedOnly: true }));

  // named with its version so a folder can hold the old and the new without a collision, and
  // so the user can see at a glance which one they are about to run
  const name = manifest.file.replace(/\.exe$/i, `-${version}.exe`);
  const dest = path.join(dir, name);
  if (fs.existsSync(dest) && fs.statSync(dest).size === manifest.size) {
    return { path: dest, name, bytes: manifest.size, already: true };
  }

  const got = await downloadFile(releaseUrl(version, manifest.file), dest, {
    expectSha256: manifest.sha256,
    onProgress,
    log,
  });
  return { path: got.path, name, bytes: got.bytes };
}

module.exports = { parseManifest, fetchBeside, portableDir, releaseUrl, MANIFEST };
