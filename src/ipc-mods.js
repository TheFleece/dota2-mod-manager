/* Installing, removing, switching and importing mods: the channels the Library screen and
 * the catalog's install buttons reach for.
 *
 * The bodies are unchanged from where they were in main.js. What changed is that everything
 * they use arrives as an argument, so the list at the top of the function is an honest answer
 * to "what does managing a mod actually touch".
 */
const fs = require('fs');
const path = require('path');
const { dialog, ipcMain } = require('electron');

const { t } = require('./i18n');

/** @param {object} ctx  the services and main-process callbacks these channels use */
function registerModsIpc({
  applyMasterToCursors, catalog, diag, disableOtherCursors, fingerprints, importVpkBuffers, importVpkPaths, installer, isCursorRecord, library, refreshPresence, schemaService, sendProgress, verifyStuck, win,
}) {
  // `win` arrives as a getter, not as the window. These are registered before the window
  // is created, so a value captured here would be undefined forever - which is exactly
  // what win:isMaximized did on the first run after this file was split out.
  ipcMain.handle('mods:install', async (e, payload) => {
    // payload: { categoryId, name, styleLabel, fileRef, preview }
    const stop = blocked('install');
    if (stop) return stop;
    try {
      const existing = library.findByKey(payload.categoryId, payload.name, payload.styleLabel);
      if (existing) return { error: t('Уже установлено'), already: true };
      // a cursor set is written straight over the one in resource\cursor, so the set that
      // is on has to step aside first — otherwise its files are gone with no way back
      const replaced = payload.categoryId === 'cursors' ? disableOtherCursors(null) : [];
      const files = await installer.install({
        categoryId: payload.categoryId,
        modName: payload.name,
        fileRef: payload.fileRef,
      });
      const rec = library.add({ ...payload, files });
      // lift any item-schema changes out of the mod and rebuild the schema pak
      const harvest = schemaService.harvest(rec);
      if (harvest && harvest.deltas) schemaService.refresh();
      // keep the set's own copy, so it can be switched back on later without a re-download
      if (payload.categoryId === 'cursors') { try { installer.ensureCursorStore(rec.id, files); } catch { /* noop */ } }
      // installed while the master switch is off? sweep the fresh file off too, so the
      // library state stays consistent (all mods off) until the user turns them back on.
      if (installer.masterIsOff()) {
        try { installer.setMasterEnabled(false); } catch { /* noop */ }
        applyMasterToCursors(false);
      }
      sendProgress({ type: 'done', label: payload.name });
      return { ok: true, record: rec, replaced };
    } catch (err) {
      sendProgress({ type: 'error', label: payload.name, message: String(err.message || err) });
      return { error: String(err.message || err) };
    }
  });

  ipcMain.handle('mods:exportSingle', async (e, id) => {
    const rec = library.find(id);
    if (!rec) return { error: t('Мод не найден') };
    try {
      // a cursor set is loose files, not a pak — it travels as the zip the catalog uses
      const cursor = isCursorRecord(rec);
      const buf = cursor ? installer.cursorZip(rec) : installer.mergeToSingleVpk(rec, rec.schema);
      const safe = rec.name.replace(/[<>:"/\\|?*]/g, '_') || 'mod';
      const res = await dialog.showSaveDialog(win(), {
        title: cursor ? t('Сохранить курсор архивом') : t('Сохранить мод одним .vpk файлом'),
        defaultPath: `${safe}.${cursor ? 'zip' : 'vpk'}`,
        filters: [cursor
          ? { name: t('Архив курсора'), extensions: ['zip'] }
          : { name: t('VPK мод'), extensions: ['vpk'] }],
      });
      if (res.canceled || !res.filePath) return { cancelled: true };
      fs.writeFileSync(res.filePath, buf);
      return { ok: true, path: res.filePath, size: buf.length };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  // The other half of "pack a folder": hand the author back the files themselves, so a mod
  // can be opened, changed and dropped in again without any other tool.
  ipcMain.handle('mods:unpackToFolder', async (e, id) => {
    const rec = library.find(id);
    if (!rec) return { error: t('Мод не найден') };
    try {
      const res = await dialog.showOpenDialog(win(), {
        title: t('Куда распаковать мод'),
        properties: ['openDirectory', 'createDirectory'],
      });
      if (res.canceled || !res.filePaths.length) return { cancelled: true };
      const safe = rec.name.replace(/[<>:"/\\|?*]/g, '_') || 'mod';
      const dest = path.join(res.filePaths[0], safe);
      fs.mkdirSync(dest, { recursive: true });
      const out = installer.unpackToFolder(rec, dest);
      return { ok: true, path: dest, ...out };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  ipcMain.handle('mods:importDialog', async () => {
    const res = await dialog.showOpenDialog(win(), {
      title: t('Выбери .vpk файлы модов или .zip с ними'),
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: t('Моды (.vpk, .zip)'), extensions: ['vpk', 'zip'] }],
    });
    if (res.canceled || !res.filePaths.length) return { cancelled: true };
    return importVpkPaths(res.filePaths);
  });

  // folder picker — Windows can't offer files and folders in one dialog, so a pack that
  // unzipped to a whole game tree (Skinchanger) gets its own entry point
  ipcMain.handle('mods:importFolderDialog', async () => {
    const res = await dialog.showOpenDialog(win(), {
      title: t('Выбери папку с модами'),
      properties: ['openDirectory'],
    });
    if (res.canceled || !res.filePaths.length) return { cancelled: true };
    return importVpkPaths(res.filePaths);
  });

  ipcMain.handle('mods:importPaths', (e, paths) => importVpkPaths(Array.isArray(paths) ? paths : []));
  ipcMain.handle('mods:importBuffers', (e, items) => importVpkBuffers(items));

  ipcMain.handle('mods:list', () => {
    // folder sync: a mod deleted straight from the game folder drops out of the library
    try {
      for (const rec of [...library.list()]) {
        if (rec.kind === 'pack') {
          if ((rec.files || []).length && !installer.langPrimaryPresent(rec)) {
            installer.removePackFully(rec);
            library.removeRecord(rec.id);
          }
        } else if (!installer.langPrimaryPresent(rec)) {
          library.removeRecord(rec.id);
        }
      }
    } catch { /* no game path yet — nothing to sync */ }

    let external = [];
    // fingerprint -> a mod already in the library, so a file that is byte-identical to
    // something managed can be called what it is (a leftover copy) instead of a mystery
    const installedFps = new Map();
    try {
      for (const rec of library.list()) {
        if (rec.kind === 'pack') continue;
        const a = installer.analyzeRecord(rec);
        if (a && a.fp && !installedFps.has(a.fp)) installedFps.set(a.fp, rec.name);
      }
    } catch { /* no game path — nothing to compare against */ }
    try {
      const known = library.knownFiles();
      const canMatch = fingerprints.hasData();
      external = installer.externalFiles(known, { scanExtras: canMatch });
      for (const f of external) {
        if (!f.fp) continue;
        f.match = fingerprints.match(f.fp); // recognise catalog mods
        if (installedFps.has(f.fp)) f.duplicateOf = installedFps.get(f.fp);
      }
      // lang-root files are always worth listing; maps/cursor only when recognised
      external = external.filter((f) => f.primary || f.match);
      // fonts share panorama\fonts with vanilla — subset-match instead of a folder fp
      if (canMatch && fingerprints.fonts.length && !known.some((f) => f.root === 'fonts')) {
        const fh = installer.fontFolderHashes();
        for (const m of (fh ? fingerprints.matchFonts(fh) : [])) {
          external.push({
            kind: 'font', key: `__font__${m.name}`, name: m.name, primary: false,
            size: 0, enabled: true, files: Object.keys(m.files).map((bn) => ({ root: 'fonts', relPath: bn })),
            match: [{ name: m.name, categoryId: m.categoryId, styleLabel: m.styleLabel || null }],
          });
        }
      }
    } catch { /* lang folder may not exist yet */ }
    // imported mods have no catalog identity — tag them by content, match to catalog if known
    const installed = library.list().map((rec) => {
      if (rec.categoryId !== 'imported') return rec;
      try {
        const a = installer.analyzeRecord(rec) || {};
        // fpOriginal: the file was repacked to drop the whole-game tables it shipped, so
        // match on what it hashed to before that, or a recognised mod becomes unknown
        const matches = fingerprints.match(rec.fpOriginal || a.fp);
        // one-time: give bare "pakNN" imports a real name — the catalog name if the file
        // is recognised, otherwise the content (hero / set / kind)
        if (/^!?pak\d+$/i.test(rec.name)) {
          const dir = rec.files.find((f) => f.root === 'lang' && /_dir\.vpk$/i.test(f.relPath));
          const nm = (matches && matches[0] && matches[0].name) || (dir && installer.displayNameForFile(dir.relPath));
          if (nm && nm !== rec.name) { library.update(rec.id, { name: nm }); rec.name = nm; }
        }
        return { ...rec, ...a, match: matches };
      } catch { return rec; }
    });
    // Who is quietly covering whom. Both lists take part: a foreign file in the folder is
    // mounted by the game exactly like a managed one, so leaving it out would name the wrong
    // winner. Only switched-on mods, because a switched-off one is renamed and never mounted.
    let covered = new Map();
    try {
      const live = [
        ...installed.filter((r) => r.enabled).map((r) => ({ key: r.id, name: r.name, files: r.files })),
        ...external.filter((f) => f.enabled).map((f) => ({ key: f.key, name: f.name, files: f.files })),
      ];
      covered = installer.coverage(live);
    } catch { /* no game path — nothing is mounted, nothing covers anything */ }
    external = external.map((f) => (covered.has(f.key) ? { ...f, coveredBy: covered.get(f.key) } : f));

    let slots = 0;
    try { slots = installer.usedModSlots(); } catch { /* no game path */ }
    /* Leave a note on disk saying which files here are ours. This handler already reconciles
     * the library against the folder and the renderer re-lists after every install, toggle,
     * preset and bulk action, so it is the one place that keeps the note honest without
     * hooking a dozen handlers - the same reason refreshPresence() sits here. */
    try { installer.writeOwnership(library.knownLangRelPaths()); } catch (err) { diag(`ownership note skipped: ${err.message}`); }
    // the renderer re-lists after every install, toggle, preset and bulk action, so this is
    // the one place that keeps the Discord status honest without hooking a dozen handlers
    refreshPresence();
    // The lifted item blocks are only ever needed in the main process; the renderer just
    // shows that a mod has them, and whether the patch that makes them work is on. Copies,
    // never the stored records — dropping the field off those would erase it on save.
    const schemaOn = schemaService.state().enabled;
    const listed = installed.map((rec) => {
      const by = covered.get(rec.id);
      if (!Array.isArray(rec.schema)) return by ? { ...rec, coveredBy: by } : rec;
      const { schema, ...rest } = rec;
      return { ...rest, schemaCount: schema.length, schemaLive: schemaOn, ...(by ? { coveredBy: by } : {}) };
    });
    return { installed: listed, external, slots, slotCeil: 98, verifyStuck: verifyStuck() };
  });
}

module.exports = { registerModsIpc };
