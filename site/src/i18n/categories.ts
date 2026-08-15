/**
 * The catalog's categories, written as the pages people are actually looking for.
 *
 * This is the half of the audience the site had nothing for. Somebody who wants a different
 * river does not search "mods" - they search "как сделать кастомную реку в дота 2". Somebody
 * annoyed by the deny animation searches "изменить денай крипов". They find a forum thread
 * from 2017, and hours later work out that the answer is a mod and that mod managers exist.
 * These pages are meant to be what they find first.
 *
 * So the title is the question and the h1 answers it. The category name alone ("Terrains")
 * matches nothing anybody types.
 *
 * The ids are the catalog's own. Anything not listed here still gets a page, titled from the
 * id: a new category appearing upstream should not vanish from the site until somebody writes
 * a sentence about it.
 */
export interface CategoryCopy {
  /** Short label, for the index and the breadcrumb. */
  name: string;
  title: string;
  h1: string;
  description: string;
  /** One paragraph saying what this kind of mod actually changes. */
  about: string;
}

type Lang = 'en' | 'ru';

export const categoryCopy: Record<Lang, Record<string, CategoryCopy>> = {
  en: {
    terrains: {
      name: 'Terrains',
      title: 'Dota 2 terrain mods: change the whole map',
      h1: 'Dota 2 terrains',
      description: 'Custom Dota 2 terrains with previews: replace the ground, the cliffs and the ambience of the whole map. Free, installed in one click.',
      about: 'A terrain replaces the map itself. It is the biggest visual change you can make and the usual reason somebody starts modding at all.',
    },
    trees: {
      name: 'Trees',
      title: 'Dota 2 tree mods: replace the trees on the map',
      h1: 'Dota 2 tree mods',
      description: 'Change the trees in Dota 2: pines, cherry blossom, low-poly, or something that just makes the lane easier to read. With previews.',
      about: 'Trees are their own mod because people mix them: the ground from one author, the trees from another. They load ahead of a terrain, so a tree mod wins over the trees a terrain ships.',
    },
    river: {
      name: 'River',
      title: 'How to change the river in Dota 2',
      h1: 'Dota 2 river mods',
      description: 'Custom rivers for Dota 2: lava, blood, ice, chrome. What Valve sells as a river vial, made by the community and free.',
      about: 'The river is the strip everyone stares at all game. Valve sells these as vials; these are the community versions and they layer over whatever you own.',
    },
    shaders: {
      name: 'Shaders',
      title: 'Dota 2 shaders: change the lighting and colours',
      h1: 'Dota 2 shader mods',
      description: 'Shader mods for Dota 2: brighter colours, cleaner contrast, a different mood on the same map. Free, with previews.',
      about: 'A shader changes how the game is lit and coloured rather than what is in it. It is the cheapest way to make the map easier on the eyes.',
    },
    cursors: {
      name: 'Cursors',
      title: 'Dota 2 cursors: replace the mouse cursor',
      h1: 'Dota 2 cursor mods',
      description: 'Custom cursors for Dota 2, and the click effect that goes with them. Free, and the originals are backed up before anything is replaced.',
      about: 'Cursors replace files rather than layering over them, so the app copies the originals first and puts them back when you remove the mod.',
    },
    fonts: {
      name: 'Fonts',
      title: 'Dota 2 fonts: change the game\'s typeface',
      h1: 'Dota 2 font mods',
      description: 'Replace the fonts in Dota 2: cleaner numbers, a bigger interface, or a different look entirely. Backed up before installing.',
      about: 'Fonts are the other kind of mod that replaces rather than layers, so the originals are copied before anything is written.',
    },
    backgrounds: {
      name: 'Menu backgrounds',
      title: 'How to change the menu background in Dota 2',
      h1: 'Dota 2 menu backgrounds',
      description: 'Change the Dota 2 main menu background: heroes, art, anime, video. The first thing you see every time the game opens.',
      about: 'The background behind the main menu, which is the screen you look at more than any other and the one Valve gives you least control over.',
    },
    'mega-kill': {
      name: 'Mega-kills',
      title: 'Dota 2 mega-kill sounds and kill announcers',
      h1: 'Dota 2 mega-kill packs',
      description: 'Replace the mega-kill and killing-spree sounds in Dota 2 with something else. Free, with previews you can listen to.',
      about: 'The line that plays on a double kill and everything above it. Sound only: nobody else in the match hears yours.',
    },
    announcers: {
      name: 'Announcers',
      title: 'Dota 2 announcer mods: change the voice',
      h1: 'Dota 2 announcer packs',
      description: 'Announcer voice packs for Dota 2, free and installed in one click. Plus how to switch on an announcer your account already owns.',
      about: 'An announcer mod replaces what you hear regardless of what your account owns.',
    },
    'hero-sounds': {
      name: 'Hero voices',
      title: 'How to change hero sounds and voices in Dota 2',
      h1: 'Dota 2 hero voice mods',
      description: 'Replace a hero\'s voice lines and ability sounds in Dota 2. Free, with previews, and reversible in one click.',
      about: 'Voice lines, ability sounds, and everything else a hero makes. These live in the folder named after your audio language, which is worth knowing before you install one.',
    },
    music: {
      name: 'Music',
      title: 'Dota 2 music mods: replace the soundtrack',
      h1: 'Dota 2 music packs',
      description: 'Change the music in Dota 2: menu, match, Roshan. Community packs, free, installed in one click.',
      about: 'Music packs replace what plays in the menu and during a match, which is Valve\'s own kind of cosmetic and here it is free.',
    },
    sounds: {
      name: 'Sounds',
      title: 'How to change sounds in Dota 2',
      h1: 'Dota 2 sound mods',
      description: 'Replace Dota 2 sounds: the interface, pings, effects. Free, with previews, and switched off in one click.',
      about: 'Everything that makes a noise and is not a hero or an announcer.',
    },
    couriers: {
      name: 'Couriers',
      title: 'Dota 2 courier mods, and free couriers',
      h1: 'Dota 2 courier mods',
      description: 'Custom couriers for Dota 2, plus how to use the ones already sitting in your inventory. Free.',
      about: 'A courier mod replaces the model. Separately, couriers you already own can be switched on without one.',
    },
    wards: {
      name: 'Wards',
      title: 'Dota 2 ward mods: change the observer ward',
      h1: 'Dota 2 ward mods',
      description: 'Replace the observer and sentry ward models in Dota 2. Free, with previews.',
      about: 'Ward skins are among the more expensive things Valve sells and among the easiest to replace locally.',
    },
    creeps: {
      name: 'Creeps',
      title: 'Dota 2 creep mods: change lane and neutral creeps',
      h1: 'Dota 2 creep mods',
      description: 'Replace the lane creeps and neutrals in Dota 2, or make them easier to tell apart. Free, with previews.',
      about: 'Lane creeps, neutrals and the megacreeps. Some of these are cosmetic and some make the lane easier to read.',
    },
    'creep-deny': {
      name: 'Creep deny',
      title: 'How to change the deny effect on creeps in Dota 2',
      h1: 'Dota 2 creep deny mods',
      description: 'Change or remove the deny marker on Dota 2 creeps: a clearer effect, a different colour, or nothing at all.',
      about: 'The marker that appears when a creep can be denied. Making it clearer, or quieter, is one of the most-asked changes in the game and Valve offers no setting for it.',
    },
    huds: {
      name: 'HUD',
      title: 'How to change the HUD in Dota 2',
      h1: 'Dota 2 HUD mods',
      description: 'Replace the Dota 2 HUD: the bottom bar, the panels, the whole interface skin. Free, and reversible.',
      about: 'The bar along the bottom and the panels around it. Valve sells HUD skins; these replace them locally.',
    },
    'item-icons': {
      name: 'Item icons',
      title: 'How to change item icons in Dota 2',
      h1: 'Dota 2 item icon mods',
      description: 'Replace the item icons in Dota 2 with clearer, older or redrawn ones. Free, with previews.',
      about: 'The icons in your inventory and the shop. People change these to read the shop faster, not only to look different.',
    },
    'item-effects': {
      name: 'Item effects',
      title: 'Dota 2 item effect mods',
      h1: 'Dota 2 item effect mods',
      description: 'Change what items look like when they go off in Dota 2: Radiance, Blink, Shiva and the rest. Free, with previews.',
      about: 'The effects items make. Some are here to look better and some to be quieter, which on a screen full of particles is its own kind of upgrade.',
    },
    'hero-items': {
      name: 'Hero items',
      title: 'Dota 2 hero item mods: weapons and sets',
      h1: 'Dota 2 hero item mods',
      description: 'Single items rather than whole sets: a weapon, a back piece, a head. Free, with previews of each.',
      about: 'One slot at a time, for when a whole set is more than you wanted to change.',
    },
    optimization: {
      name: 'Optimization',
      title: 'Dota 2 optimization mods: more FPS on a weak PC',
      h1: 'Dota 2 optimization mods',
      description: 'Mods that strip effects and simplify models to raise FPS in Dota 2 on a weak computer. Free.',
      about: 'These go the other way from everything else here: fewer particles, simpler models, more frames. Worth trying before you touch your settings.',
    },
    packs: {
      name: 'Mod packs',
      title: 'Dota 2 mod packs: a whole set at once',
      h1: 'Dota 2 mod packs',
      description: 'Ready-made collections of Dota 2 mods, installed together. Free, and each one can still be taken apart.',
      about: 'Somebody else\'s whole setup in one file, for when you want the look without picking through the catalog.',
    },
    emblems: {
      name: 'Emblems',
      title: 'Dota 2 emblem mods',
      h1: 'Dota 2 emblems',
      description: 'Replace the emblems in Dota 2. Free, with previews.',
      about: 'Emblems, which sit next to your name and are one of the more visible small things.',
    },
    roshan: {
      name: 'Roshan',
      title: 'Dota 2 Roshan mods: replace Roshan',
      h1: 'Dota 2 Roshan mods',
      description: 'Replace the Roshan model in Dota 2. Free, with previews.',
      about: 'The pit\'s occupant, replaced. Purely how he looks on your screen.',
    },
    'ranged-attack': {
      name: 'Ranged attacks',
      title: 'Dota 2 ranged attack effect mods',
      h1: 'Dota 2 ranged attack mods',
      description: 'Change what a ranged hero\'s attack projectile looks like in Dota 2. Free, with previews.',
      about: 'The projectile itself. These load ahead of most other mods, because everything else on the screen has to be visible around them.',
    },
    herofx: {
      name: 'Hero effects',
      title: 'Dota 2 hero effect mods',
      h1: 'Dota 2 hero effect mods',
      description: 'Change a hero\'s ability effects in Dota 2 without replacing the model. Free, with previews.',
      about: 'Ability effects on their own, for when the model is fine and the particles are not.',
    },
    'ti-bp-effects': {
      name: 'Battle pass effects',
      title: 'Dota 2 battle pass effect mods',
      h1: 'Dota 2 battle pass effects',
      description: 'Effects from past battle passes and Internationals, rebuilt as mods. Free, with previews.',
      about: 'Effects that were only ever sold during an event, made again by the community.',
    },
    ranks: {
      name: 'Rank icons',
      title: 'How to change rank icons in Dota 2',
      h1: 'Dota 2 rank icon mods',
      description: 'Replace the medal and rank icons in Dota 2. Free, with previews.',
      about: 'The medal beside a name. Local only, so it changes nothing about your actual rank.',
    },
    'versus-screens': {
      name: 'Versus screens',
      title: 'Dota 2 versus screen mods',
      h1: 'Dota 2 versus screens',
      description: 'Replace the versus screen that plays before a Dota 2 match. Free, with previews.',
      about: 'The screen between the draft and the game.',
    },
    pedestal: {
      name: 'Pedestals',
      title: 'Dota 2 pedestal mods',
      h1: 'Dota 2 pedestals',
      description: 'Replace the pedestal a hero stands on in the Dota 2 loadout. Free, with previews.',
      about: 'The stand under a hero in the loadout screen.',
    },
    pings: {
      name: 'Pings',
      title: 'How to change the ping sound and marker in Dota 2',
      h1: 'Dota 2 ping mods',
      description: 'Replace the Dota 2 ping marker and the sound it makes. Free, with previews.',
      about: 'The marker and the noise. Yours only, which is worth saying because pings are the one cosmetic people assume is shared.',
    },
    towers: {
      name: 'Towers',
      title: 'Dota 2 tower mods',
      h1: 'Dota 2 tower mods',
      description: 'Replace the tower models in Dota 2. Free, with previews.',
      about: 'The towers themselves, replaced.',
    },
    ancient: {
      name: 'Ancients',
      title: 'Dota 2 ancient mods',
      h1: 'Dota 2 ancient mods',
      description: 'Replace the Radiant and Dire ancients in Dota 2. Free, with previews.',
      about: 'The building the whole game is about.',
    },
    tormentor: {
      name: 'Tormentor',
      title: 'Dota 2 Tormentor mods',
      h1: 'Dota 2 Tormentor mods',
      description: 'Replace the Tormentor model in Dota 2. Free, with previews.',
      about: 'The Tormentor, replaced.',
    },
    other: {
      name: 'Useful extras',
      title: 'Useful Dota 2 mods: radii, click colour, profile',
      h1: 'Useful Dota 2 mods',
      description: 'The Dota 2 mods people find by searching for a problem: a visible tower re-aggro radius, the Techies mine radius, the colour of your click, the dummy in your profile.',
      about: 'These are the ones nobody goes looking for as "mods". Somebody wants to see how far a tower re-aggros, or is tired of losing their own click on a bright map, and finds their way here hours later. Every one of them is a file in the game folder like any other mod, on and off in a click.',
    },
    'high-five': {
      name: 'High fives',
      title: 'Dota 2 high five mods',
      h1: 'Dota 2 high five mods',
      description: 'Replace the high five animation and effect in Dota 2. Free, with previews.',
      about: 'The one interaction the game gives you with a teammate.',
    },
  },

  ru: {
    terrains: {
      name: 'Ландшафты',
      title: 'Ландшафты для Доты 2: как поставить свой терраин',
      h1: 'Ландшафты и терраины для Доты 2',
      description: 'Кастомные ландшафты для Дота 2 с превью: земля, обрывы и вся атмосфера карты меняются целиком. Бесплатно и в один клик.',
      about: 'Терраин меняет саму карту. Это самое заметное, что вообще можно сделать с картинкой в Доте, и обычная причина, по которой человек приходит в моды.',
    },
    trees: {
      name: 'Деревья',
      title: 'Деревья для Доты 2: как заменить деревья на карте',
      h1: 'Моды на деревья в Доте 2',
      description: 'Замена деревьев в Дота 2: сосны, сакура, лоуполи или просто то, с чем линия читается легче. С превью.',
      about: 'Деревья вынесены отдельно, потому что их мешают: земля от одного автора, деревья от другого. Они грузятся раньше ландшафта, поэтому мод на деревья выигрывает у деревьев, которые несёт терраин.',
    },
    river: {
      name: 'Река',
      title: 'Как сделать кастомную реку в Дота 2',
      h1: 'Моды на реку в Доте 2',
      description: 'Кастомные реки для Дота 2: лава, кровь, лёд, хром. То, что Valve продаёт склянкой, сделано сообществом и бесплатно.',
      about: 'Река - полоса, на которую смотрят всю катку. Valve продаёт их склянками; это community-версии, и они ложатся поверх того, чем ты уже владеешь.',
    },
    shaders: {
      name: 'Шейдеры',
      title: 'Шейдеры для Доты 2: свет и цвета игры',
      h1: 'Шейдеры для Доты 2',
      description: 'Шейдеры для Дота 2: ярче цвета, чище контраст, другое настроение на той же карте. Бесплатно, с превью.',
      about: 'Шейдер меняет не то, что на карте, а то, как она освещена и раскрашена. Самый дешёвый способ сделать картинку приятнее для глаз.',
    },
    cursors: {
      name: 'Курсоры',
      title: 'Курсоры для Доты 2: как поменять курсор мыши',
      h1: 'Курсоры для Доты 2',
      description: 'Кастомные курсоры для Дота 2 и эффект клика к ним. Бесплатно, оригиналы копируются до замены.',
      about: 'Курсоры заменяют файлы, а не ложатся слоем, поэтому программа сначала копирует оригиналы и возвращает их при удалении мода.',
    },
    fonts: {
      name: 'Шрифты',
      title: 'Шрифты для Доты 2: как поменять шрифт в игре',
      h1: 'Шрифты для Доты 2',
      description: 'Замена шрифтов в Дота 2: понятнее цифры, крупнее интерфейс или совсем другой вид. С резервной копией оригиналов.',
      about: 'Шрифты - второй вид модов, который заменяет, а не накладывает, поэтому оригиналы копируются до первой записи.',
    },
    backgrounds: {
      name: 'Фоны меню',
      title: 'Как изменить фон в меню Доты 2',
      h1: 'Фоны главного меню Доты 2',
      description: 'Смена фона главного меню Дота 2: герои, арты, аниме, видео. То, что видишь каждый раз при запуске игры.',
      about: 'Фон за главным меню - экран, на который смотришь чаще всего и на который Valve даёт меньше всего влияния.',
    },
    'mega-kill': {
      name: 'Мега-киллы',
      title: 'Звуки килов в Доте 2: мега-киллы и стрики',
      h1: 'Мега-киллы для Доты 2',
      description: 'Замена звуков мега-килла и серий убийств в Дота 2. Бесплатно, с превью, которое можно послушать.',
      about: 'Фраза, которая играет на дабл килле и дальше вверх. Только звук, и слышишь его только ты.',
    },
    announcers: {
      name: 'Комментаторы',
      title: 'Аннонсеры для Доты 2: как поменять комментатора',
      h1: 'Аннонсеры и комментаторы Доты 2',
      description: 'Озвучки комментаторов для Дота 2, бесплатно и в один клик. Плюс как включить аннонсера, который уже есть на аккаунте.',
      about: 'Мод с озвучкой меняет то, что ты слышишь, независимо от того, чем владеет аккаунт.',
    },
    'hero-sounds': {
      name: 'Звуки героев',
      title: 'Как изменить звуки героев в Доте 2',
      h1: 'Моды на звуки героев в Доте 2',
      description: 'Замена реплик и звуков способностей героя в Дота 2. Бесплатно, с превью, убирается одним кликом.',
      about: 'Реплики, звуки способностей и всё остальное, что издаёт герой. Лежит это в папке, названной по языку озвучки, и знать об этом стоит до установки.',
    },
    music: {
      name: 'Музыка',
      title: 'Музыка для Доты 2: как заменить саундтрек',
      h1: 'Музыкальные паки для Доты 2',
      description: 'Смена музыки в Дота 2: меню, матч, Рошан. Паки от сообщества, бесплатно и в один клик.',
      about: 'Музыкальные паки меняют то, что играет в меню и в матче. У Valve это платная косметика, здесь бесплатная.',
    },
    sounds: {
      name: 'Звуки',
      title: 'Как изменить звуки в Доте 2',
      h1: 'Моды на звуки в Доте 2',
      description: 'Замена звуков Дота 2: интерфейс, пинги, эффекты. Бесплатно, с превью, выключается одним кликом.',
      about: 'Всё, что издаёт звук и при этом не герой и не комментатор.',
    },
    couriers: {
      name: 'Курьеры',
      title: 'Курьеры для Доты 2: моды и бесплатные',
      h1: 'Моды на курьеров в Доте 2',
      description: 'Кастомные курьеры для Дота 2 и как надеть тех, что уже лежат в инвентаре. Бесплатно.',
      about: 'Мод на курьера меняет модель. Отдельно: курьеров, которыми ты уже владеешь, можно включить и без мода.',
    },
    wards: {
      name: 'Варды',
      title: 'Варды для Доты 2: как поменять модель варда',
      h1: 'Моды на варды в Доте 2',
      description: 'Замена моделей обзорных и сентри вардов в Дота 2. Бесплатно, с превью.',
      about: 'Скины на варды - одно из самых дорогих, что продаёт Valve, и одно из самых простых для локальной замены.',
    },
    creeps: {
      name: 'Крипы',
      title: 'Крипы в Доте 2: как заменить моделей крипов',
      h1: 'Моды на крипов в Доте 2',
      description: 'Замена крипов на линии и нейтралов в Дота 2 или просто чтобы их было легче различать. Бесплатно, с превью.',
      about: 'Крипы на линии, нейтралы и мегакрипы. Часть этого чистая косметика, а часть реально помогает читать линию.',
    },
    'creep-deny': {
      name: 'Денай крипов',
      title: 'Как изменить денай крипов в Доте 2',
      h1: 'Моды на денай крипов в Доте 2',
      description: 'Изменить или убрать значок деная у крипов в Дота 2: заметнее, другого цвета или совсем без него.',
      about: 'Метка, которая появляется, когда крипа можно задеть. Сделать её заметнее или наоборот тише - один из самых частых запросов в игре, и настройки для этого у Valve нет.',
    },
    huds: {
      name: 'HUD',
      title: 'Как изменить HUD в Доте 2',
      h1: 'Моды на HUD в Доте 2',
      description: 'Замена HUD в Дота 2: нижняя панель, окна, весь скин интерфейса. Бесплатно и обратимо.',
      about: 'Панель внизу и всё вокруг неё. Valve продаёт скины на HUD, эти заменяют их локально.',
    },
    'item-icons': {
      name: 'Иконки предметов',
      title: 'Как изменить иконки предметов в Доте 2',
      h1: 'Моды на иконки предметов в Доте 2',
      description: 'Замена иконок предметов в Дота 2 на понятные, старые или перерисованные. Бесплатно, с превью.',
      about: 'Иконки в инвентаре и в лавке. Их меняют не только ради вида: со старыми иконками многие читают лавку быстрее.',
    },
    'item-effects': {
      name: 'Эффекты предметов',
      title: 'Эффекты предметов в Доте 2: моды на Радианс и другие',
      h1: 'Моды на эффекты предметов в Доте 2',
      description: 'Как выглядят предметы в Дота 2, когда срабатывают: Радианс, Блинк, Шива и остальные. Бесплатно, с превью.',
      about: 'Эффекты, которые дают предметы. Часть сделана красивее, а часть тише, и на экране, забитом частицами, это тоже апгрейд.',
    },
    'hero-items': {
      name: 'Предметы героев',
      title: 'Предметы героев в Доте 2: оружие и части сетов',
      h1: 'Моды на предметы героев в Доте 2',
      description: 'Отдельные предметы вместо целых сетов: оружие, спина, голова. Бесплатно, с превью каждого.',
      about: 'По одному слоту за раз, когда менять весь сет не хочется.',
    },
    optimization: {
      name: 'Оптимизация',
      title: 'Моды на оптимизацию Доты 2: больше ФПС на слабом ПК',
      h1: 'Моды на оптимизацию Доты 2',
      description: 'Моды, которые вырезают эффекты и упрощают модели ради ФПС в Дота 2 на слабом компьютере. Бесплатно.',
      about: 'Эти идут в другую сторону от всего остального здесь: меньше частиц, проще модели, больше кадров. Стоит попробовать до того, как лезть в настройки.',
    },
    packs: {
      name: 'Модпаки',
      title: 'Модпаки для Доты 2: целая сборка разом',
      h1: 'Модпаки для Доты 2',
      description: 'Готовые сборки модов для Дота 2, ставятся вместе. Бесплатно, и каждую можно потом разобрать.',
      about: 'Чужая сборка одним файлом, когда хочется вид, но не хочется перебирать каталог.',
    },
    emblems: {
      name: 'Эмблемы',
      title: 'Эмблемы для Доты 2',
      h1: 'Моды на эмблемы в Доте 2',
      description: 'Замена эмблем в Дота 2. Бесплатно, с превью.',
      about: 'Эмблемы стоят рядом с ником и относятся к самым заметным мелочам.',
    },
    roshan: {
      name: 'Рошан',
      title: 'Рошан в Доте 2: как заменить модель Рошана',
      h1: 'Моды на Рошана в Доте 2',
      description: 'Замена модели Рошана в Дота 2. Бесплатно, с превью.',
      about: 'Обитатель ямы, заменённый. Чисто то, как он выглядит у тебя на экране.',
    },
    'ranged-attack': {
      name: 'Дальние атаки',
      title: 'Моды на снаряды дальних атак в Доте 2',
      h1: 'Моды на дальние атаки в Доте 2',
      description: 'Как выглядит снаряд атаки у дальнобойного героя в Дота 2. Бесплатно, с превью.',
      about: 'Сам снаряд. Эти моды грузятся раньше большинства других, потому что вокруг них должно быть видно всё остальное.',
    },
    herofx: {
      name: 'Эффекты героев',
      title: 'Моды на эффекты способностей в Доте 2',
      h1: 'Моды на эффекты героев в Доте 2',
      description: 'Смена эффектов способностей героя в Дота 2 без замены модели. Бесплатно, с превью.',
      about: 'Только эффекты способностей, когда модель устраивает, а частицы нет.',
    },
    'ti-bp-effects': {
      name: 'Эффекты боевых пропусков',
      title: 'Эффекты боевых пропусков Доты 2 модами',
      h1: 'Эффекты боевых пропусков в Доте 2',
      description: 'Эффекты из прошлых боевых пропусков и Инторнешоналов, пересобранные модами. Бесплатно, с превью.',
      about: 'Эффекты, которые продавались только во время события, сделаны заново сообществом.',
    },
    ranks: {
      name: 'Иконки рангов',
      title: 'Как изменить иконки рангов в Доте 2',
      h1: 'Моды на иконки рангов в Доте 2',
      description: 'Замена медалей и иконок рангов в Дота 2. Бесплатно, с превью.',
      about: 'Медаль рядом с ником. Только локально, так что на настоящий ранг это не влияет никак.',
    },
    'versus-screens': {
      name: 'Versus-экраны',
      title: 'Моды на versus-экран в Доте 2',
      h1: 'Versus-экраны для Доты 2',
      description: 'Замена экрана versus перед матчем Дота 2. Бесплатно, с превью.',
      about: 'Экран между драфтом и игрой.',
    },
    pedestal: {
      name: 'Пьедесталы',
      title: 'Моды на пьедесталы в Доте 2',
      h1: 'Пьедесталы для Доты 2',
      description: 'Замена пьедестала, на котором стоит герой в лоадауте Дота 2. Бесплатно, с превью.',
      about: 'Подставка под героем на экране лоадаута.',
    },
    pings: {
      name: 'Пинги',
      title: 'Как поменять звук и метку пинга в Доте 2',
      h1: 'Моды на пинги в Доте 2',
      description: 'Замена метки пинга в Дота 2 и звука, который она издаёт. Бесплатно, с превью.',
      about: 'Метка и звук. Только у тебя, и это стоит сказать отдельно: пинг - единственная косметика, которую все считают общей.',
    },
    towers: {
      name: 'Вышки',
      title: 'Моды на вышки в Доте 2',
      h1: 'Моды на вышки в Доте 2',
      description: 'Замена моделей вышек в Дота 2. Бесплатно, с превью.',
      about: 'Сами вышки, заменённые.',
    },
    ancient: {
      name: 'Троны',
      title: 'Моды на трон в Доте 2',
      h1: 'Моды на троны в Доте 2',
      description: 'Замена тронов Radiant и Dire в Дота 2. Бесплатно, с превью.',
      about: 'Здание, ради которого вся игра.',
    },
    tormentor: {
      name: 'Торментор',
      title: 'Моды на Торментора в Доте 2',
      h1: 'Моды на Торментора в Доте 2',
      description: 'Замена модели Торментора в Дота 2. Бесплатно, с превью.',
      about: 'Торментор, заменённый.',
    },
    other: {
      name: 'Полезное',
      title: 'Полезные моды для Доты 2: радиусы, цвет клика, профиль',
      h1: 'Полезные моды для Доты 2',
      description: 'Моды для Дота 2, которые находят, когда ищут проблему: видимый радиус реагра тавера, радиус мин Течиса, цвет клика, мишень в профиле.',
      about: 'Это те моды, которые никто не ищет словом «моды». Человек хочет видеть, с какого расстояния вышка переагривается, или устал терять свой клик на светлой карте, и добирается сюда часами позже. Каждый из них - такой же файл в папке игры, как любой другой мод, и так же включается и выключается одним кликом.',
    },
    'high-five': {
      name: 'Пятюни',
      title: 'Моды на пятюню в Доте 2',
      h1: 'Моды на пятюню в Доте 2',
      description: 'Замена анимации и эффекта пятюни в Дота 2. Бесплатно, с превью.',
      about: 'Единственное взаимодействие, которое игра даёт тебе с союзником.',
    },
  },
};

/** A category with nothing written for it still gets a page, titled from its id. */
export function categoryText(lang: Lang, id: string): CategoryCopy {
  const written = categoryCopy[lang][id];
  if (written) return written;
  const name = id.replace(/-/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
  return lang === 'ru'
    ? {
        name,
        title: `${name} для Доты 2: моды с превью`,
        h1: `${name}: моды для Доты 2`,
        description: `Моды категории «${name}» из каталога Dota2PornFx, с превью. Бесплатно и в один клик.`,
        about: '',
      }
    : {
        name,
        title: `Dota 2 ${name.toLowerCase()} mods`,
        h1: `Dota 2 ${name.toLowerCase()} mods`,
        description: `Mods in the ${name} category of the Dota2PornFx catalog, with previews. Free, and installed in one click.`,
        about: '',
      };
}
