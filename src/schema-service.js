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

  // Enabled mods' lifted item blocks + the free cosmetics the user picked.
  function patches(vanillaText) {
    const out = [];
    for (const rec of library.list()) {
      if (rec.enabled === false || !Array.isArray(rec.schema)) continue;
      for (const d of rec.schema) out.push({ id: d.id, block: d.block, source: rec.name });
    }
    const picks = settings.get('cosmetics') || {};
    for (const [slot, donorId] of Object.entries(picks)) {
      if (!donorId) continue;
      try {
        const target = schema.baseItemFor(vanillaText, slot);
        if (!target) continue;
        out.push({ id: target.id, block: schema.baseItemPatch(vanillaText, target.id, donorId), source: `cosmetic:${slot}` });
      } catch { /* a donor Valve removed simply drops out of the build */ }
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
      const base = schema.readGameSchema(game);
      const list = patches(base.text);
      if (!list.length) return drop();
      const res = schema.deploy({ gamePath: game, folder: patcher.FOLDER, patches: list });
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
    if (!game || !settings.get('schemaPatch')) return { ok: true, healed: [] };
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
      const vanilla = schema.readGameSchema(game).text;
      const { deltas, stripped } = installer.harvestSchema(rec.files, vanilla);
      if (!deltas.length && !stripped.length) return null;
      const fields = { files: rec.files };
      if (deltas.length) fields.schema = deltas;
      library.update(rec.id, fields);
      return { deltas: deltas.length, stripped: stripped.length };
    } catch { return null; }
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
      cosmetics: settings.get('cosmetics') || {},
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

  // Pickable looks for a slot, straight out of the installed game's schema.
  function cosmetics(slot) {
    const game = gamePath();
    if (!game) return { options: [] };
    try {
      const text = schema.readGameSchema(game).text;
      const base = schema.baseItemFor(text, slot);
      return {
        options: schema.cosmeticOptions(text, slot),
        base: base ? base.id : null,
        picked: (settings.get('cosmetics') || {})[slot] || null,
      };
    } catch (err) {
      return { options: [], error: String(err.message || err) };
    }
  }

  function setCosmetic(slot, donorId) {
    const picks = { ...(settings.get('cosmetics') || {}) };
    if (donorId) picks[slot] = String(donorId);
    else delete picks[slot];
    settings.set('cosmetics', picks);
    return { ok: true, ...refresh() };
  }

  return { backupDir, patches, refresh, heal, setEnabled, harvest, state, cosmetics, setCosmetic };
}

module.exports = { createSchemaService };
