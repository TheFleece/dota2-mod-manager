# Architecture

How the app is put together, and why it is put together that way. Written for somebody who wants
to change it. The individual files carry the fine detail in their header comments; this is the map
between them.

## The shape

Electron, three processes, one bridge.

```
main.js          Electron lifecycle, the window, every ipcMain handler, auto-update, deep links
  └─ src/*.js    everything that touches disk, network or the game folder
preload.js       the only channel between the two sides: window.api, built with contextBridge
renderer/        the interface: plain HTML, CSS and JavaScript, no build step, no framework
```

The renderer can do nothing on its own. It has no Node integration, no file access and no network
beyond what `window.api` exposes, and the window refuses to navigate away from its own page. That
is not ceremony: the app renders guide text and mod names that come from a repository we do not
control, so the renderer is treated as a place where hostile strings end up.

## Where a feature lives

Anything a user can do to a mod touches three files, in this order:

1. `main.js` gets an `ipcMain.handle('mods:something', ...)` that calls into `src/`
2. `preload.js` exposes it as `api.mods.something`
3. `renderer/views/*.js` calls it and draws the result

Miss the middle one and the button exists but does nothing. The renderer is split by view
(`catalog.js`, `library.js`, `presets.js`, `settings.js`) with shared pieces under `renderer/ui/`.

## Where mods end up

Dota mounts one folder named after the language of its **voices**, and that folder is mounted
before the game's own content, which is what makes mods possible at all. The name comes from
`AudioLanguage` in `game/dota/cfg/boot.vcfg`, so `src/gamelang.js` reads that file rather than
guessing. A launch option cannot change it: `-language` sets a preference inside the game, and the
invented values older guides recommend (`dota_123`, `-language mods`) stopped mounting anything in
July 2026.

Inside that folder:

| What | Where it goes |
|---|---|
| A normal mod | `pakNN_dir.vpk`, slots 10 to 99 |
| A mod whose category must load early (trees, river, shaders, hero fx, ranged attack, hero items, optimization) | slots `pak02` to `pak09`, because a lower number wins |
| A terrain | its paks, plus the `maps/` folder it ships |
| A font | `game/dota/panorama/fonts`, originals backed up |
| A cursor | `game/dota/resource/cursor`, originals backed up |

Switching a mod off renames its file to `.off`, so the game skips it and the bytes stay. The
master switch uses a separate `.moff` suffix, on purpose: one state must never clobber the other,
or turning mods back on would resurrect the ones you had deliberately switched off.

## Installing one mod

`src/installer.js`, roughly in order:

1. Resolve the catalog entry to a URL and a file name. The name comes from a repository we do not
   own, so it is treated as a name and can never become a path.
2. Download through `src/net.js`, which tries mirrors when `raw.githubusercontent.com` is
   unreachable, and keeps the archive in the download cache keyed by that name. A second install of
   the same mod never leaves the disk.
3. Open the archive through `src/safe-zip.js`, the single door every foreign zip comes through.
4. Compare its contents against what is already installed and report conflicts (see below).
5. Pick a free slot: low ones for categories that must load early, otherwise the first free number
   from 10 up. Combined packs exist for the same reason and are described in `src/vpk.js`.
6. Write everything through `src/file-tx.js`.
7. Record it in `manifest.json` through `src/library.js`.

## All of it or none of it

`src/file-tx.js` is the reason the app can be trusted with a game folder. One install is five or
six writes, a removal is as many deletes, and switching a mod off renames every file it owns.
A failure halfway through, a locked file because Dota just started, a full disk, an antivirus
holding a handle, used to leave the folder in a state the game would happily load half of.

Every change to the game folder now goes through one transaction that either lands completely or
rolls back completely, including files that were displaced to make room. Nothing writes there
while `dota2.exe` is running, and the app checks that the game files are actually present before
it downloads anything, after a user moved his Steam library and had the app cheerfully install
forty three mods into the empty folder Steam left behind.

## VPK

`src/vpk.js` is a full reader and writer for Valve's v1 and v2 pack format, written here rather
than pulled in, and it is the piece most worth reading first. It parses the directory tree, reads
entries with their CRCs, writes single and multi-volume archives, merges a multi-volume mod into
one file, splits an archive that carries two heroes into one file per hero, and combines several
mods into a single pak so a hundred mods can share the slots.

Everything it writes is verified round trip in the tests, byte for byte, against real catalog
archives rather than synthetic ones.

## Knowing what a file is

Two mechanisms, for two different questions.

**What is in this archive?** `analyzeVpkPaths` reads the canonical paths inside a VPK and works
out which hero it changes and which equipment slots it replaces, so an imported file shows up as
"Nyx Assassin (model, arms, head, weapon)" instead of "unknown file".

**Is this the mod I think it is?** `fingerprintVpk` hashes the sorted list of `path:crc` pairs
from the index, which is independent of how the archive was packed, so the same mod downloaded
from the site and installed by hand produces the same fingerprint as ours. A published
`fingerprints.json`, regenerated by a scheduled workflow, maps fingerprints to catalog identities.
That is what lets the app adopt a file a friend installed by hand instead of demanding it be
deleted and downloaded again.

## Conflicts

Two mods that carry the same file cannot both win, and the game silently picks by slot number. The
app compares **contents, not paths**: a shared path only counts as a conflict when the CRCs
differ. Without that, every pair of mods looked like a conflict, because Valve's compiler bakes
the same stock materials into every VPK and authors carry the same filler particles between their
own mods. Paths were the first attempt, a blocklist of stock paths was the second, CRC comparison
is the one that works.

## The item schema and safe mode

Some things cannot be done from a language folder at all. The engine reads
`scripts/items/items_game.txt` through the MOD path only, so skinchanger-style sets with their own
effects and the free cosmetics the game already ships do nothing from where mods normally live.

Supporting them means registering another folder ahead of the game's content, which means editing
`gameinfo_branchspecific.gi` and re-signing it in `dota.signatures`. That is a change to Valve's
own files, so it is off until the user agrees to it once, which is what the safe mode switch in
the status bar means. `src/patcher.js` performs it and reverses it byte for byte, and
`src/schema-service.js` decides when the schema is rebuilt: always from the installed game's own
item table, never from a copy a mod happened to ship.

## Presets

A preset is the set of enabled mods, and it travels two ways.

**As a link.** `src/preset-link.js` encodes catalog identities, not file names, into
`d2mm://preset/<code>`: deflate, base64url, a code short enough for a chat message. Catalog file
names change when their author renames them; the identity triple does not. The clickable form is
an https page that hands the code to the app, because chat clients only linkify http and https.

**As a file.** `src/preset-share.js` writes `.d2mm`, a zip holding the manifest and, for anything
with no catalog identity, the mod itself. It is parsed as if it came from a stranger over Discord,
because it did: paths are matched against a strict pattern, a record that does not parse is
dropped whole rather than half trusted, and a buffer is validated as a VPK before it reaches the
game folder.

## The catalog is somebody else's

Mods, previews and guides come from [Dota2PornFxWeb](https://github.com/h6rd/Dota2PornFxWeb), and
when GitHub is unreachable they come through public proxies. That whole path is treated as
untrusted: `src/catalog-signature.js` makes the catalog's own author the only person who can
change what the app will fetch and show, guide HTML goes through an allowlist of tags, and a file
name from a catalog record is a name and not a path.

## Surviving a patch

A game update overwrites the search-path patch and moves the item table underneath the built
schema. `src/patch-watch.js` notices the update while the app is open, because Steam patches in
the background and most people press Play in Steam, and the repair runs by itself.

## Updates

The installed build updates through `electron-updater` from GitHub Releases. The portable build
deliberately does not: an unsigned executable that renames and relaunches itself is the shape
antivirus vendors flag, and this project has already had one false positive. It downloads the new
build next to the old one instead and says so (`src/portable-update.js`).

## Tests and the sandbox

`npm test` is plain `node:test`, no framework, 22 files, run on every push and every pull request.
`tools/sandbox.js` builds a throwaway Dota tree with the real game's `gameinfo.gi` and a
`pak01_dir.vpk` built from its own item table, then downloads real catalog mods into it. Install,
load order, packs, the schema patch and language folders are tested there rather than against
anybody's actual installation. See [CONTRIBUTING.md](CONTRIBUTING.md).

## On disk

```
%APPDATA%/Dota 2 Mod Manager/
  settings.json      the game path, the language folder, UI preferences
  manifest.json      installed mods, pack members, presets
  downloads/         the archive cache, keyed by catalog file name
  packs/             the source VPK of each member of a combined pack
  backups/           the originals of any Valve file the app replaced
  tools/             external tools, downloaded on demand
```

The portable build puts the same tree next to its executable, and falls back to `%APPDATA%` when
that location is not writable.

## File map

| File | What it owns |
|---|---|
| `main.js` | Electron lifecycle, window, every IPC handler, deep links, auto-update |
| `preload.js` | The `window.api` surface, and nothing else crosses |
| `src/installer.js` | Download, slots, install, enable, remove, packs, imports |
| `src/vpk.js` | The VPK format: read, write, merge, split, combine, fingerprint |
| `src/file-tx.js` | One transaction per change to the game folder |
| `src/library.js` | `manifest.json`: installed records and presets |
| `src/settings.js` | `settings.json` and its defaults |
| `src/catalog.js`, `src/catalog-signature.js` | Catalog data and who is allowed to change it |
| `src/net.js` | Downloads, mirrors, backoff |
| `src/safe-zip.js` | Every foreign archive comes through here |
| `src/steam.js` | Finding Steam and the game, and proving the folder is really a game |
| `src/gamelang.js` | Which folder Dota will mount |
| `src/patcher.js`, `src/schema.js`, `src/schema-service.js` | Search-path patch, signatures, item schema |
| `src/patch-watch.js` | Noticing a game update and repairing after it |
| `src/fingerprints.js` | Recognising a file somebody else installed |
| `src/preset-link.js`, `src/preset-share.js` | Presets as a link and as a file |
| `src/portable-update.js` | Updating the portable build without self-overwrite |
| `src/diagnostics.js` | The diagnostic archive a bug report should carry |
| `src/i18n.js`, `renderer/i18n.js` | Russian and English, for the main process and the window |
| `renderer/views/*` | Catalog, My mods, Presets, Settings |
| `renderer/ui/*` | Dialogs, toasts, the media player, the install queue, shared chrome |
| `tools/sandbox.js` | The throwaway game tree |
| `tools/gen-fingerprints.js` | Regenerating the published fingerprint map |
| `tools/seo-report.mjs` | The weekly search report posted to an issue |
