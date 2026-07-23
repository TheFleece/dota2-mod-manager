/* Dota 2 Mod Manager — renderer i18n.
 * Russian is the source language. English strings are keyed by the exact Russian text,
 * using {0},{1}... placeholders for interpolated values. A missing key falls back to the
 * Russian source, so a not-yet-translated string stays readable instead of breaking.
 *
 * Usage:
 *   L`Настройки`                          -> tagged template, static text
 *   L`Пак «${name}» сохранён`             -> tagged template with values
 *   tr(CAT_RU[id])                        -> plain lookup for data-driven labels
 */
'use strict';

// current UI language. Seeded synchronously from localStorage so a returning user sees the
// right language with no flash; boot() reconciles it against settings.json (the source of truth).
window.I18N_LANG = (() => {
  try { return localStorage.getItem('uiLang') === 'ru' ? 'ru' : 'en'; } catch { return 'en'; }
})();

// locale used for date/number formatting
window.i18nLocale = () => (window.I18N_LANG === 'en' ? 'en' : 'ru');

// English plural forms keyed by the Russian "many" form passed to plural(n, one, few, many)
window.EN_PLURAL = {
  'модов': ['mod', 'mods'],
  'результатов': ['result', 'results'],
  'файлов': ['file', 'files'],
  'слотов': ['slot', 'slots'],
  'файлов опознаны': ['file recognized', 'files recognized'],
  'модов конфликтуют': ['mod conflicts', 'mods conflict'],
  'модов из каталога': ['mod from the catalog', 'mods from the catalog'],
  'своих модов': ['mod of your own', 'mods of your own'],
  'модов не получится передать': ['mod cannot be shared', 'mods cannot be shared'],
  'общих файлов': ['shared file', 'shared files'],
  'файлов склеены': ['file merged', 'files merged'],
};

const EN = {
  // ---------- category names (CAT_RU) ----------
  'Герои': 'Heroes', 'Эффекты предметов': 'Item effects', 'Предметы героев': 'Hero items',
  'Фоны меню': 'Menu backgrounds', 'Курсоры': 'Cursors', 'Мега-килл': 'Mega-kill', 'Шейдеры': 'Shaders',
  'Курьеры': 'Couriers', 'Ландшафты': 'Terrains', 'Крипы': 'Creeps', 'Деревья': 'Trees', 'Река': 'River',
  'Паки эффектов': 'Effect packs', 'Эмблемы': 'Emblems', 'Денай крипов': 'Creep deny',
  'Музыка': 'Music', 'Звуки героев': 'Hero sounds', 'Звуки': 'Sounds', 'Дальние атаки': 'Ranged attacks',
  'Разное': 'Other', 'Ранги': 'Ranks', 'Иконки предметов': 'Item icons', 'Экраны Versus': 'Versus screens',
  'Анонсеры': 'Announcers', 'Варды': 'Wards', 'Пьедесталы': 'Pedestals',
  'Эффекты героев': 'Hero FX', 'Пинги': 'Pings', 'Паки': 'Packs', 'Оптимизация': 'Optimization',
  'Тормент': 'Tormentor', 'Древние': 'Ancients', 'Рошан': 'Roshan',
  'Башни': 'Towers', 'Шрифты': 'Fonts', 'Сайты': 'Sites', 'Гайды': 'Guides', 'Новости': 'News',
  'Импортированный': 'Imported',

  // ---------- rail sections ----------
  'Мир': 'World', 'Эффекты': 'Effects', 'Интерфейс': 'Interface', 'Звук': 'Audio', 'Прочее': 'Other',

  // ---------- sort labels ----------
  'По умолчанию': 'Default', 'Сначала новые': 'Newest first',
  'По имени А-Я': 'Name A-Z', 'По имени Я-А': 'Name Z-A',

  // ---------- group / link labels ----------
  'Все герои': 'All heroes', 'Все предметы': 'All items', 'Все крипы': 'All creeps',
  'Все башни': 'All towers', 'Все типы': 'All types', 'Все группы': 'All groups',
  'Все категории': 'All categories',
  'Превью': 'Preview', 'Источник': 'Source', 'Автор': 'Author', 'Баг': 'Bug', 'Гайд': 'Guide',

  // ---------- nav / chrome (index.html static) ----------
  'Каталог': 'Catalog', 'Библиотека': 'Library', 'Пресеты': 'Presets',
  'Инструменты': 'Tools', 'Настройки': 'Settings',
  'Поиск модов…': 'Search mods…', 'Очистить': 'Clear', 'Свернуть': 'Minimize',
  'Развернуть': 'Maximize', 'Закрыть': 'Close', 'Поиск Dota 2…': 'Looking for Dota 2…',
  'Открыть папку модов': 'Open mods folder', 'Играть': 'Play',
  'Включить/выключить все моды сразу (для запуска ванильной игры)':
    'Turn all mods on/off at once (to launch the vanilla game)',
  'Запустить Dota 2 через Steam с твоими параметрами запуска':
    'Launch Dota 2 through Steam with your launch options',
  'Моды:': 'Mods:', 'вкл': 'on', 'выкл': 'off',

  // ---------- dialogs / common ----------
  'Удалить': 'Delete', 'Отмена': 'Cancel', 'ОК': 'OK', 'Готово': 'Done',
  'Пауза': 'Pause', 'Звук': 'Sound', 'На весь экран': 'Fullscreen',
  'мод': 'mod',

  // ---------- launch + master switch (app.js) ----------
  'Сначала укажи путь к Dota 2 в настройках': 'Set the Dota 2 path in Settings first',
  'Запуск Dota 2 без модов…': 'Launching Dota 2 without mods…',
  'Запуск Dota 2 с модами…': 'Launching Dota 2 with mods…',
  'Моды включены': 'Mods enabled',
  'Моды выключены — игра запустится ванильной': 'Mods disabled — the game will launch vanilla',

  // ---------- catalog ----------
  'Загрузка каталога…': 'Loading catalog…',
  'Не удалось загрузить каталог: {0}': 'Could not load the catalog: {0}',
  'Повторить': 'Retry',
  'Моды для Dota 2': 'Mods for Dota 2',
  '{0} модов в {1} категориях · каталог Dota2PornFx': '{0} mods in {1} categories · Dota2PornFx catalog',
  ' · обновлён {0}': ' · updated {0}',
  'Недавно добавленные': 'Recently added',
  'Категории': 'Categories',
  'Поиск:': 'Search:',
  'Ничего не найдено': 'Nothing found',
  'Ничего не найдено — сбрось фильтры': 'Nothing found — reset the filters',
  'Установленные': 'Installed',
  'Смотреть превью': 'Watch preview',
  'Установлен': 'Installed',
  'Пак · {0}': 'Pack · {0}',
  'Свой': 'Custom',
  'Ссылка': 'Link',

  // ---------- mod modal ----------
  'Смотреть превью ': 'Watch preview ',
  '· свой пак': '· custom pack',
  'не найден в каталоге': 'not in the catalog',
  ' · установлен': ' · installed',
  'Вернуть': 'Restore', 'Убрать': 'Remove',
  'Название своего пака…': 'Custom pack name…',
  'Сохранить пак': 'Save pack',
  'Удалить пак': 'Delete pack',
  'Установить пак ({0})': 'Install pack ({0})',
  'Установка…': 'Installing…', 'Установить': 'Install',
  'Открыть ссылку': 'Open link',
  'Гайд: {0}': 'Guide: {0}',
  'Шрифт ставится в файлы игры (game\\dota\\panorama\\fonts) — параметр запуска не нужен. Оригиналы сохраняются автоматически.':
    'The font is installed into the game files (game\\dota\\panorama\\fonts) — no launch option needed. Originals are backed up automatically.',
  'Курсор ставится в game\\dota\\resource\\cursor — параметр запуска не нужен. Оригиналы сохраняются автоматически.':
    'The cursor is installed into game\\dota\\resource\\cursor — no launch option needed. Originals are backed up automatically.',
  'Введи название пака': 'Enter a pack name',
  'В паке не осталось модов': 'No mods left in the pack',
  'Пак «{0}» сохранён — он появился в категории Паки': 'Pack «{0}» saved — it appears in the Packs category',
  'Удалить пак «{0}»?': 'Delete pack «{0}»?',
  'Удалить «{0}»?': 'Delete «{0}»?',
  '{0} удалён': '{0} removed',

  // ---------- install / conflicts ----------
  ' (и ещё {0})': ' (and {0} more)',
  'оба меняют {0}': 'both change {0}',
  'перекрываются {0} {1}': 'overlap on {0} {1}',
  '«{0}» и уже установленный «{1}»{2} конфликтуют — {3}. Одновременно работать не будут, победит тот, что грузится приоритетнее. Установить всё равно?':
    '«{0}» and the already-installed «{1}»{2} conflict — {3}. They won’t work at the same time; whichever loads with higher priority wins. Install anyway?',
  '{0} установлен': '{0} installed',
  'Пак «{0}»: установлено {1}, пропущено {2}{3}': 'Pack «{0}»: {1} installed, {2} skipped{3}',
  ', ошибок {0}': ', {0} failed',

  // ---------- library: pack rows ----------
  'Выбрать мод в паке': 'Select mod in pack',
  'Включить/выключить мод в паке': 'Enable/disable mod in pack',
  'Удалить из пака': 'Remove from pack',
  'Выбрать пак': 'Select pack',
  'Развернуть состав пака': 'Expand pack contents',
  'Пак · {0} {1}': 'Pack · {0} {1}',
  '{0} из {1} включено': '{0} of {1} enabled',
  'пусто': 'empty',
  'Включить/выключить пак целиком': 'Enable/disable whole pack',
  'Добавить моды в пак': 'Add mods to pack',
  'Добавить': 'Add',
  'Разобрать пак обратно на отдельные моды': 'Disband the pack back into separate mods',
  'Разобрать': 'Split',

  // ---------- library: normal rows ----------
  'Выбрать мод': 'Select mod',
  'всегда активен': 'always on',
  'Включить/выключить': 'Enable/disable',
  'Привязать к каталогу': 'Adopt into the catalog',
  'Привязать': 'Adopt',
  'Разбить на отдельные моды по героям': 'Split into separate mods by hero',
  'Сохранить мод одним .vpk файлом (для отправки автору каталога)':
    'Save the mod as a single .vpk (to send to the catalog author)',
  'Экспорт': 'Export',
  'Привязано: {0}': 'Adopted: {0}',

  // ---------- library: empty / search ----------
  'Пока ничего не установлено — загляни в Каталог': 'Nothing installed yet — check the Catalog',
  'Ничего не найдено по запросу': 'Nothing matches your search',
  'Выбери моды': 'Pick mods',
  'Нет отдельных модов для добавления': 'No standalone mods to add',
  'Выбери минимум 2 элемента': 'Pick at least 2 items',
  'Название объединённого пака:': 'Combined pack name:',
  'Название пака:': 'Pack name:',
  'напр. «Анимешный сет»': 'e.g. «Anime set»',
  'Объединить': 'Combine',
  'Пак «{0}»: {1} {2}': 'Pack «{0}»: {1} {2}',
  'Пересечения файлов: {0} (победил тот, что раньше в паке)':
    'File overlaps: {0} (the earlier one in the pack wins)',

  // ---------- library: banners + toolbar ----------
  'Моды выключены': 'Mods are off',
  ' мастер-переключателем внизу справа — игра запустится ванильной. Включи, чтобы менять моды по отдельности.':
    ' with the master switch at the bottom right — the game will launch vanilla. Turn it on to manage mods individually.',
  ' как моды из каталога — привяжи, чтобы получить превью и управлять как обычными.':
    ' as catalog mods — adopt them to get previews and manage them like the rest.',
  'Привязать все': 'Adopt all',
  'Занято': 'Used',
  ' из {0} слотов. Игра не грузит больше ~99 отдельных паков — объедини моды в один, чтобы уместить больше.':
    ' of {0} slots. The game won’t load more than ~99 separate paks — combine mods into one to fit more.',
  'Поиск в библиотеке…': 'Search the library…',
  'Импорт VPK': 'Import VPK',
  'Папка модов': 'Mods folder',
  'Выбрать всё': 'Select all',
  'Отметь моды галочками — объединить в пак или массово управлять':
    'Tick mods to combine them into a pack or manage in bulk',
  'Включить все': 'Enable all',
  'Выключить все': 'Disable all',
  'Внешние файлы в папке модов': 'External files in the mods folder',
  'Файлы, установленные не через менеджер': 'Files installed outside the manager',

  // ---------- bulk bar ----------
  'выбрано': 'selected',
  'Включить': 'Enable', 'Выключить': 'Disable',
  'Объединить в пак': 'Combine into pack',
  'Вытащить из пака': 'Extract from pack',
  'Сбросить выбор': 'Clear selection',
  'Удалить выбранное ({0})?': 'Delete selected ({0})?',
  'Удалено': 'Removed',
  'Выбери моды для объединения в пак': 'Pick mods to combine into a pack',
  'Далее': 'Next',
  'Вытащено из пака: {0}': 'Extracted from pack: {0}',

  // ---------- library actions (bindLibrary) ----------
  'Убрать «{0}» из пака?': 'Remove «{0}» from the pack?',
  'Пак удалён — в нём не осталось модов': 'Pack removed — it had no mods left',
  'Убрано из пака': 'Removed from the pack',
  'Добавлено в пак: {0}': 'Added to pack: {0}',
  'Разобрать пак «{0}» на отдельные моды? Каждый мод снова займёт свой слот.':
    'Disband pack «{0}» into separate mods? Each mod will take its own slot again.',
  'Разобрано на {0}: {1}': 'Split into {0}: {1}',
  'Разобрано на {0}: {1}{2}': 'Split into {0}: {1}{2}',
  'Удалить пак «{0}» со всеми модами внутри?': 'Delete pack «{0}» with all mods inside?',
  'Собираю…': 'Building…',
  '{0} сохранён одним файлом ({1} MB)': '{0} saved as a single file ({1} MB)',
  'Привязан к каталогу: «{0}»': 'Adopted into the catalog: «{0}»',
  'Разбить «{0}» на отдельные моды по героям? Исходный файл заменится на отдельные, каждый можно будет включать и удалять по отдельности.':
    'Split «{0}» into separate mods by hero? The source file is replaced by separate ones you can toggle and remove individually.',

  // ---------- external files ----------
  'Курсор в игре': 'In-game cursor',
  'шрифт · panorama/fonts': 'font · panorama/fonts',
  'мод из каталога': 'catalog mod',
  'опознан по содержимому': 'recognized by content',
  'внешний файл': 'external file',
  'Привязать к каталогу и управлять как обычным модом': 'Adopt into the catalog and manage like a normal mod',
  'Принять': 'Adopt',
  '«{0}» принят из каталога': '«{0}» adopted from the catalog',
  'Разбить «{0}» на отдельные моды по героям? Файл заменится на отдельные управляемые моды.':
    'Split «{0}» into separate mods by hero? The file is replaced by separate managed mods.',
  'Удалить файл {0}?': 'Delete file {0}?',

  // ---------- import ----------
  'Импортировано: {0} {1}': 'Imported: {0} {1}',
  '«{0}» перекрывается с: {1}': '«{0}» overlaps with: {1}',
  '«{0}» перекрывается с: {1}{2}': '«{0}» overlaps with: {1}{2}',
  '{0} {1} в {2} {3}': '{0} {1} into {2} {3}',
  'Импорт папки': 'Import folder',
  'Импортировать все .vpk из папки — например из распакованного пака Dota 2 Skinchanger':
    'Import every .vpk in a folder — an unpacked Dota 2 Skinchanger pack, for instance',
  'Импортировать можно .vpk файлы, .zip или папку с ними': 'You can import .vpk files, a .zip, or a folder with them',
  'Не удалось прочитать перетащенные файлы': 'Could not read the dropped files',
  'Не удалось прочитать перетащенную папку': 'Could not read the dropped folder',

  // ---------- conflicts ----------
  'конфликт': 'conflict',
  'Меняет те же файлы, что и: {0}': 'Changes the same files as: {0}',
  ' — меняют одни и те же файлы игры. Загрузится только один из пары, выключи лишний.':
    ' — they change the same game files. Only one of each pair loads, turn the other off.',
  'и': 'and',
  'и ещё {0}': 'and {0} more',
  'Включено': 'Enabled', 'Выключено': 'Disabled',

  // ---------- presets ----------
  'Пресет запоминает, какие моды включены. Применение пресета включает его моды и выключает остальные. Готовым пресетом можно поделиться файлом — перетащи полученный .d2mm сюда.':
    'A preset remembers which mods are on. Applying a preset enables its mods and disables the rest. A finished preset can be shared as a file — drop a .d2mm you received here.',

  // ---------- sharing presets ----------
  'Поделиться': 'Share',
  'Сохранить пресет файлом, чтобы отправить другому': 'Save the preset as a file to send to someone',
  'Открыть .d2mm': 'Open .d2mm',
  'Поделиться пресетом «{0}»': 'Share the preset «{0}»',
  'уедут ссылками, почти не весят': 'travel as references, next to no weight',
  'нет в каталоге, поедут файлом целиком': 'not in the catalog, they travel as whole files',
  'Твой ник (необязательно)': 'Your nickname (optional)',
  'Пара слов о сборке (необязательно)': 'A few words about the build (optional)',
  'Размер файла:': 'File size:',
  'несколько КБ': 'a few KB',
  'МБ': 'MB',
  'Сохранить файл': 'Save file',
  'Пресет сохранён · {0} МБ': 'Preset saved · {0} MB',
  'В пресете нет модов': 'The preset has no mods',
  'получен': 'received',
  'Установить': 'Install',
  '{0} уже стоят': '{0} already installed',
  '{0} скачать из каталога': '{0} to download from the catalog',
  '{0} внутри файла': '{0} inside the file',
  'нечего устанавливать': 'nothing to install',
  'Не найдены ни у тебя, ни в файле:': 'Found neither here nor in the file:',
  'Пресет «{0}» добавлен — нажми «Установить»': 'Preset «{0}» added — press «Install»',
  'Установлено и применено: {0} {1}': 'Installed and applied: {0} {1}',
  'Это пресет — открой его во вкладке «Пресеты»': 'That is a preset — open it in the Presets tab',
  'Это мод — перетащи его во вкладку «Библиотека»': 'That is a mod — drop it in the Library tab',
  'Сюда можно перетащить файл пресета .d2mm': 'You can drop a .d2mm preset file here',
  'Не удалось прочитать файл пресета': 'Could not read the preset file',
  'Моды перетаскивай в «Библиотеку», пресеты — в «Пресеты»': 'Drop mods in the Library, presets in the Presets tab',
  'Название пресета (напр. «Анимешный», «Минимал»)': 'Preset name (e.g. «Anime», «Minimal»)',
  'Сохранить текущее состояние': 'Save current state',
  'Пресетов пока нет': 'No presets yet',
  'Применить': 'Apply',
  'пусто (всё будет выключено)': 'empty (everything will be turned off)',
  'Введи название пресета': 'Enter a preset name',
  'Пресет «{0}» сохранён': 'Preset «{0}» saved',
  'Пресет применён': 'Preset applied',
  'Удалить пресет «{0}»?': 'Delete preset «{0}»?',

  // ---------- tools ----------
  'Запустить': 'Run', 'Папка': 'Folder', 'Скачать': 'Download', 'Открыть сайт': 'Open site',
  'Скачивание…': 'Downloading…', '{0} готов': '{0} ready',

  // ---------- guides ----------
  'Гайды из репозитория Dota2PornFx. Менеджер делает бóльшую часть шагов автоматически — гайды пригодятся для ручной установки и решения проблем.':
    'Guides from the Dota2PornFx repository. The manager does most of the steps for you — the guides help with manual installs and troubleshooting.',

  // ---------- settings ----------
  'Путь к Dota 2': 'Dota 2 path',
  'не найден': 'not found',
  'Найти автоматически': 'Auto-detect',
  'Указать вручную': 'Set manually',
  'Язык приложения': 'App language',
  'Меняет язык интерфейса и папку модов (English — dota_123, Русский — dota_russian). Установленные моды переезжают автоматически.':
    'Changes the interface language and the mods folder (English — dota_123, Russian — dota_russian). Installed mods are moved automatically.',
  'Папка модов и параметры запуска': 'Mods folder and launch options',
  'Языковая папка': 'Language folder',
  'Параметр запуска Steam': 'Steam launch option',
  'Копировать': 'Copy',
  'Steam → Библиотека → ПКМ по Dota 2 → Свойства → Параметры запуска → вставь строку выше. Моды (кроме шрифтов и курсоров) работают только с этим параметром.':
    'Steam → Library → right-click Dota 2 → Properties → Launch Options → paste the line above. Mods (except fonts and cursors) work only with this option.',
  'Дота на русском?': 'Playing in Russian?',
  ' Выбирай ': ' Pick ',
  ' и параметр ': ' with the ',
  ' — тогда игра останется русской. С ': ' option — the game stays Russian. With ',
  ' игра переключается на английский. При смене папки установленные моды переезжают автоматически.':
    ' the game switches to English. When the folder changes, installed mods are moved automatically.',
  'Обнаружен Minify': 'Minify detected',
  ' (папка ': ' (the ',
  ' рядом). Если Minify настроен на ту же языковую папку, что и менеджер, их моды будут перекрывать друг друга — используй разные папки или ставь моды через что-то одно.':
    ' folder is next to it). If Minify uses the same language folder as the manager, their mods will override each other — use different folders or install mods through just one of them.',
  'Кэш загрузок': 'Download cache',
  'Размер': 'Size',
  'Очистить': 'Clear',
  'Скачанные архивы модов. Нужны для быстрой переустановки — удаление ничего не сломает.':
    'Downloaded mod archives. They speed up reinstalls — clearing them breaks nothing.',
  'Каталог': 'Catalog',
  'Обновлён': 'Updated',
  'Обновить сейчас': 'Refresh now',
  'Источник': 'Source',
  'О программе': 'About',
  'Версия': 'Version',
  'Обновления скачиваются автоматически из GitHub Releases — когда новая версия готова, появится кнопка установки.':
    'Updates download automatically from GitHub Releases — when a new version is ready, an install button appears.',
  'Dota 2 найдена: {0}': 'Dota 2 found: {0}',
  'Не нашёл автоматически — укажи вручную': 'Not found automatically — set it manually',
  'Путь сохранён': 'Path saved',
  'Папка модов: dota_{0}. Не забудь сменить параметр запуска!':
    'Mods folder: dota_{0}. Don’t forget to change the launch option!',
  'Скопировано в буфер': 'Copied to clipboard',
  'Кэш очищен': 'Cache cleared',
  'Язык переключён на English': 'Language switched to English',
  'Язык переключён на Русский': 'Language switched to Russian',

  // ---------- status bar ----------
  'Dota 2 подключена · dota_{0} · параметр: -language {1}':
    'Dota 2 connected · dota_{0} · option: -language {1}',
  'Dota 2 не найдена — укажи путь в настройках': 'Dota 2 not found — set the path in Settings',

  // ---------- progress + updates ----------
  'Скачивание: {0}': 'Downloading: {0}',
  'Найдено обновление v{0} — скачиваю в фоне…': 'Update v{0} found — downloading in the background…',
  'Обновление ': 'Update ',
  ' готово к установке': ' is ready to install',
  'Перезапустить и обновить': 'Restart and update',
  'Позже': 'Later',
  'Обновляю каталог…': 'Refreshing the catalog…',
  'Каталог обновлён': 'Catalog updated',
};

function canonKey(strings) {
  let k = strings[0];
  for (let i = 1; i < strings.length; i++) k += '{' + (i - 1) + '}' + strings[i];
  return k;
}

function fillValues(tmpl, values) {
  return tmpl.replace(/\{(\d+)\}/g, (_, i) => (values[+i] != null ? String(values[+i]) : ''));
}

// tagged template (L`...`) or plain call L('...')
function L(strings, ...values) {
  if (typeof strings === 'string') return tr(strings);
  const key = canonKey(strings);
  if (window.I18N_LANG === 'en' && EN[key] != null) return fillValues(EN[key], values);
  if (window.I18N_LANG === 'en' && !EN[key]) console.warn('[i18n miss]', JSON.stringify(key));
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += String(values[i]) + strings[i + 1];
  return out;
}

// plain-string lookup for data-driven labels
function tr(s) {
  if (s == null) return s;
  if (window.I18N_LANG === 'en' && EN[s] != null) return EN[s];
  return s;
}

window.L = L;
window.tr = tr;
