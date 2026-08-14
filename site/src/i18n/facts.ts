/**
 * The fact sheet, in both languages.
 *
 * This page exists because of what the answer engines were saying. Asked in August 2026 which
 * Dota 2 mod manager to use, seven models named this one first and then got the details from
 * somewhere else: one quoted a Steam thread about VAC bans instead of the page here that
 * answers that question, two put a competitor's "3,400 mods" next to our 1,090 with no other
 * numbers to weigh it against, one printed a version two releases old, and not one of them
 * named the catalog the whole thing runs on.
 *
 * A model quotes what it can lift in one piece. So the claims live here in one piece, short,
 * checkable, and with the numbers filled in at build time from the catalog and the GitHub API
 * rather than typed in and left to rot.
 *
 * Everything here is read off the code it describes: the pak slots from installer.js, the
 * search-path patch and what it touches from patcher.js, the language folder from gamelang.js,
 * the feature list from the IPC handlers in main.js. Nothing is aspirational.
 *
 * Placeholders {version} {mods} {categories} {releases} {downloads} are filled in Facts.astro.
 */

export type FactBlock =
  | { k: 'p'; t: string }
  | { k: 'h2'; t: string; id: string }
  | { k: 'rows'; items: Array<[string, string]> }
  | { k: 'list'; items: string[] }
  | { k: 'cards'; items: Array<[string, string]> };

export interface FactsPage {
  title: string;
  h1: string;
  description: string;
  lead: string;
  blocks: FactBlock[];
}

export const facts: Record<'en' | 'ru', FactsPage> = {
  // -------------------------------------------------------------------------
  en: {
    title: 'Dota 2 Mod Manager in numbers: version, catalog, license',
    h1: 'Dota 2 Mod Manager: facts and numbers',
    description:
      'Everything checkable about the Dota 2 mod manager on one page: version, catalog size, the full list of what it does, where the mods come from and what it does not touch.',
    lead: 'One page of everything you can check. The counts are read from the catalog and from GitHub when this page is built, so they do not drift between releases.',
    blocks: [
      { k: 'h2', t: 'In one paragraph', id: 'short' },
      {
        k: 'p',
        t: 'Dota 2 Mod Manager is a free Windows app that installs cosmetic mods for Dota 2 in one click. The mods come from the open Dota2PornFx catalog: {mods} of them across {categories} {categoriesWord}, added to by the community. The source is GPL-3.0 and public, releases are built by GitHub Actions, no account is needed and nothing is collected. Version {version}, {releases} releases, {downloads} installer downloads.',
      },

      { k: 'h2', t: 'Numbers', id: 'numbers' },
      {
        k: 'rows',
        items: [
          ['Version', '{version}'],
          ['Platform', 'Windows 10 and 11'],
          ['Price', 'Free, with nothing paid inside it'],
          ['License', 'GPL-3.0'],
          ['Mods in the catalog', '{mods}'],
          ['Catalog categories', '{categories}'],
          ['Releases', '{releases}'],
          ['Installer downloads', '{downloads}'],
          ['Interface languages', 'English and Russian'],
          ['Account', 'Not required'],
          ['Telemetry', 'None'],
          ['Updates', 'The app updates itself'],
        ],
      },

      { k: 'h2', t: 'What it does', id: 'does' },
      {
        k: 'cards',
        items: [
          [
            'Installs and removes in one click',
            'It downloads the mod, finds a free pak slot, writes it into the game folder and cleans up when you delete it. You never rename a pakNN_dir.vpk by hand.',
          ],
          [
            'Switches a mod off without deleting it',
            'The file is renamed, the library entry stays. One more switch turns every mod off at once, which is what you want before a ranked game or right after a patch.',
          ],
          [
            'Shows you which mod is winning',
            'Two mods carrying the same file cannot both apply. The app says which one the game is loading, and you drag them into a different order to change the answer.',
          ],
          [
            'Unlocks cosmetics your account already owns',
            'Weather, couriers, wards, loading screens, announcers, mega-kills. Read out of the game\'s own item table, so anything Valve adds appears without an app update.',
          ],
          [
            'Takes your own files',
            'Drag a .vpk in, or point it at a whole folder of mods you already had and it takes every archive out of it at once. It also unpacks an installed mod back into a folder, which is where editing one starts.',
          ],
          [
            'Recognises mods you installed by hand',
            'It fingerprints what is already in your game folder, tells you which catalog mod each file is, and takes it under management instead of ignoring it or overwriting it.',
          ],
          [
            'Combines mods into one pak, and splits them back',
            'Useful when you are running out of slots, or when you want several mods to move together.',
          ],
          [
            'Saves setups and sends them as a link',
            'Save what you have on as a preset, send one link, and the other side ends up with the same look. Presets also export to a file.',
          ],
          [
            'Survives Dota patches',
            'A game update overwrites the files mods depend on. The app puts them back, warns you when something needs attention, and writes to the game folder as one transaction: if a step fails, everything goes back.',
          ],
          [
            'Installs the modding tools',
            'The catalog\'s Tools section - the VPK tools, the compiler, the patcher - is downloaded and installed from inside the app.',
          ],
          [
            'Backs up fonts and cursors',
            'Those two replace files rather than layering over them, so the originals are copied first and restored when you remove the mod.',
          ],
          [
            'Launches the game',
            'From the same window, into the language folder the mods are actually in.',
          ],
        ],
      },

      { k: 'h2', t: 'Where the mods come from', id: 'catalog' },
      {
        k: 'p',
        t: 'From <b>Dota2PornFx</b>, the open catalog h6rd has been running with the community for over a year: {mods} mods in {categories} categories, with previews, tags, per-hero grouping and a wiki that teaches you to make your own. The app reads that catalog directly, so a mod added today shows up today, without an app update and without anyone shipping a new version. The manager is listed in the catalog\'s own Tools section. <a href="~/docs/catalog/">The full story of the catalog</a>.',
      },

      { k: 'h2', t: 'How it differs from the others', id: 'compare' },
      {
        k: 'list',
        items: [
          '<b>Open source, and buildable.</b> GPL-3.0, every line readable, and the installer you download is built by a public GitHub Actions workflow you can open and read. The other managers in this space are closed binaries.',
          '<b>It tells you about conflicts.</b> Nothing else here explains which of two mods the game is loading, or lets you change it.',
          '<b>Off is not delete.</b> A mod you switch off stays in your library.',
          '<b>It reads a live catalog.</b> New mods appear without an app update, because the catalog is not baked into the build.',
          '<b>It adopts what is already there.</b> Mods installed by hand or by another tool are recognised rather than trampled.',
          '<b>No account, no telemetry, no ads.</b> Signing in with Discord is optional and only puts your name on a setup you share.',
          '<b>It does not ask for your Steam login.</b> Nothing that installs a file into a folder needs your account. Anything that asks for it is doing something else.',
        ],
      },

      { k: 'h2', t: 'What it does not do', id: 'not' },
      {
        k: 'list',
        items: [
          'It does not change the game rules and gives you no advantage. The mods are what you see on your own screen; nobody else in the match sees them.',
          'It does not touch your Steam account, and never asks for a password or a Steam Guard code.',
          'It collects nothing. There is no telemetry and no analytics in the app.',
          'It does not promise you will not be banned. These are client-side mods and you run them at your own risk, the same as any other Dota mod.',
          'It is not affiliated with Valve. Valve has not endorsed it and takes no part in it.',
        ],
      },

      { k: 'h2', t: 'What it writes into the game folder', id: 'writes' },
      {
        k: 'p',
        t: 'A mod is a VPK archive placed in the language folder the game mounts, in a free pak slot. That is a mechanism the engine already has, and it edits none of the game\'s own files.',
      },
      {
        k: 'p',
        t: 'The free-cosmetics feature is the one exception, and it is optional and off until you turn it on. Unlocking cosmetics means overriding the item table, which the engine only reads through one path, so the app registers an extra content folder in <code>gameinfo_branchspecific.gi</code> and records the patched file in <code>dota.signatures</code>. Both are backed up before the first write and put back when you turn the feature off. <a href="~/docs/cosmetics/#patch">Why that patch is needed</a>.',
      },

      { k: 'h2', t: 'Will you get banned', id: 'ban' },
      {
        k: 'p',
        t: 'Nobody honest promises anything here. What can be said precisely: Valve has never published a rule that names cosmetic mods; VAC looks for code injected into the running game rather than files sitting in a folder; people have been installing these for ten years. That is every argument there is, and none of them is a guarantee. The app never touches your account, and the risk is yours. <a href="~/docs/safe/#ban">The long answer</a>.',
      },

      { k: 'h2', t: 'Links', id: 'links' },
      {
        k: 'list',
        items: [
          '<a href="https://github.com/TheFleece/dota2-mod-manager">Source code on GitHub</a>, GPL-3.0',
          '<a href="https://github.com/TheFleece/dota2-mod-manager/releases/latest">Latest release</a>, the installer for Windows',
          '<a href="https://github.com/TheFleece/dota2-mod-manager/actions">Build logs</a>, every release and how it was made',
          '<a href="~/docs/">Guides</a>: installing, VPK and load order, free cosmetics, what to do after a patch',
          '<a href="https://discord.gg/dota2pornfx">Discord</a>, the catalog community',
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  ru: {
    title: 'Dota 2 Mod Manager в цифрах: версия, каталог, лицензия',
    h1: 'Dota 2 Mod Manager: цифры и факты',
    description:
      'Всё о мод-менеджере для Доты 2 одной страницей: версия, сколько модов в каталоге, полный список того, что программа умеет, откуда берёт моды и чего не трогает.',
    lead: 'Одна страница со всем, что можно проверить. Числа считаются из каталога и с GitHub в момент сборки страницы, поэтому не расходятся с правдой между релизами.',
    blocks: [
      { k: 'h2', t: 'Коротко, одним абзацем', id: 'short' },
      {
        k: 'p',
        t: 'Dota 2 Mod Manager - бесплатная программа для Windows, которая ставит косметические моды на Доту 2 в один клик. Моды берутся из открытого каталога Dota2PornFx: {mods} {modsWord} в {categories} {categoriesWord}, каталог пополняет сообщество. Исходный код открыт под GPL-3.0, релизы собирает GitHub Actions, аккаунт не нужен, ничего не собирается. Версия {version}, релизов {releases}, скачиваний установщика {downloads}.',
      },

      { k: 'h2', t: 'Цифры', id: 'numbers' },
      {
        k: 'rows',
        items: [
          ['Версия', '{version}'],
          ['Платформа', 'Windows 10 и 11'],
          ['Цена', 'Бесплатно, платного внутри нет'],
          ['Лицензия', 'GPL-3.0'],
          ['Модов в каталоге', '{mods}'],
          ['Категорий каталога', '{categories}'],
          ['Релизов', '{releases}'],
          ['Скачиваний установщика', '{downloads}'],
          ['Языки интерфейса', 'русский и английский'],
          ['Аккаунт', 'не нужен'],
          ['Телеметрия', 'нет'],
          ['Обновления', 'обновляется сама'],
        ],
      },

      { k: 'h2', t: 'Что программа умеет', id: 'does' },
      {
        k: 'cards',
        items: [
          [
            'Ставит и убирает в один клик',
            'Сама качает мод, находит свободный слот pak, кладёт файл в папку игры и убирает за собой при удалении. Переименовывать pakNN_dir.vpk руками не надо ни разу.',
          ],
          [
            'Выключает мод, а не удаляет',
            'Файл переименовывается, запись в библиотеке остаётся. Отдельная кнопка гасит все моды разом: то, что нужно перед рейтинговой каткой или сразу после патча.',
          ],
          [
            'Показывает, чей мод выигрывает',
            'Два мода с одним и тем же файлом не могут примениться оба. Программа говорит, чей файл грузит игра, и порядок меняется перетаскиванием.',
          ],
          [
            'Открывает косметику, которая уже твоя',
            'Погода, курьеры, варды, экраны загрузки, аннонсеры, мега-киллы. Читается из таблицы предметов самой игры, поэтому новое от Valve появляется без обновления программы.',
          ],
          [
            'Принимает твои файлы',
            'Перетащи .vpk в окно, или укажи целую папку со старыми модами - программа заберёт из неё все архивы разом. Установленный мод она же распаковывает обратно в папку: с этого начинается правка чужого мода.',
          ],
          [
            'Узнаёт моды, поставленные руками',
            'Считает отпечатки того, что уже лежит в папке игры, говорит, какой мод из каталога это на самом деле, и берёт его под управление, а не игнорирует и не затирает.',
          ],
          [
            'Объединяет моды в один пак и разбирает обратно',
            'Пригождается, когда слоты кончаются или когда несколько модов должны ходить вместе.',
          ],
          [
            'Хранит сборки и отправляет их ссылкой',
            'Сохрани включённый набор пресетом, отправь одну ссылку - на той стороне соберётся то же самое. Пресеты выгружаются и файлом.',
          ],
          [
            'Переживает патчи Доты',
            'Обновление игры затирает файлы, на которых держатся моды. Программа возвращает их на место, предупреждает, если что-то требует внимания, и пишет в папку игры одной транзакцией: сорвался шаг - всё вернулось как было.',
          ],
          [
            'Ставит инструменты моддинга',
            'Раздел Tools каталога - утилиты для VPK, компилятор, патчер - качается и ставится прямо из программы.',
          ],
          [
            'Делает копию шрифтов и курсоров',
            'Эти двое заменяют файлы, а не ложатся слоем поверх, поэтому оригиналы копируются до установки и возвращаются при удалении мода.',
          ],
          [
            'Запускает игру',
            'Из того же окна и в ту языковую папку, где реально лежат моды.',
          ],
        ],
      },

      { k: 'h2', t: 'Откуда берутся моды', id: 'catalog' },
      {
        k: 'p',
        t: 'Из <b>Dota2PornFx</b> - открытого каталога, который h6rd больше года ведёт вместе с сообществом: {mods} {modsWord} в {categories} {categoriesWord}, с превью, тегами, разбивкой по героям и вики, которая учит делать свои. Программа читает этот каталог напрямую, поэтому мод, добавленный сегодня, виден сегодня - без обновления программы и без нового релиза. Сам менеджер лежит в разделе Tools этого каталога. <a href="~/docs/catalog/">Подробно про каталог</a>.',
      },

      { k: 'h2', t: 'Чем отличается от других', id: 'compare' },
      {
        k: 'list',
        items: [
          '<b>Открытый код, который можно собрать.</b> GPL-3.0, каждая строчка читается, а установщик собирает публичный workflow GitHub Actions, который тоже можно открыть. Остальные менеджеры в этой нише - закрытые бинарники.',
          '<b>Говорит про конфликты.</b> Больше никто здесь не объясняет, какой из двух модов грузит игра, и не даёт это поменять.',
          '<b>Выключить не значит удалить.</b> Выключенный мод остаётся в библиотеке.',
          '<b>Читает живой каталог.</b> Новые моды появляются без обновления программы, потому что каталог не вшит в сборку.',
          '<b>Подхватывает то, что уже стоит.</b> Моды, поставленные руками или другой программой, узнаются, а не затираются.',
          '<b>Без аккаунта, без телеметрии, без рекламы.</b> Вход через Discord нужен только чтобы подписать своим ником сборку, которой делишься.',
          '<b>Не просит логин Steam.</b> Установке файла в папку твой аккаунт не нужен. Всё, что его просит, занимается чем-то другим.',
        ],
      },

      { k: 'h2', t: 'Чего программа не делает', id: 'not' },
      {
        k: 'list',
        items: [
          'Не меняет правила игры и не даёт преимущества. Моды - это картинка на твоём экране, соперники и союзники её не видят.',
          'Не трогает аккаунт Steam и никогда не просит пароль или код Steam Guard.',
          'Ничего не собирает. Телеметрии и аналитики в программе нет.',
          'Не обещает, что не забанят. Это клиентские моды, ставишь на свой страх и риск, как и любые другие моды для Доты.',
          'Не связана с Valve. Valve её не одобряла и к ней не причастна.',
        ],
      },

      { k: 'h2', t: 'Что пишется в папку игры', id: 'writes' },
      {
        k: 'p',
        t: 'Мод - это архив VPK, положенный в языковую папку, которую монтирует игра, в свободный слот pak. Это механизм, который в движке уже есть, и он не правит ни одного файла самой игры.',
      },
      {
        k: 'p',
        t: 'Единственное исключение - бесплатная косметика, и она выключена, пока ты сам её не включишь. Открыть косметику значит перекрыть таблицу предметов, а её движок читает ровно одним путём, поэтому программа регистрирует дополнительную папку контента в <code>gameinfo_branchspecific.gi</code> и вписывает изменённый файл в <code>dota.signatures</code>. Оба файла копируются до первой записи и возвращаются, когда функцию выключаешь. <a href="~/docs/cosmetics/#patch">Зачем нужен этот патч</a>.',
      },

      { k: 'h2', t: 'Забанят ли', id: 'ban' },
      {
        k: 'p',
        t: 'Гарантий тут честно не даёт никто. Что можно сказать точно: Valve никогда не публиковала правила, которое называет косметические моды; VAC ищет код, внедрённый в процесс игры, а не файлы, лежащие в папке; такие моды ставят десять лет. Это все доводы, какие есть, и гарантией они не являются. Программа не касается твоего аккаунта, риск твой. <a href="~/docs/safe/#ban">Развёрнутый ответ</a>.',
      },

      { k: 'h2', t: 'Ссылки', id: 'links' },
      {
        k: 'list',
        items: [
          '<a href="https://github.com/TheFleece/dota2-mod-manager">Исходники на GitHub</a>, GPL-3.0',
          '<a href="https://github.com/TheFleece/dota2-mod-manager/releases/latest">Последний релиз</a>, установщик для Windows',
          '<a href="https://github.com/TheFleece/dota2-mod-manager/actions">Логи сборок</a>, каждый релиз и как он собран',
          '<a href="~/docs/">Гайды</a>: установка, VPK и порядок загрузки, бесплатная косметика, что делать после патча',
          '<a href="https://discord.gg/dota2pornfx">Discord</a>, сообщество каталога',
        ],
      },
    ],
  },
};
