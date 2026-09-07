<div align="center">
  <img src="build/icon.png" alt="Dota 2 Mod Manager" width="110">

  <h1>Dota 2 Mod Manager</h1>

  <p><b>Mods for Dota 2, without the file juggling.</b><br>
  1000+ skins, terrains, announcers and music in one catalog. Free cosmetics the game already
  ships. Setups you can hand to a friend as a link.</p>

  <p>
    <a href="https://github.com/TheFleece/dota2-mod-manager/releases/latest/download/Dota-2-Mod-Manager-Setup.exe">
      <img src="https://img.shields.io/github/v/release/TheFleece/dota2-mod-manager?style=flat-square&color=8b6ff0&label=Download&logo=github&logoColor=white" alt="Download the latest release"></a>
    <img src="https://img.shields.io/github/downloads/TheFleece/dota2-mod-manager/Dota-2-Mod-Manager-Setup.exe?style=flat-square&color=6d5bd0&label=Installs" alt="Installer downloads">
    <a href="https://github.com/TheFleece/dota2-mod-manager/actions/workflows/test.yml">
      <img src="https://img.shields.io/github/actions/workflow/status/TheFleece/dota2-mod-manager/test.yml?style=flat-square&label=Tests" alt="Test status"></a>
    <img src="https://img.shields.io/badge/Windows%20%7C%20Linux-201c2c?style=flat-square&logo=windows&logoColor=white" alt="Windows and Linux">
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-GPL--3.0-c4b5fd?style=flat-square" alt="License"></a>
    <a href="https://dota2modmanager.com"><img src="https://img.shields.io/badge/Site-dota2modmanager.com-2a2440?style=flat-square" alt="Website"></a>
  </p>

  <p>
    <a href="#what-it-does">Features</a> ·
    <a href="#install">Install</a> ·
    <a href="#how-it-works">How it works</a> ·
    <a href="#alongside-dota2-minify">Alongside Minify</a> ·
    <a href="#documentation">Docs</a> ·
    <a href="#report-a-problem">Report a problem</a> ·
    <a href="README.ru.md">Русский</a>
  </p>

  <img src="site/public/screenshots/dota-2-mod-manager-catalog-en.webp" alt="The catalog" width="100%">
</div>

> [!NOTE]
> Not affiliated with Valve. Every mod here is client-side: nobody else sees them, and no other
> player's game is touched. Safe mode is on by default and keeps the app out of Dota's own files
> entirely; the one feature that changes them asks first and reverts byte for byte.

> **Why not just copy the files yourself?** You can, and people do. What the app adds is
> everything after that: switching a mod off before a match without deleting it, free cosmetics
> read from the game's own item table, a setup you send as one link, and a game that still works
> after a Dota patch.

## What it does

| | |
|---|---|
| **The whole catalog** | 1000+ mods in 41 categories, read live from the [D2PFX](https://github.com/h6rd/Dota2PornFxWeb) repository, so a mod added today installs today |
| **One click in, one click out** | The app downloads it, picks a free pak slot and cleans up after itself. Categories that must load early get low slots by themselves |
| **Switch off, don't delete** | Turn a mod off before a match and back on after. Your library stays, the game folder stays clean |
| **Free cosmetics** | Weather, couriers, wards, loading screens, announcers, mega-kills, read from the game's own item table, so anything Valve adds appears by itself |
| **It says when mods collide** | Two mods carrying the same file cannot both win. The app names the file, says which mod the game loads it from, and lets you reorder |
| **Setups by link** | Save what you run as a preset and send it in one message. The other side opens it and gets the same look |
| **It survives Dota patches** | The app notices a game update when it lands and puts back what the patch wiped, without ever writing while Dota is running |

<details>
<summary><b>And the rest</b></summary>

| | |
|---|---|
| **An install list** | Put mods aside while you browse and install them all at once. The list has its own search, because people were installing eighty mods one at a time |
| **Filters and search** | Chips for what a mod changes, a dropdown for the item slot, a list of heroes, and one search across the whole catalog |
| **Fonts and cursors** | Installed into the game files with a backup of the originals; removing them restores vanilla |
| **Combined packs** | Merge several mods into one pak slot, and take them apart again |
| **Your own files** | Import a `.vpk`, or adopt what somebody else's tool left in the folder. The app fingerprints it against the catalog and tells you what it is |
| **Auto-updates** | The app checks GitHub Releases and installs new versions itself |
| **Windows and Linux** | Both ship with every release: an installer and a portable build for Windows, an AppImage for Linux. Steam is found wherever your distribution keeps it, flatpak included |
| **No account, no telemetry** | Nothing is collected and nothing is sent. Signing in with Discord is optional and only puts your name on a setup you share |

</details>

<div align="center">
  <img src="site/public/screenshots/dota-2-mod-manager-heroes-en.webp" alt="Mods grouped hero by hero" width="49%">
  <img src="site/public/screenshots/dota-2-mod-manager-my-mods-en.webp" alt="Installed mods, with the load order" width="49%">
</div>

## Install

1. Download **[Dota 2 Mod Manager Setup](https://github.com/TheFleece/dota2-mod-manager/releases/latest/download/Dota-2-Mod-Manager-Setup.exe)** — direct link, always the latest version
2. Run it. The app installs, creates a shortcut and starts
3. It finds Dota on its own. No launch options, no Steam properties to edit

**On Linux** the same app ships as an
[AppImage](https://github.com/TheFleece/dota2-mod-manager/releases/latest/download/Dota-2-Mod-Manager.AppImage):
`chmod +x` it and run it.

> [!IMPORTANT]
> Windows will call the publisher unknown, because the installer carries no paid signature.
> Click **More info**, then **Run anyway**. Every release is built from this source by a
> [public workflow](https://github.com/TheFleece/dota2-mod-manager/actions/workflows/release.yml)
> rather than uploaded from anybody's desktop, and the build log for the exact file you
> downloaded is open to read.

## How it works

Nothing is injected into Dota's process, and no file of the game is opened while it runs.

- Dota mounts **one** folder, named after its **voice** language. The app sets that language in
  the game's own settings and installs there — **no launch option involved**, which is the part
  worth reading twice. [Why that works](https://dota2modmanager.com/docs/language/)
- VPK mods go in as `pakNN_dir.vpk`, slots 10 to 99. Categories that must load first get
  `pak02` to `pak09`. [Slots and load order](https://dota2modmanager.com/docs/vpk/)
- Switching a mod off renames its file to `.off`. The game skips it, the file stays
- Fonts and cursors go into the game's own folders, with the originals backed up first
- Everything that writes to the game folder is one transaction: if a step fails, the whole
  change rolls back, displaced files included
- Safe mode, on by default, means the app never touches Dota's own files. Turning it off adds
  one line to `gameinfo_branchspecific.gi` and a signature to `dota.signatures` — both backed up
  before the first edit, both restored byte for byte when it goes back on.
  [What that buys and costs](https://dota2modmanager.com/docs/safe/)

Downloads live in `%APPDATA%/dota2-mod-manager/downloads`, the install manifest beside them.
The full picture is in [ARCHITECTURE.md](ARCHITECTURE.md).

## Alongside Dota2 Minify

[Dota2 Minify](https://github.com/Egezenn/dota2-minify) is a different kind of tool by a
different author: it builds mods by patching the game where this installs finished ones from a
catalog. **Run both.** This app installs into whichever folder the game will really mount —
including the one Minify picked — never hands out the pak slots Minify writes, and leaves its
files alone. Minify since v1.14rc7 checks ownership before clearing the map folder, so a terrain
installed here survives its uninstall.

[What Minify is, and how the two share a game](https://dota2modmanager.com/docs/minify/).

## Documentation

| | |
|---|---|
| [Installing mods](https://dota2modmanager.com/docs/install/) | The whole route, by hand and with the app |
| [The language folder](https://dota2modmanager.com/docs/language/) | Why `-language` is not needed, and what it does when it is there |
| [VPK and load order](https://dota2modmanager.com/docs/vpk/) | Pak slots, which mod wins, and `gameinfo.gi` |
| [Safe mode](https://dota2modmanager.com/docs/safe/) | What the app writes into the game, and what it does not |
| [Free cosmetics](https://dota2modmanager.com/docs/cosmetics/) | The item table, and what it can and cannot give you |
| [After a Dota patch](https://dota2modmanager.com/docs/troubleshooting/) | What breaks, and what the app puts back |
| [Every fact, checkable](https://dota2modmanager.com/facts/) | Version, platforms, counts, and how to verify each one |
| [ARCHITECTURE.md](ARCHITECTURE.md) · [CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md) | For anyone reading the code |
| [CHANGELOG.md](CHANGELOG.md) · [CHANGELOG.ru.md](CHANGELOG.ru.md) | What changed in each release |

## Report a problem

| | |
|---|---|
| [Bug report](https://github.com/TheFleece/dota2-mod-manager/issues/new?template=bug_report.yml) | Something is broken. **Settings → Diagnostics → Export report** puts everything needed in one file |
| [Feature request](https://github.com/TheFleece/dota2-mod-manager/issues/new?template=feature_request.yml) | An idea for how the app should work |
| [Discord](https://discord.gg/PBvG8D9MxT) | Questions and quick help, in the catalog's community |
| [Security](SECURITY.md) | Vulnerabilities, privately — never a public issue |

Two things first: make sure you are on the latest version, and if Dota updated recently, open
the app and let it put the patch back.

## Development

```bash
npm install
npm start                 # run the app
npm test                  # unit tests
npm run test:coverage     # the same with the floor CI enforces
npm run sandbox:seed      # a throwaway game tree with real mods
npm run start:sandbox     # the app against it, never your own game
```

Node 24, Electron 43, no bundler — the renderer is plain HTML, CSS and JavaScript. Every release
is produced by [`release.yml`](.github/workflows/release.yml) from the commit its tag names.
[CONTRIBUTING.md](CONTRIBUTING.md) has the rest.

## Credits

- **All mods, previews, guides and catalog data** come from the open-source
  [**D2PFX**](https://github.com/h6rd/Dota2PornFxWeb) repository by [h6rd](https://github.com/h6rd)
  and the Dota 2 modding community. This app is a desktop client for their catalog, and every mod
  card in it credits its author.
- Community tools (VPKMerge, Background Changer, Compiler, ItemsFix) belong to their authors.
- **[hanta](https://www.youtube.com/@hqnta)** filmed a
  [walkthrough](https://www.youtube.com/watch?v=Z_yalpuP6pA) in Russian, which answers more
  questions than this page does for anyone who would rather watch than read.

## License

[GPL-3.0](LICENSE). Copyright (C) 2026 Mykhailo Lynnyk.

Fork it, change it, ship your own. GPL-3.0 asks you to keep the copyright line, to say that you
changed the code and when, and to open your version under the same license. Section 7 lets an
author add two more, and this repository does: keep the credit the app shows, and pick your own
name for your version. [NOTICE](NOTICE) puts all of it in plain words.

Catalog content belongs to [h6rd](https://github.com/h6rd/Dota2PornFxWeb) and the mod authors,
under the license in their repository.

*Not affiliated with Valve Corporation. You modify game files at your own risk.*
