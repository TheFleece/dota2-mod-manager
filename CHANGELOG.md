# Changelog

What changed in each release. The app updates itself, so you get all of this without reinstalling.

## 2.6.4

### Mods reach the folder the game reads again, if you run the new Minify

Minify v1.14rc7 puts a command of its own in front of Dota in Steam's launch options, so that
pressing Play patches first. Storing that escapes the quotes around its path, and this app read
launch options up to the first quote and stopped there. It lost the `-language` sitting behind
it, concluded nothing was set, and went back to installing into the folder named by the voice
setting - which Dota does not mount while that option is there. Your mods were on disk, switched
on, in a folder nothing reads.

Launch options now parse the way Steam writes them. If your mods went quiet after Minify
updated, they come back on the next start of this app, and nothing has to be installed again.

### When Dota will not start, the Library says why

That same Minify setting is "Run patches upon launch if required", and it is on by default. It
can swallow a launch: if its patch decides your launch options need fixing, it closes Steam and
waits for it, and your launch goes down with Steam. This app is nowhere in that sequence, since
Play here opens the same `steam://` link the Play button in Steam does. It is the window you
have open when nothing happens, though, so it now tells you the wrapper is set, whose setting it
is, and where to switch it off.

### pak99 is back in circulation

Minify merged its English localization into pak66, so it will not write pak99 again and this app
can hand that slot out. A pak99 already sitting in your folder is still read as Minify's and
left alone.

### Colours changed once, then never again

Turn animations off in Windows and the mascot in the title bar worked on the first click of a
session and ignored every click after it. The spin now ends on a clock rather than on an
animation that never runs.

### Deleting mods no longer looks like deleting your presets

Clear out the Mods tab and every preset read "0 mods" above the words "empty (everything will be
switched off)". Nothing had gone: a preset remembers mods rather than installations, which is
what lets a build outlive a reinstall, and the card counted only the ones it could find on disk.
A preset now shows everything in it, with the mods you do not have drawn as outlines.

## 2.6.3

### The interface no longer needs the internet to draw itself

Every icon in the app is a glyph in a font, and that font was fetched from Google at startup
along with the two typefaces. When it did not arrive - no connection yet, a slow or blocked
network, a cache emptied by an update - each icon fell back to the word behind it, and the
window filled up with `campaign`, `shield` and `play_arrow` where the pictures should be.

The fonts now sit inside the app and are read from disk. Nothing about drawing the window
touches the network any more, and the window's content policy no longer permits it to.

## 2.6.2

### Updating no longer asks whether to delete your mods

2.6.1 shipped an uninstaller that asks what to take along with the app - the mods in the game
folder, the app's own data. It was supposed to appear when somebody removes the program. It
appeared during updates as well, with the boxes already ticked, because an update replaces a
version by running the old uninstaller and nothing checked for that.

Nothing was deleted unless the window was confirmed, and cancelling it left everything alone.
But being asked to delete your mods while merely updating is not something anybody should have
to read carefully, and I am sorry for the fright.

Updates are silent again. The questions appear only when the program is being removed from
Windows, and nothing destructive is ticked in advance any more: deleting mods and app data are
now yours to choose, not the app's to assume. Putting the game's own files back stays on by
default, because a game left carrying an edit with the app that undoes it gone is the one
outcome that cannot be fixed afterwards.

## 2.6.1

### Mods now go where the game is actually looking

A `-language` in Steam's launch options outranks the language setting inside Dota. The app did
not know that, so on a machine with one set it did the worst possible thing: it wrote the voice
language back on every start, lost every time, and left your mods in a folder the game never
opens - while telling you everything was fine. Nothing was broken and nothing was lost; the
mods were simply somewhere nothing reads.

It follows the launch option now. If it names a language Dota knows, that folder is where mods
go, and mods already installed move themselves there on the next start. Remove the option later
and they move back on their own. Nothing changes for anyone without one.

This is also what makes running alongside Minify work rather than merely be described: Minify
is what puts the option there, so following it means both sets of mods end up in the one folder
the game reads.

### Everything the app said about Minify, corrected

A machine running the current Minify showed three notices at once that contradicted each other
and the game. All of it was wrong, and all of it is fixed.

Minify records the language you asked it for and the folder it writes to separately - ask for
English and it notes "english" while building into `dota_dutch` - and the app was reading the
wrong one, so it named a folder that exists nowhere and concluded that neither program's mods
were loading while Minify's plainly were. It also offered a button to move Minify's mods into
its own folder, had no wording at all for "the game is reading neither of us", and suggested
setting Minify to Russian, which for anyone whose game is not in Russian would have hardcoded
it there.

`pak99` joins `pak65` to `pak67` as slots the app will not use: that is where Minify writes its
English fix, and 99 was the last slot this app hands out, so a large library would have reached
it first.

### Smaller things

The Library no longer lists `dota_mods` - the app's own folder for free cosmetics - as if it
were a language. A language folder that already exists is left as it is instead of being given
a `gameinfo.gi` it never needed. And moving mods between folders skips anything another program
owns, whichever folder it is pointed at.

## 2.6.0

### Turning safe mode off now explains itself

It used to be one line of file names, and nobody read it. It is a proper window now: what the
app does today - drops its .vpk into a folder Dota already reads, touching nothing of the game -
and what it will do instead, with both files it edits named and what lands in each. Copies of
both are kept before the first write, so switching back puts them back byte for byte with
nothing left behind. Dota wipes that edit with every update and the app writes it back on its
own, which the window now says too. And the sentence that actually decides it: editing game
files counts as unsafe in Dota modding, no ban for it in 8+ years, no guarantees from us.

### Switching tabs, and importing a pile of mods

Opening a tab rebuilt the whole screen from nothing. Coming back to Heroes meant 513 cards
built again and about 90ms of frozen window, every time. Screens are kept now: around 30ms, and
it no longer grows with the size of the category. Each screen also remembers where it was
scrolled to, instead of inheriting the last one's position.

Importing a batch never let go of the app while it worked, so Windows put "not responding" on
the title bar for the several minutes a big pack takes. It hands control back between mods now,
and the bar counts them: "Reading mods 31 / 60" instead of one width until it is over.

### Removing mods

Deleting the file was never the slow part - it takes about two milliseconds. The wait was the
item table being rebuilt afterwards, and a selection paid for it once per mod. It is rebuilt
once for the whole batch now, and the rebuild itself went from 2.6 seconds to under half a
second. Twenty mods removed in about six tenths of a second, where the same twenty were close
to a minute.

### Presets keep what you saved

A preset used to hold the mods it named only as long as they stayed installed: delete one and
it was cut out of every preset, and reinstalling did not bring it back. Presets now remember
what a mod is rather than which copy of it was on the machine, so deleting one leaves the build
alone and installing it again anywhere fills the gap on its own. The card says how many of its
mods are not installed right now.

Free cosmetics are no longer part of a preset. A pick is not a mod - it owns no file and only
exists while safe mode is off - and folding the two together is why applying a build used to
strip whatever courier or weather you had chosen.

### Item pictures come from your own game

The cosmetics picker used to match items against a wiki: rate limited, wrong when two items are
named alike, and nothing at all offline. Almost every picture is already in the game in a form
that needs no decoding, so it now comes from there - correct for your build, instantly, with
nothing downloaded. The few that are stored compressed still fall back as before.

### Alongside Minify

[Minify](https://github.com/Egezenn/dota2-minify) loads mods the way this app does: by naming a
language folder, of which Dota mounts exactly one. So the app now reads Minify's own
configuration, works out which of the two the game is actually set to read, and says so -
including the case where its folder is not one the game reads at all, which is nothing to do
with us.

It also stays out of its way: the pak slots Minify writes are never used, the "disable all
mods" switch no longer renames its files, and its output is not offered in My mods as something
to adopt or delete. Its files are recognised by the marker it packs into what it builds, and
this app leaves a `dota2modmanager.json` naming its own, so either side can tell whose a file
is. Nothing of Minify is moved, renamed or deleted.

Where the two genuinely cannot both win, the app asks: Dota reads one map archive, so a terrain
and a Minify map mod are the same file. Installing one replaces the other, and you now hear
about it first.

### A launch option that overrules everything

Older guides hand out `-language something` freely. While it is there Dota takes both language
settings from it and mounts the folder it names, whatever this app does. The Library says so
now, and where to remove it.

## 2.5.1

### A skin that borrows from another hero comes in whole

The app reads which heroes a mod dresses from the models it carries, and two things fooled it.
A persona lives in a folder of its own - `models/heroes/antimage_female` is Anti-Mage's Wei,
`invoker_kid` is Invoker's Acolyte - so a pack that dresses one hero looked like a pack that
dressed two. And skins hang props from other heroes on themselves: a Clinkz set carries a
Phoenix immortal on its bow, a Sven one wears Disruptor's back piece. That one model counted as
a second hero.

An import that reads as two to four heroes cuts itself into a mod each, so both cases arrived as
two half mods: the bow in one, the hero in the other, each under a name that was half right.

A persona now reads as the hero it belongs to, along with the folder names Dota kept from before
a rename - bard, lanaya, drow, gyro, tuskarr and the rest - and a hero carrying under a quarter
of the leading hero's models reads as lent rather than dressed. Naming and cutting ask the same
question now, so a mod that comes in under the right name also comes in whole. Over 75 mods cut
out of one Skinchanger pack, the number that split themselves goes from three to none.

### The piece an item points at instead of shipping

A mod can point a default slot at one of Valve's own models and still be the author's work: he
repaints that item by shipping its textures, and his entry only ever names the model. Tinker's
Deep Sea Robot back is exactly that, and the import threw the entry away because the mod carries
nothing of the model it names, so the back never appeared on the hero at all.

Such an entry is now recognised by the item folder the mod's own textures sit in.

### Thanks

hanta made a walkthrough of the manager. His channel has a line in About now, beside the version
and the licence.

## 2.5.0

### The day GitHub is down is no longer your problem

On 17 August GitHub was out for three hours. Everything this app reads lives there: the
catalog, the mod archives, the file that recognises mods you installed by hand. The mirrors it
already had are all proxies standing in front of GitHub, so they went down with it. The window
opened, the catalog was empty, and nothing could be installed.

There are two more places to look now, and neither is GitHub. The catalog and its data are
copied onto the app's own site every time that site is built. All 915 mod archives sit in
object storage behind `cdn.dota2modmanager.com`, refreshed nightly. GitHub is still asked
first, because it is the source; the others answer when it cannot.

### A catalog that fails to update no longer disappears

If the app could not fetch a fresh catalog, it used to show you nothing, even with a perfectly
good copy already on your disk from an hour before. Now it shows the one it has and says so in
a line at the top. An old list of mods beats an empty window.

## 2.4.0

### It runs on Linux now

The release carries an AppImage. Make it executable, run it, and that is the whole installation.

Dota's Linux build keeps its mods in the same folders as the Windows one, so nothing about how
mods work changes. What had to learn a second platform is everything around them. The app finds
Steam where your distribution keeps it rather than in the Windows registry: the `~/.steam`
symlink, the XDG folder, the flatpak home, and both spellings of the steamapps directory, which
Windows forgives and Linux does not. It knows the game is running by asking for the process
instead of running a Windows tool. And it tells your desktop that it owns `d2mm://` links, so a
preset somebody sends you opens the app the same way it does everywhere else.

Being straight about how new this is: every change is built and started against a throwaway game
tree on Linux by our own CI, and somebody ran this build on a real desktop before it shipped.
That is a week of Linux against a year of Windows. If something looks wrong, the issue tracker is
the place, and it will be fixed faster than it was found.

### Small things

A Shadow Shaman mod whose folder is spelled `shadowshaman` said it was for "Shadowshaman". It
says Shadow Shaman.

## 2.3.0

### A portable build, for people who would rather not install anything

The release now carries a second file, `Dota-2-Mod-Manager-Portable.exe`. It runs from wherever
you put it, including a stick, and writes nothing into your system.

Portable here means the data comes with it. Your settings, your mod library and the download
cache go into a folder next to the exe, so the same stick on another machine comes up with
everything you already had. If that folder cannot be written to, which is what happens if you
drop it in Program Files, it falls back to the usual place and keeps working.

The one thing it cannot do is replace its own exe. So instead of updating in place it fetches
the new build, puts it beside the old one and tells you it is there. Nothing on your disk gets
rewritten, and the installer version updates itself exactly as before.

### Mods can no longer be installed where there is no game

Somebody moved his Steam library from C to F. Steam left the empty folder tree behind, as it
does. The app checked whether a folder named `dota` existed, decided it had found the game, and
installed forty-three mods into the leftovers. All forty-three were listed as installed. None of
them were anywhere the game could see.

The check is now for Valve's own files, not for a folder name, and it runs in three places: at
startup, where a path that stopped being an install gets replaced by the real one automatically;
in the folder picker; and before a download starts, so a mod with nowhere to go no longer costs
you 300 MB first.

If Dota cannot be found at all, the app says so and installs nothing. It always meant to. The
warning simply never appeared, because the old check called those leftovers a game.

### Small things

The release page could not be updated for a few minutes after 2.2.0 went out, which also left
its own update manifest split across two pages. Both are fixed, and the release now checks
itself before it is called done.

There is a `SECURITY.md` and a `security.txt` now, so anybody who finds a hole has a private
way to report it instead of a public issue.

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
