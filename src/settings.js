// Simple JSON settings store in userData
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  dotaGamePath: null,
  // folder mods are installed into: game/dota_<langSuffix>. Since Dota's 2026-07-24 update
  // this must be the game's own audio language (see src/gamelang.js) — made-up folders like
  // dota_123 are no longer mounted. Kept in sync automatically unless the user pins it.
  langSuffix: 'russian',
  // follow the audio language read from the game instead of the value above
  langSuffixAuto: true,
  // app UI language: "en" | "ru". English is the default until the user picks otherwise.
  uiLang: 'en',
  // one-time language picker: false for fresh installs AND for users updating from a
  // version without this key, so everybody sees the picker once after this release.
  langPromptSeen: false,
  // zoom factor of the whole window (text and images alike), 0.7 - 1.6
  uiScale: 1,
  // catalog mods the user starred: "<categoryId>|<mod name>" keys
  favorites: [],
  // sizes and folded state of the title bar, status bar and category rail
  panels: null,
  // Discord identity, when signed in: { id, username, avatar }. No token is ever kept —
  // it is used once to read the name and dropped (see src/discord-auth.js).
  account: null,
  // show "Playing Dota 2 Mod Manager" in Discord while the app is open
  discordPresence: true,
  // Item-schema support. The engine reads scripts/items/items_game.txt through the MOD
  // path only (game/dota), so mods that change it - skinchanger-style sets with their own
  // ambient effects, free weather/terrain - do nothing from a language folder. Turning
  // this on registers game/dota_mods ahead of the game's content, which means editing
  // gameinfo_branchspecific.gi and re-signing it in dota.signatures. Off until the user
  // agrees to that once; originals are backed up and the switch reverts them.
  schemaPatch: false,
  // free cosmetics taken from the game's own schema: { weather: "10706", terrain: "590" }
  cosmetics: {},
  // items_game.txt build the deployed schema was made from, to spot a game update
  schemaStamp: null,
};

class Settings {
  constructor(userDataDir) {
    this.file = path.join(userDataDir, 'settings.json');
    this.data = { ...DEFAULTS };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.file)) {
        this.data = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(this.file, 'utf-8')) };
      }
    } catch {
      this.data = { ...DEFAULTS };
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    this.save();
  }

  all() {
    return { ...this.data };
  }
}

module.exports = { Settings };
