# Changelog

What changed in each release. The app updates itself, so you get all of this without reinstalling.

## 2.2.0

Mostly work you will not see. Update anyway.

### The app trusts the catalog less than it used to

Mods, previews and guides come from a repository this app does not own, and when GitHub is
blocked they arrive through public proxies instead. That path used to be treated as friendly.
It is not, and this release stops treating it that way.

Guide text now passes through a fixed list of allowed tags, so a guide carries words and links
and nothing else. The window refuses to navigate away from its own page. A file name that
arrives with a catalog entry is used as a name and can no longer become a path. The one program
the app downloads and runs, the Source 2 reader, may now only come from that project's own
releases, and the file pinning its version is fetched from GitHub with no proxy in between.

The interface looks the same. Everything above is in the commit history if you want the detail.

### A current browser engine underneath

The app draws its window with the same engine a browser uses, and this one had been left ten
major versions behind, which means two years of published fixes it never received. It now runs
Electron 43, and the installer that ships it was rebuilt from scratch to check nothing broke on
the way.

### Mods follow the speech your game is set to

Dota mounts the folder named after your audio language, and the app used to answer that by
writing "russian" into your game for everyone. Korean speech now puts mods in `dota_koreana`,
Chinese in `dota_schinese`, Russian where it always went. Nothing is asked and nothing about
your game is changed.

English is the one language Valve mounts no folder for, so those mods go to `dota_russian` and
you hear no difference: Steam decides what gets downloaded, Dota decides what gets mounted, and
a folder with no voice pack in it serves mods while the speech keeps coming from the game's own
files. The English-voices switch is gone with it. Set English in Steam, which is where that
belongs.

### The program says who wrote it

A `NOTICE` file, a line in Settings under About, and two additional terms allowed by section 7
of the GPL: keep the credit, and give your version its own name. The licence is unchanged and
the app stays free software. Fork it, sell it, gut it. Say whose it was.

## 2.1.0

Everything here came from what people said after 2.0.

### Drag a mod to where it should load

The arrows moved a mod one slot per press, so getting a mod to load before
thirty others took thirty presses. Rows now have a grab handle. The list rearranges under the
pointer as you move it, the other rows slide out of the way, and it scrolls itself when you
near the top or bottom. Nothing is written to the game folder until you let go.

### Every mod shows its file

A row now prints its own file, named exactly as your mods folder names it, and carrying the
`.off` suffix when the mod is switched off. There was no other way to tell which of forty pak
files belonged to which mod.

### A preset looks like what it holds

A preset used to be its mod names joined by dots, which at eighty mods is a paragraph nobody
reads. It now leads with the covers of the mods in it and a line of counts by category, with
the full list one click away and grouped. A preset of eighty looks the same as a preset of ten.

### The window behaves like a window

Text no longer selects when you drag across a list, and pictures no longer pick up and follow
the mouse. Both used to happen while scrolling, and the second one ended with the app offering
to import the picture you had just dragged off its own card. Text fields still select, and so
does the file name on a mod row, which is the one string there worth copying.

The help menu no longer slides behind the mods when the page scrolls, and it closes when you
scroll away from it.

### The app says where it lives

The help menu now has the site next to the wiki and Discord, in the language the window is
speaking. Nothing in the program mentioned it before.

### A support report that says what is wrong

Same button, same file, same place to send it. Inside, the archive now opens with a one-screen
summary that starts with the verdict: if nothing is wrong it says so, and if something is, it
is named in plain words - the game is not patched, mods are going to a folder the game does
not mount, downloads are failing, the drive is nearly full. A second, full report next to it
carries everything for whoever is going to dig: the whole mod list in load order, the open
windows, the errors the interface reported, the updater and the config.

It also collects more: the two game files our patch edits, Dota's own console log if you have
ever run with `-condebug`, and listings of the app's own folders.

### Fixed

- The pill that says a mod is overruled had its icon sitting crooked next to its own text.
- "How many mods are overruled" was blank in every support report ever sent: the report asked
  for something that does not exist and quietly wrote nothing.
- Update errors were thrown away entirely, which is unhelpful when the report is that it never
  updates. They are still silent for you, and now recorded for a support report.

## 2.0.0

The whole app, rebuilt. Six tabs became four, the catalog was redrawn, and most of the
questions the app used to ask you it now answers itself.

### Four sections instead of six

Catalog, My mods, Presets, Settings. Guides moved inside the mod they explain: open a mod and
the guide is there, on the same card. Tools became what they always were, a category of the
catalog, so they sit in the rail with everything else.

### The catalog, redrawn

- Five columns instead of four, and a card that leads with the picture. Tags say what a mod
  changes; which item slot it fills is a dropdown, because that is one answer rather than a
  set. Both are translated now.
- A mod with several looks shows them as coloured buttons with their names on, and you can
  flip between them on the card itself without opening anything.
- An installed mod wears a green frame you can see from across the grid.
- Heroes is grouped hero by hero, A to Z, and scrolls four times faster than it did.
- Opening a mod takes a third of a second and comes out of the card you clicked.
- Counts are gone from the rail, the tiles and the headings. They were catalog statistics, and
  you came here to install a mod.

### An install list

Click the plus on a card to put a mod aside, keep browsing, then install everything at once.
The list has its own search, so a list eighty mods long is still a list you can work with.
That was the most asked-for thing in Discord: people were installing eighty mods one at a
time.

### It wears the hero you pick

Eight palettes from the catalog's own art, and a little animated mascot next to the logo that
switches between them. Click it and the whole window follows.

### My mods is a list again

A row is a picture, a name, a category and a switch. Everything rarer lives under the right
mouse button: rename, remove, open the folder, change the load order. The order is always
available, not only when something looks wrong.

### Sharing a setup is one button

One Share button opens one sheet: the link is already made and the file is next to it. It
says what each of the two carries, so nobody sends a link expecting it to include a mod that
is not in the catalog.

### It stopped asking about languages

The app no longer touches Dota's text language, keeps the voices Russian by itself, and puts
mods where the game actually looks for them. If your mods were stranded in another folder from
an older version, they move over on the first start. English voices are a single switch in
Settings, and turning them on leaves every mod in place.

### It survives a Dota patch

The app notices a game update when it lands rather than at the next start, and puts back what
the patch wiped. While Dota is running it does not write to the game folder at all: it says so
and waits for you to close the game.

### All of the change, or none of it

Installing, importing, switching and deleting now write to the game folder as one transaction.
If anything fails halfway, everything goes back to how it was, including the files that were
displaced to make room.

### Downloads that finish

Several mirrors instead of one, a download that resumes where it stopped, and a checksum on
what arrives. A half-finished file in the cache is re-fetched instead of installed.

### It puts back what Steam's file check takes away

Verifying game files in Steam removes the patch, the item table, the voice setup, fonts and
cursors. The app notices and restores all of it without asking.

### It reads the game rather than guessing

- Item pictures come from Dota's own files, so anything Valve adds appears without an app
  update and without downloading a 48 MB wiki dump.
- A mod that came with no picture gets one out of itself, from the art the author packed
  inside it.
- The app asks the game which items a mod replaces and who wears them, so a mod is named by
  what it actually does. A "bundle for 8 heroes" turned out to be one hero.
- A mod whose files are supplied by another mod is marked covered, and the app tells you which
  one the game is loading. It decides that by comparing the files themselves, so two mods that
  happen to carry the same stock file are not accused of fighting.
- A folder of loose game files can be turned into a mod, and a mod can be unpacked back into a
  folder. Drag a folder onto the window and it just works.

### Fixed

- **Favouriting a mod could stop installs from working.** Saving any setting made the app
  forget it had found Dota, so the catalog claimed the game was not installed and every
  install refused until you restarted. Present since 1.15.0.
- An archive can no longer lie about its size to make the app unpack a bomb, and a file inside
  an archive can no longer be written outside the folder it was meant for. That applied to any
  archive the app accepts, including a preset somebody sends you.
- Chips on a card stay on one line instead of pushing the card's own layout apart.
- After moving between screens, cards and buttons could stop responding. The app now waits for
  a screen to exist before wiring it up.
- My mods no longer breaks when there are files in the mods folder that the app did not put
  there.

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
