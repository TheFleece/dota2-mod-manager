/**
 * The landing's own words, in both languages.
 *
 * Most of this is carried over from the site the project already had rather than written
 * fresh: that copy has been in front of users for months, and rewriting working text to make
 * it new is how a page loses the phrasing that earned its trust. What changed is what became
 * untrue - the old footer promised a code-signing certificate from an application that has
 * since been turned down.
 *
 * The numbers are real and checkable: 27 releases and 17,515 installer downloads, read off
 * the GitHub releases API on 2026-08-07. Stars and forks are deliberately absent - there are
 * eight of them, and a number that small argues against the thing it is meant to support.
 */
export interface Landing {
  heroTitle: string;
  heroLead: string;
  download: string;
  source: string;
  heroMeta: string;

  shotsTitle: string;
  shotCatalog: string;
  shotLibrary: string;
  shotHeroes: string;

  whatTitle: string;
  cards: Array<[string, string]>;

  trustTitle: string;
  trustLead: string;
  trustFacts: Array<[string, string]>;
  smartscreenTitle: string;
  smartscreen: string;

  faqTitle: string;
  faq: Array<[string, string]>;

  ctaTitle: string;
  ctaLead: string;
}

export const landing: Record<'en' | 'ru', Landing> = {
  en: {
    heroTitle: 'Mods for Dota 2, without the file juggling',
    heroLead: '1100+ skins, terrains, announcers and music in one catalog. The cosmetics your account already owns. Setups you can hand to a friend as a link.',
    download: 'Download for Windows',
    source: 'Source code',
    heroMeta: 'Windows 10/11 · free · open source · updates itself',

    shotsTitle: 'What it looks like',
    shotCatalog: 'The catalog: every mod in the community collection, sorted the way its authors sorted it.',
    shotLibrary: 'Your mods: switch one off before a match, back on after. The app says when one mod is covering another.',
    shotHeroes: 'Everything for one hero in one place, with the tags that say what a mod actually changes.',

    whatTitle: 'What you get',
    cards: [
      ['One click in, one click out', 'The app downloads the mod, puts it in a free pak slot and cleans up after itself. No copying files, no renaming pak51_dir.vpk by hand.'],
      ['Switch off, do not delete', 'Turn a mod off before a match and back on after. Your library stays, the game folder stays clean.'],
      ['Cosmetics you already own', 'Weather, couriers, wards, loading screens, announcers, mega-kills. Read from the game\'s own item table, so anything Valve adds shows up by itself.'],
      ['It tells you when mods collide', 'Two mods that carry the same file cannot both win. The app says which one the game is loading and lets you swap the order.'],
      ['Setups by link', 'Save the mods you run as a preset and send it in one message. The other side opens it and gets the same look.'],
      ['It survives Dota patches', 'After a game update the app puts back what the patch wiped, and it writes to the game folder as one transaction - if anything fails, everything goes back.'],
    ],

    trustTitle: 'Why you can check this one',
    trustLead: 'It is a program that writes into your game folder, downloaded from the internet. That deserves suspicion. Here is what can be verified instead of trusted.',
    trustFacts: [
      ['Open source, GPL-3.0', 'Every line is in the repository. Not "source available on request" - readable right now.'],
      ['Built by GitHub Actions', 'Releases are built from that source by a public workflow, not uploaded from somebody\'s desktop.'],
      ['27 releases, 17,500+ downloads', 'It has been in the open since long before you found it, and the whole history is there.'],
      ['No account, no telemetry', 'Signing in is optional and only puts your name on a setup you share. Nothing is collected.'],
    ],
    smartscreenTitle: 'Windows will warn you, and here is why',
    smartscreen: 'The installer is not signed with a paid certificate, so SmartScreen says "unknown publisher". Click <b>More info</b>, then <b>Run anyway</b>. A certificate costs a few hundred dollars a year, and this is free software; the free programme for open-source projects turned the application down for not being famous enough yet.',

    faqTitle: 'Questions',
    faq: [
      ['Is this a cheat?', 'No. The mods change how things look on your screen only. Nobody else in the match sees them.'],
      ['Will I get banned?', 'Nobody can promise anything here: these are client-side mods, and you run them at your own risk, same as any other Dota mod. The app never touches your account, and there is no login unless you want your name on a shared setup.'],
      ['My antivirus said something.', 'It happens to unsigned installers with no reputation yet. Microsoft reviewed one such report about this app in August 2026 and removed the detection. If yours complains, the file you downloaded is built in the open by GitHub Actions and you can check the workflow that made it.'],
      ['How do I remove a mod?', 'Delete it in My mods and the game goes back to how it was. Fonts and cursors are restored from the backup the app made before installing.'],
      ['Where do the mods come from?', 'The Dota2PornFx catalog. The app reads it directly, so new mods appear without an app update.'],
      ['Does it work after a Dota update?', 'Yes. After a game patch the app puts back what the update wiped, and warns you when something needs attention.'],
    ],

    ctaTitle: 'Get it',
    ctaLead: 'Windows 10 or 11. No account. It updates itself from here on.',
  },

  ru: {
    heroTitle: 'Моды для Dota 2 без возни с файлами',
    heroLead: '1100+ скинов, ландшафтов, комментаторов и музыки в одном каталоге. Косметика, которая у тебя и так есть. Сборки, которые отправляются другу одной ссылкой.',
    download: 'Скачать для Windows',
    source: 'Исходный код',
    heroMeta: 'Windows 10/11 · бесплатно · открытый код · обновляется само',

    shotsTitle: 'Как это выглядит',
    shotCatalog: 'Каталог: всё, что есть в общей коллекции, в том порядке, в котором это разложили её авторы.',
    shotLibrary: 'Мои моды: выключил перед каткой, включил после. Приложение говорит, когда один мод перекрывает другой.',
    shotHeroes: 'Всё по одному герою в одном месте, с чипами, которые говорят, что мод меняет на самом деле.',

    whatTitle: 'Что это даёт',
    cards: [
      ['Поставил и убрал в один клик', 'Приложение само качает мод, кладёт его в свободный слот и убирает за собой. Не надо копировать файлы и переименовывать pak51_dir.vpk руками.'],
      ['Выключить, а не удалять', 'Выключи мод перед каткой и включи обратно после. Библиотека остаётся, папка игры чистая.'],
      ['Косметика, которая уже твоя', 'Погода, курьеры, варды, экраны загрузки, комментаторы, мега-киллы. Читается из таблицы предметов самой игры, поэтому новое от Valve появляется само.'],
      ['Говорит, когда моды спорят', 'Два мода с одним и тем же файлом не могут выиграть оба. Приложение показывает, чей файл грузит игра, и даёт поменять порядок.'],
      ['Сборки ссылкой', 'Сохрани набор включённых модов пресетом и отправь одним сообщением. На той стороне откроется то же самое.'],
      ['Переживает патчи Доты', 'После обновления игры приложение возвращает на место то, что патч стёр, а в папку игры пишет одной транзакцией: если что-то сорвётся, всё вернётся как было.'],
    ],

    trustTitle: 'Почему это можно проверить',
    trustLead: 'Это программа, которая пишет в папку с игрой и скачана из интернета. Подозрение тут уместно. Вот что можно проверить вместо того, чтобы верить на слово.',
    trustFacts: [
      ['Открытый код, GPL-3.0', 'Каждая строчка лежит в репозитории. Не «исходники по запросу», а прямо сейчас.'],
      ['Собирает GitHub Actions', 'Релизы собираются из этого кода публичным workflow, а не заливаются с чьего-то компьютера.'],
      ['27 релизов, 17 500+ скачиваний', 'Программа лежит на виду задолго до того, как ты о ней узнал, и вся история там же.'],
      ['Без аккаунта и без телеметрии', 'Вход нужен только чтобы подписать своим ником сборку, которой делишься. Ничего не собирается.'],
    ],
    smartscreenTitle: 'Windows будет ругаться, и вот почему',
    smartscreen: 'Установщик не подписан платным сертификатом, поэтому SmartScreen пишет «неизвестный издатель». Нажми <b>Подробнее</b>, затем <b>Выполнить в любом случае</b>. Сертификат стоит несколько сотен долларов в год, а программа бесплатная; бесплатная программа подписи для открытых проектов заявку отклонила - проект пока недостаточно известен.',

    faqTitle: 'Вопросы',
    faq: [
      ['Это чит?', 'Нет. Моды меняют только картинку у тебя на экране. Соперники и союзники ничего этого не видят.'],
      ['Забанят?', 'Гарантий тут не даёт никто: это клиентские моды, ставишь на свой страх и риск, как и любые другие моды для доты. Приложение не трогает твой аккаунт, вход нужен только если хочешь подписать свою сборку ником.'],
      ['Антивирус что-то сказал.', 'Так бывает с неподписанными установщиками без репутации. Microsoft разобрала одно такое обращение по этой программе в августе 2026 и сняла детект. Если ругается твой - файл собран на виду в GitHub Actions, и workflow, который его собрал, можно открыть и прочитать.'],
      ['Как убрать мод?', 'Кнопка «Удалить» в «Моих модах» возвращает игру к исходному виду. Шрифты и курсоры восстанавливаются из копии, которую приложение сделало до установки.'],
      ['Откуда моды?', 'Каталог Dota2PornFx. Приложение читает его напрямую, поэтому новые моды появляются без обновления программы.'],
      ['А после патча доты работает?', 'Да. После обновления игры приложение возвращает на место то, что патч стёр, и предупреждает, если что-то требует внимания.'],
    ],

    ctaTitle: 'Забрать',
    ctaLead: 'Windows 10 или 11. Без аккаунта. Дальше обновляется само.',
  },
};
