/**
 * The docs pages, in both languages.
 *
 * Why these five and not a manual: each one answers a question people actually type into a
 * search box, and the landing page cannot answer any of them without becoming a wall. The
 * install page exists because every guide ranking for that question today teaches the
 * `-language mods` launch option, which Dota stopped honouring on 2026-07-24 when it moved
 * the folder name into boot.vcfg. Being the page that says so is worth more than being the
 * tenth page that repeats the old trick.
 *
 * Everything technical here is read off our own code rather than remembered: pak slots from
 * installer.js (allocatePak), the search-path patch from patcher.js, the language folder from
 * gamelang.js. If those change, these pages are wrong and have to change with them.
 *
 * Links inside copy start with "~/" and the layout turns that into "/" or "/ru/", so one
 * string serves both languages.
 */

export type Block =
  | { k: 'p'; t: string }
  | { k: 'h2'; t: string; id: string }
  | { k: 'note'; t: string }
  | { k: 'steps'; items: Array<[string, string]> }
  | { k: 'list'; items: string[] }
  | { k: 'cards'; items: Array<[string, string]> }
  | { k: 'code'; t: string }
  | { k: 'faq'; items: Array<[string, string]> };

export interface Doc {
  slug: string;
  /** <title>: the words somebody types, not a clever name. */
  title: string;
  h1: string;
  description: string;
  lead: string;
  /** Card text on the docs index. */
  card: string;
  blocks: Block[];
}

export interface DocsIndex {
  title: string;
  h1: string;
  description: string;
  lead: string;
}

/** Order matters: it is the order on the index and in the "read next" row. */
export const docSlugs = ['install', 'vpk', 'safe', 'cosmetics', 'troubleshooting'] as const;
export type DocSlug = (typeof docSlugs)[number];

export const docsIndex: Record<'en' | 'ru', DocsIndex> = {
  en: {
    title: 'Dota 2 modding guides: install, VPK, free cosmetics',
    h1: 'Guides',
    description:
      'How Dota 2 mods work and how to install them on Windows: pak slots and load order, VPK files, the item schema, and what to do after a game patch.',
    lead: 'Five pages on how Dota 2 modding actually works. Written against the game as it is in 2026, not as it was when the tutorials on page one were published.',
  },
  ru: {
    title: 'Гайды по модам Dota 2: установка, VPK, косметика',
    h1: 'Гайды',
    description:
      'Как устроены моды для Dota 2 и как их поставить: слоты pak и порядок загрузки, файлы VPK, таблица предметов и что делать после патча игры.',
    lead: 'Пять страниц о том, как моддинг Доты работает на самом деле. По игре образца 2026 года, а не той, при которой писались гайды из топа выдачи.',
  },
};

// ---------------------------------------------------------------------------
// English
// ---------------------------------------------------------------------------

const en: Record<DocSlug, Doc> = {
  install: {
    slug: 'install',
    title: 'How to install Dota 2 mods in 2026',
    h1: 'How to install Dota 2 mods',
    description:
      'Install steps that work in 2026: three clicks with the app, or by hand with a pakNN_dir.vpk file. Plus why -language mods stopped working in July.',
    lead: 'Most guides still teach a launch option Valve stopped honouring in July 2026. Both methods below work on the game as it ships today, one with a program and one without.',
    card: 'Three clicks with the app, or the file work by hand. Plus the launch option that no longer does anything.',
    blocks: [
      {
        k: 'note',
        t: 'If a guide tells you to put <code>-language mods</code> in your Steam launch options, it was written before 24 July 2026. Dota now reads that folder name from its own settings file and ignores the argument. A folder called <code>dota_mods123</code> will never mount again.',
      },

      { k: 'h2', t: 'The three-click way', id: 'app' },
      {
        k: 'p',
        t: 'Dota 2 Mod Manager does the file work and keeps a record of it, which is what lets you switch a mod off before a match instead of deleting it and finding it again later.',
      },
      {
        k: 'steps',
        items: [
          [
            'Download and run the installer',
            'Windows 10 or 11, no account. Windows will call the publisher unknown, because the installer carries no paid signature. Click <b>More info</b>, then <b>Run anyway</b>. <a href="~/docs/safe/">The reason it says that</a>.',
          ],
          [
            'Let it find Dota',
            'It reads your Steam library and points itself at the game folder. If Dota sits on a second drive, pick the folder once and it remembers.',
          ],
          [
            'Open the catalog and press Install',
            'It downloads the mod, gives it a free pak slot in the folder your game actually mounts, and tells you if another installed mod carries the same file.',
          ],
          [
            'Start the game',
            'From the app or from Steam, both work. To take a mod off, switch it off under My mods and start Dota again.',
          ],
        ],
      },

      { k: 'h2', t: 'By hand, one mod', id: 'manual' },
      {
        k: 'p',
        t: 'You need the .vpk file and the name of the folder Dota mounts for your audio language. Since the July 2026 update those are two different settings, and the one that decides the folder is the audio one.',
      },
      {
        k: 'steps',
        items: [
          [
            'Read your audio language',
            'Open <code>game\\dota\\cfg\\boot.vcfg</code> inside the Dota folder in any text editor and find <code>AudioLanguage</code>. That word is your folder suffix.',
          ],
          [
            'Open the matching folder',
            'Russian audio means <code>game\\dota_russian\\</code>, German means <code>game\\dota_german\\</code>, and so on through the languages Valve recorded voice for. The folder already holds <code>pak01_dir.vpk</code> and its numbered parts; leave those where they are, they are Valve\'s localized voice. <b>English audio has no folder at all</b>, which is its own case: see below.',
          ],
          [
            'Rename the mod and drop it in',
            'Call it <code>pak02_dir.vpk</code>. If 02 is taken, go up: 03, 04, and onward to 99. When two mods carry the same file, the lower number wins.',
          ],
          [
            'Restart Dota all the way',
            'Close it from Steam, not just to the menu. The game reads that folder once at startup.',
          ],
        ],
      },
      {
        k: 'p',
        t: 'That holds until it stops. A game patch can clear the folder, two mods can carry the same texture and cancel each other with no message, and nothing on disk records which mod a given <code>pak14_dir.vpk</code> came from. Those three are the parts a manager exists to remember for you. <a href="~/docs/vpk/">What the numbering means</a>.',
      },

      { k: 'h2', t: 'English audio is its own case', id: 'english' },
      {
        k: 'p',
        t: 'English speech lives inside <code>dota/pak01</code>, so Valve ships no <code>dota_english</code> folder: there would be nothing to put in it. With English audio selected there is nowhere for a mod to go.',
      },
      {
        k: 'p',
        t: 'Making the folder yourself is not enough either. Each of Valve\'s language folders carries its own <code>gameinfo.gi</code> that layers it onto <code>dota</code>, and a folder without that file is one the engine never looks in.',
      },
      {
        k: 'p',
        t: 'One way out is to build the layer properly: create <code>game\\dota_english\\</code> and save this inside it as <code>gameinfo.gi</code>. It writes a new file in a new folder and touches nothing Valve shipped.',
      },
      {
        k: 'code',
        t: '"GameInfo"\n{\n\tLayeredOnMod\tdota\n\n\tFileSystem\n\t{\n\t\tSearchPaths\n\t\t{\n\t\t\tGame\t\t\tdota_english\n\t\t\tGame\t\t\tdota\n\t\t\tGame\t\t\tcore\n\n\t\t\tMod\t\t\t\tdota_english\n\t\t\tMod\t\t\t\tdota\n\n\t\t\tAddonRoot\t\tdota_addons\n\n\t\t\tPublicContent\tcore\n\t\t}\n\t}\n}',
      },
      {
        k: 'p',
        t: 'The other way creates nothing at all. Leave the audio language on one that has a real folder, keep the mods there, and rename Valve\'s <code>pak01_dir.vpk</code> inside it. The speech falls back to the English in <code>dota/pak01</code> and every mod stays mounted. Only the index has to move: the numbered volumes beside it are unreadable without it, so you rename a few hundred kilobytes and leave the gigabytes where they are. Rename it back to undo, or verify the game files in Steam.',
      },

      { k: 'h2', t: 'Free cosmetics take one more step', id: 'schema' },
      {
        k: 'p',
        t: 'A mod in a language folder can replace any ordinary asset and never the item list. Dota resolves its MOD search path to <code>game\\dota</code> alone, so <code>scripts/items/items_game.txt</code> stays out of reach from there. Unlocking couriers, wards or announcers means registering a second content folder in <code>gameinfo_branchspecific.gi</code> and writing the patched file\'s hash into <code>dota.signatures</code>, which the client verifies when it starts. <a href="~/docs/cosmetics/">How the item table works</a>.',
      },

      { k: 'h2', t: 'Taking a mod back off', id: 'remove' },
      {
        k: 'list',
        items: [
          'In the app: switch the mod off to keep it in your library, or delete it to remove the file. Fonts and cursors come back from the copy made before installing.',
          'By hand: delete the <code>pakNN_dir.vpk</code> you added, along with any <code>pakNN_000.vpk</code> parts that share its number.',
          'To undo everything at once, use <b>Verify integrity of game files</b> in Steam. It restores Valve\'s files and leaves your Steam inventory untouched.',
        ],
      },

      { k: 'h2', t: 'Questions', id: 'faq' },
      {
        k: 'faq',
        items: [
          [
            'Do I need to reinstall mods after every Dota patch?',
            'Sometimes. A patch that rewrites the game folder can drop what you put there. The app checks on startup and puts back what went missing; by hand, you copy the files in again.',
          ],
          [
            'Can other players see my mods?',
            'No. Every file involved lives on your machine and changes what your client draws. Nothing about it reaches the match.',
          ],
          [
            'Does -language mods still work?',
            'No. Dota took the folder name out of the launch arguments on 24 July 2026 and now reads it from <code>boot.vcfg</code>. Guides that still teach it were written earlier and nobody updated them.',
          ],
          [
            'Where do I get the mods themselves?',
            'The Dota2PornFx catalog is the largest collection, and the app reads it directly, so new mods appear without an app update. You can also install any .vpk you already have.',
          ],
        ],
      },
    ],
  },

  vpk: {
    slug: 'vpk',
    title: 'Dota 2 VPK files and pak load order explained',
    h1: 'What a VPK is and which one Dota loads',
    description:
      'What VPK archives are, why Dota 2 mods are named pak02_dir.vpk through pak99, which mod wins when two carry the same file, and where gameinfo.gi fits.',
    lead: 'Everything Dota ships sits inside VPK archives. A mod is another one of those, slotted in ahead of the game\'s own. The number in its name decides who wins an argument.',
    card: 'Archives, pak numbers and the search paths. Why one mod covers another, and how the engine decides.',
    blocks: [
      { k: 'h2', t: 'The archive', id: 'archive' },
      {
        k: 'p',
        t: 'VPK stands for Valve Pak. One archive holds thousands of files with their paths intact, so <code>models/heroes/juggernaut/juggernaut.vmdl_c</code> inside the archive answers to that path in the game. Big archives split in two parts: a <code>_dir.vpk</code> index that lists what is where, and numbered <code>_000.vpk</code>, <code>_001.vpk</code> data files holding the bytes. Move the index without its parts and you get an archive that points at nothing.',
      },
      {
        k: 'p',
        t: 'A Dota mod is a small VPK carrying a handful of replacement files under exactly the paths the originals use. The engine never compares them. It takes the first copy it finds.',
      },

      { k: 'h2', t: 'Where "first" comes from', id: 'order' },
      {
        k: 'p',
        t: 'Inside a mounted folder, Dota walks the pak archives in numeric order and stops at the first hit. <code>pak02</code> is read before <code>pak30</code>, so a file present in both comes from <code>pak02</code>. That is the whole rule, and it is why installing a mod means renaming it to a free number rather than dropping it in with the name its author gave it.',
      },
      {
        k: 'cards',
        items: [
          ['pak01_*', 'Valve\'s own. In a language folder it holds localized voice. Renaming or deleting it breaks the game.'],
          ['pak02 to pak09', 'Where a mod goes when you want it to beat the others. The app puts anything you mark as priority here.'],
          ['pak10 to pak99', 'Ordinary mods, first free number wins. Ninety-eight slots is more than anybody fills.'],
          ['pak00', 'Never mounted. The app parks an archive here for a moment while swapping two mods, so a crash mid-swap leaves nothing half-installed.'],
        ],
      },
      {
        k: 'p',
        t: 'Two mods that touch different heroes never meet, and you can run a hundred of them. Two Juggernaut sets in the same slot range will collide over the same model file, and only one of them shows up. Nothing warns you: the hero simply looks like the other mod.',
      },

      { k: 'h2', t: 'Which folder gets mounted', id: 'folder' },
      {
        k: 'p',
        t: 'Dota mounts <code>game\\dota</code>, <code>game\\core</code>, and one folder named after your audio language, such as <code>game\\dota_russian</code>. Until July 2026 you could invent that suffix with a <code>-language</code> launch argument, which is where the old advice to make a <code>dota_mods</code> folder comes from. Dota now takes the value from <code>game\\dota\\cfg\\boot.vcfg</code> instead, and a folder that matches no real language stays unmounted.',
      },
      {
        k: 'code',
        t: '"boot"\n{\n\t"UILanguage"     "english"\n\t"AudioLanguage"  "russian"\n}',
      },
      {
        k: 'p',
        t: 'Read <code>AudioLanguage</code>, not <code>UILanguage</code>. The engine substitutes the audio one into the search path, which is also why changing your voice language asks for a restart while changing menu text does not.',
      },

      { k: 'h2', t: 'The one file a language folder cannot touch', id: 'schema' },
      {
        k: 'p',
        t: 'The list of every cosmetic in the game, <code>scripts/items/items_game.txt</code>, is read through a search path called MOD, and MOD resolves to <code>game\\dota</code> and nothing else. Drop a modified copy into a language folder and the game reads straight past it.',
      },
      {
        k: 'p',
        t: 'Getting a file in there means editing <code>game\\dota\\gameinfo_branchspecific.gi</code> to register another content folder, then adding that file\'s SHA1 and CRC to <code>game\\bin\\win64\\dota.signatures</code>, because the client checks the file against that list before it loads. Both files belong to Valve and both get overwritten by updates. <a href="~/docs/cosmetics/">What people do with it</a>.',
      },

      { k: 'h2', t: 'Questions', id: 'faq' },
      {
        k: 'faq',
        items: [
          [
            'Can I open a VPK and see what is inside?',
            'Yes. Dota 2 Mod Manager lists the paths in any mod you install and names the heroes and slots it touches. Outside the app, ValveResourceFormat reads Source 2 archives.',
          ],
          [
            'Why did my mod stop working when I installed another one?',
            'They carry the same file and the lower pak number won. Give the one you want the lower number, or drop the other.',
          ],
          [
            'What is the !pak51 prefix on files I downloaded?',
            'A merge hint for VPKMerge, not a name the game understands. Dota never mounts a file starting with an exclamation mark; rename it to a plain <code>pakNN_dir.vpk</code>.',
          ],
        ],
      },
    ],
  },

  safe: {
    slug: 'safe',
    title: 'Are Dota 2 mods safe? Bans, VAC and Windows warnings',
    h1: 'Are Dota 2 mods safe?',
    description:
      'What client-side Dota 2 mods do and do not touch, whether Valve has ruled on them, why SmartScreen flags unsigned installers, and how to check a tool.',
    lead: 'Two different questions get asked as one. Whether the mods can cost you your account, and whether the program you downloaded to install them can cost you your machine.',
    card: 'Bans, VAC, and why Windows calls the installer an unknown publisher. What you can verify instead of trust.',
    blocks: [
      { k: 'h2', t: 'What a cosmetic mod actually changes', id: 'what' },
      {
        k: 'p',
        t: 'It swaps files your client reads while drawing the game. A model, a texture, a sound, an announcer pack. The server holds the match, and nothing in these files reaches it. Your teammates see the courier you own; you see the one you installed.',
      },
      {
        k: 'p',
        t: 'That also fixes the ceiling. No mod gives you vision, changes cooldowns or shows anything the client was not already sent. A tool that claims otherwise is doing something else and lying about the category.',
      },

      { k: 'h2', t: 'Two mechanisms, and only one of them is contested', id: 'methods' },
      {
        k: 'p',
        t: 'Two different things get called a mod, and the difference matters more than anything else on this page.',
      },
      {
        k: 'cards',
        items: [
          [
            'A VPK override',
            'The engine\'s own layering, the same one that loads localized voice. You put an archive in a folder Dota already mounts and it reads yours first. Nothing is bypassed and no Valve file changes. Skins, terrains, announcers, music, cursors.',
          ],
          [
            'An item schema edit',
            'Showing a cosmetic your account does not own needs <code>scripts/items/items_game.txt</code>, which a language folder cannot reach. Getting a file there means registering a second content folder in <code>gameinfo_branchspecific.gi</code> and writing the patched file\'s hash into <code>dota.signatures</code>, the list the client checks at startup.',
          ],
        ],
      },
      {
        k: 'p',
        t: 'People who have worked on Dota modding for years draw a hard line between the two and call the second one unsafe, on the grounds that it touches a check the client performs on itself. That is a fair description of what it does, and you should know it before you switch anything on.',
      },
      {
        k: 'p',
        t: 'Where this app sits: skins never need the second mechanism, and the app installs them without it. The schema patch runs only for free cosmetics, it copies both Valve files before its first write and puts them back byte for byte when you undo it, and the code that does it is <a href="https://github.com/TheFleece/dota2-mod-manager/blob/main/src/patcher.js" rel="noopener">one file of four hundred lines</a> that you can read end to end, rather than something you have to take on faith. Whether that is enough is your call to make, and the rest of the app works with it switched off.',
      },

      { k: 'h2', t: 'Will you get banned', id: 'ban' },
      {
        k: 'p',
        t: 'Nobody honest promises you anything here. Valve has never published a rule that names cosmetic mods, VAC looks for code injected into the game process rather than files sitting in the game folder, and people have run these mods for a decade. That is the evidence. It is not a guarantee, and you install them at your own risk, the same as every other Dota mod.',
      },
      {
        k: 'list',
        items: [
          'Your Steam inventory stays as it is. Nothing here trades, buys or unlocks an item on Valve\'s side.',
          'Turning mods off before a tournament match or a client update costs you one click and removes the question.',
          'Any tool asking for your Steam login is not a mod manager. Nothing about installing a file needs your account.',
        ],
      },

      { k: 'h2', t: 'Why Windows warns you about the installer', id: 'smartscreen' },
      {
        k: 'p',
        t: 'SmartScreen shows "Windows protected your PC" and calls the publisher unknown when an installer carries no paid code-signing certificate. It is a statement about paperwork, not about the file. A certificate runs a few hundred dollars a year, this program is free, and the free certificate programme for open-source projects turned the application down for not being well known enough yet.',
      },
      {
        k: 'p',
        t: 'Click <b>More info</b>, then <b>Run anyway</b>. If you would rather not, that is a reasonable place to stop, and the source is on GitHub for anybody who wants to build it themselves.',
      },
      {
        k: 'p',
        t: 'Antivirus software sometimes flags unsigned installers the same way, for the same reason: no reputation yet. Microsoft reviewed one such report about this app in August 2026 and removed the detection.',
      },

      { k: 'h2', t: 'How to check a mod manager before running it', id: 'check' },
      {
        k: 'cards',
        items: [
          ['Read the source', 'Not "source available on request". A link to a repository you can open right now, with the code that matches the release.'],
          ['Check who built the file', 'A release built by a public CI workflow has a log you can read. One uploaded from somebody\'s desktop has your word for it.'],
          ['Look at the history', 'Twenty-seven releases over a year and an issue tracker with real complaints in it beats a fresh repository with one binary.'],
          ['Watch what it asks for', 'A mod installer needs the game folder. It does not need your Steam password, your inventory or a login.'],
        ],
      },
      {
        k: 'p',
        t: 'This one is GPL-3.0, built from that source by GitHub Actions, and every release since the first is still on the releases page. <a href="https://github.com/TheFleece/dota2-mod-manager" rel="noopener">Read it</a> before you run it.',
      },

      { k: 'h2', t: 'Questions', id: 'faq' },
      {
        k: 'faq',
        items: [
          [
            'Is a skin changer the same as a cheat?',
            'No. A cosmetic mod changes what your own client draws and gives you no information and no advantage. Tools that inject code into the running game are a different thing with a different risk.',
          ],
          [
            'Has anyone been banned for cosmetic mods?',
            'No case has been reported and confirmed in the years these mods have existed. Absence of reports is weaker than a rule from Valve, and Valve has published no rule either way.',
          ],
          [
            'Can I use mods in ranked?',
            'They work there, and nothing in them touches the match. Whether you want an unsigned change to your client during a ranked game is your call.',
          ],
          [
            'Why does my antivirus flag it?',
            'Unsigned installer, no reputation. Check the build log for the release you downloaded and decide from there.',
          ],
        ],
      },
    ],
  },

  cosmetics: {
    slug: 'cosmetics',
    title: 'Free Dota 2 cosmetics and the item schema',
    h1: 'Free cosmetics, and what they really are',
    description:
      'Dota 2 ships the files for every courier, ward and announcer. The item schema decides which ones your client shows, and a local edit has honest limits.',
    lead: 'Every cosmetic in Dota is already on your disk. Your client checks a list to decide which ones to show you. Edit your copy of the list and it shows you more.',
    card: 'Why the files are already there, what a local schema edit changes, and where the honest limits are.',
    blocks: [
      { k: 'h2', t: 'The list', id: 'schema' },
      {
        k: 'p',
        t: 'When Valve adds an Arcana, the models and sounds go into the game files for everybody. What separates you from somebody who bought it is <code>scripts/items/items_game.txt</code>, a text file listing every item in the game and what it belongs to. Your client reads that file to decide what to draw.',
      },
      {
        k: 'p',
        t: 'Change your copy and your client draws differently. The server keeps its own record of what you own, which is why the whole thing is one-sided: the courier walks across your screen and nobody else\'s.',
      },

      { k: 'h2', t: 'What that gets you', id: 'what' },
      {
        k: 'p',
        t: 'Dota 2 Mod Manager reads the item table out of your game files rather than shipping a list of its own, so anything Valve adds in a patch appears without waiting for an app update.',
      },
      {
        k: 'list',
        items: [
          'Weather effects, which is the one most people come for.',
          'Couriers, wards and their upgrades.',
          'Loading screens, emblems and menu backgrounds.',
          'Announcers and mega-kill packs.',
          'Terrains, river paints and tree styles.',
        ],
      },

      { k: 'h2', t: 'What it does not get you', id: 'limits' },
      {
        k: 'p',
        t: 'Anything the server decides stays with the server. Your Steam inventory does not change, nothing becomes tradeable, and no item you unlock this way is worth anything to anyone. Battle pass levels, Dota Plus features and anything counted on Valve\'s side are out of reach by construction, not by politeness.',
      },
      {
        k: 'p',
        t: 'Hero sets are the case people misread most. A local unlock shows the set to you, and your opponents keep seeing the default hero. If the point was for other people to see it, this is not the thing.',
      },

      { k: 'h2', t: 'Why it needs a search-path patch', id: 'patch' },
      {
        k: 'p',
        t: 'The item table lives behind the MOD search path, and Dota resolves MOD to <code>game\\dota</code> alone. A file in a language folder never reaches it, which is why unlocking cosmetics takes more work than installing a skin.',
      },
      {
        k: 'p',
        t: 'Registering another content folder means editing <code>game\\dota\\gameinfo_branchspecific.gi</code> and then adding the edited file\'s hash to <code>game\\bin\\win64\\dota.signatures</code>, which the client verifies at startup. The app backs up both files before its first write and puts the originals back byte for byte when you undo it. <a href="~/docs/vpk/">The search paths in detail</a>.',
      },
      {
        k: 'note',
        t: 'Dota patches overwrite both files regularly. Anything that edits them has to notice and redo the work, or your unlocks quietly disappear after an update. <a href="~/docs/troubleshooting/">What to do when that happens</a>.',
      },

      { k: 'h2', t: 'Questions', id: 'faq' },
      {
        k: 'faq',
        items: [
          [
            'Can I get an Arcana for free this way?',
            'You can make your client draw one for you. Nobody else sees it, it never enters your inventory, and it has no value. That is the honest description of what the unlock is.',
          ],
          [
            'Will Valve take the items away?',
            'There is nothing to take. Your account is unchanged; the difference is a text file on your disk. Verifying your game files in Steam undoes it.',
          ],
          [
            'Do my unlocks survive a Dota update?',
            'Not by themselves. A patch rewrites the files that carry the change. The app checks on startup and restores what the update removed.',
          ],
        ],
      },
    ],
  },

  troubleshooting: {
    slug: 'troubleshooting',
    title: 'Dota 2 mods not working: fixes after a patch',
    h1: 'Mods stopped working',
    description:
      'Dota 2 mods gone after an update, one mod covering another, a game that will not start, a mod that changed nothing. Symptom by symptom, with the fix.',
    lead: 'Most of these have the same cause. A Dota patch rewrote a file your mods depend on, and nothing told you.',
    card: 'Mods gone after a patch, one covering another, a game that will not start. Symptom by symptom.',
    blocks: [
      { k: 'h2', t: 'Everything vanished after a game update', id: 'patch' },
      {
        k: 'p',
        t: 'A Dota patch can rewrite <code>gameinfo_branchspecific.gi</code> and <code>dota.signatures</code>, and it can clear files out of the language folder. Free cosmetics go first, because they depend on both of those files, and skins follow when the folder gets swept.',
      },
      {
        k: 'p',
        t: 'In the app, open it after the patch and take the offer to restore. By hand, redo the search-path edit and copy your <code>pakNN_dir.vpk</code> files back in.',
      },

      { k: 'h2', t: 'One mod works, the other does nothing', id: 'conflict' },
      {
        k: 'p',
        t: 'They carry the same file, and Dota takes the copy from the lower pak number. Nothing is broken and nothing will tell you: the hero just looks like the mod that won. Move the one you want to a lower slot, or take the other one off. <a href="~/docs/vpk/">How the numbering works</a>.',
      },

      { k: 'h2', t: 'Dota will not start at all', id: 'crash' },
      {
        k: 'list',
        items: [
          'Check that <code>pak01_dir.vpk</code> is still in your language folder along with its numbered parts. Deleting or renaming it stops the game.',
          'A half-written <code>gameinfo.gi</code> keeps Dota from launching. <b>Verify integrity of game files</b> in Steam restores it.',
          'If you patched by hand and skipped the <code>dota.signatures</code> line, the client rejects the file it was told to load.',
        ],
      },

      { k: 'h2', t: 'The mod installed but nothing changed', id: 'nothing' },
      {
        k: 'list',
        items: [
          'Restart Dota from Steam rather than returning to the menu. The game reads the mod folders once, at startup.',
          'Check that you put the file in the folder matching your <b>audio</b> language, not your menu language. They are separate settings since July 2026.',
          'No <code>dota_</code> folder anywhere? Your audio is English, and Valve ships no folder for it. <a href="~/docs/install/#english">What to do instead</a>.',
          'A file named <code>!pak51_dir.vpk</code> or <code>mymod.vpk</code> is never mounted. It has to be <code>pakNN_dir.vpk</code>.',
          'If the mod replaces a hero set you do not own, it needs the item schema patch as well as the archive. <a href="~/docs/cosmetics/">Why</a>.',
        ],
      },

      { k: 'h2', t: 'Starting over cleanly', id: 'reset' },
      {
        k: 'p',
        t: '<b>Verify integrity of game files</b> in Steam puts every Valve file back and leaves your Steam inventory and settings alone. It removes mods along with everything else, which is the point. Reinstall from the app afterwards and the app knows what you had.',
      },

      { k: 'h2', t: 'Questions', id: 'faq' },
      {
        k: 'faq',
        items: [
          [
            'Does verifying game files ban or flag me?',
            'No. It is a Steam feature that compares your files to Valve\'s and replaces what differs.',
          ],
          [
            'Do I have to redo this after every patch?',
            'Only after patches that touch the files involved, which is a minority of them. The app checks at startup and says when something needs attention.',
          ],
          [
            'My fonts or cursor are stuck from an old mod.',
            'Those install outside the pak system, so deleting an archive does not undo them. The app restores the copy it made before installing; by hand, verify your game files.',
          ],
        ],
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Russian
// ---------------------------------------------------------------------------

const ru: Record<DocSlug, Doc> = {
  install: {
    slug: 'install',
    title: 'Как установить моды на Dota 2 в 2026 году',
    h1: 'Как установить моды на Dota 2',
    description:
      'Рабочая установка модов Dota 2: три клика через приложение или руками через pakNN_dir.vpk. И почему -language mods перестал работать в июле 2026.',
    lead: 'Почти все гайды до сих пор учат параметру запуска, который Valve отключила в июле 2026. Ниже два способа по игре в её сегодняшнем виде: с программой и без.',
    card: 'Три клика через приложение или работа с файлами руками. Плюс параметр запуска, который больше ничего не делает.',
    blocks: [
      {
        k: 'note',
        t: 'Если гайд советует прописать <code>-language mods</code> в параметрах запуска Steam, он написан до 24 июля 2026. Дота теперь берёт имя папки из своего файла настроек и на аргумент не смотрит. Папка вида <code>dota_mods123</code> больше не примонтируется никогда.',
      },

      { k: 'h2', t: 'Способ на три клика', id: 'app' },
      {
        k: 'p',
        t: 'Dota 2 Mod Manager делает работу с файлами и помнит, что куда положил. Из-за этого мод можно выключить перед каткой, а не удалять и искать заново.',
      },
      {
        k: 'steps',
        items: [
          [
            'Скачай и запусти установщик',
            'Windows 10 или 11, без аккаунта. Windows назовёт издателя неизвестным: у установщика нет платной подписи. Жми <b>Подробнее</b>, потом <b>Выполнить в любом случае</b>. <a href="~/docs/safe/">Почему так</a>.',
          ],
          [
            'Дай ему найти Доту',
            'Он читает библиотеку Steam и сам наводится на папку игры. Если Дота на другом диске, укажи папку один раз, дальше он её помнит.',
          ],
          [
            'Открой каталог и нажми «Установить»',
            'Приложение скачает мод, положит в свободный слот pak в той папке, которую игра действительно монтирует, и скажет, если такой же файл несёт другой установленный мод.',
          ],
          [
            'Запусти игру',
            'Из приложения или из Steam, работает и так и так. Чтобы снять мод, выключи его в «Моих модах» и перезапусти Доту.',
          ],
        ],
      },

      { k: 'h2', t: 'Руками, один мод', id: 'manual' },
      {
        k: 'p',
        t: 'Нужен файл .vpk и имя папки, которую Дота монтирует под твой язык озвучки. С июльского патча 2026 это две разные настройки, и папку определяет именно озвучка.',
      },
      {
        k: 'steps',
        items: [
          [
            'Посмотри язык озвучки',
            'Открой <code>game\\dota\\cfg\\boot.vcfg</code> в папке игры любым текстовым редактором и найди <code>AudioLanguage</code>. Это слово и есть суффикс папки.',
          ],
          [
            'Открой нужную папку',
            'Русская озвучка означает <code>game\\dota_russian\\</code>, немецкая <code>game\\dota_german\\</code>, и так далее по языкам, для которых Valve записала озвучку. Там уже лежит <code>pak01_dir.vpk</code> и его нумерованные части, их не трогай: это валвовская локализованная речь. <b>У английской озвучки папки нет вообще</b>, и это отдельный случай, он ниже.',
          ],
          [
            'Переименуй мод и положи туда',
            'Назови <code>pak02_dir.vpk</code>. Если 02 занят, бери выше: 03, 04 и так до 99. Когда два мода несут один и тот же файл, побеждает меньший номер.',
          ],
          [
            'Перезапусти Доту полностью',
            'Закрой её из Steam, а не выйди в меню. Игра читает эту папку один раз, при старте.',
          ],
        ],
      },
      {
        k: 'p',
        t: 'Работает, пока не перестанет. Патч игры может вычистить папку, два мода могут нести одну и ту же текстуру и молча погасить друг друга, а на диске нигде не записано, из какого мода взялся конкретный <code>pak14_dir.vpk</code>. Ровно эти три вещи менеджер и держит в голове за тебя. <a href="~/docs/vpk/">Что означает нумерация</a>.',
      },

      { k: 'h2', t: 'Английская озвучка: отдельный случай', id: 'english' },
      {
        k: 'p',
        t: 'Английская речь лежит внутри <code>dota/pak01</code>, поэтому папки <code>dota_english</code> Valve не поставляет: класть туда было бы нечего. С английской озвучкой моду просто некуда деться.',
      },
      {
        k: 'p',
        t: 'Создать папку самому тоже мало. В каждой валвовской языковой папке лежит свой <code>gameinfo.gi</code>, который накладывает её на <code>dota</code>, а в папку без этого файла движок не заглядывает.',
      },
      {
        k: 'p',
        t: 'Первый выход - сделать слой по-настоящему: создать <code>game\\dota_english\\</code> и положить внутрь вот это под именем <code>gameinfo.gi</code>. Так ты пишешь новый файл в новую папку и ничего валвовского не трогаешь.',
      },
      {
        k: 'code',
        t: '"GameInfo"\n{\n\tLayeredOnMod\tdota\n\n\tFileSystem\n\t{\n\t\tSearchPaths\n\t\t{\n\t\t\tGame\t\t\tdota_english\n\t\t\tGame\t\t\tdota\n\t\t\tGame\t\t\tcore\n\n\t\t\tMod\t\t\t\tdota_english\n\t\t\tMod\t\t\t\tdota\n\n\t\t\tAddonRoot\t\tdota_addons\n\n\t\t\tPublicContent\tcore\n\t\t}\n\t}\n}',
      },
      {
        k: 'p',
        t: 'Второй выход не создаёт вообще ничего. Оставь язык озвучки таким, для которого папка есть, держи моды там, а валвовский <code>pak01_dir.vpk</code> внутри неё переименуй. Речь откатится на английскую из <code>dota/pak01</code>, а все моды останутся смонтированными. Двигать надо только индекс: нумерованные тома рядом без него не читаются, так что ты переименовываешь несколько сотен килобайт и не трогаешь гигабайты. Обратно - тем же переименованием или проверкой целостности файлов в Steam.',
      },

      { k: 'h2', t: 'Бесплатной косметике нужен ещё один шаг', id: 'schema' },
      {
        k: 'p',
        t: 'Мод в языковой папке заменит любой обычный ассет и никогда - список предметов. Дота разрешает свой путь поиска MOD только в <code>game\\dota</code>, поэтому <code>scripts/items/items_game.txt</code> оттуда недосягаем. Чтобы открыть курьеров, варды или комментаторов, надо зарегистрировать вторую папку контента в <code>gameinfo_branchspecific.gi</code> и вписать хеш пропатченного файла в <code>dota.signatures</code>, который клиент проверяет при запуске. <a href="~/docs/cosmetics/">Как устроена таблица предметов</a>.',
      },

      { k: 'h2', t: 'Как снять мод', id: 'remove' },
      {
        k: 'list',
        items: [
          'В приложении: выключи мод, чтобы он остался в библиотеке, или удали, чтобы убрать файл. Шрифты и курсоры вернутся из копии, снятой до установки.',
          'Руками: удали добавленный <code>pakNN_dir.vpk</code> и все части <code>pakNN_000.vpk</code> с тем же номером.',
          'Откатить всё разом - <b>Проверить целостность файлов игры</b> в Steam. Валвовские файлы вернутся, инвентарь Steam не тронется.',
        ],
      },

      { k: 'h2', t: 'Вопросы', id: 'faq' },
      {
        k: 'faq',
        items: [
          [
            'Надо переставлять моды после каждого патча Доты?',
            'Иногда. Патч, переписывающий папку игры, может снести то, что ты туда положил. Приложение проверяет это при запуске и возвращает пропавшее на место; руками - копируешь файлы заново.',
          ],
          [
            'Другие игроки видят мои моды?',
            'Нет. Все задействованные файлы лежат у тебя и меняют то, что рисует твой клиент. До матча из этого не доходит ничего.',
          ],
          [
            'А -language mods ещё работает?',
            'Нет. 24 июля 2026 Дота убрала имя папки из аргументов запуска и читает его из <code>boot.vcfg</code>. Гайды, которые всё ещё этому учат, написаны раньше, и их никто не обновил.',
          ],
          [
            'Где брать сами моды?',
            'Самая большая коллекция - каталог Dota2PornFx, приложение читает его напрямую, поэтому новые моды появляются без обновления программы. Можно поставить и любой свой .vpk.',
          ],
        ],
      },
    ],
  },

  vpk: {
    slug: 'vpk',
    title: 'VPK в Dota 2: номера pak и порядок загрузки',
    h1: 'Что такое VPK и какой из них берёт Дота',
    description:
      'Что такое файлы VPK, почему моды называются pak02_dir.vpk и до pak99, какой мод побеждает при совпадении файлов и при чём тут gameinfo.gi.',
    lead: 'Всё, что Дота с собой возит, лежит в архивах VPK. Мод - ещё один такой архив, поставленный перед игровыми. Номер в его имени решает, кто выиграет спор.',
    card: 'Архивы, номера pak и пути поиска. Почему один мод перекрывает другой и как движок это решает.',
    blocks: [
      { k: 'h2', t: 'Архив', id: 'archive' },
      {
        k: 'p',
        t: 'VPK расшифровывается как Valve Pak. Один архив держит тысячи файлов вместе с их путями, поэтому <code>models/heroes/juggernaut/juggernaut.vmdl_c</code> внутри архива отзывается на этот же путь в игре. Большие архивы разбиты надвое: индекс <code>_dir.vpk</code> со списком, что где лежит, и нумерованные <code>_000.vpk</code>, <code>_001.vpk</code> с самими байтами. Перенесёшь индекс без частей - получишь архив, который указывает в пустоту.',
      },
      {
        k: 'p',
        t: 'Мод для Доты - маленький VPK с горсткой файлов-замен, лежащих ровно по тем путям, что и оригиналы. Движок их не сравнивает. Он берёт первую найденную копию.',
      },

      { k: 'h2', t: 'Откуда берётся «первая»', id: 'order' },
      {
        k: 'p',
        t: 'Внутри примонтированной папки Дота идёт по архивам pak по возрастанию номера и останавливается на первом попадании. <code>pak02</code> читается раньше <code>pak30</code>, поэтому файл, который есть в обоих, придёт из <code>pak02</code>. Это всё правило целиком, и из-за него установка мода означает переименование в свободный номер, а не «положить как есть».',
      },
      {
        k: 'cards',
        items: [
          ['pak01_*', 'Валвовский. В языковой папке это локализованная озвучка. Переименуешь или удалишь - игра сломается.'],
          ['pak02 - pak09', 'Сюда кладут мод, который должен выигрывать у остальных. Приложение отправляет туда всё, что помечено приоритетным.'],
          ['pak10 - pak99', 'Обычные моды, занимается первый свободный номер. Девяносто восемь слотов не выбирает никто.'],
          ['pak00', 'Не монтируется никогда. Приложение на секунду паркует там архив при перестановке двух модов, чтобы падение посреди операции не оставило полуустановленный мод.'],
        ],
      },
      {
        k: 'p',
        t: 'Два мода на разных героев не встречаются никогда, и таких можно держать хоть сотню. Два сета на Juggernaut в соседних слотах столкнутся на одном файле модели, и покажется только один. Предупреждения не будет: герой просто выглядит как второй мод.',
      },

      { k: 'h2', t: 'Какая папка монтируется', id: 'folder' },
      {
        k: 'p',
        t: 'Дота монтирует <code>game\\dota</code>, <code>game\\core</code> и одну папку по имени языка озвучки, например <code>game\\dota_russian</code>. До июля 2026 этот суффикс можно было выдумать аргументом запуска <code>-language</code>, откуда и растёт старый совет сделать папку <code>dota_mods</code>. Теперь Дота берёт значение из <code>game\\dota\\cfg\\boot.vcfg</code>, и папка, не совпадающая ни с одним настоящим языком, остаётся непримонтированной.',
      },
      {
        k: 'code',
        t: '"boot"\n{\n\t"UILanguage"     "english"\n\t"AudioLanguage"  "russian"\n}',
      },
      {
        k: 'p',
        t: 'Смотри <code>AudioLanguage</code>, а не <code>UILanguage</code>. Движок подставляет в путь поиска язык озвучки, поэтому смена голосов просит перезапуск, а смена языка меню - нет.',
      },

      { k: 'h2', t: 'Единственный файл, до которого языковая папка не дотянется', id: 'schema' },
      {
        k: 'p',
        t: 'Список всей косметики в игре, <code>scripts/items/items_game.txt</code>, читается через путь поиска MOD, а MOD разрешается только в <code>game\\dota</code>. Положи изменённую копию в языковую папку - игра прочитает мимо неё.',
      },
      {
        k: 'p',
        t: 'Чтобы файл туда попал, надо править <code>game\\dota\\gameinfo_branchspecific.gi</code>, регистрируя ещё одну папку контента, и дописывать SHA1 и CRC этого файла в <code>game\\bin\\win64\\dota.signatures</code>: клиент сверяется с этим списком до загрузки. Оба файла принадлежат Valve, и оба переписываются обновлениями. <a href="~/docs/cosmetics/">Что с этим делают</a>.',
      },

      { k: 'h2', t: 'Вопросы', id: 'faq' },
      {
        k: 'faq',
        items: [
          [
            'Можно посмотреть, что внутри VPK?',
            'Да. Dota 2 Mod Manager показывает пути в любом устанавливаемом моде и называет героев и слоты, которых тот касается. Вне приложения архивы Source 2 читает ValveResourceFormat.',
          ],
          [
            'Почему мод перестал работать после установки другого?',
            'Они несут один и тот же файл, и победил меньший номер pak. Дай нужному номер поменьше или убери второй.',
          ],
          [
            'Что за приставка !pak51 у скачанных файлов?',
            'Это подсказка для слияния в VPKMerge, а не имя, понятное игре. Файл, начинающийся с восклицательного знака, Дота не монтирует; переименуй в обычный <code>pakNN_dir.vpk</code>.',
          ],
        ],
      },
    ],
  },

  safe: {
    slug: 'safe',
    title: 'Безопасны ли моды для Dota 2? Баны и VAC',
    h1: 'Безопасны ли моды для Dota 2?',
    description:
      'Что клиентские моды Dota 2 трогают и чего не трогают, что об этом говорила Valve, почему ругается SmartScreen и как проверить менеджер до запуска.',
    lead: 'Под одним вопросом прячутся два. Могут ли моды стоить тебе аккаунта и может ли программа, которой ты их ставишь, стоить тебе компьютера.',
    card: 'Баны, VAC и почему Windows называет издателя неизвестным. Что можно проверить вместо того, чтобы верить.',
    blocks: [
      { k: 'h2', t: 'Что косметический мод меняет на самом деле', id: 'what' },
      {
        k: 'p',
        t: 'Он подменяет файлы, которые твой клиент читает, пока рисует игру. Модель, текстуру, звук, пак комментатора. Матч держит сервер, и до него из этих файлов не доходит ничего. Твои союзники видят курьера, который у тебя есть; ты видишь того, которого поставил.',
      },
      {
        k: 'p',
        t: 'Отсюда же и потолок. Ни один мод не даст обзора, не поменяет кулдауны и не покажет того, чего клиенту и так не прислали. Инструмент, который обещает обратное, занимается чем-то другим и врёт о категории.',
      },

      { k: 'h2', t: 'Механизма два, и спорный из них один', id: 'methods' },
      {
        k: 'p',
        t: 'Модом называют две разные вещи, и разница между ними важнее всего остального на этой странице.',
      },
      {
        k: 'cards',
        items: [
          [
            'Переопределение через VPK',
            'Родное наслоение движка, то же самое, которым грузится локализованная озвучка. Ты кладёшь архив в папку, которую Дота и так монтирует, и она читает твой файл первым. Ничего не обходится, ни один валвовский файл не меняется. Скины, ландшафты, комментаторы, музыка, курсоры.',
          ],
          [
            'Правка таблицы предметов',
            'Показать косметику, которой у аккаунта нет, можно только через <code>scripts/items/items_game.txt</code>, а до него из языковой папки не дотянуться. Чтобы файл туда попал, надо зарегистрировать вторую папку контента в <code>gameinfo_branchspecific.gi</code> и вписать хеш изменённого файла в <code>dota.signatures</code>, список, который клиент проверяет при запуске.',
          ],
        ],
      },
      {
        k: 'p',
        t: 'Люди, которые занимаются моддингом Доты годами, проводят между этими двумя вещами жёсткую границу и называют вторую небезопасной на том основании, что она трогает проверку, которую клиент делает сам над собой. Это честное описание происходящего, и знать его стоит до того, как что-то включать.',
      },
      {
        k: 'p',
        t: 'Где в этой картине приложение: скинам второй механизм не нужен вообще, и оно ставит их без него. Патч схемы работает только ради бесплатной косметики, оба валвовских файла копируются до первой записи и возвращаются побайтово при откате, а код, который это делает, - <a href="https://github.com/TheFleece/dota2-mod-manager/blob/main/src/patcher.js" rel="noopener">один файл на четыреста строк</a>, который читается целиком, а не то, что приходится принимать на веру. Достаточно этого или нет, решаешь ты, и всё остальное работает с выключенным патчем.',
      },

      { k: 'h2', t: 'Забанят ли', id: 'ban' },
      {
        k: 'p',
        t: 'Гарантий тут честно не даёт никто. Valve никогда не публиковала правила, которое называет косметические моды; VAC ищет код, внедрённый в процесс игры, а не файлы, лежащие в папке; люди ставят такие моды десять лет. Это все имеющиеся доводы. Гарантией они не являются, и ставишь ты их на свой страх и риск, как и любые другие моды для Доты.',
      },
      {
        k: 'list',
        items: [
          'Инвентарь Steam остаётся как был. Ничего здесь не торгует, не покупает и не открывает предмет на стороне Valve.',
          'Выключить моды перед турнирным матчем или обновлением клиента стоит одного клика и снимает вопрос.',
          'Любой инструмент, просящий логин Steam, - не менеджер модов. Установке файла твой аккаунт не нужен.',
        ],
      },

      { k: 'h2', t: 'Почему Windows ругается на установщик', id: 'smartscreen' },
      {
        k: 'p',
        t: 'SmartScreen пишет «Система Windows защитила ваш компьютер» и называет издателя неизвестным, когда у установщика нет платного сертификата подписи кода. Это утверждение про бумаги, а не про файл. Сертификат стоит несколько сотен долларов в год, программа бесплатная, а бесплатная программа подписи для открытых проектов заявку отклонила: проект пока недостаточно известен.',
      },
      {
        k: 'p',
        t: 'Жми <b>Подробнее</b>, затем <b>Выполнить в любом случае</b>. Если не хочется, это нормальное место, чтобы остановиться: исходники лежат на GitHub, и собрать самому никто не мешает.',
      },
      {
        k: 'p',
        t: 'Антивирусы иногда помечают неподписанные установщики по той же причине - нет репутации. Microsoft разобрала одно такое обращение по этой программе в августе 2026 и сняла детект.',
      },

      { k: 'h2', t: 'Как проверить менеджер модов до запуска', id: 'check' },
      {
        k: 'cards',
        items: [
          ['Прочитай исходники', 'Не «исходники по запросу», а ссылка на репозиторий, который открывается прямо сейчас, с кодом, из которого собран релиз.'],
          ['Посмотри, кто собрал файл', 'У релиза, собранного публичным CI, есть лог, который можно открыть. У залитого с чьего-то компьютера есть только чьё-то слово.'],
          ['Посмотри историю', 'Двадцать семь релизов за год и трекер с настоящими жалобами весят больше, чем свежий репозиторий с одним бинарником.'],
          ['Следи, что просят', 'Установщику модов нужна папка игры. Ему не нужен пароль от Steam, инвентарь или вход в аккаунт.'],
        ],
      },
      {
        k: 'p',
        t: 'Этот - под GPL-3.0, собран из своих же исходников через GitHub Actions, и каждый релиз с самого первого до сих пор лежит на странице релизов. <a href="https://github.com/TheFleece/dota2-mod-manager" rel="noopener">Прочитай</a>, прежде чем запускать.',
      },

      { k: 'h2', t: 'Вопросы', id: 'faq' },
      {
        k: 'faq',
        items: [
          [
            'Скинченджер - это чит?',
            'Нет. Косметический мод меняет то, что рисует твой собственный клиент, и не даёт ни информации, ни преимущества. Инструменты, внедряющие код в запущенную игру, - другая вещь с другим риском.',
          ],
          [
            'Кого-нибудь банили за косметические моды?',
            'Подтверждённых случаев за все годы существования этих модов нет. Отсутствие сообщений слабее правила от Valve, а правила Valve не публиковала ни в ту, ни в другую сторону.',
          ],
          [
            'Можно с модами в ранкед?',
            'Работать будет, и до матча из них ничего не доходит. Хочешь ли ты неподписанных изменений в клиенте во время рейтинговой игры - решаешь ты.',
          ],
          [
            'Почему антивирус ругается?',
            'Неподписанный установщик без репутации. Открой лог сборки того релиза, который скачал, и решай оттуда.',
          ],
        ],
      },
    ],
  },

  cosmetics: {
    slug: 'cosmetics',
    title: 'Бесплатная косметика Dota 2: таблица предметов',
    h1: 'Бесплатная косметика и что это такое на самом деле',
    description:
      'Dota 2 везёт файлы каждого курьера, варда и комментатора. Какие показать, решает таблица предметов. Что даёт её правка и чего она не даёт.',
    lead: 'Вся косметика Доты уже лежит у тебя на диске. Клиент сверяется со списком, чтобы решить, что тебе показывать. Поправь свою копию списка - он покажет больше.',
    card: 'Почему файлы уже на диске, что меняет локальная правка схемы и где честные границы.',
    blocks: [
      { k: 'h2', t: 'Список', id: 'schema' },
      {
        k: 'p',
        t: 'Когда Valve добавляет аркану, модели и звуки уезжают в файлы игры ко всем. От того, кто её купил, тебя отделяет <code>scripts/items/items_game.txt</code> - текстовый файл со списком всех предметов игры и того, кому что принадлежит. Клиент читает его, чтобы решить, что рисовать.',
      },
      {
        k: 'p',
        t: 'Поправь свою копию, и клиент нарисует иначе. Сервер держит свою запись о том, чем ты владеешь, поэтому вся история односторонняя: курьер бегает по твоему экрану и ничьему больше.',
      },

      { k: 'h2', t: 'Что это даёт', id: 'what' },
      {
        k: 'p',
        t: 'Dota 2 Mod Manager читает таблицу предметов из твоих же файлов игры, а не везёт свой список, поэтому всё, что Valve добавит патчем, появляется без обновления приложения.',
      },
      {
        k: 'list',
        items: [
          'Погода - за ней приходит большинство.',
          'Курьеры, варды и их апгрейды.',
          'Экраны загрузки, эмблемы и фоны меню.',
          'Комментаторы и паки мега-киллов.',
          'Ландшафты, раскраска реки и стили деревьев.',
        ],
      },

      { k: 'h2', t: 'Чего это не даёт', id: 'limits' },
      {
        k: 'p',
        t: 'Всё, что решает сервер, остаётся у сервера. Инвентарь Steam не меняется, ничего не становится тредабельным, и открытый так предмет не стоит ни для кого ничего. Уровни боевого пропуска, Dota Plus и всё, что считается на стороне Valve, недостижимы по устройству, а не из вежливости.',
      },
      {
        k: 'p',
        t: 'Сеты героев понимают неправильно чаще всего. Локальная разблокировка показывает сет тебе, а соперники продолжают видеть дефолтного героя. Если смысл был в том, чтобы сет увидели другие, это не та вещь.',
      },

      { k: 'h2', t: 'Почему нужен патч путей поиска', id: 'patch' },
      {
        k: 'p',
        t: 'Таблица предметов лежит за путём поиска MOD, а MOD у Доты разрешается только в <code>game\\dota</code>. Файл из языковой папки до неё не дотягивается, поэтому открыть косметику сложнее, чем поставить скин.',
      },
      {
        k: 'p',
        t: 'Зарегистрировать вторую папку контента - значит править <code>game\\dota\\gameinfo_branchspecific.gi</code>, а потом дописывать хеш изменённого файла в <code>game\\bin\\win64\\dota.signatures</code>, который клиент проверяет при запуске. Приложение делает копию обоих файлов до первой записи и возвращает оригиналы побайтово, когда всё это откатываешь. <a href="~/docs/vpk/">Подробно про пути поиска</a>.',
      },
      {
        k: 'note',
        t: 'Патчи Доты переписывают оба файла регулярно. Всё, что их правит, обязано это замечать и делать работу заново, иначе разблокировки тихо пропадают после обновления. <a href="~/docs/troubleshooting/">Что делать, когда это случилось</a>.',
      },

      { k: 'h2', t: 'Вопросы', id: 'faq' },
      {
        k: 'faq',
        items: [
          [
            'Можно так получить аркану бесплатно?',
            'Можно заставить свой клиент её тебе нарисовать. Никто больше её не видит, в инвентарь она не попадает и не стоит ничего. Это честное описание того, что такое разблокировка.',
          ],
          [
            'Valve потом отберёт предметы?',
            'Отбирать нечего. Аккаунт не изменился, вся разница - текстовый файл на твоём диске. Проверка целостности файлов в Steam её отменяет.',
          ],
          [
            'Разблокировки переживают патч Доты?',
            'Сами по себе нет. Патч переписывает файлы, на которых держится правка. Приложение проверяет это при запуске и возвращает то, что обновление убрало.',
          ],
        ],
      },
    ],
  },

  troubleshooting: {
    slug: 'troubleshooting',
    title: 'Моды Dota 2 не работают: что делать после патча',
    h1: 'Моды перестали работать',
    description:
      'Моды Dota 2 пропали после обновления, один перекрывает другой, игра не запускается, мод встал но ничего не изменил. Что значит каждый симптом.',
    lead: 'У большинства из этого одна и та же причина. Патч Доты переписал файл, на котором держались твои моды, и никто тебе об этом не сказал.',
    card: 'Моды пропали после патча, один перекрывает другой, игра не стартует. По симптомам.',
    blocks: [
      { k: 'h2', t: 'После обновления игры всё пропало', id: 'patch' },
      {
        k: 'p',
        t: 'Патч Доты может переписать <code>gameinfo_branchspecific.gi</code> и <code>dota.signatures</code>, а ещё вычистить файлы из языковой папки. Первой отваливается бесплатная косметика, потому что держится на обоих этих файлах, а следом скины, когда подметают папку.',
      },
      {
        k: 'p',
        t: 'В приложении: открой его после патча и согласись восстановить. Руками: заново сделай правку путей поиска и скопируй свои <code>pakNN_dir.vpk</code> обратно.',
      },

      { k: 'h2', t: 'Один мод работает, второй как будто не поставлен', id: 'conflict' },
      {
        k: 'p',
        t: 'Они несут один и тот же файл, и Дота взяла копию из меньшего номера pak. Ничего не сломано и никто не сообщит: герой просто выглядит как победивший мод. Перенеси нужный в слот пониже или сними второй. <a href="~/docs/vpk/">Как работает нумерация</a>.',
      },

      { k: 'h2', t: 'Дота вообще не запускается', id: 'crash' },
      {
        k: 'list',
        items: [
          'Проверь, что <code>pak01_dir.vpk</code> на месте в языковой папке вместе с нумерованными частями. Удаление или переименование останавливает игру.',
          'Недописанный <code>gameinfo.gi</code> не даёт Доте стартовать. <b>Проверить целостность файлов игры</b> в Steam его восстановит.',
          'Если патчил руками и пропустил строчку в <code>dota.signatures</code>, клиент отказывается от файла, который ему велели загрузить.',
        ],
      },

      { k: 'h2', t: 'Мод встал, но ничего не изменилось', id: 'nothing' },
      {
        k: 'list',
        items: [
          'Перезапусти Доту из Steam, а не выйди в меню. Папки модов читаются один раз, при старте.',
          'Проверь, что положил файл в папку по языку <b>озвучки</b>, а не по языку меню. С июля 2026 это разные настройки.',
          'Папки <code>dota_</code> нет ни одной? Значит озвучка английская, а для неё Valve папку не поставляет. <a href="~/docs/install/#english">Что делать вместо этого</a>.',
          'Файл с именем <code>!pak51_dir.vpk</code> или <code>mymod.vpk</code> не монтируется никогда. Нужно <code>pakNN_dir.vpk</code>.',
          'Если мод подменяет сет, которого у тебя нет, ему нужен ещё и патч таблицы предметов, не только архив. <a href="~/docs/cosmetics/">Почему</a>.',
        ],
      },

      { k: 'h2', t: 'Начать с чистого листа', id: 'reset' },
      {
        k: 'p',
        t: '<b>Проверить целостность файлов игры</b> в Steam возвращает на место все валвовские файлы и не трогает инвентарь и настройки. Моды при этом сносятся вместе со всем остальным, в чём и смысл. Поставь заново из приложения: оно помнит, что у тебя было.',
      },

      { k: 'h2', t: 'Вопросы', id: 'faq' },
      {
        k: 'faq',
        items: [
          [
            'За проверку целостности файлов банят или помечают?',
            'Нет. Это функция Steam: он сравнивает твои файлы с валвовскими и заменяет то, что разошлось.',
          ],
          [
            'Это придётся делать после каждого патча?',
            'Только после тех, что трогают задействованные файлы, а таких меньшинство. Приложение проверяет при запуске и говорит, когда что-то требует внимания.',
          ],
          [
            'Шрифт или курсор застряли от старого мода.',
            'Они ставятся мимо системы pak, поэтому удаление архива их не откатывает. Приложение восстанавливает копию, снятую до установки; руками - проверка целостности файлов.',
          ],
        ],
      },
    ],
  },
};

export const docs: Record<'en' | 'ru', Record<DocSlug, Doc>> = { en, ru };
