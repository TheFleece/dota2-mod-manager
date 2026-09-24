/* The load order in two parts.
 *
 * The game mounts pakNN_dir.vpk in numeric order and the first copy of a file wins, so a mod's
 * slot number is its priority. Some categories have to load before everything else: trees,
 * river, shaders, hero effects and a few more replace files other mods ship too, and lose
 * otherwise. Slots 02-29 belong to them; every other mod starts at 30.
 *
 * Asked for by Misha on 2026-09-24. Until then only the first install kept the two apart: a mod
 * moved up past a shader took the shader's slot, and a shader imported by hand and then linked
 * to the catalog stayed wherever the import had put it. 28 slots rather than the old eight
 * because those categories hold 217 catalog mods between them, 126 of them hero items, and eight
 * ran out after one shader, one set of trees, one river and a few items.
 *
 * The installer hands out slots through freeSlotIn; moving a mod between the two parts, and the
 * one-time layout of an order from before, live here too so the rules sit in one place.
 */
const { RESERVED_PAKS } = require('./minify');

/** The categories that load before every other mod. The Dota2PornFx cart zips mark them with a
 *  "!pak" prefix, a merge-order hint for VPKMerge; the game only mounts pakNN_dir.vpk. */
const PRIORITY_CATEGORIES = ['trees', 'river', 'shaders', 'herofx', 'ranged-attack', 'hero-items', 'optimization'];
/** The first and last slot of those categories. */
const PRIORITY_SLOTS = [2, 29];
/** Where every other mod starts. */
const NORMAL_FIRST = 30;

/** Whether a category is one of those that load first. */
const isPriorityCategory = (categoryId) => PRIORITY_CATEGORIES.includes(categoryId);

/** Which part of the load order a category's mods belong in. */
const zoneFor = (categoryId) => (isPriorityCategory(categoryId) ? 'priority' : 'normal');

/** Which part of the load order a slot number is in. */
const slotZone = (n) => (n >= PRIORITY_SLOTS[0] && n <= PRIORITY_SLOTS[1] ? 'priority' : 'normal');

/**
 * The first free slot of a part of the load order, as a file name, or null when it is full.
 * @param {'priority'|'normal'} zone
 * @param {Set<string>} used  lowercased pakNN_dir.vpk names already taken
 */
function freeSlotIn(zone, used) {
  const [from, to] = zone === 'priority' ? PRIORITY_SLOTS : [NORMAL_FIRST, 99];
  for (let n = from; n <= to; n++) {
    // Minify writes 65, 66 and 67 into whichever language folder it is set to, and if that is
    // ours, whoever writes second replaces the other's mod. Three slots out of ninety buys never
    // having to coordinate - see src/minify.js. A pak it has already written needs no
    // reserving: it is in `used`, read off the folder.
    if (RESERVED_PAKS.includes(n)) continue;
    const name = `pak${String(n).padStart(2, '0')}_dir.vpk`;
    if (!used.has(name)) return name;
  }
  return null;
}

/**
 * Move a mod into the part of the load order its category belongs in, when it is not there.
 * Linking an import to the catalog is where this matters: the import could not know the
 * category and took a slot among the rest.
 * @returns {Array<object>|null} the record's new files, or null when it stays where it is
 *   (already in place, no slot, or its part of the order full)
 */
function moveToZone(installer, rec) {
  const n = installer.slotNumber(rec);
  if (n === null) return null;
  const want = zoneFor(rec.categoryId);
  if (slotZone(n) === want) return null;
  const free = freeSlotIn(want, installer.usedPakNames());
  if (!free) return null;
  return installer.moveToSlot(rec, free.replace(/_dir\.vpk$/i, ''));
}

/**
 * Lay an existing load order out in its two parts, once. The order within each part is kept;
 * what changes is that every priority mod now comes before every other one, and that the rest
 * start at 30. Files that are not ours keep their slots.
 *
 * Every file is renamed twice, first to a name the game never mounts and then to its new slot,
 * so no step lands on a slot another mod still holds. A failure puts back everything already
 * renamed and throws; the caller tries again on the next start.
 * @returns {{ moved: number }|null} null when there is nothing to lay out, or it would not fit
 */
function migrateSlotZones(installer, library) {
  const recs = library.list()
    .map((r) => ({ r, n: installer.slotNumber(r) }))
    .filter((x) => x.n !== null)
    .sort((a, b) => a.n - b.n);
  if (!recs.length) return null;
  const ours = new Set(recs.map((x) => `${installer.slotBase(x.r)}_dir.vpk`));
  const taken = new Set([...installer.usedPakNames()].filter((f) => /^pak\d+_dir\.vpk$/.test(f) && !ours.has(f)));
  const hand = (zone) => {
    const f = freeSlotIn(zone, taken);
    if (f) taken.add(f);
    return f;
  };
  const plan = [
    ...recs.filter((x) => isPriorityCategory(x.r.categoryId)).map((x) => ({ ...x, to: hand('priority') || hand('normal') })),
    ...recs.filter((x) => !isPriorityCategory(x.r.categoryId)).map((x) => ({ ...x, to: hand('normal') })),
  ];
  if (plan.some((p) => !p.to)) return null;
  const moving = plan
    .filter((p) => `${installer.slotBase(p.r)}_dir.vpk` !== p.to)
    .map((p) => ({ ...p, from: installer.slotBase(p.r), park: `mmslot${p.n}`, to: p.to.replace(/_dir\.vpk$/i, '') }));
  if (!moving.length) return { moved: 0 };

  const done = [];
  const step = (p, files, from, to) => {
    const out = installer.moveToSlot({ ...p.r, files }, to, from);
    done.push({ p, files: out, from, to });
    return out;
  };
  try {
    for (const p of moving) p.parked = step(p, p.r.files, p.from, p.park);
    for (const p of moving) p.files = step(p, p.parked, p.park, p.to);
  } catch (err) {
    for (const d of done.reverse()) {
      try { installer.moveToSlot({ ...d.p.r, files: d.files }, d.from, d.to); } catch { /* nothing else to try */ }
    }
    throw err;
  }
  for (const p of moving) library.update(p.r.id, { files: p.files });
  return { moved: moving.length };
}

module.exports = {
  PRIORITY_CATEGORIES, PRIORITY_SLOTS, NORMAL_FIRST,
  isPriorityCategory, zoneFor, slotZone, freeSlotIn, moveToZone, migrateSlotZones,
};
