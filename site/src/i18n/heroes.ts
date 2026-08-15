/**
 * The words on the hero pages, in both languages.
 *
 * There are 126 of these pages per language and they are generated, which is exactly the shape
 * of page a search engine is right to be suspicious of. What keeps them from being filler is
 * that each one carries something no other page has: the mods that actually exist for that
 * hero, what each one replaces, who made it, and a picture of it. The sentences around that
 * are the same everywhere, and that is fine - the list is the page.
 *
 * Hero names carry the game's own spelling on both halves, and the Russian half adds the
 * nickname the hero is played under where there is one: "моды на Пуджа" is the query, and a
 * page that only ever writes "Pudge" has nothing for it to match. The nicknames and their
 * accusative forms live in hero-names.ts; a hero missing from that table reads exactly as it
 * did before, because inventing a nickname nobody uses helps nobody.
 */
export interface HeroCopy {
  indexTitle: string;
  indexH1: string;
  indexDescription: string;
  indexLead: string;
  /** Carries {count}: how many heroes have something. */
  indexCount: string;
  modsWord: [string, string, string];

  /** All carry {hero}. */
  title: string;
  h1: string;
  description: string;
  /** The same three for a hero with a Russian nickname: {ru} names him, {ruAcc} asks for him. */
  titleAka: string;
  h1Aka: string;
  descriptionAka: string;
  /** "Его же пишут как {alts}." Only when the hero has other spellings on file. */
  aka: string;
  lead: string;
  /** Carries {hero} and {count} plus the agreeing noun in {word}. */
  intro: string;
  changes: string;
  by: string;
  install: string;
  installBody: string;
  back: string;
  alt: string;
  noSlots: string;
  otherHeroes: string;
}

export const heroCopy: Record<'en' | 'ru', HeroCopy> = {
  en: {
    indexTitle: 'Dota 2 mods by hero: skins for every hero',
    indexH1: 'Dota 2 mods by hero',
    indexDescription:
      'Every Dota 2 hero with the skins and mods that exist for them, from the open Dota2PornFx catalog. Pick a hero and see what is there, with previews.',
    indexLead:
      'Every hero somebody has made something for, with how many mods there are. All of it from the Dota2PornFx catalog, and all of it installable in one click.',
    indexCount: '{count} heroes have something made for them',
    modsWord: ['mod', 'mods', 'mods'],

    title: '{hero} mods and skins for Dota 2',
    h1: '{hero} mods for Dota 2',
    description:
      'Every {hero} skin and mod in the Dota2PornFx catalog, with previews and what each one replaces. Free, and installed in one click.',
    // English has no second name for a hero, so these are the same three strings.
    titleAka: '{hero} mods and skins for Dota 2',
    h1Aka: '{hero} mods for Dota 2',
    descriptionAka:
      'Every {hero} skin and mod in the Dota2PornFx catalog, with previews and what each one replaces. Free, and installed in one click.',
    aka: '',
    lead: 'What has been made for {hero}, what each one changes, and who made it.',
    intro:
      'There are <b>{count} {word}</b> for {hero} in the Dota2PornFx catalog. Each one is a cosmetic change on your own screen: nobody else in the match sees it, and your Steam inventory is untouched.',
    changes: 'Replaces',
    by: 'by',
    install: 'Installing any of these',
    installBody:
      'Open Dota 2 Mod Manager, find the hero, press Install. The app puts the file in a free pak slot in the folder your game mounts, tells you when two mods carry the same file, and puts everything back after a Dota patch. <a href="~/docs/install/">The full guide</a>, or <a href="~/docs/install/#manual">the manual route</a> if you would rather do it yourself.',
    back: 'All heroes',
    alt: '{mod}: a {hero} mod for Dota 2',
    noSlots: 'a recolour',
    otherHeroes: 'Other heroes',
  },

  ru: {
    indexTitle: 'Моды на героев Доты 2: скины по каждому герою',
    indexH1: 'Моды Доты 2 по героям',
    indexDescription:
      'Все герои Доты 2 и скины, которые для них сделаны, из открытого каталога Dota2PornFx. Выбери героя и посмотри, что есть, с превью.',
    indexLead:
      'Каждый герой, для которого кто-то что-то сделал, и сколько на него модов. Всё из каталога Dota2PornFx и всё ставится в один клик.',
    indexCount: 'Героев, для которых что-то сделано: {count}',
    modsWord: ['мод', 'мода', 'модов'],

    title: 'Моды и скины на {hero} для Доты 2',
    h1: 'Моды на {hero} в Доте 2',
    description:
      'Все скины и моды на {hero} из каталога Dota2PornFx: превью и что каждый мод заменяет. Бесплатно и в один клик.',
    titleAka: 'Моды на {ruAcc}: скины на {hero} для Доты 2',
    h1Aka: 'Моды на {ruAcc} в Доте 2',
    descriptionAka:
      'Все скины и моды на {ruAcc} ({hero}) из каталога Dota2PornFx: превью и что каждый мод заменяет. Бесплатно и в один клик.',
    aka: 'Его же пишут как {alts}.',
    lead: 'Что сделано на {ruAcc} ({hero}), что каждый мод меняет и кто его автор.',
    intro:
      'На {ruAcc} в каталоге Dota2PornFx <b>{count} {word}</b>. Каждый - косметическая правка на твоём экране: соперники и союзники её не видят, инвентарь Steam не трогается.',
    changes: 'Меняет',
    by: 'автор',
    install: 'Как поставить любой из них',
    installBody:
      'Открой Dota 2 Mod Manager, найди героя, нажми «Установить». Программа положит файл в свободный слот pak в ту папку, которую монтирует игра, скажет, если два мода несут один файл, и вернёт всё на место после патча Доты. <a href="~/docs/install/">Полный гайд</a> или <a href="~/docs/install/#manual">установка руками</a>, если хочется самому.',
    back: 'Все герои',
    alt: '{mod}: мод на {hero} для Доты 2',
    noSlots: 'перекраска',
    otherHeroes: 'Другие герои',
  },
};

/** What a replaced slot is called. The ids come out of the model paths inside the archive. */
export const slotNames: Record<'en' | 'ru', Record<string, string>> = {
  en: {
    base: 'the model',
    head: 'head',
    misc: 'misc',
    weapon: 'weapon',
    arms: 'arms',
    shoulder: 'shoulders',
    back: 'back',
    belt: 'belt',
    legs: 'legs',
    tail: 'tail',
    wings: 'wings',
    offhand: 'off-hand',
    mount: 'mount',
    shield: 'shield',
  },
  ru: {
    base: 'модель',
    head: 'голова',
    misc: 'разное',
    weapon: 'оружие',
    arms: 'руки',
    shoulder: 'плечи',
    back: 'спина',
    belt: 'пояс',
    legs: 'ноги',
    tail: 'хвост',
    wings: 'крылья',
    offhand: 'вторая рука',
    mount: 'ездовое',
    shield: 'щит',
  },
};
