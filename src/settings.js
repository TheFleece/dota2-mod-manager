// Simple JSON settings store in userData
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  dotaGamePath: null,
  // "russian" keeps the game in Russian while loading mods (dota_russian + -language russian);
  // "123" switches the game UI to English
  langSuffix: 'russian',
  // app UI language: "en" | "ru". English is the default until the user picks otherwise.
  uiLang: 'en',
  // one-time language picker: false for fresh installs AND for users updating from a
  // version without this key, so everybody sees the picker once after this release.
  langPromptSeen: false,
  // Discord identity, when signed in: { id, username, avatar }. No token is ever kept —
  // it is used once to read the name and dropped (see src/discord-auth.js).
  account: null,
  // show "Playing Dota 2 Mod Manager" in Discord while the app is open
  discordPresence: true,
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
