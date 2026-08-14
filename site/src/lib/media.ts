/**
 * Every picture and the one film, named once.
 *
 * Four places need to agree about these: the landing that shows them, the structured data that
 * nominates them, the sitemap that submits them, and the alt text that describes them. They
 * were spread across three files, which is how a site ends up with a screenshot whose alt says
 * "Каталог модов в приложении" and a sitemap that never mentions it exists.
 *
 * The names are what they are on purpose. `ru-catalog.webp` tells an image crawler nothing;
 * the file name, the alt and the caption are the only three things it has, and the site was
 * spending all three on the word "catalog". Google Images had seven pictures to choose from on
 * the entire site and showed three.
 */
export type Lang = 'en' | 'ru';

export const shotNames = ['catalog', 'heroes', 'my-mods'] as const;
export type ShotName = (typeof shotNames)[number];

export const shotUrl = (lang: Lang, name: ShotName) =>
  `/screenshots/dota-2-mod-manager-${name}-${lang}.webp`;

export const tourUrl = (lang: Lang) => `/video/dota-2-mod-manager-tour-${lang}.webm`;
export const tourPoster = (lang: Lang) => `/video/dota-2-mod-manager-tour-${lang}.webp`;

/** Measured off the files themselves, not remembered: 24.15s and 24.40s, both PT24S. */
export const TOUR_SECONDS = 24;
export const TOUR_ISO = 'PT24S';
/** When the clip was first published with the site. */
export const TOUR_UPLOADED = '2026-08-09';
export const TOUR_SIZE = { width: 880, height: 556 };
export const SHOT_SIZE = { width: 1360, height: 860 };

/**
 * What each picture is of, in a sentence.
 *
 * An alt that repeats the caption printed under the image teaches nothing twice. These say
 * which screen it is and what is on it, in the words somebody would search for.
 */
export const shotAlt: Record<Lang, Record<ShotName, string>> = {
  en: {
    catalog:
      'The Dota 2 mod catalog inside Dota 2 Mod Manager: cards from the Dota2PornFx collection with previews and tags',
    heroes: 'The heroes screen: every skin and mod for one Dota 2 hero in a single list',
    'my-mods': 'My mods: installed Dota 2 mods with toggles and their load order',
  },
  ru: {
    catalog:
      'Каталог модов для Доты 2 в окне Dota 2 Mod Manager: карточки скинов из коллекции Dota2PornFx с превью и тегами',
    heroes: 'Экран героев: все скины и моды на одного героя Доты 2 одним списком',
    'my-mods': 'Мои моды: установленные моды Доты 2 с переключателями и порядком загрузки',
  },
};

/** Short titles for the sitemap, where a caption and a title are separate fields. */
export const shotTitle: Record<Lang, Record<ShotName, string>> = {
  en: {
    catalog: 'Dota 2 mod catalog',
    heroes: 'Dota 2 mods by hero',
    'my-mods': 'Installed Dota 2 mods',
  },
  ru: {
    catalog: 'Каталог модов для Доты 2',
    heroes: 'Моды Доты 2 по героям',
    'my-mods': 'Установленные моды Доты 2',
  },
};

export const tourText: Record<Lang, { name: string; description: string }> = {
  en: {
    name: 'Installing two Dota 2 mods in one take',
    description:
      'Twenty-four seconds of Dota 2 Mod Manager: find a hero in the catalog, take a set, take a second one, install both. Filmed off the app itself, no cuts and no speed-up.',
  },
  ru: {
    name: 'Как поставить два мода на Доту 2, один дубль',
    description:
      'Двадцать четыре секунды работы Dota 2 Mod Manager: находим героя в каталоге, берём сет, берём второй, ставим оба. Снято с самого приложения, без склеек и без ускорения.',
  },
};
