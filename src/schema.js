// Item-schema engine: the game's own scripts/items/items_game.txt is the only place
// where a mod can attach new particles to a hero, redirect a stock effect, or turn a
// free "base item" (default weather / terrain / HUD...) into a paid one.
//
// Two rules shape everything here:
//   1. Only one items_game.txt may be live, so mods never ship theirs — we lift the
//      changed item blocks out of them and splice those into the game's CURRENT file.
//   2. The result is rebuilt from the installed game every time, so it can never go
//      stale the way a schema shipped inside a mod does.
//
// The file is ~50 MB of KeyValues with a few non-UTF8 bytes in it, so everything here
// works on latin1 strings: byte-exact in and out, no re-encoding surprises.
const fs = require('fs');
const path = require('path');
const { readVpkEntryFile, openVpkIndex, buildVpk, crc32, heroDisplayName } = require('./vpk');
const { t } = require('./i18n');

const SCHEMA_REL = 'scripts/items/items_game.txt';
// Our folder is registered ahead of "dota", so the first pak in it wins the MOD path.
const SCHEMA_VPK = 'pak01_dir.vpk';

// ---------- KeyValues navigation (no full parse: 50 MB, and we only need blocks) ----------

// Skip whitespace and // line comments starting at i.
function skipGap(text, i) {
  for (;;) {
    while (i < text.length && /\s/.test(text[i])) i++;
    if (text[i] === '/' && text[i + 1] === '/') {
      const nl = text.indexOf('\n', i);
      if (nl === -1) return text.length;
      i = nl + 1;
      continue;
    }
    return i;
  }
}

// Read a token (quoted or bare) at i. Returns { value, start, next } or null at a closing brace.
function readToken(text, i) {
  i = skipGap(text, i);
  if (i >= text.length || text[i] === '}') return null;
  if (text[i] === '"') {
    const end = text.indexOf('"', i + 1);
    if (end === -1) throw new Error(t('items_game: незакрытая кавычка'));
    return { value: text.slice(i + 1, end), start: i, next: end + 1 };
  }
  let end = i;
  while (end < text.length && !/[\s{}"]/.test(text[end])) end++;
  return { value: text.slice(i, end), start: i, next: end };
}

/**
 * Bounds of the { ... } block that starts at (or after) i.
 * @returns {[number, number]} [open, close+1]
 */
function blockBounds(text, i) {
  const open = text.indexOf('{', i);
  if (open === -1) throw new Error(t('items_game: не найдено открытие блока'));
  let depth = 0;
  for (let k = open; k < text.length; k++) {
    const c = text[k];
    if (c === '"') { const e = text.indexOf('"', k + 1); if (e === -1) break; k = e; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return [open, k + 1]; }
  }
  throw new Error(t('items_game: незакрытый блок'));
}

/**
 * Walk the direct children of a block.
 * @param {string} text
 * @param {[number, number]} bounds  from blockBounds()
 * @param {(child: {key: string, start: number, end: number, isBlock: boolean, value: string|null, body: [number, number]|null}) => void} fn
 */
function eachChild(text, bounds, fn) {
  let i = bounds[0] + 1;
  const end = bounds[1] - 1;
  while (i < end) {
    const key = readToken(text, i);
    if (!key) break;
    const at = skipGap(text, key.next);
    if (text[at] === '{') {
      const b = blockBounds(text, at);
      fn({ key: key.value, start: key.start, end: b[1], isBlock: true, value: null, body: b });
      i = b[1];
    } else {
      const val = readToken(text, at);
      if (!val) break;
      fn({ key: key.value, start: key.start, end: val.next, isBlock: false, value: val.value, body: null });
      i = val.next;
    }
  }
}

// The "items" section of items_game.txt (all item definitions live directly under it).
function itemsSection(text) {
  const root = blockBounds(text, 0);
  let found = null;
  eachChild(text, root, (c) => {
    if (!found && c.isBlock && c.key.toLowerCase() === 'items') found = c.body;
  });
  if (!found) throw new Error(t('items_game: секция items не найдена'));
  return found;
}

/**
 * One item definition, by id. Returns the exact source range so a splice is byte-exact.
 * @returns {{ id: string, start: number, end: number, text: string } | null}
 */
function findItem(text, id, section) {
  // The parsed list already knows where every item begins and ends, and callers that hand in
  // no section are asking about the whole table - which is the one that is usually warm.
  // Walking all 25 000 children instead cost about 200 ms a call, and dressing one cosmetic
  // slot makes two of them.
  if (!section) {
    const want = String(id);
    const item = listItems(text).find((i) => i.id === want);
    if (item) return { id: item.id, start: item.start, end: item.end, text: text.slice(item.start, item.end) };
  }
  // A named section, or an id the item list does not carry (it keeps numbered items only).
  const bounds = section || itemsSection(text);
  let hit = null;
  eachChild(text, bounds, (c) => {
    if (!hit && c.isBlock && c.key === String(id)) {
      hit = { id: c.key, start: c.start, end: c.end, text: text.slice(c.start, c.end) };
    }
  });
  return hit;
}

// Direct scalar fields of an item block ("name", "prefab", "item_slot"...).
function itemFields(text, item) {
  const out = new Map();
  eachChild(text, blockBounds(text, item.start), (c) => {
    if (!c.isBlock) out.set(c.key.toLowerCase(), c.value);
  });
  return out;
}

/**
 * Every item in the schema, as light records. Used for the free-cosmetics picker
 * (weather / terrain / HUD / killstreak...) which is generated from the live schema
 * rather than hardcoded, so anything Valve adds later shows up on its own.
 * @returns {Array<{id, name, slot, prefab, itemName, image, baseitem, start, end}>}
 */
// Walking 25k item blocks costs ~300 ms, and a rebuild asks for the list several times
// over the same string, so keep the last result around.
/* Two tables, not one.
 *
 * Every rebuild walks the game's own table and then the merged one, and they alternate:
 * patches() reads vanilla, validateSchema reads merged and then vanilla again to compare the
 * counts. With room for a single answer each of those evicted the last, so one rebuild paid
 * for the walk three times over - about 350 ms each on the real 48.5 MB table, and it is
 * exactly the wait somebody feels when they remove a mod that carries item blocks.
 *
 * Two is the number the work actually alternates between; a third would only hold a table
 * nothing is going to ask for again. */
const ITEMS_CACHE_SIZE = 2;
let itemsCache = [];

function listItems(text) {
  const hit = itemsCache.find((e) => e.text === text);
  if (hit) return hit.list;
  const section = itemsSection(text);
  const out = [];
  eachChild(text, section, (c) => {
    if (!c.isBlock || !/^\d+$/.test(c.key)) return;
    const fields = new Map();
    let hasVisuals = false;
    let bundleItems = [];
    eachChild(text, c.body, (f) => {
      if (!f.isBlock) fields.set(f.key.toLowerCase(), f.value);
      else if (f.key.toLowerCase() === 'visuals') hasVisuals = true;
      else if (f.key.toLowerCase() === 'bundle') {
        eachChild(text, f.body, (bundleItem) => {
          if (!bundleItem.isBlock && bundleItem.value === '1') {
            bundleItems.push(bundleItem.key);
          }
        });
      }
    });
    out.push({
      id: c.key,
      name: fields.get('name') || '',
      slot: fields.get('item_slot') || '',
      prefab: fields.get('prefab') || '',
      itemName: fields.get('item_name') || '',
      itemDescription: fields.get('item_description') || '',
      image: fields.get('image_inventory') || '',
      model: fields.get('model_player') || '',
      typeName: fields.get('item_type_name') || '',
      baseitem: fields.get('baseitem') === '1',
      hasVisuals,
      bundleItems,
      start: c.start,
      end: c.end,
    });
  });
  itemsCache.unshift({ text, list: out });
  itemsCache.length = Math.min(itemsCache.length, ITEMS_CACHE_SIZE);
  return out;
}

// The table is read as latin1 so every splice stays byte-exact, which leaves names with
// non-ASCII characters (curly quotes, accents) as raw UTF-8 bytes. Anything shown to a
// person goes back through UTF-8 first.
function toUtf8(s) {
  return /[\x80-\xff]/.test(s) ? Buffer.from(s, 'latin1').toString('utf8') : s;
}

// Which slot an item belongs to. Wearables say it outright; the whole-match cosmetics
// (weather, terrain, HUD...) leave item_slot out and only name their prefab.
function itemSearchText(item) {
  return [item?.slot, item?.prefab, item?.name, item?.itemName, item?.itemDescription, item?.image, item?.model, item?.typeName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function inferredItemSlot(item) {
  if (item?.slot) return item.slot;
  const hay = itemSearchText(item);
  if (!hay) return '';
  const rules = [
    [/offhand_weapon|weapon_offhand/, 'offhand_weapon'],
    [/(^|[^a-z])offhand([^a-z]|$)|quiver/, 'offhand'],
    [/weapon|sword|blade|staff|bow|axe|hammer|scythe|spear|dagger|guns|gun|claws|claw|hook|totem|anchor|sickle/, 'weapon'],
    [/shoulders?|pauldron|necklace|neck/, 'shoulder'],
    [/helmet|helm|head|hood|mask|hair|face|hat|crown|horn|mane|headwear/, 'head'],
    [/shield/, 'shield'],
    [/bracer|glove|arm/, 'arms'],
    [/cape|cloak|back|wings?/, 'back'],
    [/tail/, 'tail'],
    [/skirt|leg|boot|feet|foot/, 'legs'],
    [/mount/, 'mount'],
    [/armor|vest|mail|jacket|coat/, 'armor'],
    [/ambient/, 'ambient'],
    [/summon|pet|forge spirit|forged spirit/, 'summon'],
    [/voice/, 'voice'],
    [/hero_base|persona_selector|shapeshift/, 'hero_base'],
  ];
  for (const [re, slot] of rules) if (re.test(hay)) return slot;
  return '';
}

function slotOf(item) {
  return inferredItemSlot(item) || item.prefab || '';
}

/**
 * The free "base item" of a slot - the one every account owns (555 Default Weather,
 * 590 Default Terrain, ...). Dressing it in another item's visuals is what makes a paid
 * cosmetic the default one.
 */
function baseItemFor(text, slot) {
  return listItems(text).find((i) => i.baseitem && slotOf(i) === slot) || null;
}

/**
 * What can be put on that base item, read straight out of the installed game: anything Valve
 * adds to the schema later shows up on its own, without an app update.
 * @returns {Array<{id, name}>}  name is the schema's own English name, sorted A-Z
 */
function cosmeticOptions(text, slot) {
  return listItems(text)
    .filter((i) => slotOf(i) === slot && !i.baseitem && i.hasVisuals && i.name)
    .map((i) => ({ id: i.id, name: toUtf8(i.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const ITEM_EFFECTS = [
  {
    id: 'fire',
    name: 'Fire',
    type: 'particle_create',
    modifier: 'particles/econ/courier/courier_trail_lava/courier_trail_lava.vpcf',
  },
  {
    id: 'lightnings',
    name: 'Lightnings',
    type: 'particle_create',
    modifier: 'particles/econ/courier/courier_platinum_roshan/platinum_roshan_ambient.vpcf',
  },
  {
    id: 'frostbloom',
    name: 'Frostbloom',
    type: 'particle_create',
    modifier: 'particles/econ/seasonal/seasonal_ambient_silver.vpcf',
  },
  {
    id: 'snow',
    name: 'Snow',
    type: 'particle_create',
    modifier: 'particles/econ/seasonal/seasonal_ambient_snow.vpcf',
  },
  
  {
    id: 'bubbles',
    name: 'Bubbles',
    type: 'particle_create',
    modifier: 'particles/econ/seasonal/seasonal_ambient_bubbles.vpcf',
  },
  {
    id: 'sand-storm',
    name: 'Sand Storm',
    type: 'particle_create',
    modifier: 'particles/econ/courier/courier_roshan_desert_sands/baby_roshan_desert_sands_ambient.vpcf',
  },
  {
    id: 'ghost',
    name: 'Ghost',
    type: 'particle_create',
    modifier: 'particles/econ/courier/courier_f2p/courier_f2p_10th_anniversary_ambient.vpcf',
  },
  // {
  //   id: 'candy_caster',
  //   name: '_Candy Caster',
  //   type: 'particle_create',
  //   modifier: 'particles/econ/seasonal/seasonal_ambient_candy_mint.vpcf',
  // },
  // {
  //   id: 'coins',
  //   name: '_Coins',
  //   type: 'particle_create',
  //   modifier: 'pparticles/econ/seasonal/seasonal_ambient_fortune_coin.vpcf',
  // }
];
const ITEM_HIDDEN_HEROES = new Set(['wisp', 'io']);
const ITEM_SLOT_MATCH_ALIAS = {
  offhand_weapon: 'offhand',
  offhand: 'offhand',
  shoulder: 'shoulders',
  shoulders: 'shoulders',
  arm: 'arms',
  arms: 'arms',
};
const ITEM_SLOT_LABEL = {
  head: 'голова', body_head: 'голова (2)', hair: 'волосы', weapon: 'оружие', offhand: 'оружие (2)', offhand_weapon: 'доп. оружие', shield: 'щит', armor: 'броня',
  shoulder: 'плечи', shoulders: 'плечи', neck: 'шея', belt: 'пояс', arm: 'руки', arms: 'руки', gloves: 'перчатки', back: 'спина',
  wings: 'крылья', tail: 'хвост', legs: 'ноги', mount: 'ездовое', costume: 'костюм', misc: 'разное', ambient: 'эффекты', ambient_effects: 'эффекты',
  ability1: 'способность 1', ability2: 'способность 2', ability3: 'способность 3', ability4: 'способность 4', ability_ultimate: 'ультимейт',
  summon: 'призыв', voice: 'голос', shapeshift: 'форма', hero_base: 'база героя', bundle: 'набор',
};
const ITEM_SLOT_ORDER = [
  'head', 'body_head', 'hair', 'neck', 'shoulder', 'shoulders', 'arm', 'arms', 'gloves', 'back', 'weapon', 'offhand', 'offhand_weapon',
  'shield', 'armor', 'belt', 'legs', 'mount', 'wings', 'tail', 'costume', 'ambient', 'ambient_effects', 'ability1', 'ability2', 'ability3',
  'ability4', 'ability_ultimate', 'summon', 'voice', 'shapeshift', 'misc', 'bundle',
];

function canonicalHeroId(hero) {
  const clean = String(hero || '').toLowerCase().replace(/^npc_dota_hero_/, '');
  return clean === 'io' ? 'wisp' : clean;
}

function canonicalItemSlot(slot) {
  return String(slot || '').toLowerCase();
}

function matchItemSlot(slot) {
  const clean = canonicalItemSlot(slot);
  return ITEM_SLOT_MATCH_ALIAS[clean] || clean;
}

function hiddenItemHeroes(heroes) {
  return heroes.some((hero) => ITEM_HIDDEN_HEROES.has(canonicalHeroId(hero)));
}

function itemSlotId(heroIds, slot) {
  return `item:${heroIds.join('+')}:${slot}`;
}

function titleLabel(text) {
  const s = String(text || '');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function slotDisplayLabel(slot) {
  const equipSlot = canonicalItemSlot(slot);
  return titleLabel(t(ITEM_SLOT_LABEL[equipSlot] || equipSlot.replace(/_/g, ' ')));
}

function itemSlotLabel(heroIds, slot) {
  const heroes = heroIds.map((id) => heroDisplayName(canonicalHeroId(id))).join(' / ');
  return `${heroes} · ${slotDisplayLabel(slot)}`;
}

function isArcanaPersonaItem(item) {
  const text = itemSearchText(item);
  const slot = canonicalItemSlot(inferredItemSlot(item));
  return text.includes('arcana')
    || text.includes('persona')
    || slot === 'persona_selector'
    || /_persona_\d+$/i.test(slot)
    || slot === 'hero_base'
    || slot === 'voice_persona_1'
    || slot === 'summon_persona_1'
    || slot === 'shapeshift_persona_1';
}

function itemSlotIcon(slot) {
  return ({
    head: 'face', body_head: 'face', hair: 'content_cut', neck: 'checkroom', weapon: 'swords', offhand: 'shield', offhand_weapon: 'shield', shield: 'shield', armor: 'security',
    shoulder: 'accessibility_new', shoulders: 'accessibility_new', belt: 'checkroom', arm: 'front_hand', arms: 'front_hand', gloves: 'front_hand', back: 'checkroom',
    wings: 'flutter_dash', tail: 'gesture', legs: 'directions_run', mount: 'pets', costume: 'checkroom', ambient: 'auto_awesome', ambient_effects: 'auto_awesome',
    ability1: 'auto_fix_high', ability2: 'auto_fix_high', ability3: 'auto_fix_high', ability4: 'auto_fix_high', ability_ultimate: 'flash_on',
    summon: 'pets', voice: 'mic', shapeshift: 'pets', misc: 'checkroom', bundle: 'inventory_2',
  })[canonicalItemSlot(slot)] || 'checkroom';
}

/** The effect variants the synthetic cosmetics/items picker can apply. */
function itemEffects() {
  return [{ id: '', name: t('Без эффекта') }, ...ITEM_EFFECTS.map(({ id, name }) => ({ id, name }))];
}

/** Hero item slots built from real default_item entries, with one donor list per hero part. */
function itemSlots(text) {
  const items = listItems(text);
  const heroCache = new Map();
  const heroesOf = (item) => {
    if (!heroCache.has(item.id)) heroCache.set(item.id, itemHeroes(text, item));
    return heroCache.get(item.id);
  };
  const slots = new Map();
  const matchSlots = new Map();
  for (const item of items) {
    const equipSlot = canonicalItemSlot(inferredItemSlot(item));
    if (item.prefab !== 'default_item' || !equipSlot || isArcanaPersonaItem(item)) continue;
    const heroes = heroesOf(item);
    if (!heroes.length || hiddenItemHeroes(heroes)) continue;
    const heroIds = heroes.map(canonicalHeroId);
    const slotId = itemSlotId(heroIds, equipSlot);
    slots.set(slotId, {
      slot: slotId,
      kind: 'item-effect',
      base: item.id,
      targetId: item.id,
      equipSlot,
      heroIds,
      heroLabel: heroIds.map((id) => heroDisplayName(canonicalHeroId(id))).join(' / '),
      slotLabel: slotDisplayLabel(equipSlot),
      label: itemSlotLabel(heroIds, equipSlot),
      icon: itemSlotIcon(equipSlot),
      options: [],
    });
    const matchKey = itemSlotId(heroIds, matchItemSlot(equipSlot));
    const hits = matchSlots.get(matchKey) || [];
    hits.push(slotId);
    matchSlots.set(matchKey, hits);
  }
  for (const item of items) {
    const equipSlot = canonicalItemSlot(inferredItemSlot(item));
    if (item.prefab !== 'wearable' || !equipSlot || !item.name || isArcanaPersonaItem(item)) continue;
    const heroes = heroesOf(item);
    if (!heroes.length || hiddenItemHeroes(heroes)) continue;
    const heroIds = heroes.map(canonicalHeroId);
    const slotId = itemSlotId(heroIds, equipSlot);
    let target = slots.get(slotId);
    if (!target) {
      const hits = matchSlots.get(itemSlotId(heroIds, matchItemSlot(equipSlot))) || [];
      if (hits.length === 1) target = slots.get(hits[0]) || null;
    }
    if (!target) continue;
    target.options.push({ id: item.id, name: toUtf8(item.name) });
  }

  // Add bundle slots for heroes
  for (const item of items) {
    if (item.prefab !== 'bundle' || !item.bundleItems || item.bundleItems.length === 0) continue;
    const heroes = heroesOf(item);
    if (!heroes.length || hiddenItemHeroes(heroes)) continue;

    // Check if bundle contains items with models (not just loading screens)
    const bundleHasModels = item.bundleItems.some(bundleItemName => {
      const bundleItem = items.find(i => i.name === bundleItemName);
      return bundleItem && (bundleItem.model || bundleItem.hasVisuals);
    });

    if (!bundleHasModels) continue;

    const heroIds = heroes.map(canonicalHeroId);
    const slotId = itemSlotId(heroIds, 'bundle');
    let bundleSlot = slots.get(slotId);
    if (!bundleSlot) {
      bundleSlot = {
        slot: slotId,
        kind: 'item-effect',
        base: item.id,
        targetId: item.id,
        equipSlot: 'bundle',
        heroIds,
        heroLabel: heroIds.map((id) => heroDisplayName(canonicalHeroId(id))).join(' / '),
        slotLabel: slotDisplayLabel('bundle'),
        label: itemSlotLabel(heroIds, 'bundle'),
        icon: itemSlotIcon('bundle'),
        options: [],
      };
      slots.set(slotId, bundleSlot);
    }
    bundleSlot.options.push({ id: item.id, name: toUtf8(item.name) });
  }

  const order = new Map(ITEM_SLOT_ORDER.map((slot, i) => [slot, i]));
  return [...slots.values()]
    .filter((s) => s.options.length)
    .map((s) => ({ ...s, options: s.options.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => {
      const byHero = a.label.localeCompare(b.label);
      if (byHero && a.heroIds.join(',') !== b.heroIds.join(',')) return byHero;
      return (order.get(a.equipSlot) ?? 999) - (order.get(b.equipSlot) ?? 999) || a.label.localeCompare(b.label);
    });
}

/** Wearable items with visuals and a matching stock default_item, offered under cosmetics/items. */
function itemOptions(text) {
  return itemSlots(text).flatMap((slot) => slot.options);
}

// ---------- reading the game's own schema ----------

/**
 * Pull scripts/items/items_game.txt out of the game's pak01. This is the base every
 * build starts from, so a game update simply means a rebuild, never a stale schema.
 * @param {string} gamePath  ...\dota 2 beta\game
 * @returns {{ text: string, stamp: string }}  stamp = version marker of the base file
 */
function readGameSchema(gamePath) {
  const pak = path.join(gamePath, 'dota', 'pak01_dir.vpk');
  if (!fs.existsSync(pak)) throw new Error(t('Не найден {0}', pak));
  const hit = readVpkEntryFile(pak, SCHEMA_REL);
  if (!hit) throw new Error(t('items_game.txt не найден в pak01 игры'));
  return { text: hit.data.toString('latin1'), stamp: `${hit.data.length}:${hit.crc >>> 0}` };
}

// Cheap "did the game update?" probe: size+mtime of the paks that carry the schema.
function gameSchemaStamp(gamePath) {
  const dir = path.join(gamePath, 'dota');
  const parts = [];
  for (const f of fs.readdirSync(dir)) {
    if (!/^pak01_(dir|\d{3})\.vpk$/i.test(f)) continue;
    const st = fs.statSync(path.join(dir, f));
    parts.push(`${f}:${st.size}:${Math.floor(st.mtimeMs)}`);
  }
  return parts.sort().join('|');
}

// ---------- mod deltas ----------

// Skinchanger exports are written as one endless line; re-indent so the merged file
// stays readable (and diffable) when someone opens it.
function reindent(block, indent) {
  const first = readToken(block, 0);
  if (!first) return '';
  const at = skipGap(block, first.next);
  if (block[at] !== '{') return String(block).trim();
  const nl = '\r\n';
  const formatBlock = (text, key, bounds, pad) => {
    const rows = [];
    eachChild(text, bounds, (c) => {
      if (c.isBlock) rows.push(formatBlock(text, c.key, c.body, pad + '\t'));
      else rows.push(`${pad}\t"${c.key}"\t\t"${c.value}"`);
    });
    return `${pad}"${key}"${nl}${pad}{${rows.length ? `${nl}${rows.join(nl)}${nl}` : nl}${pad}}`;
  };
  return formatBlock(block, first.value, blockBounds(block, at), indent).trimStart();
}

/**
 * Asset paths a mod ships, in the form items_game refers to them: lowercase, no _c.
 * @param {string[]} vpkPaths
 * @param {{ roots?: boolean }} [opts]  roots: also match Skinchanger's numeric content
 *   root as a whole. Right for "did this mod change that block", wrong when splitting a
 *   pack per hero — there the root is shared by every hero in it.
 */
function ownedAssetNeedles(vpkPaths, opts = {}) {
  const withRoots = opts.roots !== false;
  const out = new Set();
  for (const p of vpkPaths) {
    const clean = p.toLowerCase().replace(/"+$/, '').replace(/_c$/, '');
    if (!clean || clean.length < 8) continue;
    // Stock/global files carry no identity — they are in every export.
    if (/^(scripts\/|resource\/|panorama\/styles\/|materials\/default\/)/.test(clean)) continue;
    out.add(clean);
    // A block can point a slot at one of Valve's own models and still belong to the mod: the
    // author repaints that item by shipping its materials, and the block only names the model.
    // Tinker's cape is that case - the mod carries nothing of deep_sea_robot_back but its
    // textures, and without this the redirect was dropped and the back never appeared.
    const item = /materials\/models\/items\/([a-z0-9_]+)\/([a-z0-9_]+)\//.exec(clean);
    if (item) out.add(`models/items/${item[1]}/${item[2]}/`);
    const root = clean.split('/')[0];
    if (withRoots && /^\d{3,}$/.test(root)) out.add(root + '/');
  }
  return [...out];
}

// Does an item block talk about any of these files? Used when a multi-hero pack is split:
// each part keeps only the blocks that belong to its own assets.
function blockUsesAssets(blockText, vpkPaths) {
  const hay = blockText.toLowerCase();
  return ownedAssetNeedles(vpkPaths, { roots: false }).some((n) => hay.includes(n));
}

/**
 * The blocks a mod changed, written back out as a table of their own: the shape items_game
 * has, holding nothing but this mod's items.
 *
 * Installing a mod lifts its item blocks onto the library record and drops the 47 MB table
 * it shipped (see installer.harvestSchema) - which is right for this install, and wrong for
 * a file leaving it. A mod exported or shared without those blocks travels without its
 * effects and icons, so anything built for somewhere else carries this instead: small, and
 * read straight back by the same harvest on the other side.
 * @param {Array<{id, name, block}>} deltas
 * @returns {string}
 */
function deltaTable(deltas) {
  const nl = '\r\n';
  // verbatim, not reindented: the block is already valid KV, and keeping its own bytes is
  // what makes the trip out and back byte-identical to what was lifted in the first place
  const blocks = (deltas || []).map((d) => '\t\t' + d.block).join(nl);
  return `"items_game"${nl}{${nl}\t"items"${nl}\t{${nl}${blocks}${nl}\t}${nl}}${nl}`;
}

/**
 * Which item blocks a mod actually changed. Diffing two schemas line by line is
 * useless (the mod's copy is months behind the game's), so instead: a real change
 * always names a file the mod itself ships. Blocks that mention one of those, and
 * differ from the installed schema, are the delta.
 * @param {string} modText     items_game.txt taken out of the mod
 * @param {string[]} vpkPaths  every path inside that mod's VPK
 * @param {string} baseText    the game's current schema (to drop no-op blocks)
 * @returns {Array<{ id: string, name: string, block: string }>}
 */
function extractDeltas(modText, vpkPaths, baseText) {
  const needles = ownedAssetNeedles(vpkPaths);
  if (!needles.length) return [];
  const section = itemsSection(modText);
  const baseSection = baseText ? itemsSection(baseText) : null;
  const deltas = [];
  eachChild(modText, section, (c) => {
    if (!c.isBlock || !/^\d+$/.test(c.key)) return;
    const raw = modText.slice(c.start, c.end);
    const hay = raw.toLowerCase();
    if (!needles.some((n) => hay.includes(n))) return;
    let name = '';
    eachChild(modText, c.body, (f) => { if (!f.isBlock && f.key.toLowerCase() === 'name') name = f.value; });
    if (baseText) {
      const cur = findItem(baseText, c.key, baseSection);
      if (cur && cur.text.replace(/\s+/g, ' ') === raw.replace(/\s+/g, ' ')) return; // unchanged
    }
    deltas.push({ id: c.key, name, block: raw });
  });
  return deltas;
}

// Remove every "<key> { … }" sub-block from a KV fragment, with the whitespace in front
// of it, so the result still reads like the file it came from.
function stripKeyBlocks(text, key) {
  let out = text;
  for (;;) {
    const at = out.indexOf(`"${key}"`);
    if (at === -1) return out;
    const open = out.indexOf('{', at);
    if (open === -1) return out;
    let depth = 0;
    let end = -1;
    for (let i = open; i < out.length; i++) {
      if (out[i] === '{') depth++;
      else if (out[i] === '}') { depth--; if (!depth) { end = i + 1; break; } }
    }
    if (end === -1) return out;
    let start = at;
    while (start > 0 && /[ \t\r\n]/.test(out[start - 1])) start--;
    out = out.slice(0, start) + out.slice(end);
  }
}

function setScalarField(blockText, key, value) {
  const body = blockBounds(blockText, 0);
  let hit = null;
  eachChild(blockText, body, (c) => {
    if (!hit && !c.isBlock && c.key.toLowerCase() === key.toLowerCase()) hit = c;
  });
  const line = `"${key}"\t\t"${value}"`;
  if (hit) return blockText.slice(0, hit.start) + line + blockText.slice(hit.end);
  const close = blockText.lastIndexOf('}');
  return close === -1 ? blockText : `${blockText.slice(0, close)}\r\n\t${line}\r\n${blockText.slice(close)}`;
}

function setVisualsBlock(blockText, visuals) {
  const body = blockBounds(blockText, 0);
  let hit = null;
  eachChild(blockText, body, (c) => {
    if (!hit && c.isBlock && c.key.toLowerCase() === 'visuals') hit = c;
  });
  const clean = visuals.trim();
  if (hit) return blockText.slice(0, hit.start) + clean + blockText.slice(hit.end);
  const close = blockText.lastIndexOf('}');
  return close === -1 ? blockText : `${blockText.slice(0, close)}\r\n\t${clean}\r\n${blockText.slice(close)}`;
}

function itemEffectById(effectId) {
  const want = String(effectId || '').trim().toLowerCase();
  return ITEM_EFFECTS.find((e) => e.id === want) || null;
}

function setBlockId(blockText, id) {
  return String(blockText).replace(/^\s*"\d+"/, `"${id}"`);
}

function itemHeroes(text, item) {
  const out = [];
  eachChild(text, blockBounds(text, item.start), (c) => {
    if (!c.isBlock || c.key.toLowerCase() !== 'used_by_heroes') return;
    eachChild(text, c.body, (h) => {
      if (h.isBlock || h.value !== '1' || !/^npc_dota_hero_/i.test(h.key)) return;
      out.push(h.key.toLowerCase());
    });
  });
  return out.sort();
}

function itemBlock(text, item) {
  return text.slice(item.start, item.end);
}

function itemVisuals(text, item) {
  let visuals = null;
  eachChild(text, blockBounds(text, item.start), (c) => {
    if (c.isBlock && c.key.toLowerCase() === 'visuals') visuals = text.slice(c.start, c.end);
  });
  return visuals;
}

function normalizeAssetPath(p) {
  return String(p || '').toLowerCase().replace(/\\/g, '/').replace(/^\/+/, '');
}

function compiledAssetPath(p) {
  const clean = normalizeAssetPath(p);
  return clean.endsWith('_c') ? clean : `${clean}_c`;
}

function vpkEntryForPath(relPath, data) {
  const lower = normalizeAssetPath(relPath);
  const slash = lower.lastIndexOf('/');
  const file = slash === -1 ? lower : lower.slice(slash + 1);
  const dot = file.lastIndexOf('.');
  return {
    ext: dot === -1 ? ' ' : file.slice(dot + 1),
    folder: slash === -1 ? ' ' : lower.slice(0, slash),
    name: dot === -1 ? file : file.slice(0, dot),
    data,
    preload: Buffer.alloc(0),
    crc: crc32(data),
  };
}

function sameHeroes(a, b) {
  return a.length === b.length && a.every((h, i) => h === b[i]);
}

/** The stock default_item that matches a wearable by slot and by the hero(es) that can equip it. */
function defaultItemForWearable(text, sourceId) {
  const source = findItem(text, sourceId);
  if (!source) throw new Error(t('items_game: предмет {0} не найден', sourceId));
  const sourceFields = itemFields(text, source);
  const sourceLite = listItems(text).find((i) => i.id === source.id) || null;
  if (sourceLite && isArcanaPersonaItem(sourceLite)) return null;
  const sourceSlot = canonicalItemSlot(sourceFields.get('item_slot') || inferredItemSlot(sourceLite));
  if (!sourceSlot) return null;
  const sourceMatchSlot = matchItemSlot(sourceSlot);
  const sourceHeroes = itemHeroes(text, source);
  const exact = listItems(text)
    .filter((i) => i.id !== source.id && canonicalItemSlot(inferredItemSlot(i)) === sourceSlot && i.prefab === 'default_item' && !isArcanaPersonaItem(i))
    .map((i) => ({ item: i, heroes: itemHeroes(text, i) }))
    .filter((x) => sameHeroes(x.heroes, sourceHeroes))
    .map((x) => x.item)
    .sort((a, b) => Number(a.id) - Number(b.id));
  if (exact.length) return exact[0];
  return listItems(text)
    .filter((i) => i.id !== source.id && matchItemSlot(inferredItemSlot(i)) === sourceMatchSlot && i.prefab === 'default_item' && !isArcanaPersonaItem(i))
    .map((i) => ({ item: i, heroes: itemHeroes(text, i) }))
    .filter((x) => sameHeroes(x.heroes, sourceHeroes))
    .map((x) => x.item)
    .sort((a, b) => Number(a.id) - Number(b.id))[0] || null;
}

function particleVisualCopies(visuals) {
  const copies = [];
  eachChild(visuals, blockBounds(visuals, 0), (c) => {
    if (!c.isBlock || c.key.toLowerCase() !== 'asset_modifier') return;
    const fields = new Map();
    eachChild(visuals, c.body, (f) => { if (!f.isBlock) fields.set(f.key.toLowerCase(), f.value); });
    if ((fields.get('type') || '').toLowerCase() !== 'particle') return;
    const asset = fields.get('asset');
    const modifier = fields.get('modifier');
    if (!asset || !modifier) return;
    copies.push({ from: modifier, to: asset });
  });
  return copies;
}

function appendItemEffect(visuals, effect) {
  const needle = String(effect.modifier || '').toLowerCase();
  if (needle && visuals.toLowerCase().includes(needle)) return visuals;
  const block = `"asset_modifier"\r\n{\r\n\t"type"\t\t"${effect.type}"\r\n\t"modifier"\t\t"${effect.modifier}"\r\n}`;
  let after = null;
  let before = null;
  eachChild(visuals, blockBounds(visuals, 0), (c) => {
    if (!c.isBlock || c.key.toLowerCase() !== 'asset_modifier') return;
    const fields = new Map();
    eachChild(visuals, c.body, (f) => { if (!f.isBlock) fields.set(f.key.toLowerCase(), f.value); });
    const type = (fields.get('type') || '').toLowerCase();
    if (type === 'particle_create') after = c.end;
    else if (after !== null && before === null) before = c.start;
  });
  const close = visuals.lastIndexOf('}');
  const at = before ?? after ?? close;
  if (at === -1) return visuals;
  const prefix = after === null ? '\r\n\t' : '\r\n\t';
  const suffix = before === null ? '\r\n' : '\r\n\t';
  return `${visuals.slice(0, at)}${prefix}${block}${suffix}${visuals.slice(at)}`;
}

/**
 * Free cosmetics: copy the visuals of a real item onto a "base item" everyone owns
 * (555 Default Weather, 590 Default Terrain, ...). Returns the block to splice in.
 *
 * Styles come along with the visuals, but a paid item locks its extra styles behind
 * "unlock { price, item_def }" - on a base item that only produces a "style locked"
 * button, so those gates come off.
 */
function baseItemPatch(baseText, targetId, sourceId) {
  const target = findItem(baseText, targetId);
  if (!target) throw new Error(t('items_game: предмет {0} не найден', targetId));
  const source = findItem(baseText, sourceId);
  if (!source) throw new Error(t('items_game: предмет {0} не найден', sourceId));

  let visuals = null;
  eachChild(baseText, blockBounds(baseText, source.start), (c) => {
    if (c.isBlock && c.key.toLowerCase() === 'visuals') visuals = baseText.slice(c.start, c.end);
  });
  if (!visuals) throw new Error(t('items_game: у предмета {0} нет блока visuals', sourceId));
  visuals = stripKeyBlocks(visuals, 'unlock');

  // Drop any visuals the base item already has, then append the donor's.
  let stripped = target.text;
  eachChild(baseText, blockBounds(baseText, target.start), (c) => {
    if (c.isBlock && c.key.toLowerCase() === 'visuals') {
      const rel = [c.start - target.start, c.end - target.start];
      stripped = target.text.slice(0, rel[0]) + target.text.slice(rel[1]);
    }
  });
  const close = stripped.lastIndexOf('}');
  return stripped.slice(0, close) + '\t' + visuals.trim() + '\r\n\t\t' + stripped.slice(close);
}

/* Turn one paid wearable into the hero's stock item for that slot.
 *
 * The block stays the donor item almost verbatim: only the header is rewritten to the matching
 * default_item (id + name + prefab), styles/unlocks that cannot be used on a free base item are
 * dropped, and the chosen effect is inserted into visuals. The donor model/particles stay named
 * as the paid item in items_game, while assetCopies still describe the stock-path overrides the
 * built VPK should carry.
 * @returns {{ id: string, block: string, assetCopies: Array<{from: string, to: string}> }}
 */
function itemEffectPatch(baseText, itemId, effectId) {
  const source = findItem(baseText, itemId);
  if (!source) throw new Error(t('items_game: предмет {0} не найден', itemId));
  const target = defaultItemForWearable(baseText, itemId);
  if (!target) throw new Error(t('items_game: default_item для предмета {0} не найден', itemId));
  const effect = itemEffectById(effectId);
  if (effectId && !effect) throw new Error(t('items_game: эффект {0} не найден', effectId));

  const sourceFields = itemFields(baseText, source);
  const targetFields = itemFields(baseText, target);
  let visuals = itemVisuals(baseText, source) || '"visuals"\r\n{\r\n}';

  const assetCopies = [];
  const sourceModel = sourceFields.get('model_player') || '';
  const targetModel = targetFields.get('model_player') || '';
  if (sourceModel && targetModel && normalizeAssetPath(sourceModel) !== normalizeAssetPath(targetModel)) {
    assetCopies.push({ from: sourceModel, to: targetModel });
  }
  assetCopies.push(...particleVisualCopies(visuals));

  visuals = stripKeyBlocks(visuals, 'unlock');
  visuals = stripKeyBlocks(visuals, 'styles');
  if (effect && effect.id) visuals = appendItemEffect(visuals, effect);

  let patched = setBlockId(itemBlock(baseText, source), target.id);
  patched = setScalarField(patched, 'name', targetFields.get('name') || target.name || target.id);
  patched = setScalarField(patched, 'prefab', 'default_item');
  patched = setVisualsBlock(patched, visuals);
  return { id: target.id, block: patched, assetCopies };
}

/** Read compiled asset bytes out of pak01 and stage them under the renamed path in our VPK. */
function gameAssetEntries(gamePath, assetCopies) {
  const pak = path.join(gamePath, 'dota', 'pak01_dir.vpk');
  if (!fs.existsSync(pak)) throw new Error(t('Не найден {0}', pak));
  const ix = openVpkIndex(pak);
  const out = [];
  const seen = new Set();
  for (const copy of assetCopies || []) {
    const from = compiledAssetPath(copy.from);
    const to = compiledAssetPath(copy.to);
    if (!from || !to || seen.has(to)) continue;
    const data = ix.read(from);
    if (!data) throw new Error(t('Не найден {0}', from));
    out.push(vpkEntryForPath(to, data));
    seen.add(to);
  }
  return out;
}

// ---------- build ----------

/**
 * Splice blocks into the base schema. Later entries win; every patch is applied to the
 * game's current text, so nothing Valve ships is rolled back except the patched blocks.
 * @param {string} baseText
 * @param {Array<{id: string, block: string, source?: string}>} patches
 * @returns {{ text: string, applied: Array, missing: Array, conflicts: Array }}
 */
function mergeSchema(baseText, patches) {
  const applied = [];
  const missing = [];
  const conflicts = [];
  const seen = new Map();
  const edits = [];

  // Same block from two sources is not a conflict: Skinchanger bakes the whole cart into
  // every export, so its packs routinely carry a byte-identical copy of each other's blocks.
  const flat = (s) => s.replace(/\s+/g, ' ').trim();
  for (const p of patches) {
    const prev = seen.get(String(p.id));
    if (prev && flat(prev.block) !== flat(p.block)) {
      conflicts.push({ id: String(p.id), a: prev.source || '', b: p.source || '' });
    }
    seen.set(String(p.id), p);
  }
  const section = itemsSection(baseText);
  for (const p of seen.values()) {
    const item = findItem(baseText, p.id, section);
    if (!item) { missing.push(String(p.id)); continue; }
    edits.push({ start: item.start, end: item.end, text: reindent(p.block, '\t\t') });
    applied.push({ id: String(p.id), source: p.source || '' });
  }

  edits.sort((a, b) => b.start - a.start); // splice from the tail so offsets stay valid
  let text = baseText;
  for (const e of edits) text = text.slice(0, e.start) + e.text + text.slice(e.end);
  return { text, applied, missing, conflicts };
}

/**
 * Refuse to ship a schema that could crash the client on load. Cheap structural checks
 * only: a malformed file is what makes the game die with "ERROR PARSING SCRIPT".
 */
function validateSchema(text, baseText) {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { const e = text.indexOf('"', i + 1); if (e === -1) throw new Error(t('items_game: незакрытая кавычка')); i = e; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth < 0) throw new Error(t('items_game: лишняя закрывающая скобка')); }
  }
  if (depth !== 0) throw new Error(t('items_game: незакрытый блок'));
  const items = listItems(text).length;
  if (items < 1000) throw new Error(t('items_game: подозрительно мало предметов ({0})', items));
  if (baseText) {
    const baseItems = listItems(baseText).length;
    if (items < baseItems) throw new Error(t('items_game: предметов меньше, чем в игре ({0} < {1})', items, baseItems));
  }
  return { items, bytes: text.length };
}

// crc32 comes from src/vpk.js, where the VPK writer needs it too, and is re-exported below
// for everything that was already taking it from here.

// Pack the merged schema as a one-file VPK holding nothing but items_game.txt.
function buildSchemaVpk(text, extraEntries = []) {
  const data = Buffer.from(text, 'latin1');
  return buildVpk([{ ext: 'txt', folder: 'scripts/items', name: 'items_game', crc: crc32(data), preload: Buffer.alloc(0), data }, ...extraEntries]);
}

/**
 * Build the schema and put it in the mod folder. Always rebuilt from the installed
 * game, so a Dota update is repaired by calling this again - never by shipping a copy.
 *
 * `base` is the game's own table, which the caller has usually just read: it is 50 MB out of
 * a VPK and reading it twice for one deploy was most of what removing a mod cost. Left out,
 * it is read here as before.
 * @param {object} opts
 * @param {string} opts.gamePath
 * @param {string} opts.folder            the mod folder the schema VPK is written into
 * @param {Array} opts.patches
 * @param {{ text: string, stamp: string }} [opts.base]  the game's own table, if already read
 * @returns {{ applied: Array, missing: string[], conflicts: Array, stamp: string, bytes: number }}
 */
function deploy({ gamePath, folder, patches, base = readGameSchema(gamePath) }) {
  const merged = mergeSchema(base.text, patches);
  const checked = validateSchema(merged.text, base.text);
  const extras = [];
  const seen = new Set();
  for (const p of patches || []) {
    for (const en of p.assets || []) {
      const key = `${en.folder}/${en.name}.${en.ext}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      extras.push(en);
    }
  }
  const buf = buildSchemaVpk(merged.text, extras);
  const dir = path.join(gamePath, folder);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, SCHEMA_VPK);
  const tmp = dest + '.mmtmp';
  fs.writeFileSync(tmp, buf);
  try {
    fs.rmSync(dest, { force: true });
    fs.renameSync(tmp, dest);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }
  return { ...merged, stamp: base.stamp, bytes: checked.bytes, items: checked.items };
}

// Any real file left in a directory tree (the engine drops empty rpt/ and save/ folders
// into every mounted content path, and those must not keep the folder alive).
function hasFiles(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (hasFiles(path.join(dir, e.name))) return true; }
    else return true;
  }
  return false;
}

// Drop the built schema, and the folder with it once nothing of ours is left there.
function undeploy({ gamePath, folder }) {
  const dir = path.join(gamePath, folder);
  const dest = path.join(dir, SCHEMA_VPK);
  if (fs.existsSync(dest)) fs.rmSync(dest, { force: true });
  if (fs.existsSync(dir) && !hasFiles(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function isDeployed(gamePath, folder) {
  return fs.existsSync(path.join(gamePath, folder, SCHEMA_VPK));
}

module.exports = {
  SCHEMA_REL,
  SCHEMA_VPK,
  deploy,
  undeploy,
  isDeployed,
  readGameSchema,
  gameSchemaStamp,
  listItems,
  baseItemFor,
  cosmeticOptions,
  itemEffects,
  itemOptions,
  itemSlots,
  findItem,
  defaultItemForWearable,
  itemFields,
  extractDeltas,
  deltaTable,
  ownedAssetNeedles,
  blockUsesAssets,
  baseItemPatch,
  itemEffectPatch,
  gameAssetEntries,
  mergeSchema,
  validateSchema,
  buildSchemaVpk,
  reindent,
  crc32,
};
