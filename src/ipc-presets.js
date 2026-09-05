/* The preset channels: everything the Presets screen can ask for.
 *
 * Twelve handlers, and almost all of them are one line of validation over src/presets-service,
 * which is where the thinking lives. Keeping them here rather than in main.js means the whole
 * preset domain - what a preset is, how it travels, and how the screen reaches it - is three
 * files that name each other, instead of two of them being buried a thousand lines apart in
 * the file that starts the window.
 *
 * The bodies are unchanged from where they were.
 */
const fs = require('fs');
const path = require('path');
const { app, dialog, ipcMain } = require('electron');

const { Library } = require('./library');
const { readPresetFile, writePresetFile } = require('./preset-share');
const { encodePresetLink } = require('./preset-link');
const { t } = require('./i18n');

/**
 * @param {object} ctx  the app's services and the few main-process callbacks these need
 * @param {Electron.BrowserWindow} ctx.win
 * @param {object} ctx.settings
 * @param {object} ctx.catalog
 * @param {object} ctx.installer
 * @param {object} ctx.library
 * @param {object} ctx.schemaService
 * @param {object} ctx.presets  from presetsService()
 * @param {Function} ctx.adoptImportedFiles
 * @param {Function} ctx.afterDeployMaster
 * @param {Function} ctx.disableOtherCursors
 * @param {Function} ctx.sendProgress
 */
function registerPresetsIpc({
  win, settings, catalog, installer, library, schemaService, presets,
  adoptImportedFiles, afterDeployMaster, disableOtherCursors, sendProgress,
}) {
  ipcMain.handle('presets:list', async () => {
    const cat = await presets.catalogIndex();
    return Promise.all(library.listPresets().map(async (p) => {
      // a received preset shows what installing it would cost before anything downloads
      if (p.wanted) return { ...p, status: await presets.sharedPresetStatus(p, cat).catch(() => null) };
      // an own preset says how much of it a link could carry, so the button can explain
      // itself instead of quietly disappearing
      const { mods, skipped } = presets.presetLinkMods(p, cat);
      // A build names mods, not installations, so some of them may not be here right now.
      // The screen shows the whole set and says which part of it is missing, rather than
      // quietly listing the leftovers as if that were the build.
      const members = library.presetMembers(p);
      return {
        ...p,
        modIds: members.filter((m) => m.rec).map((m) => m.rec.id),
        absent: members.filter((m) => !m.rec).map((m) => m.identity),
        link: { count: mods.length, skipped },
      };
    }));
  });
  ipcMain.handle('presets:save', (e, name) => {
    library.savePreset(name);
    return library.listPresets();
  });
  // overwrite a preset with the current on/off state — the "save" the user actually means
  // when they have tweaked a build they already named
  ipcMain.handle('presets:update', (e, id) => {
    const p = library.updatePresetMods(id);
    if (!p) return { error: t('Пресет не найден') };
    return { ok: true, count: (p.mods || []).length };
  });

  ipcMain.handle('presets:rename', (e, id, name) => {
    const clean = String(name || '').trim().slice(0, 120);
    if (!clean) return { error: t('Введи название пресета') };
    if (!library.updatePreset(id, { name: clean })) return { error: t('Пресет не найден') };
    return { ok: true, name: clean };
  });

  ipcMain.handle('presets:delete', (e, id) => {
    presets.dropSharedPresetFile(library.getPreset(id));
    library.deletePreset(id);
    return library.listPresets();
  });
  ipcMain.handle('presets:apply', (e, id) => {
    const preset = library.getPreset(id);
    if (!preset) return { error: t('Пресет не найден') };
    const errors = presets.applyPreset(preset);
    return errors.length ? { error: errors.join('\n') } : { ok: true };
  });

  // ----- sharing presets as .d2mm -----

  ipcMain.handle('presets:exportPlan', async (e, id) => {
    const preset = library.getPreset(id);
    if (!preset) return { error: t('Пресет не найден') };
    try {
      return { name: preset.name, entries: presets.planShape(await presets.presetShareEntries(preset)) };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  ipcMain.handle('presets:export', async (e, id, opts) => {
    const preset = library.getPreset(id);
    if (!preset) return { error: t('Пресет не найден') };
    const safe = preset.name.replace(/[<>:"/\\|?*]/g, '_') || 'preset';
    const res = await dialog.showSaveDialog(win, {
      title: t('Сохранить пресет для друга'),
      defaultPath: `${safe}.d2mm`,
      filters: [{ name: t('Пресет Mod Manager'), extensions: ['d2mm'] }],
    });
    if (res.canceled || !res.filePath) return { cancelled: true };
    try {
      const skip = new Set((opts && opts.skip) || []);
      sendProgress({ type: 'stage', label: preset.name, stage: t('сборка пресета') });
      // pull the bytes only now, and only for what the user kept ticked
      const prep = (entry, key) => {
        if (entry.kind === 'pack') return { ...entry, members: entry.members.map((m, j) => prep(m, `${key}.${j}`)) };
        const { loadData, ...rest } = entry;
        if (entry.kind !== 'embedded') return rest;
        if (skip.has(key)) return { kind: 'missing', name: entry.name, reason: t('отправитель не вложил файл') };
        return { ...rest, data: loadData() };
      };
      const entries = (await presets.presetShareEntries(preset)).map((entry, i) => prep(entry, String(i)));
      const written = writePresetFile(res.filePath, {
        name: preset.name,
        note: (opts && String(opts.note || '').slice(0, 600)) || '',
        author: { name: (opts && String(opts.author || '').slice(0, 80)) || '' },
        app: app.getVersion(),
        catalogFetchedAt: catalog.cacheInfo().fetchedAt,
      }, entries);
      sendProgress({ type: 'done', label: preset.name });
      return { ok: true, path: written.path, size: written.size };
    } catch (err) {
      sendProgress({ type: 'error', label: preset.name, message: String(err.message || err) });
      return { error: String(err.message || err) };
    }
  });

  ipcMain.handle('presets:shareLink', async (e, id) => {
    const preset = library.getPreset(id);
    if (!preset) return { error: t('Пресет не найден') };
    try {
      const { mods, skipped } = presets.presetLinkMods(preset, await presets.catalogIndex());
      if (!mods.length) return { error: t('В пресете только свои моды — ссылка их не донесёт, отправь файлом') };
      const account = settings.get('account');
      const link = encodePresetLink({ name: preset.name, author: account && account.username, mods });
      return { ok: true, ...link, count: mods.length, skipped };
    } catch (err) {
      return { error: String(err.message || err) };
    }
  });

  ipcMain.handle('presets:importDialog', async () => {
    const res = await dialog.showOpenDialog(win, {
      title: t('Выбери файл пресета (.d2mm)'),
      properties: ['openFile'],
      filters: [{ name: t('Пресет Mod Manager'), extensions: ['d2mm'] }],
    });
    if (res.canceled || !res.filePaths[0]) return { cancelled: true };
    return presets.importPresetFile(res.filePaths[0]);
  });

  ipcMain.handle('presets:importFile', (e, filePath) => presets.importPresetFile(filePath));

  ipcMain.handle('presets:resolve', async (e, id) => {
    const preset = library.getPreset(id);
    if (!preset || !preset.wanted) return { error: t('Пресет не найден') };
    const stash = preset.source && preset.source.file;
    let bundle = null;
    if (stash && fs.existsSync(stash)) {
      try { bundle = readPresetFile(stash); } catch (err) { return { error: String(err.message || err) }; }
    }
    const cat = await presets.catalogIndex();
    const fpIndex = presets.installedFpIndex();
    const errors = [];
    let schemaTouched = false;

    // -> ids of the library records that now provide this mod (a multi-hero bundle splits
    // into several), or an empty list when it could not be resolved at all
    const resolveEntry = async (entry) => {
      try {
        if (entry.kind === 'catalog') {
          const have = library.findByKey(entry.categoryId, entry.name, entry.styleLabel);
          if (have) return [have.id];
          const hit = cat.lookup(entry.categoryId, entry.name, entry.styleLabel);
          if (!hit) { errors.push(`${entry.name}: ${t('нет в каталоге')}`); return []; }
          if (hit.categoryId === 'cursors') disableOtherCursors(null); // one cursor at a time
          const files = await installer.install({ categoryId: hit.categoryId, modName: hit.name, fileRef: hit.fileRef });
          const rec = library.add({
            categoryId: hit.categoryId, name: hit.name, styleLabel: hit.styleLabel,
            fileRef: hit.fileRef, preview: hit.preview, files,
          });
          if (hit.categoryId === 'cursors') { try { installer.ensureCursorStore(rec.id, files); } catch { /* noop */ } }
          return [rec.id];
        }
        if (entry.kind === 'embedded') {
          if (entry.fp && fpIndex.has(entry.fp)) return [fpIndex.get(entry.fp)]; // already on disk
          if (!bundle) { errors.push(`${entry.name}: ${t('файл пресета недоступен')}`); return []; }
          sendProgress({ type: 'stage', label: entry.name, stage: t('установка') });
          const files = installer.installVpkBuffer(bundle.readMod(entry.file));
          // exactly the treatment a dragged-in file gets: the sender's item blocks lifted
          // out, a multi-hero bundle split, a name from the content when theirs is a slot
          const { records, schema } = adoptImportedFiles({ files, name: entry.name, fileRef: null });
          if (schema) schemaTouched = true;
          if (entry.fp && records.length === 1) fpIndex.set(entry.fp, records[0].id);
          return records.map((r) => r.id);
        }
        if (entry.kind === 'cosmetic') {
          const rec = schemaService.pickCosmetic(entry.slot, entry.itemId, entry.name);
          return rec ? [rec.id] : [];
        }
        errors.push(`${entry.name}: ${entry.reason || t('нет в файле')}`);
        return [];
      } catch (err) {
        errors.push(`${entry.name}: ${String(err.message || err)}`);
        return [];
      }
    };

    const ids = [];
    for (const entry of preset.wanted) {
      if (entry.kind === 'pack') {
        const memberIds = [];
        for (const m of entry.members) memberIds.push(...await resolveEntry(m));
        const built = presets.packFromRecords(entry.name, memberIds);
        if (built) ids.push(built.id); else ids.push(...memberIds);
      } else {
        ids.push(...await resolveEntry(entry));
      }
    }

    // the picks a sender's file asked for are made, but they do not join the build: from
    // here this is an ordinary preset, and those hold mods only
    const landed = [...new Set(ids)].map((id) => library.find(id)).filter((r) => Library.inPreset(r));
    preset.mods = landed.map(Library.identityOf);
    delete preset.modIds;
    delete preset.wanted;                       // resolved: it's an ordinary preset now
    if (preset.source) preset.source.file = null;
    library.save();
    if (stash) { try { fs.rmSync(stash, { force: true }); } catch { /* noop */ } }

    errors.push(...applyPreset(preset));
    // a mod that arrived already enabled never passes through applyPreset's own switch, so
    // its freshly lifted blocks would sit in the library without ever reaching the build
    if (schemaTouched) schemaService.refresh();
    afterDeployMaster();
    sendProgress({ type: 'done', label: preset.name });
    return { ok: true, installed: preset.mods.length, errors };
  });
}

module.exports = { registerPresetsIpc };
