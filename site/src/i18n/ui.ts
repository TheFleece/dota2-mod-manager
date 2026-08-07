/**
 * Every string the site shows, in both languages.
 *
 * One table rather than one file per page: the site is small, and the thing that actually
 * goes wrong with two languages is a string that exists in one and not the other. Side by
 * side, that is visible while typing. The app's own dictionaries work the same way.
 */
export const languages = { en: 'English', ru: 'Русский' } as const;
export type Lang = keyof typeof languages;

export const defaultLang: Lang = 'en';

export const ui = {
  en: {
    'site.name': 'Dota 2 Mod Manager',
    'site.tagline': 'Dota 2 mods, installed properly',

    'nav.docs': 'Docs',
    'nav.faq': 'FAQ',
    'nav.github': 'GitHub',
    'nav.discord': 'Discord',
    'nav.download': 'Download',

    'hero.title': 'Dota 2 mods, installed properly',
    'hero.lead': 'A free desktop app that installs skins, terrains, announcers and music from the community catalog, unlocks the cosmetics your account already owns, and lets you share a whole setup as one link.',
    'hero.download': 'Download for Windows',
    'hero.source': 'Source on GitHub',
    'hero.free': 'Free, open source, no account needed.',

    'foot.built': 'Built by',
    'foot.license': 'GPL-3.0, source on GitHub',
    'foot.unofficial': 'Not affiliated with Valve. Dota 2 is a trademark of Valve Corporation.',
    'foot.privacy': 'Privacy',
    'foot.terms': 'Terms',

    'lang.switch': 'Русский',
  },
  ru: {
    'site.name': 'Dota 2 Mod Manager',
    'site.tagline': 'Моды для Dota 2, поставленные по-человечески',

    'nav.docs': 'Документация',
    'nav.faq': 'Вопросы',
    'nav.github': 'GitHub',
    'nav.discord': 'Discord',
    'nav.download': 'Скачать',

    'hero.title': 'Моды для Dota 2, поставленные по-человечески',
    'hero.lead': 'Бесплатная программа: ставит скины, ландшафты, комментаторов и музыку из общего каталога, открывает косметику, которая у тебя и так есть, и позволяет поделиться всей сборкой одной ссылкой.',
    'hero.download': 'Скачать для Windows',
    'hero.source': 'Исходники на GitHub',
    'hero.free': 'Бесплатно, открытый код, без регистрации.',

    'foot.built': 'Сделал',
    'foot.license': 'GPL-3.0, исходники на GitHub',
    'foot.unofficial': 'Проект не связан с Valve. Dota 2 - товарный знак Valve Corporation.',
    'foot.privacy': 'Приватность',
    'foot.terms': 'Условия',

    'lang.switch': 'English',
  },
} as const;

/** The translator for one page. Falls back to English so a missing string is visible, not blank. */
export function useTranslations(lang: Lang) {
  return function t(key: keyof (typeof ui)['en']): string {
    return (ui[lang] as Record<string, string>)[key] ?? ui[defaultLang][key];
  };
}

/** "/ru/docs/" -> "ru"; anything else is English, which sits at the root. */
export function langFromUrl(url: URL): Lang {
  const [, first] = url.pathname.split('/');
  return first in languages ? (first as Lang) : defaultLang;
}

/** The same page in the other language, for the switcher and for hreflang. */
export function pathIn(lang: Lang, path: string): string {
  const bare = path.replace(/^\/(en|ru)(?=\/|$)/, '') || '/';
  const withSlashes = bare.endsWith('/') ? bare : `${bare}/`;
  return lang === defaultLang ? withSlashes : `/${lang}${withSlashes}`;
}
