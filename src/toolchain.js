// Tools the app can borrow, fetched only when something actually needs them.
//
// Reading a Dota item icon or a mod's own texture means decoding Source 2 formats, and the
// program that does that weighs fifty megabytes. Shipping it inside the installer would
// triple its size for a feature most people never touch, so the toolchain is downloaded on
// demand, kept in the app's own folder, and can be deleted from Settings without breaking
// anything that does not need it.
//
// Rules this file exists to enforce:
//   nothing runs that was not pinned - every tool is fetched at a version, from a URL, with
//     a SHA-256 that has to match, so "the download went through a proxy" cannot become "the
//     app now runs somebody else's binary";
//   nothing proprietary - Valve's own vpk.exe is not here and must not be added (see the
//     SignPath terms: a project that bundles it is not open source in their sense). Both
//     tools below are MIT, downloaded rather than bundled, and credited in the README;
//   the pins can be moved without a release - the same config channel the kill switch uses
//     (config/tools.json), so a tool release that breaks something can be rolled back the
//     same day.
const fs = require('fs');
const path = require('path');
const { downloadFile, fetchText } = require('./net');
const { openZip } = require('./safe-zip');
const { FileTx } = require('./file-tx');

const PINS_URL = 'https://raw.githubusercontent.com/TheFleece/dota2-mod-manager/main/config/tools.json';

// What the app was built knowing. Checked against the live pins on first use; these are what
// it falls back to offline, and what it uses if the remote file is missing or malformed.
// Measured 2026-08-07: the digests come from GitHub's own release API and were confirmed
// against the downloaded file.
const BUILT_IN_PINS = {
  vrf: {
    version: '19.2',
    url: 'https://github.com/SteamDatabase/ValveResourceFormat/releases/download/19.2/cli-windows-x64.zip',
    sha256: '53e7e8dac1ddd876078346de709c8dbe613a967e94cd0c969aa34c61ec07680d',
    bytes: 50837364,
    exe: 'Source2Viewer-CLI.exe',
    license: 'MIT',
    project: 'https://github.com/SteamDatabase/ValveResourceFormat',
  },
};

const TOOL_NAMES = Object.keys(BUILT_IN_PINS);

// Whose releases a pin may point at. "Some GitHub release with a matching digest" is not a
// pin: the digest travels in the same file as the URL, so a rewritten config could name any
// repository on GitHub and hand over its own hash to check it against. The owner is what
// makes the pin mean anything, and it is decided here rather than in a file off the network.
const PIN_REPOS = { vrf: 'SteamDatabase/ValveResourceFormat' };

function validPin(pin, name) {
  const repo = PIN_REPOS[name];
  const from = repo && new RegExp(`^https://github\\.com/${repo}/releases/download/`, 'i');
  return !!(pin && typeof pin === 'object' && from
    && typeof pin.version === 'string' && pin.version
    && typeof pin.exe === 'string' && pin.exe && !pin.exe.includes('/') && !pin.exe.includes('\\')
    && typeof pin.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(pin.sha256)
    && typeof pin.url === 'string' && from.test(pin.url));
}

/**
 * @param {object} deps
 * @param {string} deps.userDataDir
 * @param {(evt: object) => void} [deps.onProgress]
 * @param {(msg: string) => void} [deps.log]
 */
function createToolchain({ userDataDir, onProgress = () => {}, log = () => {} }) {
  const root = path.join(userDataDir, 'toolchain');
  let pins = { ...BUILT_IN_PINS };
  let pinsFetched = false;

  const dirFor = (name, version) => path.join(root, name, version);
  const stateFile = path.join(root, 'installed.json');

  function installed() {
    try { return JSON.parse(fs.readFileSync(stateFile, 'utf-8')); } catch { return {}; }
  }

  function remember(name, entry) {
    const all = installed();
    if (entry) all[name] = entry; else delete all[name];
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(all, null, 2));
  }

  /** Live pins, if they can be had. Anything that fails to validate keeps the built-in one. */
  async function refreshPins() {
    if (pinsFetched) return pins;
    pinsFetched = true;
    try {
      const raw = JSON.parse(await fetchText(PINS_URL, { trustedOnly: true }));
      for (const name of TOOL_NAMES) {
        const pin = raw && raw[name];
        if (validPin(pin, name)) pins[name] = { ...BUILT_IN_PINS[name], ...pin };
        else if (pin) log(`toolchain: pin for ${name} rejected, keeping the built-in one`);
      }
    } catch (err) {
      log(`toolchain pins not fetched: ${err.message || err}`);
    }
    return pins;
  }

  /** Where this tool's executable sits right now, or null if it is not downloaded. */
  function pathOf(name) {
    const entry = installed()[name];
    if (!entry) return null;
    const exe = path.join(dirFor(name, entry.version), entry.exe);
    return fs.existsSync(exe) ? exe : null;
  }

  /**
   * Make sure the tool is here, downloading it if it is not, and hand back the path to run.
   * @returns {Promise<string>} absolute path of the executable
   */
  async function ensure(name) {
    if (!TOOL_NAMES.includes(name)) throw new Error(`unknown tool ${name}`);
    await refreshPins();
    const pin = pins[name];
    const have = installed()[name];
    if (have && have.version === pin.version) {
      const exe = pathOf(name);
      if (exe) return exe;
      log(`toolchain: ${name} ${have.version} was recorded but is gone from disk, fetching again`);
    }

    const dest = path.join(root, `${name}-${pin.version}.zip`);
    onProgress({ type: 'stage', label: name, stage: 'download' });
    const got = await downloadFile(pin.url, dest, {
      expectSha256: pin.sha256,
      onProgress: (loaded, total) => onProgress({ type: 'download', label: name, loaded, total }),
      log,
    });
    log(`toolchain: ${name} ${pin.version} downloaded, ${(got.bytes / 1048576).toFixed(1)} MB`);

    // Unpacked as one change: a tool half-written is a tool that starts and then fails in a
    // way nobody can explain. safe-zip is what reads it, so a hostile archive from a moved
    // URL cannot write outside this folder.
    const into = dirFor(name, pin.version);
    fs.rmSync(into, { recursive: true, force: true });
    const archive = openZip(dest, { label: name });
    FileTx.run((tx) => archive.extractTo(into, tx), log);
    fs.rmSync(dest, { force: true });

    const exe = path.join(into, pin.exe);
    if (!fs.existsSync(exe)) {
      fs.rmSync(into, { recursive: true, force: true });
      throw new Error(`${pin.exe} is not in the ${name} archive`);
    }
    remember(name, { version: pin.version, exe: pin.exe, sha256: got.sha256, at: Date.now() });
    // an older version of the same tool is dead weight once this one works
    for (const old of fs.readdirSync(path.join(root, name))) {
      if (old !== pin.version) fs.rmSync(path.join(root, name, old), { recursive: true, force: true });
    }
    return exe;
  }

  /** What is on disk, for Settings and for the diagnostics report. */
  function state() {
    const have = installed();
    return TOOL_NAMES.map((name) => {
      const entry = have[name] || null;
      const dir = entry ? dirFor(name, entry.version) : null;
      let bytes = 0;
      if (dir) {
        try { for (const f of fs.readdirSync(dir)) bytes += fs.statSync(path.join(dir, f)).size; } catch { /* gone */ }
      }
      return {
        name,
        version: entry ? entry.version : null,
        latest: pins[name].version,
        installedBytes: bytes,
        downloadBytes: pins[name].bytes || 0,
        license: pins[name].license,
        project: pins[name].project,
        ready: !!pathOf(name),
      };
    });
  }

  function remove(name) {
    fs.rmSync(path.join(root, name), { recursive: true, force: true });
    remember(name, null);
  }

  return { ensure, pathOf, state, remove, refreshPins, root, TOOL_NAMES, PINS_URL };
}

module.exports = { createToolchain, BUILT_IN_PINS, validPin, TOOL_NAMES, PINS_URL };
