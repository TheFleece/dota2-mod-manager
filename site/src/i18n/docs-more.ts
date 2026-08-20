/**
 * Seven more guides, in both languages.
 *
 * A separate file from docs.ts for length alone: the two together are one table of pages, and
 * merging happens there. The rule is the same one that file states - both languages side by
 * side, so a paragraph that exists in one and not the other is visible while typing.
 *
 * Why these seven. The five originals answer how modding works; these answer what people
 * actually type. Terrains are the most-wanted mod in Dota and every guide ranking for them
 * teaches the `-language tempcontent` trick that stopped producing a folder on 2026-07-24.
 * Removing mods is the second thing searched after installing them and nothing here answered
 * it. The language folder is the piece no other guide explains correctly, and it is the reason
 * the terrain guides broke. Announcers, and your own files, had no page at all. The last two
 * are about the people this is built on and about choosing between the tools in this corner:
 * both get asked, and until now both got answered by somebody else.
 *
 * Facts are read off the code they describe: pak slots and priority categories from
 * installer.js (PRIORITY_CATEGORIES, allocatePak), the folder name from gamelang.js, the
 * search-path patch from patcher.js. Claims about other people's software are limited to what
 * their own site or repository states, and said as theirs.
 *
 * Counts written as {mods} or {categories} are filled by the layout at build time.
 */
import type { Doc } from './docs.ts';

type Slug = 'uninstall' | 'terrain' | 'announcer' | 'language' | 'own-mods' | 'catalog' | 'compare';

// ---------------------------------------------------------------------------
// English
// ---------------------------------------------------------------------------

const en: Record<Slug, Doc> = {
  uninstall: {
    slug: 'uninstall',
    title: 'How to remove Dota 2 mods and undo everything',
    h1: 'How to remove Dota 2 mods',
    description:
      'Take one mod off, switch all of them off for a single game, or put Dota back exactly as Valve ships it. With the app and by hand, including fonts, cursors and the schema patch.',
    lead: 'Three different things get called removing a mod: taking one off, turning everything off for one game, and leaving no trace at all. Here are all three, and what happens to the files in each.',
    card: 'One mod, every mod at once, or a full return to a clean game. Fonts, cursors and the patch included.',
    blocks: [
      { k: 'h2', t: 'Take one mod off', id: 'one' },
      {
        k: 'steps',
        items: [
          ['Open My mods', 'Everything installed, with a switch next to each one.'],
          ['Press Delete', 'The file leaves the game folder and the entry leaves your library. The game goes back to how it was before that mod.'],
          ['Restart Dota', 'The game reads its archives when it starts, so a client already running will not notice.'],
        ],
      },

      { k: 'h2', t: 'Switching off is not deleting', id: 'off' },
      {
        k: 'p',
        t: 'If you want the mod back tomorrow, do not delete it. The switch next to a mod renames its file and leaves the entry in your library, and one click brings it back. A second switch turns every mod off at once, which is what you want before a tournament game or straight after a patch when you do not yet know what broke.',
      },

      { k: 'h2', t: 'By hand, without the app', id: 'manual' },
      {
        k: 'p',
        t: 'A mod is a file called pakNN_dir.vpk sitting in the language folder the game mounts. Delete the file and the mod is gone.',
      },
      {
        k: 'steps',
        items: [
          [
            'Open the language folder',
            'Inside <code>...\\steamapps\\common\\dota 2 beta\\game\\</code>, named after your voice language rather than your text one: <code>dota_russian</code>, <code>dota_koreana</code> or <code>dota_schinese</code>. <a href="~/docs/language/">Which folder is yours</a>.',
          ],
          ['Look at the pak numbers', 'Mods are pak02_dir.vpk through pak99_dir.vpk. Every file in the folder that is not pak01 arrived from outside the game.'],
          ['Delete the ones you want gone', 'Gaps in the numbering are fine. The game does not care whether pak04 exists when pak05 does.'],
        ],
      },
      {
        k: 'note',
        t: 'Never delete <code>pak01_dir.vpk</code> or the <code>pak01_NNN.vpk</code> files next to it. Those are the game\'s own, and deleting them means a repair through Steam.',
      },

      { k: 'h2', t: 'Fonts and cursors', id: 'fonts' },
      {
        k: 'p',
        t: 'These two replace files instead of layering over them, so the app copies the originals before installing and puts them back when you remove the mod. If you installed a font by hand and kept no copy, Steam\'s file verification returns it.',
      },

      { k: 'h2', t: 'Back to a clean game', id: 'reset' },
      {
        k: 'list',
        items: [
          'Turn the free-cosmetics feature off. The app restores <code>gameinfo_branchspecific.gi</code> and <code>dota.signatures</code> from the copies it made before the first write.',
          'Delete everything in My mods.',
          'If you ever installed anything by hand, look in the language folder for pakNN_dir.vpk files still sitting there.',
          'In Steam, open the game properties, then Installed Files, then verify integrity. That returns everything that belongs to Valve.',
          'The app itself uninstalls the ordinary way, through Installed apps in Windows.',
        ],
      },

      { k: 'h2', t: 'Questions', id: 'faq' },
      {
        k: 'faq',
        items: [
          ['Does removing a mod remove cosmetics from my inventory?', 'No. Nothing here touches your Steam account, and your inventory is untouched either way.'],
          [
            'Will verifying files in Steam remove my mods?',
            'It restores files that belong to the game. Extra pakNN_dir.vpk files in the language folder are usually left alone, so if the point is to get rid of mods, delete those yourself.',
          ],
          [
            'I removed a mod and the game still shows it.',
            'Restart the game completely: archives are read at startup. If it survives that, a second mod is probably carrying the same files. <a href="~/docs/vpk/">How the game picks a winner</a>.',
          ],
        ],
      },
    ],
  },

  terrain: {
    slug: 'terrain',
    title: 'How to install a Dota 2 terrain in 2026',
    h1: 'Terrains: installing a custom map in Dota 2',
    description:
      'Installing a Dota 2 terrain with the app or by hand, why every guide teaching -language tempcontent stopped working in July 2026, and how trees and the river fit around it.',
    lead: 'A terrain is the most visible mod in Dota and the usual reason somebody starts modding at all. Every guide on the first page of search results teaches a trick that stopped working on 24 July 2026.',
    card: 'Terrains, trees and the river. Why -language tempcontent died and how a terrain is installed now.',
    blocks: [
      { k: 'h2', t: 'What a terrain actually is', id: 'what' },
      {
        k: 'p',
        t: 'A terrain replaces the map: the ground, the cliffs, the trees, the river, the ambient effects. Technically it is an ordinary mod, a VPK archive of models and textures laid over the game\'s own. Terrains, trees and the river are separate categories in the catalog because people mix them, taking the ground from one and the trees from another.',
      },

      { k: 'h2', t: 'Why the old guides stopped working', id: 'broken' },
      {
        k: 'p',
        t: 'Almost every terrain guide teaches the same move: add <code>-language tempcontent</code> to the launch options and drop the mod in a folder called <code>dota_tempcontent</code>. On 24 July 2026 Dota stopped taking the language from that argument. Both languages now live in <code>game/dota/cfg/boot.vcfg</code>, and the engine substitutes the audio language into its search path. A made-up value like tempcontent no longer creates a folder or mounts one, so the mod simply never loads.',
      },
      {
        k: 'p',
        t: 'The argument itself still exists and still sets the language. What it can no longer do is invent a folder out of a value nothing recognises. <a href="~/docs/language/">The whole story of the language folder</a>.',
      },

      { k: 'h2', t: 'With the app', id: 'app' },
      {
        k: 'steps',
        items: [
          ['Open Terrains in the catalog', 'Every terrain has a preview, so you see what you are getting before it is on your disk.'],
          ['Press Install', 'The app downloads it, puts it in a free pak slot in the folder your game actually mounts, and remembers what it wrote.'],
          ['Restart Dota', 'A running client will not pick it up. Close it fully first.'],
        ],
      },
      {
        k: 'p',
        t: 'Trees, the river and shaders go into lower-numbered slots than the terrain itself, because a lower number wins when two mods carry the same file. That is what lets you run one author\'s ground under another author\'s trees.',
      },

      { k: 'h2', t: 'By hand', id: 'manual' },
      {
        k: 'steps',
        items: [
          ['Find your language folder', 'Named after your voice language, not your text one. <a href="~/docs/language/">How to tell which</a>.'],
          ['Rename the file', 'To a free pakNN_dir.vpk, where NN is anything from 02 to 99 that is not taken. Never 01.'],
          ['Drop it in and restart', 'That is the whole mechanism. No launch options, no edits to game files.'],
        ],
      },

      { k: 'h2', t: 'A terrain, trees and a river together', id: 'combo' },
      {
        k: 'p',
        t: 'These three overlap. A terrain that ships its own trees and a separate tree mod both carry the same files, and only one of them can win: the one in the lower pak slot. The app tells you which and lets you drag them into another order. Installed by hand, you discover it by looking at the map.',
      },

      { k: 'h2', t: 'What breaks a terrain', id: 'breaks' },
      {
        k: 'list',
        items: [
          'A game patch overwrote the files the mod depends on. Common, and it is what the repair step exists for.',
          'Two terrains installed at once. One of them is doing nothing.',
          'The mod is in a folder the game does not mount, which is what the old guides caused.',
          'An old <code>dota_tempcontent</code> folder left over from those guides, still holding the mods you think are installed.',
        ],
      },

      { k: 'h2', t: 'Questions', id: 'faq' },
      {
        k: 'faq',
        items: [
          ['Are terrains free?', 'The ones in the catalog are. Valve sells terrains too, and a mod does not replace one: it changes what you see, not what your account owns.'],
          ['Can other players see my terrain?', 'No. It is drawn by your client, on your screen. Everyone else sees the map they installed.'],
          ['How many terrains can I have installed?', 'As many as you like, but one of them is doing the work. Switch the rest off rather than leaving them to argue.'],
          ['Does a terrain affect performance?', 'It can, in both directions. Some are heavier than Valve\'s, and the catalog\'s optimization category exists to go the other way.'],
        ],
      },
    ],
  },

  announcer: {
    slug: 'announcer',
    title: 'How to change the announcer in Dota 2',
    h1: 'Announcers and voices in Dota 2',
    description:
      'Two ways to change your Dota 2 announcer: a voice mod from the catalog, or one your account already owns. Plus mega-kill packs, hero voices and why the folder matters.',
    lead: 'The announcer changes by two different routes, and they are not the same thing. One installs somebody else\'s recording as a file. The other switches on what you already own.',
    card: 'A voice mod or an announcer from your inventory. Mega-kills, hero voices and why a restart is needed.',
    blocks: [
      { k: 'h2', t: 'Two different things', id: 'two' },
      {
        k: 'cards',
        items: [
          [
            'A voice mod',
            'Somebody recorded a set of lines and packed them as a VPK. It replaces what you hear regardless of what your account owns, and it is a file in the game folder like any other mod.',
          ],
          [
            'An announcer you already own',
            'Announcers you have from bundles, battle passes or drops sit unused because the client only shows what it thinks you have equipped. That is a list, not a file, and it can be corrected locally. <a href="~/docs/cosmetics/">How the item table works</a>.',
          ],
        ],
      },

      { k: 'h2', t: 'Installing a voice mod', id: 'mod' },
      {
        k: 'steps',
        items: [
          ['Open Announcers in the catalog', 'Most have a preview you can listen to before installing.'],
          ['Press Install', 'The app puts it in a free pak slot in the folder the game mounts.'],
          ['Restart Dota', 'Sound is loaded at startup like everything else.'],
        ],
      },
      {
        k: 'note',
        t: 'Voice lines live in the folder named after your <b>audio</b> language, not your interface language. Changing the audio language in Dota\'s settings moves the game to a different folder and leaves your voice mods behind in the old one. <a href="~/docs/language/">Why that happens</a>.',
      },

      { k: 'h2', t: 'Mega-kills and hero voices', id: 'mega' },
      {
        k: 'p',
        t: 'Mega-kill packs and hero voice packs work the same way and live in their own catalog categories. They collide with an announcer mod only when both carry the same lines, which the app tells you about.',
      },

      { k: 'h2', t: 'Questions', id: 'faq' },
      {
        k: 'faq',
        items: [
          ['Do other players hear my announcer?', 'No. Everyone hears whatever they have equipped themselves.'],
          [
            'The mod installed and nothing changed.',
            'Two usual causes: the game was not fully restarted, or the mod went into a language folder your game is not mounting. <a href="~/docs/troubleshooting/">More symptoms</a>.',
          ],
          ['Can I mix an announcer with a mega-kill pack?', 'Yes, as long as they are not carrying the same files. The app says when they are.'],
        ],
      },
    ],
  },

  language: {
    slug: 'language',
    title: 'The dota_english folder and why -language mods fails',
    h1: 'The language folder: where mods actually go',
    description:
      'Which folder Dota 2 mounts after the July 2026 update: UILanguage and AudioLanguage in boot.vcfg, why dota_tempcontent is no longer created, and how to find your own folder.',
    lead: 'Every mod for Dota lives in a folder named after a language. Which one is decided by the game\'s own settings file, not by a launch option, and that changed on 24 July 2026.',
    card: 'boot.vcfg, UILanguage against AudioLanguage, and why a made-up folder no longer mounts.',
    blocks: [
      { k: 'h2', t: 'Where the folder name comes from', id: 'name' },
      {
        k: 'p',
        t: 'Dota\'s search paths include an entry with a placeholder for the language, and the engine substitutes a real value into it at startup. Whatever that value is, the folder <code>game/dota_&lt;value&gt;</code> gets mounted and everything inside it loads on top of the game\'s own archives. That is the whole mechanism mods run on. Nothing is patched and nothing is injected: a folder the engine already looks in gets an extra archive in it.',
      },

      { k: 'h2', t: 'Two languages, not one', id: 'two' },
      {
        k: 'p',
        t: 'The July 2026 update split the setting in two and moved both into <code>game/dota/cfg/boot.vcfg</code>:',
      },
      { k: 'code', t: '"boot"\n{\n\t"UILanguage"    "english"\n\t"AudioLanguage" "english"\n}' },
      {
        k: 'p',
        t: 'The one that matters here is <b>AudioLanguage</b>. That is the value the engine puts into the search path, which is why switching your voice language asks for a restart and switching interface text does not. Interface text lives in the game\'s own pak01 for every language at once, so it never had a folder of its own.',
      },

      { k: 'h2', t: 'Why -language mods stopped working', id: 'dead' },
      {
        k: 'p',
        t: 'The old trick relied on the argument being free-form. You passed <code>-language mods</code> or <code>-language tempcontent</code>, the engine put that word into the search path, and a folder appeared for you to hide mods in, away from the real language folders. Now the value comes from boot.vcfg instead, and a word Dota does not recognise as a voice language produces nothing. The folder is not created, not mounted, and the mods in it never load.',
      },
      {
        k: 'p',
        t: 'The argument still works and still sets the language. It just cannot invent a folder any more. Every guide still teaching that step is sending people to a directory the game will never open, which is the single most common reason a mod installed correctly does nothing.',
      },

      { k: 'h2', t: 'Finding your folder', id: 'find' },
      {
        k: 'steps',
        items: [
          ['Open the game folder', 'Steam, right-click Dota 2, Manage, Browse local files, then into <code>game</code>.'],
          ['Look for the dota_ folders', 'You will see <code>dota</code> and one or more <code>dota_&lt;language&gt;</code>. The one being mounted matches AudioLanguage in boot.vcfg.'],
          ['Check boot.vcfg if in doubt', 'It is a text file in <code>game/dota/cfg/</code>. Read AudioLanguage and that is your answer.'],
        ],
      },
      {
        k: 'note',
        t: 'No <code>dota_</code> folder at all? Your audio language is English, and Valve ships no folder for it: English speech sits inside the base game. You cannot create the folder yourself either, and switching the audio language to Russian, Korean or Chinese does not cost you English voices. <a href="~/docs/install/#english">The whole case, and why</a>.',
      },
      {
        k: 'p',
        t: 'The app does this for you and shows the folder it is writing to, which is worth a glance the first time you install anything.',
      },

      { k: 'h2', t: 'If you change your voice language', id: 'switch' },
      {
        k: 'p',
        t: 'The game starts mounting a different folder, and every mod you installed stays behind in the old one. Nothing is lost and nothing is broken; the game is simply looking somewhere else. The app can move your mods across when it notices, and by hand it is a matter of moving the pakNN files into the new folder.',
      },

      { k: 'h2', t: 'Questions', id: 'faq' },
      {
        k: 'faq',
        items: [
          [
            'Which languages does Dota record voices in?',
            'Four, and that list has nothing to do with the twenty-nine the interface is translated into. Three of them get a folder: <code>dota_russian</code>, <code>dota_koreana</code>, <code>dota_schinese</code>. English is the fourth and has none, because English speech lives inside the base game. <a href="~/docs/install/#english">What to do if your audio is English</a>.',
          ],
          ['Is a separate mods folder still possible?', 'Not by making up a name. Mods go in the language folder your game already mounts, in their own pak slots, which is what the app does.'],
          ['Do I need to edit gameinfo.gi?', 'No. Guides that teach editing it are working around the same problem from the other side, and editing a file the client checks is a worse trade than using a folder that already works.'],
        ],
      },
    ],
  },

  'own-mods': {
    slug: 'own-mods',
    title: 'Your own Dota 2 mods: install, unpack, combine',
    h1: 'Your own mods: installing, unpacking, combining',
    description:
      'Install your own .vpk into Dota 2, import a whole folder of mods you already had, unpack an installed mod back into files, and combine several mods into one pak slot.',
    lead: 'The catalog is not the only source. The app takes any VPK, recognises what is already sitting in your game folder, and takes mods apart again into the files they are made of.',
    card: 'Your own .vpk, a folder of old mods, unpacking, combining and splitting paks.',
    blocks: [
      { k: 'h2', t: 'Installing your own .vpk', id: 'vpk' },
      {
        k: 'p',
        t: 'Drag the file onto the window, or use the import button. The app reads what is inside it, works out what it changes and which heroes it touches, gives it a name if it has none, and puts it in a free pak slot. From then on it behaves like anything else in your library: it switches off, it reorders, it survives patches.',
      },

      { k: 'h2', t: 'A whole folder at once', id: 'folder' },
      {
        k: 'p',
        t: 'If you have been installing mods by hand for a while, point the app at the folder they are in and it takes every archive out of it in one go, rather than asking you to add them one at a time. It looks a few levels down, because packs from other tools unzip into a whole game tree with the file you want buried in it.',
      },

      { k: 'h2', t: 'A folder with no archive in it: your own mod', id: 'pack' },
      {
        k: 'p',
        t: 'Point it at a folder holding loose game files rather than a VPK, and it packs them into one for you and imports the result. This is the case an author has and no installer covers: you have been editing files in a working folder and had nothing to point anything at. The folder\'s own name becomes the mod\'s name.',
      },
      {
        k: 'p',
        t: 'It works out where your content actually starts, so a wrapper folder left by unzipping, or a game-shaped <code>MyMod/game/dota_russian/models/</code>, both resolve to the same archive. Folders of your own sitting next to the game\'s come along too.',
      },

      { k: 'h2', t: 'It recognises mods you installed by hand', id: 'adopt' },
      {
        k: 'p',
        t: 'The app fingerprints what is already in your game folder and compares it against the catalog. Where it finds a match it tells you which mod that file is and offers to take it under management, so a folder somebody else set up becomes a library you can actually read. Files it does not recognise are listed too, rather than being quietly overwritten.',
      },

      { k: 'h2', t: 'Unpacking a mod back into files', id: 'unpack' },
      {
        k: 'p',
        t: 'An installed mod can be unpacked back into a folder of the files it contains. That is where editing somebody else\'s mod starts, and it is also the quickest way to see what a mod really touches when the description is vague.',
      },

      { k: 'h2', t: 'Combining and splitting', id: 'packs' },
      {
        k: 'p',
        t: 'Several mods can be combined into one pak, and a pack can be taken apart again into the mods it was built from. Useful when the slots are running short, and useful when a set of mods should move together as one thing.',
      },

      { k: 'h2', t: 'The tools that make mods', id: 'tools' },
      {
        k: 'p',
        t: 'Making a mod rather than installing one means decompiling a game asset, editing it, compiling it back and packing it into a VPK. The tools for that live in the catalog\'s Tools section and install from inside the app, and the catalog\'s wiki is the documentation for the pipeline. <a href="~/docs/catalog/">Where those come from</a>.',
      },

      { k: 'h2', t: 'Questions', id: 'faq' },
      {
        k: 'faq',
        items: [
          ['Can I install a mod from a zip?', 'Yes. Archives from the catalog often come that way and the app unpacks them itself.'],
          ['Will my own mod survive a Dota patch?', 'The same as any other. A patch overwrites the files underneath, and the repair puts your archives back where they were.'],
          ['Can I share a mod I made?', 'The catalog takes submissions, and its Discord is where that conversation happens.'],
        ],
      },
    ],
  },

  catalog: {
    slug: 'catalog',
    title: 'The D2PFX catalog: what it is and who runs it',
    h1: 'The D2PFX catalog',
    description:
      'The open catalog of Dota 2 mods this app installs from: how many mods, which categories, who maintains it, where its wiki and Discord are, and why the app reads it live.',
    lead: 'Every mod this app installs comes from one place, and I did not make that place. This page is about what the catalog is, who runs it, and why it is the best open collection of Dota 2 mods there is.',
    card: 'Who h6rd is, what is in the catalog, the wiki and the tools, and how the app connects to it.',
    blocks: [
      { k: 'h2', t: 'What it is', id: 'what' },
      {
        k: 'p',
        t: 'D2PFX is an open catalog of cosmetic mods for Dota 2, run by <b>h6rd</b> with the community. {mods} {modsWord} in {categories} {categoriesWord}: hero skins, hero items, terrains, trees, the river, shaders, effects, couriers, wards, announcers, music, cursors, fonts, Roshan, mega-kills. Every mod carries a preview, tags saying what it really changes, an author and a date. It has been going for over a year and grows on its own schedule rather than in releases.',
      },
      {
        k: 'p',
        t: 'D2PFX is short for the catalog\'s own name, which is spelled out on <a href="https://github.com/h6rd/Dota2PornFxWeb">its repository</a>. The short form is used here because search engines and video platforms read the full one as adult content and quietly hide whatever page carries it, which helps nobody and least of all the people who made these mods.',
      },

      { k: 'h2', t: 'What is in it right now', id: 'inside' },
      { k: 'p', t: 'Counted from the catalog when this page was built:' },
      { k: 'categories' },

      { k: 'h2', t: 'Why this one', id: 'why' },
      {
        k: 'list',
        items: [
          '<b>It is open.</b> The site and the data are in a public GitHub repository under GPL-3.0. The list of mods is an ordinary JSON file that anything can read, which is exactly how this app reads it.',
          '<b>It is alive.</b> Mods arrive continuously. A collection that updates twice a year is a different kind of object.',
          '<b>It is sorted.</b> Categories, grouping by hero, tags that describe the actual change rather than the marketing, and a preview for nearly everything.',
          '<b>It documents itself.</b> The wiki teaches making mods, not just installing them.',
          '<b>It ships tools.</b> A Tools section with the VPK utilities, a compiler and a patcher, maintained by the same author.',
        ],
      },

      { k: 'h2', t: 'The wiki, which is the good part', id: 'wiki' },
      {
        k: 'p',
        t: 'Most mod sites tell you where to put a file. The catalog\'s wiki tells you how the file was made: decompiling a game asset, editing it, compiling it back, packing it into a VPK, and which folder inside the archive each kind of resource has to sit in for the engine to find it. Icons, sounds, styles and fonts all live in different places and only some of them need compiling. If you want to stop installing other people\'s mods and start making your own, that is where to go.',
      },

      { k: 'h2', t: 'How this app is connected to it', id: 'link' },
      {
        k: 'list',
        items: [
          'It reads the catalog\'s data over the network, so a mod added today is installable today, with no app update and no new release.',
          'It downloads mod files from the catalog\'s own addresses. Nothing is re-hosted here.',
          'The Tools section installs from inside the app.',
          'It fingerprints mods already in your game folder against the catalog, which is how it can tell you what a file you installed by hand actually is.',
          'The manager itself is listed in the catalog\'s Tools section.',
        ],
      },

      { k: 'h2', t: 'Credit, and the limits of it', id: 'credit' },
      {
        k: 'p',
        t: 'The catalog and the mods in it belong to the people who made them. This app installs them and takes no money for it, from anyone. If you made something shown here and want it credited differently, or gone, the Discord is the fastest way and it gets done.',
      },

      { k: 'h2', t: 'Questions', id: 'faq' },
      {
        k: 'faq',
        items: [
          [
            'Is this the catalog\'s official app?',
            'No. The catalog and this app are separate projects by different people. The manager is listed in the catalog\'s Tools section, but the catalog stands on its own and the app reads it as open data.',
          ],
          [
            'Why is it called that?',
            'The author named it years ago and that is the name it is known by. It says nothing about the contents: the catalog is cosmetic mods for Dota 2, sorted by hero and category.',
          ],
          ['Can I install from the catalog by hand?', 'Yes. Download the file from the site and rename it into a free pak slot. <a href="~/docs/install/#manual">The manual route</a>.'],
          ['Does the app work without the catalog?', 'Yes, for your own files. <a href="~/docs/own-mods/">Installing your own .vpk</a>. The catalog is where the browsable collection comes from.'],
        ],
      },
    ],
  },

  compare: {
    slug: 'compare',
    title: 'Choosing a Dota 2 mod manager: what to check',
    h1: 'How to choose a Dota 2 mod manager',
    description:
      'What to check before running any Dota 2 mod installer: source, who built the file, what it asks for, whether its catalog is live. With honest answers for this one and the alternatives.',
    lead: 'You are about to let a program write into your game folder. Five questions decide whether that is a reasonable thing to do, and they are the same five whatever you end up installing.',
    card: 'Five questions to ask any mod installer, answered for this one and for the alternatives.',
    blocks: [
      { k: 'h2', t: 'The five questions', id: 'questions' },
      {
        k: 'cards',
        items: [
          ['Can you read the source?', 'Not "source available on request". A repository that opens right now, with the code the release was built from.'],
          ['Who built the file you downloaded?', 'A public CI job leaves a log anybody can open. A file uploaded from somebody\'s desktop leaves their word.'],
          ['What does it ask for?', 'A mod installer needs your game folder. It does not need a Steam login, your inventory or a password. Anything asking is doing something other than installing files.'],
          ['Where do its mods come from?', 'A collection baked into the build ages with the build. One read live grows without anybody shipping anything.'],
          ['What happens when two mods collide?', 'Two mods carrying the same file cannot both apply. A manager that does not mention this is leaving you to work it out from the map.'],
        ],
      },

      { k: 'h2', t: 'This one, answered', id: 'here' },
      {
        k: 'list',
        items: [
          '<b>Source:</b> GPL-3.0, the whole repository, every release tagged.',
          '<b>Builds:</b> GitHub Actions, workflow and logs public.',
          '<b>Asks for:</b> the game folder. Signing in with Discord is optional and only puts your name on a setup you share.',
          '<b>Mods:</b> read live from the D2PFX catalog, {mods} of them. <a href="~/docs/catalog/">What that is</a>.',
          '<b>Collisions:</b> named on screen, with the load order editable from the same place.',
          '<b>Cost:</b> free, with nothing paid inside and no ads.',
        ],
      },

      { k: 'h2', t: 'The alternatives', id: 'others' },
      {
        k: 'p',
        t: 'Said as they say it themselves, because that is the only fair way to put somebody else\'s software on your own page.',
      },
      {
        k: 'cards',
        items: [
          [
            'DOTA Mods Installer (dota2mods.com)',
            'The big one. Its site states over 3,400 mods and over 8,300 mod parts, Windows only, with a shuffle mode, a texture and particle editor, and user uploads. It is not open source, and the site offers a donation to remove ads. If catalog size is what decides it for you, it is larger than ours. What it is not is a manager: it builds a pack, and putting that pack into the game folder, taking it back out and keeping track of what is in it stays your job.',
          ],
          [
            'd2mm (github.com/SebRut/d2mm)',
            'Open source under MIT, and genuinely early: install ordering and a package creator. Its last commit is from January 2015, which is five Dota engines and one whole game version ago. It does not work with the game as it ships today.',
          ],
          [
            'd2modmanager (github.com/philface)',
            'Open source, "without vpk injection", last touched in February 2015. Of historical interest.',
          ],
          [
            'Dota 2 SkinChanger (dota2changer.com)',
            'A website rather than a program: you pick mods in a browser, it generates a VPK pack, and you place that pack in the game folder yourself. Part of its collection is behind a paid tier. Nothing updates itself afterwards, and a pack built last month is the pack you keep.',
          ],
          [
            'Skin changers and inventory changers (Overplus, MetaSkins and the like)',
            'A different category of thing. They advertise unlocking items you do not own, they are closed source, with no public build anybody can check. Where this app adds a file next to the game and can take it back, these change the files of the game itself, and you have their word for what else they touch.',
          ],
          [
            'Umbrella and other cheat platforms',
            'Not a mod manager at all. Those sell scripts and automation that play parts of the match for you, which is the one thing in this whole area that Valve does ban accounts for. If a page offers you mods and scripts from the same download, close it.',
          ],
        ],
      },

      { k: 'h2', t: 'What this one is not best at', id: 'weak' },
      {
        k: 'list',
        items: [
          'Windows first. There is a Linux AppImage since 2.4.0, tested by one person on one desktop rather than by a year of use, and no Mac build at all.',
          'The catalog is smaller than the largest one out there. It is curated, previewed and open, which is a different trade.',
          'The installer is unsigned, so Windows warns about it on first run. <a href="~/docs/safe/#smartscreen">Why, and what to do</a>.',
          'It does not edit textures. Recolouring a mod is a job for the catalog\'s tools. <a href="~/docs/own-mods/#tools">Those</a>.',
        ],
      },

      { k: 'h2', t: 'Questions', id: 'faq' },
      {
        k: 'faq',
        items: [
          ['Can I run two managers at once?', 'Badly. Both write into the same folder and neither knows what the other did. This one at least notices foreign files and says so instead of overwriting them.'],
          ['I already installed mods with something else. Do I start over?', 'No. Point this at your game folder and it identifies what is there and takes it over. <a href="~/docs/own-mods/#adopt">How that works</a>.'],
          ['Which is safest?', 'The one whose code you can read and whose build you can check. That is a property of the tool, not a promise from its author.'],
        ],
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Russian
// ---------------------------------------------------------------------------

const ru: Record<Slug, Doc> = {
  uninstall: {
    slug: 'uninstall',
    title: 'Как удалить моды с Доты 2 и вернуть всё как было',
    h1: 'Как удалить моды в Доте 2',
    description:
      'Убрать один мод, выключить все разом или вернуть Доту 2 в исходный вид: через мод-менеджер и руками, вместе со шрифтами, курсорами и патчем схемы.',
    lead: 'Удалить мод значит три разных вещи: убрать один, погасить все на одну катку и не оставить следов совсем. Ниже все три и что при этом происходит с файлами.',
    card: 'Один мод, все моды сразу или полный откат к чистой игре. Шрифты, курсоры и патч тоже.',
    blocks: [
      { k: 'h2', t: 'Убрать один мод', id: 'one' },
      {
        k: 'steps',
        items: [
          ['Открой «Мои моды»', 'Там всё установленное, у каждого мода свой переключатель.'],
          ['Нажми «Удалить»', 'Файл уходит из папки игры, запись - из библиотеки. Игра возвращается к тому виду, что был до этого мода.'],
          ['Перезапусти Доту', 'Игра читает архивы при старте, поэтому уже запущенный клиент ничего не заметит.'],
        ],
      },

      { k: 'h2', t: 'Выключить - это не удалить', id: 'off' },
      {
        k: 'p',
        t: 'Если мод понадобится завтра, удалять его незачем. Переключатель рядом с модом гасит его: файл переименовывается, мод остаётся в библиотеке, обратно включается одним кликом. Отдельная кнопка гасит все моды разом - то, что нужно перед турнирной каткой или сразу после патча, когда ещё непонятно, что именно сломалось.',
      },

      { k: 'h2', t: 'Руками, без программы', id: 'manual' },
      {
        k: 'p',
        t: 'Мод - это файл pakNN_dir.vpk в языковой папке, которую монтирует игра. Удали файл, и мода нет.',
      },
      {
        k: 'steps',
        items: [
          [
            'Открой языковую папку',
            'Обычно <code>...\\steamapps\\common\\dota 2 beta\\game\\dota_russian</code>, и названа она по языку озвучки, а не интерфейса. <a href="~/docs/language/">Какая папка твоя</a>.',
          ],
          ['Посмотри на номера pak', 'Моды - это pak02_dir.vpk и до pak99_dir.vpk. Всё в этой папке, что не pak01, пришло со стороны.'],
          ['Удали лишние', 'Дырки в нумерации допустимы: игре всё равно, есть ли pak04, если есть pak05.'],
        ],
      },
      {
        k: 'note',
        t: 'Никогда не удаляй <code>pak01_dir.vpk</code> и лежащие рядом <code>pak01_NNN.vpk</code>. Это файлы самой игры, и после их удаления придётся чинить установку через Steam.',
      },

      { k: 'h2', t: 'Шрифты и курсоры', id: 'fonts' },
      {
        k: 'p',
        t: 'Эти двое не ложатся слоем поверх, а заменяют файлы, поэтому программа копирует оригиналы до установки и возвращает их при удалении мода. Если ставил шрифт руками и копию не делал, вернуть его поможет проверка целостности файлов в Steam.',
      },

      { k: 'h2', t: 'Вернуть чистую игру', id: 'reset' },
      {
        k: 'list',
        items: [
          'Выключи бесплатную косметику. Программа вернёт <code>gameinfo_branchspecific.gi</code> и <code>dota.signatures</code> из копий, снятых до первой записи.',
          'Удали всё в «Моих модах».',
          'Если что-то ставил руками, загляни в языковую папку: там могли остаться pakNN_dir.vpk.',
          'В Steam: свойства игры, «Установленные файлы», проверить целостность. Это вернёт всё, что принадлежит Valve.',
          'Саму программу можно удалить обычным путём, через «Установленные приложения» Windows.',
        ],
      },

      { k: 'h2', t: 'Вопросы', id: 'faq' },
      {
        k: 'faq',
        items: [
          ['Удаление мода уберёт косметику из инвентаря?', 'Нет. Программа не касается аккаунта Steam, инвентарь остаётся как был.'],
          [
            'Проверка целостности в Steam снесёт моды?',
            'Она возвращает файлы, которые принадлежат игре. Лишние pakNN_dir.vpk в языковой папке она обычно не трогает, так что если цель - убрать моды, удаляй их файлы сам.',
          ],
          [
            'Мод удалён, а в игре он всё ещё есть.',
            'Перезапусти игру полностью: архивы читаются при старте. Если не помогло, скорее всего те же файлы несёт второй мод. <a href="~/docs/vpk/">Как игра выбирает победителя</a>.',
          ],
        ],
      },
    ],
  },

  terrain: {
    slug: 'terrain',
    title: 'Как поставить терраин на Доту 2 в 2026 году',
    h1: 'Терраины: как поставить свой ландшафт в Доте 2',
    description:
      'Установка терраина на Дота 2 через мод-менеджер или руками, почему все гайды с -language tempcontent перестали работать в июле 2026 и как к ландшафту подходят деревья и река.',
    lead: 'Терраин - самый заметный мод в Доте и обычная причина, по которой человек вообще приходит в моддинг. Все гайды с первой страницы выдачи учат приёму, который умер 24 июля 2026 года.',
    card: 'Ландшафты, деревья и река. Почему -language tempcontent больше не работает и как ставить терраин сейчас.',
    blocks: [
      { k: 'h2', t: 'Что такое терраин', id: 'what' },
      {
        k: 'p',
        t: 'Ландшафт, он же терраин, меняет карту: землю, обрывы, деревья, реку, эффекты вокруг. Технически это обычный мод, архив VPK с моделями и текстурами, положенный поверх игровых. В каталоге ландшафты, деревья и река лежат отдельными категориями, потому что их часто мешают: земля от одного автора, деревья от другого.',
      },

      { k: 'h2', t: 'Почему старые гайды не работают', id: 'broken' },
      {
        k: 'p',
        t: 'Почти каждый гайд по терраинам учит одному и тому же: допиши <code>-language tempcontent</code> в параметры запуска и положи мод в папку <code>dota_tempcontent</code>. 24 июля 2026 года Дота перестала брать язык из этого аргумента. Оба языка теперь лежат в <code>game/dota/cfg/boot.vcfg</code>, а в путь поиска движок подставляет язык озвучки. Выдуманное значение вроде tempcontent больше не создаёт папку и не монтирует её, поэтому мод не грузится вообще.',
      },
      {
        k: 'p',
        t: 'Сам аргумент никуда не делся и язык по-прежнему ставит. Он просто больше не умеет придумывать папку из ничего. <a href="~/docs/language/">Вся история с языковой папкой</a>.',
      },

      { k: 'h2', t: 'Через программу', id: 'app' },
      {
        k: 'steps',
        items: [
          ['Открой «Ландшафты» в каталоге', 'У каждого терраина есть превью, так что видно, что берёшь, до того как оно окажется на диске.'],
          ['Нажми «Установить»', 'Программа скачает мод, положит его в свободный слот pak в ту папку, которую игра реально монтирует, и запомнит, что записала.'],
          ['Перезапусти Доту', 'Запущенный клиент мод не подхватит, закрой его полностью.'],
        ],
      },
      {
        k: 'p',
        t: 'Деревья, реку и шейдеры программа кладёт в слоты с меньшими номерами, чем сам ландшафт, потому что при совпадении файлов выигрывает меньший номер. Именно это позволяет держать землю одного автора под деревьями другого.',
      },

      { k: 'h2', t: 'Руками', id: 'manual' },
      {
        k: 'steps',
        items: [
          ['Найди свою языковую папку', 'Она названа по языку озвучки, а не интерфейса. <a href="~/docs/language/">Как понять, какая</a>.'],
          ['Переименуй файл', 'В свободный pakNN_dir.vpk, где NN - любое незанятое от 02 до 99. Никогда не 01.'],
          ['Положи и перезапусти игру', 'Это весь механизм. Без параметров запуска и без правки файлов игры.'],
        ],
      },

      { k: 'h2', t: 'Терраин, деревья и река вместе', id: 'combo' },
      {
        k: 'p',
        t: 'Эти трое пересекаются. Терраин со своими деревьями и отдельный мод на деревья несут одни и те же файлы, и выиграть может только один: тот, что лежит в слоте с меньшим номером. Программа говорит, какой именно, и даёт перетащить их в другом порядке. При установке руками это выясняется уже на карте.',
      },

      { k: 'h2', t: 'Что ломает терраин', id: 'breaks' },
      {
        k: 'list',
        items: [
          'Патч игры переписал файлы, на которых мод держался. Обычное дело, ради этого и существует восстановление.',
          'Поставлено два терраина сразу. Один из них ничего не делает.',
          'Мод лежит в папке, которую игра не монтирует: ровно то, к чему приводили старые гайды.',
          'Осталась папка <code>dota_tempcontent</code> с тех времён, и в ней лежат моды, которые ты считаешь установленными.',
        ],
      },

      { k: 'h2', t: 'Вопросы', id: 'faq' },
      {
        k: 'faq',
        items: [
          ['Терраины бесплатные?', 'Те, что в каталоге, - да. Valve тоже продаёт ландшафты, и мод их не заменяет: он меняет то, что видишь ты, а не то, чем владеет аккаунт.'],
          ['Другие игроки увидят мой терраин?', 'Нет. Его рисует твой клиент на твоём экране. У остальных карта та, которую поставили они.'],
          ['Сколько терраинов можно поставить?', 'Сколько угодно, но работать будет один. Остальные лучше выключить, чем оставлять спорить.'],
          ['Терраин влияет на фпс?', 'Может, в обе стороны. Некоторые тяжелее валвовского, а категория оптимизации в каталоге существует ровно для обратного.'],
        ],
      },
    ],
  },

  announcer: {
    slug: 'announcer',
    title: 'Как поставить аннонсера в Доте 2: моды и бесплатные',
    h1: 'Аннонсеры и озвучка в Доте 2',
    description:
      'Два способа сменить комментатора в Дота 2: мод с чужой озвучкой из каталога или аннонсер, который уже есть на аккаунте. Плюс мега-киллы, звуки героев и почему важна папка.',
    lead: 'Комментатор меняется двумя разными путями, и это не одно и то же. Один ставит чужую запись файлом, второй включает то, что тебе и так принадлежит.',
    card: 'Мод с озвучкой или аннонсер из инвентаря. Мега-киллы, звуки героев и зачем перезапуск.',
    blocks: [
      { k: 'h2', t: 'Два разных способа', id: 'two' },
      {
        k: 'cards',
        items: [
          [
            'Мод с озвучкой',
            'Кто-то записал набор фраз и упаковал их в VPK. Он меняет то, что ты слышишь, независимо от того, чем владеет аккаунт, и лежит в папке игры как любой другой мод.',
          ],
          [
            'Аннонсер, который уже твой',
            'Аннонсеры из наборов, боевых пропусков и дропов лежат без дела, потому что клиент показывает только то, что считает надетым. Это список, а не файл, и его можно поправить локально. <a href="~/docs/cosmetics/">Как устроена таблица предметов</a>.',
          ],
        ],
      },

      { k: 'h2', t: 'Ставим мод с озвучкой', id: 'mod' },
      {
        k: 'steps',
        items: [
          ['Открой «Комментаторы» в каталоге', 'У большинства есть превью, которое можно послушать до установки.'],
          ['Нажми «Установить»', 'Программа положит мод в свободный слот pak в ту папку, которую монтирует игра.'],
          ['Перезапусти Доту', 'Звук грузится при старте, как и всё остальное.'],
        ],
      },
      {
        k: 'note',
        t: 'Голос лежит в папке, названной по языку <b>озвучки</b>, а не интерфейса. Смена языка озвучки в настройках Доты уводит игру в другую папку, а твои моды с голосом остаются в старой. <a href="~/docs/language/">Почему так</a>.',
      },

      { k: 'h2', t: 'Мега-киллы и звуки героев', id: 'mega' },
      {
        k: 'p',
        t: 'Мега-киллы и звуковые паки героев работают так же и лежат в своих категориях каталога. С модом на аннонсера они спорят только тогда, когда несут одни и те же фразы, и программа об этом скажет.',
      },

      { k: 'h2', t: 'Вопросы', id: 'faq' },
      {
        k: 'faq',
        items: [
          ['Соперники слышат моего аннонсера?', 'Нет. Каждый слышит то, что надел сам.'],
          [
            'Мод встал, а ничего не поменялось.',
            'Две обычные причины: игру не перезапустили полностью, или мод уехал в языковую папку, которую твоя игра не монтирует. <a href="~/docs/troubleshooting/">Разбор по симптомам</a>.',
          ],
          ['Можно совмещать аннонсера с мега-киллами?', 'Да, пока они не несут одни и те же файлы. Если несут, программа скажет.'],
        ],
      },
    ],
  },

  language: {
    slug: 'language',
    title: 'Папка dota_russian и почему -language mods не работает',
    h1: 'Языковая папка: куда на самом деле кладутся моды',
    description:
      'Какую папку монтирует Дота 2 после патча 24 июля 2026: UILanguage и AudioLanguage в boot.vcfg, почему dota_tempcontent больше не создаётся и как найти свою папку.',
    lead: 'Все моды для Доты живут в папке, названной по языку. Какая именно - решает файл настроек игры, а не параметр запуска, и это поменялось 24 июля 2026 года.',
    card: 'boot.vcfg, UILanguage против AudioLanguage и почему выдуманная папка больше не монтируется.',
    blocks: [
      { k: 'h2', t: 'Откуда берётся имя папки', id: 'name' },
      {
        k: 'p',
        t: 'В путях поиска Доты есть запись с подстановкой языка, и при старте движок подставляет туда настоящее значение. Какое бы оно ни было, папка <code>game/dota_&lt;значение&gt;</code> монтируется, и всё, что в ней лежит, грузится поверх игровых архивов. На этом механизме и держатся моды. Ничего не патчится и никуда не внедряется: в папку, куда движок и так смотрит, добавляется ещё один архив.',
      },

      { k: 'h2', t: 'Языка два, а не один', id: 'two' },
      {
        k: 'p',
        t: 'Июльский патч 2026 года разделил настройку надвое и перенёс обе в <code>game/dota/cfg/boot.vcfg</code>:',
      },
      { k: 'code', t: '"boot"\n{\n\t"UILanguage"    "russian"\n\t"AudioLanguage" "russian"\n}' },
      {
        k: 'p',
        t: 'Здесь важен <b>AudioLanguage</b>. Именно его движок подставляет в путь поиска, поэтому смена языка озвучки просит перезапуск, а смена языка интерфейса нет. Текст интерфейса лежит в игровом pak01 сразу на всех языках, и своей папки у него никогда не было.',
      },

      { k: 'h2', t: 'Почему -language mods перестал работать', id: 'dead' },
      {
        k: 'p',
        t: 'Старый трюк держался на том, что аргумент принимал что угодно. Ты писал <code>-language mods</code> или <code>-language tempcontent</code>, движок подставлял это слово в путь поиска, и появлялась папка, куда можно было спрятать моды подальше от настоящих языковых. Теперь значение берётся из boot.vcfg, а слово, которого Дота не знает как язык озвучки, не даёт ничего. Папка не создаётся, не монтируется, и моды в ней не грузятся.',
      },
      {
        k: 'p',
        t: 'Аргумент работает и язык по-прежнему ставит. Он просто больше не выдумывает папку. Каждый гайд, который до сих пор учит этому шагу, отправляет людей в каталог, который игра никогда не откроет, и это самая частая причина, по которой правильно поставленный мод ничего не делает.',
      },

      { k: 'h2', t: 'Как найти свою папку', id: 'find' },
      {
        k: 'steps',
        items: [
          ['Открой папку игры', 'Steam, правой кнопкой по Dota 2, «Управление», «Просмотреть локальные файлы», дальше в <code>game</code>.'],
          ['Посмотри на папки dota_', 'Там будет <code>dota</code> и одна или несколько <code>dota_&lt;язык&gt;</code>. Монтируется та, что совпадает с AudioLanguage в boot.vcfg.'],
          ['Сомневаешься - открой boot.vcfg', 'Это текстовый файл в <code>game/dota/cfg/</code>. Читаешь AudioLanguage, и вот ответ.'],
        ],
      },
      {
        k: 'note',
        t: 'Ни одной папки <code>dota_</code> нет? Значит озвучка английская, а для неё Valve папку не поставляет: английская речь лежит внутри базовой игры. Создать папку самому тоже нельзя, а переключение озвучки на русскую, корейскую или китайскую английских голосов тебя не лишает. <a href="~/docs/install/#english">Весь случай целиком</a>.',
      },
      {
        k: 'p',
        t: 'Программа делает это за тебя и показывает папку, в которую пишет. В первый раз туда стоит взглянуть.',
      },

      { k: 'h2', t: 'Если сменить язык озвучки', id: 'switch' },
      {
        k: 'p',
        t: 'Игра начинает монтировать другую папку, а все поставленные моды остаются в старой. Ничего не пропало и не сломалось, игра просто смотрит в другое место. Программа умеет перенести моды, когда это замечает; руками это перенос файлов pakNN в новую папку.',
      },

      { k: 'h2', t: 'Вопросы', id: 'faq' },
      {
        k: 'faq',
        items: [
          [
            'На каких языках у Доты есть озвучка?',
            'На четырёх, и этот список никак не связан с двадцатью девятью языками перевода интерфейса. Папка есть у трёх: <code>dota_russian</code>, <code>dota_koreana</code>, <code>dota_schinese</code>. Английский четвёртый, и папки у него нет, потому что английская речь лежит внутри базовой игры. <a href="~/docs/install/#english">Что делать, если озвучка английская</a>.',
          ],
          ['Можно ли всё-таки держать моды в отдельной папке?', 'Придумав ей имя - нет. Моды кладутся в ту языковую папку, которую игра и так монтирует, в свои слоты pak. Это то, что делает программа.'],
          ['Надо ли править gameinfo.gi?', 'Нет. Гайды, которые учат его править, заходят к той же проблеме с другой стороны, и менять файл, который клиент проверяет, - обмен хуже, чем воспользоваться папкой, которая и так работает.'],
        ],
      },
    ],
  },

  'own-mods': {
    slug: 'own-mods',
    title: 'Свои моды в Доте 2: поставить .vpk, распаковать, собрать',
    h1: 'Свои моды: поставить, распаковать, объединить',
    description:
      'Как поставить свой .vpk в Дота 2, забрать целую папку старых модов, распаковать установленный мод обратно в файлы и объединить несколько модов в один слот pak.',
    lead: 'Каталог - не единственный источник. Программа берёт любой VPK, узнаёт то, что уже лежит в папке игры, и разбирает моды обратно на файлы, из которых они собраны.',
    card: 'Свой .vpk, папка со старыми модами, распаковка, объединение и разбор паков.',
    blocks: [
      { k: 'h2', t: 'Поставить свой .vpk', id: 'vpk' },
      {
        k: 'p',
        t: 'Перетащи файл в окно или нажми импорт. Программа прочитает, что внутри, поймёт, что мод меняет и каких героев трогает, придумает ему имя, если своего нет, и положит в свободный слот pak. Дальше он ведёт себя как всё остальное в библиотеке: выключается, переставляется в порядке, переживает патчи.',
      },

      { k: 'h2', t: 'Целую папку разом', id: 'folder' },
      {
        k: 'p',
        t: 'Если ты давно ставишь моды руками, укажи программе папку, где они лежат, и она заберёт из неё все архивы за один раз, а не попросит добавлять их по одному. Смотрит она и на несколько уровней вглубь: паки от других инструментов распаковываются в целое дерево игры, и нужный файл лежит где-то внутри.',
      },

      { k: 'h2', t: 'Папка без архива: свой мод из сырых файлов', id: 'pack' },
      {
        k: 'p',
        t: 'Укажи папку, где лежат не VPK, а сами файлы игры, и программа соберёт из них архив сама и тут же его поставит. Это случай автора, который не закрывает ни один установщик: ты правишь файлы в рабочей папке, и указать инструменту было не на что. Именем мода становится имя папки.',
      },
      {
        k: 'p',
        t: 'Где начинается контент, она определяет сама, поэтому и обёртка, оставшаяся от распаковки, и путь игрового вида <code>МойМод/game/dota_russian/models/</code> сводятся к одному и тому же архиву. Твои собственные папки рядом с игровыми тоже поедут внутрь.',
      },

      { k: 'h2', t: 'Программа узнаёт моды, поставленные руками', id: 'adopt' },
      {
        k: 'p',
        t: 'Она считает отпечатки того, что уже лежит в папке игры, и сверяет их с каталогом. Где нашлось совпадение - говорит, что это за мод, и предлагает взять его под управление, так что чужая папка превращается в библиотеку, которую можно читать. То, что не опознано, тоже показывается списком, а не затирается молча.',
      },

      { k: 'h2', t: 'Распаковать мод обратно в файлы', id: 'unpack' },
      {
        k: 'p',
        t: 'Установленный мод можно распаковать обратно в папку с его файлами. С этого начинается правка чужого мода, и это же самый быстрый способ увидеть, что мод трогает на самом деле, когда описание расплывчатое.',
      },

      { k: 'h2', t: 'Объединить и разобрать', id: 'packs' },
      {
        k: 'p',
        t: 'Несколько модов складываются в один пак, а пак разбирается обратно на моды, из которых собран. Полезно, когда кончаются слоты, и полезно, когда набор модов должен ходить вместе как одна вещь.',
      },

      { k: 'h2', t: 'Инструменты, которыми моды делают', id: 'tools' },
      {
        k: 'p',
        t: 'Сделать мод, а не поставить, значит декомпилировать игровой ресурс, отредактировать, скомпилировать обратно и запаковать в VPK. Инструменты для этого лежат в разделе Tools каталога и ставятся прямо из программы, а вики каталога - документация ко всему конвейеру. <a href="~/docs/catalog/">Откуда это всё</a>.',
      },

      { k: 'h2', t: 'Вопросы', id: 'faq' },
      {
        k: 'faq',
        items: [
          ['Можно поставить мод из zip?', 'Да. Из каталога они часто приходят именно так, и программа распаковывает их сама.'],
          ['Мой мод переживёт патч Доты?', 'Так же, как любой другой. Патч переписывает файлы под ним, а восстановление возвращает архивы на место.'],
          ['Можно поделиться модом, который я сделал?', 'Каталог принимает работы, а его Discord - место, где этот разговор происходит.'],
        ],
      },
    ],
  },

  catalog: {
    slug: 'catalog',
    title: 'Каталог D2PFX: что это и кто его ведёт',
    h1: 'Каталог D2PFX',
    description:
      'Открытый каталог модов для Доты 2, из которого программа ставит моды: сколько модов, какие категории, кто его ведёт, где вики и Discord и почему приложение читает его напрямую.',
    lead: 'Все моды, которые ставит эта программа, лежат в одном месте, и это место сделал не я. Страница о том, что это за каталог, кто его ведёт и почему он лучшая открытая коллекция модов для Доты.',
    card: 'Кто такой h6rd, что внутри каталога, вики и инструменты, и как с ним связана программа.',
    blocks: [
      { k: 'h2', t: 'Что это', id: 'what' },
      {
        k: 'p',
        t: 'D2PFX - открытый каталог косметических модов для Доты 2, который ведёт <b>h6rd</b> вместе с сообществом. {mods} {modsWord} в {categories} {categoriesWord}: скины на героев, предметы, ландшафты, деревья, река, шейдеры, эффекты, курьеры, варды, аннонсеры, музыка, курсоры, шрифты, Рошан, мега-киллы. У каждого мода есть превью, теги, которые говорят, что он меняет на самом деле, автор и дата. Каталогу больше года, и он растёт своим ходом, а не релизами.',
      },
      {
        k: 'p',
        t: 'D2PFX - это сокращение от полного названия каталога, оно написано целиком в <a href="https://github.com/h6rd/Dota2PornFxWeb">его репозитории</a>. Сокращение используется потому, что поисковики и видеоплатформы читают полное название как взрослый контент и тихо прячут страницу, которая его несёт. От этого не выигрывает никто, и меньше всех - авторы этих модов.',
      },

      { k: 'h2', t: 'Что в нём сейчас', id: 'inside' },
      { k: 'p', t: 'Посчитано по каталогу в момент сборки этой страницы:' },
      { k: 'categories' },

      { k: 'h2', t: 'Почему именно он', id: 'why' },
      {
        k: 'list',
        items: [
          '<b>Он открытый.</b> Сайт и данные лежат в публичном репозитории на GitHub под GPL-3.0. Список модов - обычный JSON, который может прочитать что угодно. Именно так его и читает эта программа.',
          '<b>Он живой.</b> Моды появляются постоянно. Коллекция, которая обновляется дважды в год, - другой по сути объект.',
          '<b>Он разложен.</b> Категории, разбивка по героям, теги про настоящее изменение, а не про рекламу, и превью почти у всего.',
          '<b>Он себя документирует.</b> Вики учит делать моды, а не только ставить их.',
          '<b>В нём есть инструменты.</b> Раздел Tools: утилиты для VPK, компилятор и патчер, от того же автора.',
        ],
      },

      { k: 'h2', t: 'Вики, и это лучшая его часть', id: 'wiki' },
      {
        k: 'p',
        t: 'Большинство сайтов с модами объясняют, куда положить файл. Вики каталога объясняет, как этот файл сделан: декомпилировать игровой ресурс, отредактировать, скомпилировать обратно, запаковать в VPK, и в какой папке внутри архива должен лежать каждый тип ресурса, чтобы движок его нашёл. Иконки, звуки, стили и шрифты лежат в разных местах, и компилировать нужно не всё. Если хочется перестать ставить чужие моды и начать делать свои - идти туда.',
      },

      { k: 'h2', t: 'Как с ним связана программа', id: 'link' },
      {
        k: 'list',
        items: [
          'Она читает данные каталога по сети, поэтому мод, добавленный сегодня, ставится сегодня - без обновления программы и без нового релиза.',
          'Файлы модов она качает с адресов самого каталога. Здесь ничего не перезалито.',
          'Раздел Tools ставится прямо из программы.',
          'Она сверяет отпечатки модов, уже лежащих в папке игры, с каталогом - так она и может сказать, что за файл ты поставил руками.',
          'Сам менеджер лежит в разделе Tools этого каталога.',
        ],
      },

      { k: 'h2', t: 'Уважение и его границы', id: 'credit' },
      {
        k: 'p',
        t: 'Каталог и моды в нём принадлежат тем, кто их сделал. Эта программа их только ставит и денег за это не берёт ни с кого. Если ты автор чего-то показанного здесь и хочешь другую подпись или чтобы это убрали - быстрее всего через Discord, и так и будет.',
      },

      { k: 'h2', t: 'Вопросы', id: 'faq' },
      {
        k: 'faq',
        items: [
          [
            'Это официальное приложение каталога?',
            'Нет. Каталог и программа - разные проекты разных людей. Менеджер лежит в разделе Tools каталога, но каталог живёт сам по себе, а программа читает его как открытые данные.',
          ],
          [
            'Почему он так называется?',
            'Автор назвал его так много лет назад, и под этим именем его знают. К содержимому это отношения не имеет: внутри косметические моды для Доты 2, разложенные по героям и категориям.',
          ],
          ['Можно ставить моды из каталога руками?', 'Да. Скачай файл с сайта и переименуй в свободный слот pak. <a href="~/docs/install/#manual">Как это делается</a>.'],
          ['Программа работает без каталога?', 'Со своими файлами - да. <a href="~/docs/own-mods/">Как поставить свой .vpk</a>. Каталог - это то, откуда берётся коллекция, которую можно листать.'],
        ],
      },
    ],
  },

  compare: {
    slug: 'compare',
    title: 'Какой мод-менеджер для Доты 2 выбрать в 2026',
    h1: 'Как выбрать мод-менеджер для Доты 2',
    description:
      'Что проверить до запуска любой программы для модов Дота 2: исходники, кто собрал файл, что она просит, живой ли у неё каталог. С честными ответами про эту программу и про остальные.',
    lead: 'Ты собираешься пустить программу писать в папку с игрой. Пять вопросов решают, разумно ли это, и они одни и те же, что бы ты в итоге ни поставил.',
    card: 'Пять вопросов к любой программе для модов, с ответами про эту и про остальные.',
    blocks: [
      { k: 'h2', t: 'Пять вопросов', id: 'questions' },
      {
        k: 'cards',
        items: [
          ['Можно ли прочитать исходники?', 'Не «исходники по запросу». Репозиторий, который открывается прямо сейчас, с кодом, из которого собран релиз.'],
          ['Кто собрал файл, который ты скачал?', 'У публичного CI остаётся лог, который может открыть кто угодно. У файла, залитого с чьего-то компьютера, остаётся только его слово.'],
          ['Что программа просит?', 'Установщику модов нужна папка игры. Ему не нужен логин Steam, инвентарь или пароль. Всё, что их просит, занимается не установкой файлов.'],
          ['Откуда её моды?', 'Коллекция, вшитая в сборку, стареет вместе со сборкой. Прочитанная по сети растёт без чьих-либо релизов.'],
          ['Что будет, если два мода столкнутся?', 'Два мода с одним файлом не могут примениться оба. Менеджер, который об этом молчит, оставляет тебя выяснять это по карте.'],
        ],
      },

      { k: 'h2', t: 'Ответы про эту', id: 'here' },
      {
        k: 'list',
        items: [
          '<b>Исходники:</b> GPL-3.0, весь репозиторий, каждый релиз с тегом.',
          '<b>Сборка:</b> GitHub Actions, workflow и логи публичные.',
          '<b>Просит:</b> папку игры. Вход через Discord необязателен и нужен только чтобы подписать своим ником сборку, которой делишься.',
          '<b>Моды:</b> читаются вживую из каталога D2PFX, {mods} штук. <a href="~/docs/catalog/">Что это</a>.',
          '<b>Конфликты:</b> называются на экране, порядок загрузки правится там же.',
          '<b>Цена:</b> бесплатно, платного внутри нет, рекламы нет.',
        ],
      },

      { k: 'h2', t: 'Остальные', id: 'others' },
      {
        k: 'p',
        t: 'Так, как о себе говорят они сами: это единственный честный способ поставить чужую программу на свою страницу.',
      },
      {
        k: 'cards',
        items: [
          [
            'DOTA Mods Installer (dota2mods.com)',
            'Самый крупный. На своём сайте заявляет больше 3400 модов и больше 8300 частей модов, только Windows, режим случайного выбора, редактор текстур и частиц, загрузка своих работ. Исходников нет, на сайте есть пожертвование за отключение рекламы. Если решает размер каталога, у него он больше нашего. Чего он не делает, так это не управляет модами: он собирает пак, а положить его в игру, убрать обратно и помнить, что внутри, остаётся твоей заботой.',
          ],
          [
            'd2mm (github.com/SebRut/d2mm)',
            'Открытый код под MIT, и по-настоящему ранний: порядок установки и сборка пакетов. Последний коммит - январь 2015 года, это пять движков Доты назад. С сегодняшней игрой он не работает.',
          ],
          [
            'd2modmanager (github.com/philface)',
            'Открытый код, «без инъекции vpk», последняя правка - февраль 2015 года. Представляет исторический интерес.',
          ],
          [
            'Dota 2 SkinChanger (dota2changer.com)',
            'Не программа, а сайт: моды выбираются в браузере, он собирает VPK-пак, а класть его в папку игры ты идёшь сам. Часть коллекции платная. Дальше ничего не обновляется: собранный месяц назад пак таким у тебя и остаётся.',
          ],
          [
            'Скинченджеры и инвентарь-ченджеры (Overplus, MetaSkins и подобные)',
            'Другая категория вещей. Они обещают открыть предметы, которыми ты не владеешь, у них закрытый код и нет публичной сборки, которую можно проверить. Разница простая: эта программа кладёт файл рядом с игрой и умеет его забрать, а они меняют файлы самой игры, и что там ещё затронуто, известно только с их слов.',
          ],
          [
            'Umbrella и прочие читы',
            'Это вообще не мод-менеджеры. Там продают скрипты и автоматизацию, которые играют за тебя, и это единственное во всей теме, за что Valve действительно банит аккаунты. Если на одной странице предлагают и моды, и скрипты, эту страницу лучше закрыть.',
          ],
        ],
      },

      { k: 'h2', t: 'В чём эта программа не лучшая', id: 'weak' },
      {
        k: 'list',
        items: [
          'Сначала Windows. С версии 2.4.0 есть AppImage под Linux, но его проверил один человек на одном рабочем столе, а не год использования. Сборки под Mac нет вовсе.',
          'Каталог меньше самого крупного из существующих. Он отобранный, с превью и открытый - это другой обмен.',
          'Установщик не подписан, поэтому Windows ругается при первом запуске. <a href="~/docs/safe/#smartscreen">Почему и что делать</a>.',
          'Она не редактирует текстуры. Перекрасить мод - работа для инструментов каталога. <a href="~/docs/own-mods/#tools">Вот они</a>.',
        ],
      },

      { k: 'h2', t: 'Вопросы', id: 'faq' },
      {
        k: 'faq',
        items: [
          ['Можно держать два менеджера сразу?', 'Плохо получится. Оба пишут в одну папку, и ни один не знает, что сделал другой. Этот хотя бы замечает чужие файлы и говорит о них, а не затирает.'],
          ['Я уже ставил моды другой программой. Начинать заново?', 'Нет. Укажи эту на папку игры, и она опознает, что там лежит, и возьмёт под управление. <a href="~/docs/own-mods/#adopt">Как это работает</a>.'],
          ['Какой безопаснее?', 'Тот, чей код можно прочитать и чью сборку можно проверить. Это свойство инструмента, а не обещание его автора.'],
        ],
      },
    ],
  },
};

export const moreDocs = { en, ru };
