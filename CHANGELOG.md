# Changelog

What changed in each release. The app updates itself, so you get all of this without reinstalling.

## 1.15.0

### You decide which mod loads first

Dota mounts mod files in order, and the first copy of a shared file is the one you see. The
app used to work out who covered whom by comparing what every mod ships, then offer to swap
the two. It got that wrong far too often: two mods that happen to carry the same stock
texture are not fighting over anything, and a badge telling you a working mod is "covered"
helps nobody.

All of that is gone. The Library lists mods in the order the game loads them, and every row
has arrows. Move a mod up and its version of any shared file wins. No warning before an
install, no badge to decode, no button promising to sort it out for you.

### A file you put in the mods folder yourself is a mod

Such a file used to sit at the bottom of the Library as a row reading `pak90_dir.vpk`, with
an empty square where a picture goes and nothing you could do about it.

- The app reads the file and names it after what is inside, next to the portrait of the hero
  it turned out to be for.
- **Adopt** takes in any mod file now, not only the ones the catalog recognises. A file
  nobody has a name for joins your library as an import.
- A file byte-identical to a mod you already have is marked as a copy, so you can delete it
  instead of keeping two rows for one mod.
- Data volumes (`pak90_000.vpk`) belong to their index. They no longer show up as separate
  rows you cannot name or act on, and deleting the mod takes them with it.

### Sets, arcanas and item mods arrive with a name and a picture

The app knew where Dota keeps hero models and missed where it keeps cosmetic items:
`models/items/<hero>`, `materials/models/heroes` and the econ particle folders. A set or an
arcana therefore came out with no hero, no name, no category and no picture. All of those
read correctly now, down to which slots the set covers.

It also treated every spelling of a hero folder as a separate hero, so a single-hero skin
could claim to be a bundle of three and offer to split into parts that make no sense.
`crystalmaiden` and `crystal_maiden` are one hero again, and so are `nyx` and
`nerubian_assassin`.

### Presets

- A preset link used to vanish the moment your build held one mod of your own, with nothing
  said about why. It now carries the catalog mods and names what it had to leave behind, so
  you know to send the file for those.
- Mods arriving inside a shared preset get what a file you drag in gets: a name from their
  content, their item blocks lifted out, a split when one file holds several heroes.
- **Update** overwrites a preset with whatever is enabled right now, and the pencil renames
  it. Retyping the name exactly used to be the only way, and a typo quietly left you with a
  second preset.
- Drop a `.d2mm` anywhere in the window and it opens in Presets. Drop a `.vpk` anywhere and
  it imports. The tab you happen to be standing on no longer decides.

### Fixes

- Safe mode left Dota asking you to verify your files, with matchmaking refusing to start:
  the opposite of what safe mode is for. Switching it on puts back the one game file the app
  edits, and the app rebuilt that file one tab character shorter than the copy Dota ships.
  It still loaded, so nothing looked broken, but it no longer matched the signature Dota
  checks it against. The app now rebuilds the file exactly, verifies it against Dota's own
  signature list before writing it, and repairs a bad copy it saved earlier. When it cannot,
  it says so and points you at Steam's file check rather than leaving you to guess.
- Sharing a preset counted nine mods you had installed from the catalog as your own: it
  packed them into the file whole and left them out of the link. Five catalog sections list
  their mods in groups (creeps, towers, hero items, item effects, creep deny) and the app
  read only the ungrouped ones. A build that came out at 111 MB is half a megabyte now.
- Switching a mod off, or turning everything off with the master switch, cost imported mods
  their name, their content tag and their picture until you switched them back on. The app
  looked for a mod's file under its plain name, and a switched-off mod is renamed on disk.

## 1.14.3

### Fixes

- After Dota updated, safe mode left the game asking you to verify your files, and
  matchmaking would not start. Turning safe mode on rebuilds Dota's list of file
  signatures, and the app rebuilt it from a copy saved before the update: the list then
  described the older build instead of the files on your disk. Turning safe mode back on
  reapplied that same old copy, which is why only Steam's file check cleared it. The app
  now refreshes its copy whenever the game updates, and changes nothing in the list but
  its own line.

## 1.14.2

### Fixes

- A mod exported for someone else, or shared inside a preset, carried its models but not
  the item-schema blocks that give it effects and icons: the same blocks the app lifts on
  install and keeps on the record. It now carries a compact copy of them, read back the
  same way on the other side.
- Adopting a mod file another tool had already dropped into the mods folder skipped that
  same step: it became a library record, but its item blocks stayed unread and its effects
  never showed up.

## 1.14.1

### More cosmetics with a picture, fewer library rows with none

- Not every cosmetic's picture is filed under the name the game uses: some (couriers with
  their own wiki page, mostly) are illustrated with a plain screenshot under some other name
  entirely. The app now asks the wiki's exact page for its picture directly, instead of only
  ever guessing a file name.
- A "Loading Screen" or "Versus Screen" cosmetic with no picture of its own now falls back to
  its outfit's picture, for when the outfit has one and that exact screen doesn't.
- An imported mod recognised as skinning one hero shows that hero's own portrait instead of
  an empty box in the Library. An unmatched cursor set or an unsplit multi-hero import get a
  stand-in picture too, instead of nothing.

## 1.14.0

### A support report, one file instead of a round of screenshots

Settings has an **Export report** button now. It writes a single .zip: Dota's path and
language settings, the app's own settings, the installed mods, the patch state, a listing of
the mod folder's files, and the app's recent log. Send that instead of a screenshot and a
copy of your settings.json.

- The app now keeps a small log of its own on disk outside of testing too, so a crash you
  can't explain still leaves something to look at.
- Your Discord name is the only personal detail in the report, if you're signed in - no id,
  no picture, and the sign-in token was never saved to begin with.

### Fixes

- The three HUDs 1.13.0 said the wiki had no picture for now have one: Liquipedia keeps
  pictures for a few dozen looks Fandom never got, `Battle Pass 2022 HUD` among them, and
  the app asks it once Fandom has come up with nothing at all.

## 1.13.0

- **What's new, in the app.** The app updates itself in the background, so you used to be
  handed a new version with no idea what moved. Now it shows the changes once after an
  update, and Settings has a button to read them again.
- A shared preset link now opens a page that shows the whole build with pictures before
  anyone is asked to install anything.
- The catalog has a **Favorites** filter, the one the cosmetics already had. It shows what
  you starred without leaving the category.

### Fixes

- Cosmetics the wiki files under another spelling stayed blank tiles: the game writes
  `Aghanim's Labryinth 2021 HUD`, and it calls two HUDs a `Hud Skin` where the wiki does
  not. The app now asks the wiki which file it keeps such a look under. Three HUDs stay
  blank because the wiki has no picture for them at all.
- A mod whose preview is a video showed an empty box in the Library. You get its first
  frame, and a mod installed without a picture borrows the catalog's.
- Installing a pack dropped the picture of any mod that comes in several styles.

## 1.12.0

### Mods that share files now stack instead of fighting

Install a hero set and a separate item mod for the same hero, and both stay on. The one on
top supplies the files they share, so item mods from the catalog can be worn over a set.

- The Library says who is on top and who is covered, and a **Move up** button swaps the two.
- A fresh install goes on top of whatever it overlaps.
- The old warning claimed only one mod of the pair would load and told you to switch the
  other off. That was wrong.

### Fixes

- Mods shipped as several VPK volumes kept the packer's own file names for the data
  archives, which left half the mod under a name the game never mounts. Every volume now
  moves to the app's slot together with its index. This is what put files with a leading
  `!` in the mods folder.
- Deleting a cosmetic left the green "installed" badge on its catalog card until the next
  restart.
- Cosmetic pictures could go missing for a week: one refused request to the wiki was
  remembered as "no such picture". Only a real 404 counts now, and requests go out in small
  batches. Names the wiki spells its own way (`Mega-Kills: Axe`, apostrophes) are found too.

### Cosmetics work like the rest of the app

- Favorites and search show them, in a section of their own.
- Clicking one opens its page instead of installing it on the spot.
- The Library gives them a select-all, a count and a disable-all of their own, and the bulk
  bar takes them.

## 1.11.0

- Ctrl + wheel now looks at what the cursor is over: the title bar, the status bar and the
  category rail resize themselves, everything else scales the content.
- Every scale lives in Settings: one slider for all of it, plus a per-part block for the
  content and the three panels.
- The tab strip scrolls and swipes, so no tab is out of reach at a large scale.
- Packs export as a single .vpk file.
- Fixed: the panel grips did not drag at all, and scaling with the wheel shuddered.

## 1.10.0

- Set Dota's own text and voice language from the app.
- Mods follow the game's audio language folder after Dota's 2026-07-24 update, which stopped
  mounting made-up language folders.

## 1.9.1

- Fixed the Discord status icon and the master mods switch.

## 1.9.0

- Discord Rich Presence: your friends see the app while it is open.
- Privacy policy and terms pages.

## 1.8.1

- Sign-in moved to the title bar, and copying a preset link no longer opens a dialog.

## 1.8.0

- Share a preset as a `.d2mm` file or as a link, and sign in with Discord to put your name
  on the builds you share.
- Multi-volume imports fold into one VPK on the way in.
- Conflict detection stopped counting the filler assets every mod carries, so it only warns
  about real overlaps.
