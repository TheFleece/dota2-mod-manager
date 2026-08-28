// Orchestration around the item schema: what goes into it, when it is rebuilt, and how a
// game update is repaired. Kept out of main.js so the whole flow can be exercised without
// starting Electron.
//
// The rules it enforces:
//   - the schema is ALWAYS rebuilt from the installed game's own items_game.txt, so it can
//     never be the stale copy a mod happened to ship;
//   - a mod's changes live in the library record (record.schema), never in its VPK;
//   - nothing is written to the game unless the user turned the patch on.
const path = require('path');
const patcher = require('./patcher');
const schema = require('./schema');

/**
 * @param {object} deps
 * @param {import('./settings').Settings} deps.settings
 * @param {import('./library').Library} deps.library
 * @param {import('./installer').Installer} deps.installer
 * @param {string} deps.userDataDir
 */
function createSchemaService({ settings, library, installer, userDataDir }) {
  const backupDir = path.join(userDataDir, 'backups', 'patch');
  const gamePath = () => settings.get('dotaGamePath');

  // The game's table is 50 MB and walking its 25k items costs ~300 ms, while the picker
  // asks about a dozen slots in a row. Hold on to the text until the game itself changes:
  // the stamp is a stat() of the paks, so noticing an update stays cheap.
  let cache = { stamp: null, base: null };
  /** The game's own table, read once per build of the game. */
  function vanillaBase() {
    const game = gamePath();
    let stamp = null;
    try { stamp = schema.gameSchemaStamp(game); } catch { /* fall through to a fresh read */ }
    if (stamp && cache.stamp === stamp && cache.base) return cache.base;
    const base = schema.readGameSchema(game);
    cache = { stamp, base };
    return base;
  }
  const vanilla = () => vanillaBase().text;

  // Enabled mods' lifted item blocks + the free cosmetics the user picked. A cosmetic pick
  // is a library record like any other (categoryId 'cosmetic', slot + itemId of its own),
  // so toggling, deleting and sharing it in a preset all go through the normal machinery.
  function patches(vanillaText) {
    const out = [];
    for (const rec of library.list()) {
      if (rec.enabled === false) continue;
      if (rec.categoryId === 'cosmetic') {
        try {
          const target = schema.baseItemFor(vanillaText, rec.slot);
          if (!target) continue;
          out.push({ id: target.id, block: schema.baseItemPatch(vanillaText, target.id, rec.itemId), source: rec.name });
        } catch { /* a donor Valve removed simply drops out of the build */ }
        continue;
      }
      if (!Array.isArray(rec.schema)) continue;
      for (const d of rec.schema) out.push({ id: d.id, block: d.block, source: rec.name });
    }
    return out;
  }

  // Rebuild and write the schema pak, or remove it when nothing needs one.
  function refresh() {
    const game = gamePath();
    if (!game) return { ok: false, reason: 'no-game-path' };
    try {
      const drop = () => {
        schema.undeploy({ gamePath: game, folder: patcher.FOLDER });
        settings.set('schemaStamp', null);
        return { ok: true, deployed: false, patches: 0 };
      };
      if (!settings.get('schemaPatch')) return drop();
      // through the cache, not around it: this runs on every mod removed, enabled or
      // switched off, and re-extracting 50 MB from the game's pak each time was the wait
      const base = vanillaBase();
      const list = patches(base.text);
      if (!list.length) return drop();
      const res = schema.deploy({ gamePath: game, folder: patcher.FOLDER, patches: list, base });
      settings.set('schemaStamp', res.stamp);
      return { ok: true, deployed: true, patches: res.applied.length, missing: res.missing, conflicts: res.conflicts, bytes: res.bytes };
    } catch (err) {
      return { ok: false, error: String(err.message || err) };
    }
  }

  // A Dota update overwrites the patched gameinfo and moves the item table underneath our
  // build. Runs on startup and before launching the game.
  function heal() {
    const game = gamePath();
    if (!game) return { ok: true, healed: [] };
    // Safe mode still needs a look: if the game's own file is not what Valve signed, the
    // client refuses the install and nothing in the app is on to explain it. Putting the
    // verified original back is the whole repair (see patcher.restoreBranch).
    if (!settings.get('schemaPatch')) {
      try {
        if (patcher.state(game, patcher.FOLDER).vanillaOk) return { ok: true, healed: [] };
        patcher.revert({ gamePath: game, folder: patcher.FOLDER, backupDir });
        return { ok: true, healed: patcher.state(game, patcher.FOLDER).vanillaOk ? ['vanilla'] : [] };
      } catch (err) {
        return { ok: false, error: String(err.message || err), healed: [] };
      }
    }
    const healed = [];
    try {
      const st = patcher.state(game, patcher.FOLDER);
      if (!st.patched || !st.signed) {
        patcher.apply({ gamePath: game, folder: patcher.FOLDER, backupDir });
        healed.push('patch');
      }
      const stamp = schema.readGameSchema(game).stamp;
      if (stamp !== settings.get('schemaStamp') || !schema.isDeployed(game, patcher.FOLDER)) {
        refresh();
        healed.push('schema');
      }
    } catch (err) {
      return { ok: false, error: String(err.message || err), healed };
    }
    return { ok: true, healed };
  }

  // Turn the patch on or off. This is the only place that edits files of the game install
  // itself, and it is reached only from an explicit user action.
  function setEnabled(on) {
    const game = gamePath();
    if (!game) return { error: 'no-game-path' };
    if (on) {
      patcher.apply({ gamePath: game, folder: patcher.FOLDER, backupDir });
      settings.set('schemaPatch', true);
      return { ok: true, ...refresh() };
    }
    settings.set('schemaPatch', false);
    schema.undeploy({ gamePath: game, folder: patcher.FOLDER });
    patcher.revert({ gamePath: game, folder: patcher.FOLDER, backupDir });
    settings.set('schemaStamp', null);
    return { ok: true, deployed: false };
  }

  // Lift the item blocks a freshly installed mod changed, drop the whole-game tables it
  // shipped, and remember the blocks on its record.
  function harvest(rec) {
    const game = gamePath();
    if (!game || !rec || !Array.isArray(rec.files)) return null;
    try {
      // Repacking changes the file, and with it the fingerprint the catalog is matched by.
      // Keep the original so a recognised mod does not turn into an unknown one.
      let fpBefore = null;
      try { fpBefore = (installer.analyzeRecord(rec) || {}).fp || null; } catch { /* not a vpk record */ }
      const { deltas, stripped } = installer.harvestSchema(rec.files, vanilla());
      if (!deltas.length && !stripped.length) return null;
      const fields = { files: rec.files };
      if (deltas.length) fields.schema = deltas;
      if (stripped.length && fpBefore) fields.fpOriginal = fpBefore;
      library.update(rec.id, fields);
      return { deltas: deltas.length, stripped: stripped.length };
    } catch { return null; }
  }

  /**
   * A Skinchanger export can hold several heroes at once - its packer bundles whatever was
   * in the cart, so a "Grimstroke" pack may also carry Morphling's files and the item block
   * that goes with them. Split such a record into one mod per hero and hand each part the
   * blocks that talk about its own files.
   * @returns {Array<object>|null} the new records, or null when there was nothing to split
   */
  function split(rec) {
    const dir = (rec.files || []).find((f) => f.root === 'lang' && /_dir\.vpk$/i.test(f.relPath));
    if (!dir) return null;
    let parts;
    try { parts = installer.splitVpkFile(dir.relPath); } catch { return null; }
    if (!parts.length) return null;

    const blocks = Array.isArray(rec.schema) ? rec.schema : [];
    const added = [];
    for (const part of parts) {
      const mine = blocks.filter((b) => schema.blockUsesAssets(b.block, part.paths || []));
      const created = library.add({
        name: part.name,
        categoryId: 'imported',
        styleLabel: null,
        fileRef: rec.fileRef || rec.name,
        preview: null,
        files: part.files,
      });
      const fields = { schemaChecked: true };
      if (mine.length) fields.schema = mine;
      if (rec.fpOriginal) fields.fpOriginal = rec.fpOriginal;
      library.update(created.id, fields);
      added.push({ ...created, ...fields });
    }
    installer.remove(rec.files);
    library.removeRecord(rec.id);
    return added;
  }

  /**
   * Mods installed before this existed still carry the whole-game tables inside their VPK:
   * a stale item schema (dead weight) and a stale localization copy (which outranks the
   * game's own and rolls UI text back to whenever the mod was built). Sweep them once.
   * @returns {{ scanned: number, changed: number, deltas: number, freedMB: number }}
   */
  function migrate() {
    const game = gamePath();
    const out = { scanned: 0, changed: 0, deltas: 0, freedMB: 0 };
    if (!game) return out;
    for (const rec of library.list()) {
      if (rec.kind === 'pack' || Array.isArray(rec.schema) || rec.schemaChecked) continue;
      if (!Array.isArray(rec.files) || !rec.files.some((f) => f.root === 'lang' && /_dir\.vpk$/i.test(f.relPath))) continue;
      out.scanned++;
      let before = 0;
      try { before = installer.installedSize(rec); } catch { /* size is only for the log line */ }
      const res = harvest(rec);
      // remember that this record was looked at, so a clean mod is not re-scanned every start
      if (!res) { library.update(rec.id, { schemaChecked: true }); continue; }
      out.changed++;
      out.deltas += res.deltas;
      try { out.freedMB += Math.max(0, before - installer.installedSize(rec)) / 1048576; } catch { /* noop */ }
      library.update(rec.id, { schemaChecked: true });
    }
    out.freedMB = Math.round(out.freedMB);
    return out;
  }

  // Two mods changing the same item block DIFFERENTLY: only one of them can be in the built
  // table (the one installed later), so the library has to say so instead of quietly
  // dropping the other. Identical blocks are not a conflict at all - Skinchanger bundles
  // the whole cart into every export, so two of its packs routinely carry the same block.
  function conflicts() {
    const flat = (s) => s.replace(/\s+/g, ' ').trim();
    const byId = new Map();
    for (const rec of library.list()) {
      if (rec.enabled === false || !Array.isArray(rec.schema)) continue;
      for (const d of rec.schema) {
        if (!byId.has(d.id)) byId.set(d.id, { id: d.id, name: d.name, mods: [], texts: new Set() });
        const entry = byId.get(d.id);
        entry.mods.push(rec.name);
        entry.texts.add(flat(d.block));
      }
    }
    return [...byId.values()]
      .filter((c) => c.texts.size > 1)
      .map(({ id, name, mods }) => ({ id, name, mods }));
  }

  function state() {
    const game = gamePath();
    const out = {
      enabled: !!settings.get('schemaPatch'),
      folder: patcher.FOLDER,
      patched: false,
      signed: false,
      foreign: null,
      deployed: false,
      stale: false,
      mods: library.list().filter((r) => r.enabled !== false && Array.isArray(r.schema) && r.schema.length).length,
      cosmeticsPicked: library.list().filter((r) => r.categoryId === 'cosmetic' && r.enabled !== false).length,
      conflicts: conflicts(),
    };
    if (!game) return out;
    try {
      Object.assign(out, patcher.state(game, patcher.FOLDER));
      out.deployed = schema.isDeployed(game, patcher.FOLDER);
      if (out.deployed) out.stale = schema.readGameSchema(game).stamp !== settings.get('schemaStamp');
    } catch (err) {
      out.error = String(err.message || err);
    }
    return out;
  }

  // The live cosmetic record for a slot, if any — at most one is ever enabled at a time
  // (see pickCosmetic), the same rule the app already applies to cursor sets.
  function cosmeticRecordFor(slot) {
    return library.list().find((r) => r.categoryId === 'cosmetic' && r.slot === slot && r.enabled !== false) || null;
  }

  /**
   * Every slot that has both a free "base item" and something to put on it, in one call.
   * The list comes from the installed game, so a slot Valve adds later appears by itself.
   * @returns {{ slots: Array<{slot, base, picked, options}> }}
   */
  function cosmeticSlots() {
    const game = gamePath();
    if (!game) return { slots: [] };
    try {
      const text = vanilla();
      const bases = schema.listItems(text).filter((i) => i.baseitem);
      const seen = new Set();
      const slots = [];
      for (const base of bases) {
        const slot = base.slot || base.prefab || '';
        if (!slot || seen.has(slot)) continue;
        seen.add(slot);
        const options = schema.cosmeticOptions(text, slot);
        if (!options.length) continue;
        const rec = cosmeticRecordFor(slot);
        slots.push({ slot, base: base.id, picked: rec ? rec.itemId : null, recordId: rec ? rec.id : null, options });
      }
      return { slots };
    } catch (err) {
      return { slots: [], error: String(err.message || err) };
    }
  }

  /**
   * Pick a look for a slot. Switching to a genuinely new item disables whatever was live for
   * that slot (never deletes it: a preset saved earlier may still point at that record,
   * exactly like disabling a regular mod doesn't erase it) and creates a fresh record — or
   * reactivates a dormant one for that same item, so flipping back and forth between two
   * looks doesn't spawn a new row each time. Returns the now-live record.
   */
  function pickCosmetic(slot, itemId, itemName) {
    const id = String(itemId);
    const name = itemName || id;
    const live = cosmeticRecordFor(slot);
    if (live && live.itemId === id) return live; // already this

    if (live) library.setEnabled(live.id, false);
    const dormant = library.list().find((r) => r.categoryId === 'cosmetic' && r.slot === slot && r.itemId === id);
    const rec = dormant
      ? library.update(dormant.id, { name, enabled: true })
      : library.add({ name, categoryId: 'cosmetic', styleLabel: null, fileRef: null, preview: null, files: [] });
    if (!dormant) library.update(rec.id, { slot, itemId: id });
    refresh();
    return library.find(rec.id);
  }

  // One-time move of picks that used to live in settings.json into library records, from
  // before cosmetics could be toggled/deleted/shared like any other mod.
  function migrateCosmeticSettings() {
    const picks = settings.get('cosmetics');
    if (!picks || !Object.keys(picks).length) return;
    const game = gamePath();
    if (!game) return;
    try {
      const text = vanilla();
      for (const [slot, itemId] of Object.entries(picks)) {
        if (!itemId || cosmeticRecordFor(slot)) continue;
        const opt = schema.cosmeticOptions(text, slot).find((o) => o.id === String(itemId));
        pickCosmetic(slot, itemId, opt ? opt.name : slot);
      }
    } catch { /* the game path may not be ready yet; nothing lost, just retried next start */ }
    settings.set('cosmetics', {});
  }

  return {
    backupDir, patches, refresh, heal, setEnabled, harvest, split, migrate, state,
    cosmeticSlots, pickCosmetic, migrateCosmeticSettings,
  };
}

module.exports = { createSchemaService };
