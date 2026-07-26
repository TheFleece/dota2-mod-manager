# Changelog

What changed in each release. The app updates itself, so you get all of this without reinstalling.

## 1.13.1

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
