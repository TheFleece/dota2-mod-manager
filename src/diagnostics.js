// A support report a user can send instead of a round of screenshots: Dota's own path and
// language settings, the app's settings and installed mods, the patch/schema state, a
// listing of the mod folder's pak files, and the app's own recent log.
//
// Pure data in, pure data out - no Electron here, no zip - so main.js decides how it is
// packaged (see the diag:export handler) and this stays exercisable on its own.
const fs = require('fs');
const path = require('path');
const os = require('os');
const gamelang = require('./gamelang');
const { validateGamePath } = require('./steam');
const { mirrorHealth } = require('./net');

// Nothing about a folder listing that matters for troubleshooting needs the file's bytes,
// only its shape - names, sizes, when they last changed.
function listFolder(dir) {
  try {
    return fs.readdirSync(dir).map((name) => {
      const st = fs.statSync(path.join(dir, name));
      return { name, size: st.size, mtime: st.mtimeMs, dir: st.isDirectory() };
    }).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return null; // missing or unreadable folder is itself worth knowing
  }
}

function folderListingText(dir, filter) {
  const list = listFolder(dir);
  if (!list) return `${dir}\n(not found or unreadable)`;
  const rows = filter ? list.filter(filter) : list;
  const lines = rows.map((f) =>
    `${f.dir ? 'DIR ' : '    '}${String(f.size).padStart(10)}  ${new Date(f.mtime).toISOString()}  ${f.name}`);
  return `${dir}\n\n${lines.join('\n') || '(empty)'}`;
}

// The last chunk of a log file - a support conversation is almost always about what just
// happened, not the file's whole history.
function tailLog(file, maxBytes) {
  try {
    const st = fs.statSync(file);
    const start = Math.max(0, st.size - maxBytes);
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(st.size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    fs.closeSync(fd);
    return buf.toString('utf-8');
  } catch {
    return null;
  }
}

/**
 * @param {object} deps
 * @param {import('./settings').Settings} deps.settings
 * @param {import('./library').Library} deps.library
 * @param {import('./installer').Installer} deps.installer
 * @param {ReturnType<import('./schema-service').createSchemaService>} deps.schemaService
 * @param {import('./catalog').Catalog} deps.catalog
 * @param {import('./icons').Icons} [deps.icons]
 * @param {{version: string, logFile?: string}} deps.app
 * @returns {{report: object, files: Record<string, string>}}
 *   report: the structured data to write as report.json
 *   files: extra plain-text files to include verbatim, keyed by name inside the zip
 */
function buildReport({ settings, library, installer, schemaService, catalog, icons, app }) {
  const s = settings.all();
  const game = s.dotaGamePath;
  const gameValid = validateGamePath(game);
  const active = s.langSuffix;

  const records = library.list();
  const byCategory = {};
  for (const r of records) byCategory[r.categoryId] = (byCategory[r.categoryId] || 0) + 1;

  const report = {
    generatedAt: new Date().toISOString(),
    app: {
      version: app.version,
      platform: `${os.platform()} ${os.release()} ${os.arch()}`,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      uiLang: s.uiLang,
    },
    settings: {
      ...s,
      // the OAuth token never touches disk (see discord-auth.js) - what's left is fine to
      // send, but the Discord id and the avatar picture add nothing to a bug report
      account: s.account ? { signedIn: true, username: s.account.username || null } : null,
    },
    dota: {
      path: game || null,
      pathValid: gameValid,
      detectedLang: gameValid ? gamelang.detectLangSuffix(game) : null,
      bootLanguages: gameValid ? gamelang.bootLanguages(game) : null,
      steamLanguage: gameValid ? gamelang.steamLanguage(game) : null,
      langFolders: gameValid ? gamelang.langFolders(game) : [],
      activeVoiceInstalled: gameValid && !!active ? gamelang.voiceInstalled(game, active) : false,
      minifyDetected: !!(gameValid && fs.existsSync(path.join(game, 'dota_minify'))),
    },
    patchAndSchema: (() => {
      try { return schemaService.state(); } catch (err) { return { error: String(err.message || err) }; }
    })(),
    // which download mirrors have been failing this session: "it won't download" is one of
    // the commonest reports, and this says whether the bytes or the route are the problem
    mirrors: (() => {
      try { return mirrorHealth(); } catch { return []; }
    })(),
    library: {
      totalRecords: records.length,
      byCategory,
      enabled: records.filter((r) => r.enabled !== false).length,
      disabled: records.filter((r) => r.enabled === false).length,
      packs: records.filter((r) => r.kind === 'pack').length,
      withSchemaEdits: records.filter((r) => Array.isArray(r.schema) && r.schema.length).length,
      presets: library.listPresets().length,
      fileOverlaps: (() => {
        try { return installer.libraryConflicts(records).length; } catch { return null; }
      })(),
    },
    catalogCache: catalog.cacheInfo(),
    caches: {
      downloadCacheBytes: installer.downloadCacheSize(),
      iconCacheBytes: icons ? icons.size() : null,
    },
  };

  const files = {};
  if (gameValid && active) {
    files['mod-folder-listing.txt'] = folderListingText(path.join(game, `dota_${active}`));
    files['dota-pak-listing.txt'] = folderListingText(
      path.join(game, 'dota'),
      (f) => /^pak\d+_/i.test(f.name) || /gameinfo/i.test(f.name)
    );
  }
  if (app.logFile) {
    const tail = tailLog(app.logFile, 200 * 1024);
    if (tail) files['app.log'] = tail;
  }

  return { report, files };
}

module.exports = { buildReport, listFolder, tailLog };
