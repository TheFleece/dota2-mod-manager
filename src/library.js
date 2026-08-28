// Library: manifest of installed mods + presets
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class Library {
  constructor(userDataDir) {
    this.file = path.join(userDataDir, 'manifest.json');
    this.data = { installed: [], presets: [] };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.file)) {
        const parsed = JSON.parse(fs.readFileSync(this.file, 'utf-8'));
        this.data = { installed: [], presets: [], ...parsed };
      }
    } catch {
      // keep defaults; corrupted manifest is preserved as .bak for manual recovery
      try { fs.copyFileSync(this.file, this.file + '.bak'); } catch { /* ignore */ }
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }

  list() {
    return this.data.installed;
  }

  find(id) {
    return this.data.installed.find((m) => m.id === id) || null;
  }

  findByKey(categoryId, name, styleLabel) {
    return this.data.installed.find(
      (m) => m.categoryId === categoryId && m.name === name && (m.styleLabel || null) === (styleLabel || null)
    ) || null;
  }

  add({ name, categoryId, styleLabel, fileRef, preview, files, kind, members }) {
    const id = crypto.randomUUID();
    const rec = {
      id,
      name,
      categoryId,
      styleLabel: styleLabel || null,
      fileRef,
      preview: preview || null,
      files,
      enabled: true,
      installedAt: Date.now(),
    };
    if (kind) rec.kind = kind;            // e.g. 'pack' — a combined multi-mod slot
    if (members) rec.members = members;   // pack members: [{ id, name, categoryId, enabled, ... }]
    this.data.installed.push(rec);
    this.save();
    return rec;
  }

  update(id, fields) {
    const rec = this.find(id);
    if (rec) { Object.assign(rec, fields); this.save(); }
    return rec;
  }

  setEnabled(id, enabled) {
    const rec = this.find(id);
    if (rec) {
      rec.enabled = enabled;
      this.save();
    }
    return rec;
  }

  removeRecord(id) {
    this.data.installed = this.data.installed.filter((m) => m.id !== id);
    // drop the mod from presets too
    for (const p of this.data.presets) {
      p.modIds = p.modIds.filter((mid) => mid !== id);
    }
    this.save();
  }

  knownLangRelPaths() {
    const out = [];
    for (const m of this.data.installed) {
      for (const f of m.files) {
        if (f.root === 'lang') out.push(f.relPath);
      }
    }
    return out;
  }

  // every installed file across all roots (lang/fonts/cursor/tools) — used to tell
  // app-managed content apart from foreign files during the foreign scan
  knownFiles() {
    const out = [];
    for (const m of this.data.installed) {
      for (const f of m.files) out.push({ root: f.root, relPath: f.relPath });
    }
    return out;
  }

  // ---------- presets ----------

  listPresets() {
    return this.data.presets;
  }

  /* A preset is a set of mods, and a free cosmetic is not one: it owns no file and no pak
   * slot, it is a pick written into the item table, and it exists only while safe mode is
   * off. Folding the two together is what made applying a build silently strip somebody's
   * courier and wards - they were never in the preset, so the apply turned them off. The
   * picks are left alone by everything here; the Library is where they are managed. */
  static inPreset(rec) {
    return !!rec && rec.categoryId !== 'cosmetic';
  }

  savePreset(name) {
    const enabledIds = this.data.installed.filter((m) => m.enabled && Library.inPreset(m)).map((m) => m.id);
    // never fold today's state into a shared preset waiting to be installed — same name,
    // completely different thing
    const existing = this.data.presets.find((p) => p.name === name && !p.wanted);
    if (existing) {
      existing.modIds = enabledIds;
      existing.updatedAt = Date.now();
    } else {
      this.data.presets.push({ id: crypto.randomUUID(), name, modIds: enabledIds, updatedAt: Date.now() });
    }
    this.save();
  }

  // Re-capture what is enabled right now into an existing preset. Saving by name meant
  // retyping it exactly to update a build, and a typo silently created a second preset.
  updatePresetMods(presetId) {
    const p = this.getPreset(presetId);
    if (!p || p.wanted) return null;
    p.modIds = this.data.installed.filter((m) => m.enabled && Library.inPreset(m)).map((m) => m.id);
    p.updatedAt = Date.now();
    this.save();
    return p;
  }

  // A preset that arrived as a .d2mm and hasn't been installed yet: it holds the sender's
  // wish list (`wanted`) instead of local mod ids, plus where the file is stashed.
  addSharedPreset({ name, note, author, wanted, sourceFile }) {
    const preset = {
      id: crypto.randomUUID(),
      name,
      modIds: [],
      updatedAt: Date.now(),
      wanted,
      source: { note: note || '', author: author || '', file: sourceFile || null, importedAt: Date.now() },
    };
    this.data.presets.push(preset);
    this.save();
    return preset;
  }

  updatePreset(id, fields) {
    const p = this.getPreset(id);
    if (p) { Object.assign(p, fields); this.save(); }
    return p;
  }

  deletePreset(presetId) {
    this.data.presets = this.data.presets.filter((p) => p.id !== presetId);
    this.save();
  }

  getPreset(presetId) {
    return this.data.presets.find((p) => p.id === presetId) || null;
  }

  /* The mods of a preset, which is not the same as everything its modIds list: one saved
   * before cosmetics were kept out still names picks, and reading it must give the same
   * answer as saving it again would. Stored data is left as it is - a downgrade should find
   * its presets intact. */
  presetModIds(preset) {
    return (preset?.modIds || []).filter((id) => {
      const rec = this.find(id);
      return !rec || Library.inPreset(rec);
    });
  }
}

module.exports = { Library };
