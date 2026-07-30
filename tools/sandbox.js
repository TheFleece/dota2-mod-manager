#!/usr/bin/env node
/*
 * Sandbox: a throwaway copy of the parts of Dota the app writes to, plus a handful of real
 * catalog mods, so installs / toggles / load order / the schema patch can be exercised end
 * to end without ever touching the real game.
 *
 *   node tools/sandbox.js seed     build the tree, download real mods, seed userData
 *   node tools/sandbox.js reset    restore the tree to pristine, wipe userData, keep mods
 *   node tools/sandbox.js status   what is on disk right now
 *
 * The layout mirrors a real Steam library, because the app derives things from it: the game
 * path ends in ...\dota 2 beta\game (src/steam.js) and src/gamelang.js walks three levels up
 * looking for appmanifest_570.acf.
 *
 * Nothing here changes app code. The app is pointed at the sandbox purely through
 * --user-data-dir plus a seeded settings.json, so a sandbox run and a real run are the same
 * binary with different data. Run it with:  npm run start:sandbox
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { crc32 } = require('zlib');

const { readVpkEntryFile, buildVpk } = require('../src/vpk.js');
const { Catalog, RAW_BASE } = require('../src/catalog.js');
const { findDotaGamePath } = require('../src/steam.js');

const ROOT = path.resolve(__dirname, '..');
const SANDBOX = path.join(ROOT, 'sandbox');
const LIB = path.join(SANDBOX, 'steamapps');
const GAME = path.join(LIB, 'common', 'dota 2 beta', 'game');
const PRISTINE = path.join(SANDBOX, 'pristine');
const MODS = path.join(SANDBOX, 'mods');
const USERDATA = path.join(SANDBOX, 'userdata');
const MANIFEST = path.join(__dirname, 'sandbox-mods.json');

const SCHEMA_REL = 'scripts/items/items_game.txt';
// How many mods to pull per category. Small on purpose: the point is one real file of each
// shape (single vpk, multi-part, zip, font, cursor), not a mirror of the catalog.
const PER_CATEGORY = 2;
const MAX_MODS = 14;

const log = (...a) => console.log(...a);
const mkdir = (p) => fs.mkdirSync(p, { recursive: true });

// ---------- files the fake game needs ----------

// Valve's own SearchPaths block. src/patcher.js reads this out of gameinfo.gi to build the
// patched branch file, and the Game_Language line is what makes dota_<audio lang> mount at
// all (measured 2026-07-30) - so it has to be verbatim, not paraphrased.
const GAMEINFO = `"GameInfo"
{
	game 		"Dota 2"
	title 		"Dota 2"

	FileSystem
	{
		SteamAppId				570

		SearchPaths
		{
			// These are optional language paths. They must be mounted first, which is why there are first in the list.
			// *LANGUAGE* will be replaced with the actual language name. If not running a specific language, these paths will not be mounted
			Game_Language		dota_*LANGUAGE*

			// These are optional low-violence paths. They will only get mounted if you're in a low-violence mode.
			Game_LowViolence	dota_lv

			Game				dota
			Game				core

			Mod					dota

			Write				dota

			AddonRoot_Language	dota_*LANGUAGE*_addons

			AddonRoot			dota_addons

			// Note: addon content is included in publiccontent by default.
			PublicContent		dota_core
			PublicContent		core
		}
	}
}
`;

// Vanilla branch file: no SearchPaths of its own, which is exactly the state the patcher
// expects to find before it writes one.
const BRANCHSPECIFIC = `"GameInfo"
{
	game 		"Dota 2"
	title 		"Dota 2"

	FileSystem
	{
		SteamAppId				570
		BreakpadAppId			373300
		BreakpadAppId_Tools		375360
	}
}
`;

// Valve's shape for a language folder (mirrors gameinfoStub in src/gamelang.js).
const LANG_GAMEINFO = (suffix) => `"GameInfo"
{
	LayeredOnMod	dota

	FileSystem
	{
		SearchPaths
		{
			Game				dota_${suffix}
			Game				dota
			Game				core

			Mod					dota_${suffix}
			Mod					dota

			AddonRoot			dota_addons

			// Note: addon content is included in publiccontent by default.
			PublicContent		core
		}
	}
}
`;

const BOOT_VCFG = `"boot"
{
	"UILanguage"		"english"
	"AudioLanguage"		"russian"
}
`;

// Real steam.inf shape. PatchWatcher (phase 4) watches this file and reads ClientVersion out
// of it, so the sandbox needs something parseable to bump when simulating a game update.
const STEAM_INF = `ClientVersion=8888
ServerVersion=8888
PatchVersion=7.39c
ProductName=dota
appID=570
`;

const APPMANIFEST = `"AppState"
{
	"appid"		"570"
	"name"		"Dota 2"
	"MountedConfig"
	{
		"language"		"russian"
	}
}
`;

// dota.signatures is a list of "<path>~SHA1:...;CRC:..." lines closed by DIGEST. The patcher
// appends its own line after DIGEST and reverts by dropping it, so the sandbox only needs a
// well-formed file with Valve's own entry for the branch file present.
function signaturesFor(branchText) {
  const sha1 = crypto.createHash('sha1').update(branchText).digest('hex').toUpperCase();
  const le = Buffer.alloc(4);
  le.writeUInt32LE(crc32(Buffer.from(branchText)) >>> 0);
  return [
    `...\\..\\..\\dota\\gameinfo.gi~SHA1:${'0'.repeat(40)};CRC:00000000`,
    `...\\..\\..\\dota\\gameinfo_branchspecific.gi~SHA1:${sha1};CRC:${le.toString('hex').toUpperCase()}`,
    'DIGEST:0000000000000000000000000000000000000000',
    '',
  ].join('\n');
}

/** One inline-data VPK entry in the shape buildVpk() wants. */
function entry(relPath, data) {
  const norm = relPath.replace(/\\/g, '/').toLowerCase();
  const slash = norm.lastIndexOf('/');
  const file = slash === -1 ? norm : norm.slice(slash + 1);
  const folder = slash === -1 ? ' ' : norm.slice(0, slash);
  const dot = file.lastIndexOf('.');
  return {
    ext: dot === -1 ? ' ' : file.slice(dot + 1),
    folder,
    name: dot === -1 ? file : file.slice(0, dot),
    data,
    preload: Buffer.alloc(0),
    crc: crc32(data) >>> 0,
  };
}

// Minimal but structurally real items_game.txt, used only when the real game is not
// installed. Enough for src/schema.js to parse, find an items block and patch a base item.
const FALLBACK_SCHEMA = `"items_game"
{
	"items"
	{
		"1"
		{
			"name"		"Default Item"
			"prefab"		"default_item"
			"item_name"		"#DOTA_Item_Default"
			"used_by_heroes"
			{
				"npc_dota_hero_axe"		"1"
			}
		}
	}
}
`;

// ---------- seed ----------

function buildGameTree() {
  log('game tree ->', GAME);
  for (const p of [
    path.join(GAME, 'dota', 'cfg'),
    path.join(GAME, 'dota', 'panorama', 'fonts'),
    path.join(GAME, 'dota', 'resource', 'cursor'),
    path.join(GAME, 'dota_russian'),
    path.join(GAME, 'core'),
    path.join(GAME, 'bin', 'win64'),
    LIB,
  ]) mkdir(p);

  const real = findDotaGamePathSync();
  const copied = [];

  // Prefer the real files where we can read them: the patcher hashes gameinfo byte for byte,
  // so a paraphrase would make the sandbox test a different file than production.
  const take = (rel, fallback) => {
    const dst = path.join(GAME, ...rel);
    if (real) {
      const src = path.join(real, ...rel);
      try {
        fs.copyFileSync(src, dst);
        copied.push(rel.join('/'));
        return;
      } catch { /* fall through to the stub */ }
    }
    fs.writeFileSync(dst, fallback);
  };

  take(['dota', 'gameinfo.gi'], GAMEINFO);
  take(['dota', 'gameinfo_branchspecific.gi'], BRANCHSPECIFIC);

  const branchText = fs.readFileSync(path.join(GAME, 'dota', 'gameinfo_branchspecific.gi'), 'utf-8');
  fs.writeFileSync(path.join(GAME, 'bin', 'win64', 'dota.signatures'), signaturesFor(branchText));
  fs.writeFileSync(path.join(GAME, 'dota', 'cfg', 'boot.vcfg'), BOOT_VCFG);
  fs.writeFileSync(path.join(GAME, 'dota', 'steam.inf'), STEAM_INF);
  fs.writeFileSync(path.join(LIB, 'appmanifest_570.acf'), APPMANIFEST);

  // game/dota/pak01_dir.vpk carrying the schema. Built with our own buildVpk, so the sandbox
  // also exercises the writer: if buildVpk regresses, seeding fails loudly instead of later.
  let schema = FALLBACK_SCHEMA;
  let origin = 'fallback stub';
  if (real) {
    try {
      const hit = readVpkEntryFile(path.join(real, 'dota', 'pak01_dir.vpk'), SCHEMA_REL);
      if (hit && hit.data.length) {
        schema = hit.data.toString('latin1');
        origin = `real game (${(hit.data.length / 1024 / 1024).toFixed(1)} MB)`;
      }
    } catch (e) {
      log('  could not read the real schema, using the stub:', e.message);
    }
  }
  fs.writeFileSync(
    path.join(GAME, 'dota', 'pak01_dir.vpk'),
    buildVpk([entry(SCHEMA_REL, Buffer.from(schema, 'latin1'))])
  );
  log(`  items_game.txt from ${origin}`);

  // dota_russian: Valve's gameinfo plus stand-ins for the voice paks. langFolders() decides
  // "this folder holds Valve content" by the presence of pak01_*, and the 2.0 feature
  // "Russian folder, English voices" disables exactly pak01_dir.vpk - so both must exist.
  fs.writeFileSync(path.join(GAME, 'dota_russian', 'gameinfo.gi'), LANG_GAMEINFO('russian'));
  fs.writeFileSync(
    path.join(GAME, 'dota_russian', 'pak01_dir.vpk'),
    buildVpk([entry('sounds/vo/announcer_placeholder.vsnd_c', Buffer.from('sandbox voice-over stand-in'))])
  );
  fs.writeFileSync(path.join(GAME, 'dota_russian', 'pak01_000.vpk'), Buffer.alloc(1024, 0x5a));

  if (copied.length) log('  copied from the real install:', copied.join(', '));
  else log('  real game not found, wrote faithful stubs');
}

function findDotaGamePathSync() {
  // findDotaGamePath is async; the registry lookup it does is optional here, so try the
  // well-known location first and fall back to null rather than making seed() await it.
  for (const drive of 'CDEFGH') {
    for (const lib of [
      `${drive}:\\Program Files (x86)\\Steam`,
      `${drive}:\\Program Files\\Steam`,
      `${drive}:\\Steam`,
      `${drive}:\\SteamLibrary`,
    ]) {
      const game = path.join(lib, 'steamapps', 'common', 'dota 2 beta', 'game');
      if (fs.existsSync(path.join(game, 'dota', 'pak01_dir.vpk'))) return game;
    }
  }
  return null;
}

function snapshotPristine() {
  fs.rmSync(PRISTINE, { recursive: true, force: true });
  mkdir(PRISTINE);
  fs.cpSync(path.join(SANDBOX, 'steamapps'), path.join(PRISTINE, 'steamapps'), { recursive: true });
  log('pristine snapshot ->', PRISTINE);
}

async function downloadMods() {
  mkdir(MODS);
  const catalog = new Catalog(USERDATA);
  log('fetching the catalog from', RAW_BASE);
  const data = await catalog.load({ forceRefresh: true });
  const byCategory = data.mods?.modsData || {};

  const wanted = [];
  for (const [categoryId, list] of Object.entries(byCategory)) {
    if (categoryId === 'tools' || !Array.isArray(list)) continue; // tools are exes, not mods
    let taken = 0;
    for (const mod of list) {
      if (taken >= PER_CATEGORY || wanted.length >= MAX_MODS) break;
      const ref = mod?.file;
      if (typeof ref !== 'string' || !/\.(vpk|zip)$/i.test(ref)) continue;
      wanted.push({ categoryId, name: mod.name, file: ref });
      taken++;
    }
    if (wanted.length >= MAX_MODS) break;
  }

  const prev = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf-8')) : { mods: [] };
  const known = new Map(prev.mods.map((m) => [`${m.categoryId}/${m.file}`, m]));
  const out = [];

  for (const item of wanted) {
    const url = /^https?:\/\//i.test(item.file)
      ? item.file
      : `${RAW_BASE}/assets/files/${item.categoryId}/${encodeURIComponent(item.file)}`;
    // The catalog numbers files per category, so plain basenames collide across categories
    // (five different mods are all called pak10_dir.vpk). Keep the category in the name or
    // the later downloads silently reuse the first mod's file.
    const dest = path.join(MODS, `${item.categoryId}__${path.basename(item.file)}`);

    const label = `${item.categoryId}/${item.file}`;
    if (fs.existsSync(dest)) {
      const sha = sha256(dest);
      const expected = known.get(label)?.sha256;
      if (expected && expected !== sha) log(`  ! ${label}: sha256 changed upstream`);
      else log(`  = ${label} (cached)`);
      out.push({ ...item, url, sha256: sha, bytes: fs.statSync(dest).size });
      continue;
    }

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      const bytes = fs.statSync(dest).size;
      log(`  + ${label} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
      out.push({ ...item, url, sha256: sha256(dest), bytes });
    } catch (e) {
      log(`  x ${label}: ${e.message}`);
    }
  }

  // Committed alongside the script: the heavy files stay out of git, the list of what a
  // sandbox should contain (and each file's hash) travels with the repo.
  fs.writeFileSync(MANIFEST, `${JSON.stringify({ source: RAW_BASE, mods: out }, null, 2)}\n`);
  log(`manifest -> ${path.relative(ROOT, MANIFEST)} (${out.length} mods)`);
}

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function seedUserData() {
  mkdir(USERDATA);
  // Pre-answered first run: game path found, mod folder pinned to the sandbox's own language
  // folder, language picker and "what's new" already seen. Without this every sandbox launch
  // would open on the first-run dialogs instead of the screen under test.
  const settings = {
    dotaGamePath: GAME,
    langSuffix: 'russian',
    langSuffixAuto: true,
    uiLang: 'ru',
    langPromptSeen: true,
    lastSeenVersion: require('../package.json').version,
    discordPresence: false,
    schemaPatch: false,
  };
  fs.writeFileSync(path.join(USERDATA, 'settings.json'), `${JSON.stringify(settings, null, 2)}\n`);
  log('userData ->', USERDATA);
}

// ---------- commands ----------

async function seed() {
  mkdir(SANDBOX);
  buildGameTree();
  snapshotPristine();
  seedUserData();
  await downloadMods();
  log('\nseeded. run the app against it:  npm run start:sandbox');
}

function reset() {
  if (!fs.existsSync(PRISTINE)) {
    log('no pristine snapshot yet, run: npm run sandbox:seed');
    process.exitCode = 1;
    return;
  }
  fs.rmSync(path.join(SANDBOX, 'steamapps'), { recursive: true, force: true });
  fs.cpSync(path.join(PRISTINE, 'steamapps'), path.join(SANDBOX, 'steamapps'), { recursive: true });
  // Keep the downloaded mods (slow to refetch), drop everything the app wrote.
  fs.rmSync(USERDATA, { recursive: true, force: true });
  seedUserData();
  log('reset: game tree restored, userData wiped, downloaded mods kept');
}

function status() {
  const count = (dir, re) => {
    try { return fs.readdirSync(dir).filter((f) => re.test(f)).length; } catch { return 0; }
  };
  log('sandbox   ', fs.existsSync(SANDBOX) ? SANDBOX : '(not seeded)');
  if (!fs.existsSync(SANDBOX)) return;
  log('game      ', fs.existsSync(path.join(GAME, 'dota')) ? GAME : '(missing)');
  log('pristine  ', fs.existsSync(PRISTINE) ? 'yes' : 'no');
  // pak01_* is Valve's voice-over, not a mod - same exclusion langFolders() in src/gamelang.js makes
  const isMod = (f) => /^pak\d+_dir\.vpk(\.off|\.moff)?$/i.test(f) && !/^pak01_/i.test(f);
  log('mods in dota_russian:', count(path.join(GAME, 'dota_russian'), { test: isMod }));
  log('downloaded mods:     ', count(MODS, /\.(vpk|zip)$/i));
  log('userData settings:   ', fs.existsSync(path.join(USERDATA, 'settings.json')) ? 'seeded' : 'missing');
}

const cmd = process.argv[2] || 'status';
const commands = { seed, reset, status };
if (!commands[cmd]) {
  log('usage: node tools/sandbox.js <seed|reset|status>');
  process.exitCode = 1;
} else {
  Promise.resolve(commands[cmd]()).catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
