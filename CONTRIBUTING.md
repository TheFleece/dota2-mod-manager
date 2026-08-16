# Contributing

Thanks for looking. Bug reports, translations and pull requests are all welcome, and so is a
question in an issue when something in the code makes no sense.

One thing shapes every rule below: this app writes into somebody else's Dota 2 installation. A
mistake here does not throw a stack trace, it silently breaks a game the person paid nothing for
but plays every day. So the bar for a change is not "it works on my machine", it is "a stranger's
game still works after this".

[ARCHITECTURE.md](ARCHITECTURE.md) explains how the app is put together and is worth reading
before a first change.

## Running it

You need Node 24 or newer. The tests use `zlib.crc32`, which arrived in Node 22, and the CI runs
24.

```bash
git clone https://github.com/TheFleece/dota2-mod-manager.git
cd dota2-mod-manager
npm install
npm start          # the app, against your real settings
npm test           # the unit tests
npm run dist       # the Windows installer, if you need to check packaging
```

The renderer has no build step. HTML, CSS and JavaScript are loaded as written, so a UI change is
visible on reload with nothing to compile.

## Do not test against your own game

There is a throwaway Dota tree for exactly this:

```bash
npm run sandbox:seed     # build sandbox/ and download real catalog mods into it
npm run start:sandbox    # run the app against that tree, with its own settings
npm run sandbox:status   # what is on disk right now
npm run sandbox:reset    # back to a clean state
```

The seeder copies `gameinfo.gi` out of your real installation and builds a `pak01_dir.vpk` with
the game's own `items_game.txt`, so slot allocation, load order, the schema patch and language
folders behave the way they do in a real install. It downloads around fourteen real mods from the
catalog, because synthetic VPKs agree with our own parser and prove nothing.

Nothing in `sandbox/` is committed, and nothing in it touches
`steamapps/common/dota 2 beta`. Please keep it that way in your own changes: a test that needs a
real game folder is a test nobody else can run.

## Tests

```bash
npm test
```

Plain `node:test`, no test framework, no dependencies. They run on every push and on every pull
request, including pull requests from forks.

Four modules get special attention because they are the ones that write into the game folder:

| Module | What its tests hold down |
|---|---|
| `src/patcher.js` | The search-path patch and the signature file, byte for byte, both directions |
| `src/vpk.js` | The reader against the writer, round trips, fingerprints |
| `src/gamelang.js` | Which folder the game will actually mount |
| `src/schema.js` | Merging and validating `items_game.txt` |

If your change touches any of them, start by finding the test that covers the behaviour you are
about to change, and make new behaviour bring its own test. A red `npm test` is not a formality
here: every one of those tests exists because something in it broke somebody's game once.

## Every user-facing string exists twice

The interface ships in Russian and English. Russian text is the key and English is looked up from
it, so a new string is two edits, not one:

- `renderer/i18n.js` for anything in the window
- `src/i18n.js` for native dialogs, menus and tray text

A string with no English twin falls back to Russian, which means an English speaker sees Cyrillic
in the middle of their app. Please check both before opening the PR.

New languages are welcome. Say so in an issue first, so two people do not translate the same file
in the same week.

## What a good pull request looks like

- One change. A fix and a refactor in the same branch take three times as long to review.
- A description that says what to click to see it work. "Install two skins for the same hero and
  look at the library banner" saves a reviewer twenty minutes.
- Screenshots for anything visual, both languages if the text changed.
- No reformatting of code you did not otherwise touch. A diff where the change hides among two
  hundred moved brackets will be sent back.

## Dependencies

The app ships two of them, `adm-zip` and `electron-updater`. Everything else, including the VPK
parser and writer, the KeyValues reader and the update logic, is written here, because every
dependency is a stranger with write access to a game folder on 27,000 machines.

That is a bias, not a ban. A pull request that adds one needs to say what it replaces and why
writing it ourselves is worse. Tools under `tools/` and the tests use no dependencies at all.

## What will not be merged

- Telemetry, analytics, crash reporting, "anonymous usage statistics". The app phones no home and
  that is a feature.
- Anything that downloads and runs an executable from somewhere other than that program's own
  releases.
- Writes to the game folder that skip the transaction helper. If it cannot be rolled back, it does
  not go in.
- Mods. The catalog belongs to [h6rd](https://github.com/h6rd/Dota2PornFxWeb) and its authors; a
  new mod goes to them, not here.
- Whole-project reformatting, a linter config that rewrites every file, or a framework rewrite of
  the renderer.

## Style

Plain JavaScript, no framework, no transpiler. Comments explain why a thing is the way it is,
especially when it looks wrong: most of them exist because a game update, a VPK edge case or a
user's report made the obvious version fail. Match the surrounding code and the surrounding
comment density.

`.editorconfig` covers indentation and line endings. There is no linter on purpose.

## Reporting a bug

The app writes a diagnostic archive: Help, then Diagnostics. It holds the app log, the manifest,
the load order and what the app thinks about your installation, with no personal paths beyond the
game folder. Attaching it turns most reports into a five minute fix.

Security problems go to [SECURITY.md](SECURITY.md) instead of a public issue.

## Licence

GPL-3.0. Opening a pull request means your change ships under it as part of this program.

Two extra terms are allowed by section 7 of that licence and this repository uses both: keep the
credit the app shows, and give your own version its own name. [NOTICE](NOTICE) says it in plain
words. Neither one restricts what you may do with the code; they restrict passing it off as
something else.

## Where to ask

Open an issue, or find the `#mod-manager` channel in the catalog's
[Discord](https://discord.gg/PBvG8D9MxT).
