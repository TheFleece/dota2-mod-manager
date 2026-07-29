// Which mods actually cover each other's files.
//
// Two VPKs sharing an inner path is the norm, not the exception: authors bake helper
// materials, error placeholders and whole-game tables into every export their tool builds.
// Counting those made the library announce that a Death Prophet skin covers an Io arcana —
// they share six of the author's transparent-material helpers and nothing else.
//
// Three filters, in order of how much they know:
//
//   1. Stock and whole-game paths (below) — fixed knowledge about the engine and about the
//      packers everyone uses. Cheap, and wrong for nobody.
//   2. Paths many installed mods provide. A helper library shows up in every mod its author
//      ships; a genuine asset clash involves two or three mods, never a dozen. This one needs
//      no list to maintain — a packer nobody has heard of yet is caught the same way.
//   3. What is left has to be a real share of the smaller mod. Six shared helpers out of a
//      174-file arcana is 3%: noise. The one file a pedestal mod consists of is 100%: that
//      mod really is being covered, and the user really does need the "raise" button.
//
// Everything here works on Map<path, crc>. A crc of -1 means "unknown" (a loose file with no
// VPK index behind it) and is treated as a clash, since it cannot be ruled out.

// Engine stock / placeholder assets that mods carry but never really fight over:
//   - materials/default/, materials/particle/basic_, materials/models/cubemaps/,
//     particles/basic_ — the "basic_"/default filler Source 2's compiler bakes into
//     almost every mod VPK;
//   - models/dev/ (the ERROR placeholder), models/nomodel/ (the empty null model used to
//     hide default parts) and particles/error/ — shared by unrelated mods that hide or
//     fail to resolve something.
const STOCK_CONTENT_RE = /^(?:materials\/default\/|materials\/particle\/basic_|materials\/models\/cubemaps\/|particles\/(?:models\/)?basic_|particles\/error\/|models\/(?:dev|nomodel)\/)/;

// Whole-game tables and tool branding that packaging tools bake into EVERY export.
// Dota 2 Skinchanger, for one, ships a full 47 MB scripts/items/items_game.txt plus the
// localization files, its loadout stylesheets, its logo strip and a steam-id watermark in
// every single pack it builds. Two packs for two different heroes therefore always differ
// on items_game.txt — which made the app announce "Abaddon conflicts with Elder Titan".
// They don't: the skins live in per-hero asset paths, and these files are interchangeable
// copies of the same table, so whichever one the game loads first serves both mods.
const GLOBAL_TABLE_RE = new RegExp('^(?:' + [
  'scripts/items/items_game(?:\\.txt)?"?$',            // the game's whole item table
  'resource/localization/',                            // full dota_<lang>.txt copies
  'panorama/styles/(?:hero_slot_item_picker_loadout|ui_econ_item)\\.vcss_c"?$',
  'panorama/images/(?:ds|tg|tt|wb|yu|remove|header_credits|footer_credits)[^/]*$',
  '(?:models/heroes|panorama)/\\d{8,}\\.vxml_c"?$',    // <steam id>.vxml_c watermark
].join('|') + ')');

// A path this many installed mods provide is shared tooling, not an asset two of them are
// fighting over. Three is deliberately low: a helper library reaches it as soon as the user
// has three mods by the same author, and no real skin asset is ever supplied by three
// different mods without all of them being about the same hero (which the share rule keeps).
const COMMON_PROVIDERS = 3;

// How much of the smaller mod has to be covered before it is worth telling the user. Real
// overlaps in testing sat at 50-100% (one mod entirely inside another); author filler sat
// under 7%. Anywhere in between is quiet either way, so the exact number is not delicate.
const SIGNIFICANT_SHARE = 0.1;

// drops stock/filler and shared tool-table keys from a Map<path, crc> (in place)
function dropSharedPaths(paths) {
  for (const p of paths.keys()) if (STOCK_CONTENT_RE.test(p) || GLOBAL_TABLE_RE.test(p)) paths.delete(p);
  return paths;
}

/**
 * Paths two mods both provide with content that actually differs. An identical CRC on both
 * sides means the two ship the byte-for-byte same file, which loads the same either way.
 * @param {Map<string, number>} a
 * @param {Map<string, number>} b
 * @param {(path: string) => boolean} [keep]  extra per-path filter (see commonPaths)
 * @returns {string[]}
 */
function conflictingPaths(a, b, keep) {
  const out = [];
  // walk the smaller map: a 40-file mod against the 5000-file library costs 40 lookups
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  for (const [p, cc] of small) {
    if (!big.has(p)) continue;
    if (keep && !keep(p)) continue;
    const ic = big.get(p);
    if (cc === -1 || ic === -1 || cc !== ic) out.push(p);
  }
  return out;
}

/**
 * Paths that too many of the given mods provide to be anyone's own content.
 * @param {Array<{paths: Map<string, number>}>} entries
 * @returns {Set<string>}
 */
function commonPaths(entries) {
  const seen = new Map();
  for (const e of entries) {
    for (const p of e.paths.keys()) seen.set(p, (seen.get(p) || 0) + 1);
  }
  const out = new Set();
  for (const [p, n] of seen) if (n >= COMMON_PROVIDERS) out.add(p);
  return out;
}

/**
 * Every pair of mods where one really does cover the other.
 *
 * @param {Array<{id: string, name: string, paths: Map<string, number>, slot: number|null}>} entries
 * @returns {Array<{a, b, count, paths, share, winner}>} sorted by how much is covered
 */
function findOverlaps(entries) {
  const list = entries.filter((e) => e.paths && e.paths.size);
  const common = commonPaths(list);
  const keep = (p) => !common.has(p);
  const out = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const x = list[i];
      const y = list[j];
      const paths = conflictingPaths(x.paths, y.paths, keep);
      if (!paths.length) continue;
      const share = paths.length / Math.min(x.paths.size, y.paths.size);
      if (share < SIGNIFICANT_SHARE) continue;
      // the game mounts the lower pak number first and that copy wins, so an overlap is a
      // stack rather than a fight; null when neither side is in a numbered pak and the
      // engine's own order settles it
      const winner = x.slot == null || y.slot == null || x.slot === y.slot ? null
        : (x.slot < y.slot ? x.id : y.id);
      out.push({
        a: { id: x.id, name: x.name },
        b: { id: y.id, name: y.name },
        count: paths.length,
        paths,
        share,
        winner,
      });
    }
  }
  return out.sort((p, q) => q.share - p.share || q.count - p.count);
}

/**
 * The same question for a mod that is not installed yet: which of `entries` would the
 * candidate cover (or be covered by)? Run through findOverlaps so a warning before the
 * download says exactly what the library would say afterwards.
 *
 * @param {{id, name, paths}} candidate
 * @param {Array<{id, name, paths, slot}>} entries  the installed mods to compare against
 * @returns {Array<{name, count, share, paths}>}
 */
function findOverlapsWith(candidate, entries) {
  const cand = { ...candidate, slot: null };
  return findOverlaps([cand, ...entries])
    .filter((c) => c.a.id === cand.id || c.b.id === cand.id)
    .map((c) => {
      const other = c.a.id === cand.id ? c.b : c.a;
      return { name: other.name, count: c.count, share: c.share, paths: c.paths.slice(0, 3) };
    });
}

module.exports = {
  STOCK_CONTENT_RE, GLOBAL_TABLE_RE, COMMON_PROVIDERS, SIGNIFICANT_SHARE,
  dropSharedPaths, conflictingPaths, commonPaths, findOverlaps, findOverlapsWith,
};
