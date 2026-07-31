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
  'модов из каталога': ['mod from the catalog', 'mods from the catalog'],
  'своих модов': ['mod of your own', 'mods of your own'],
  'модов не получится передать': ['mod cannot be shared', 'mods cannot be shared'],
  'файлов склеены': ['file merged', 'files merged'],
  'косметик': ['cosmetic', 'cosmetics'],
  'из них — копии уже установленных модов': ['of them is a copy of a mod you already have', 'of them are copies of mods you already have'],
  'вариантов': ['option', 'options'],
  'видов': ['look', 'looks'],
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
  'Торментор': 'Tormentor', 'Древние': 'Ancients', 'Рошан': 'Roshan',
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
  'Все категории': 'All categories', 'Все слоты': 'All slots',

  // ---------- tags: what a mod changes, and which slot an item goes in ----------
  // The catalog ships these in English; these are our own words for them. 'Эффекты' and
  // 'Звуки' are already above as category names, with the same English.
  'Иконки': 'Icons', 'Аниме': 'Anime', '18+': '18+',
  'Видео': 'Video', 'Картинка': 'Image', 'Плохое качество': 'Poor quality',
  'Мета': 'Meta', 'Статистика': 'Stats', 'Развлечения': 'Fun', 'Исходный код': 'Source code',
  'Оружие': 'Weapon', 'Наплечники': 'Shoulders', 'Голова': 'Head', 'Руки': 'Arms',
  'Броня': 'Armor', 'Спина': 'Back', 'Ездовое': 'Mount', 'Щит': 'Shield',
  'Тотем': 'Totem', 'Волосы': 'Hair',
  'Избранное': 'Favorites',
  'В избранное': 'Add to favorites',
  'Убрать из избранного': 'Remove from favorites',
  'Здесь пусто — жми на сердечко у мода в каталоге': 'Nothing here yet — tap the heart on a mod in the catalog',
  'Превью': 'Preview', 'Источник': 'Source', 'Автор': 'Author', 'Баг': 'Bug', 'Гайд': 'Guide',

  // ---------- nav / chrome (index.html static) ----------
  'Каталог': 'Catalog', 'Библиотека': 'Library', 'Пресеты': 'Presets',
  'Инструменты': 'Tools', 'Настройки': 'Settings',

  // ---------- safe mode (status bar switch) ----------
  'Безопасно:': 'Safe:',
  'Безопасный режим: моды из патча (эффекты, косметика) скрыты и не работают. Выключи, чтобы их включить — приложение впишет свою папку в файлы игры.':
    'Safe mode: patch-only mods (effects, cosmetics) are hidden and inactive. Turn it off to enable them — the app will register its folder in the game files.',
  'Приложение впишет свою папку в gameinfo_branchspecific.gi и пересчитает подпись этого файла в dota.signatures — так Dota сможет читать эффекты модов и бесплатную косметику. Оригиналы сохраняются, обратное переключение возвращает их byte-в-byte.':
    'The app will register its folder in gameinfo_branchspecific.gi and recompute that file\'s signature in dota.signatures — that lets Dota read mod effects and free cosmetics. Originals are backed up; switching back restores them byte for byte.',
  'Безопасный режим выключен — эффекты и косметика доступны': 'Safe mode off — effects and cosmetics are available',
  'Безопасный режим включён, файлы игры восстановлены': 'Safe mode on, game files restored',

  // ---------- item schema: catalog cards, library tag, conflict banners ----------
  'Моды спорят за один предмет': 'Mods disagree about the same item',
  '. В таблицу попадёт правка того мода, что установлен последним — выключи лишний.':
    '. The table takes the change from whichever mod was installed last: turn the other one off.',
  'В gameinfo уже прописан другой патчер': 'gameinfo already lists another patcher',
  '. Два патчера в одном файле уживаются плохо — включай наш только если тем не пользуешься.':
    '. Two patchers in one file get along badly: turn ours on only if you no longer use that one.',
  'Читаем схему игры…': 'Reading the game schema…',
  'Схема игры не прочиталась — проверь путь к Dota 2 в настройках.':
    'Could not read the game schema: check the Dota 2 path in settings.',
  'Поиск…': 'Search…',
  'Ничего не найдено — сбрось фильтры': 'Nothing found — clear the filters',
  'Выбрано: {0}': 'Picked: {0}',
  'Вернули как в игре': 'Back to the game default',
  'На один слот — только одна активная косметика': 'One slot, one active look at a time',
  'эффекты': 'effects',
  'нужны правки': 'needs the patch',
  'Мод меняет схему предметов: его эффекты и иконки собраны в общую таблицу':
    'This mod changes the item schema: its effects and icons are built into the shared table',
  'Мод меняет схему предметов. Без правок схемы встанет только модель — эффекты и иконки работать не будут.':
    'This mod changes the item schema. Without the patch only the model installs: effects and icons will not work.',
  'Косметика': 'Cosmetics',
  'Моды': 'Mods',
  'бесплатная косметика': 'free cosmetic',
  'Выбрать всю косметику': 'Select every look',
  'Вернуть все слоты к тому, что даёт игра': 'Put every slot back to what the game gives',
  'Косметика выключена — слоты снова как в игре': 'Cosmetics off — the slots are the game’s own again',
  'Этот вид сейчас стоит в слоте «{0}». Убрать — вернуть то, что даёт игра; включить обратно можно в Библиотеке.':
    'This look is what the «{0}» slot wears now. Removing it puts the game’s own back; you can switch it on again from the Library.',
  'На один слот — только одна активная косметика: этот вид заменит «{0}». Прошлый выбор останется в Библиотеке выключенным.':
    'One slot, one active look: this one replaces «{0}». The previous pick stays in the Library, switched off.',
  'Косметика подставляется в схему предметов игры — файлы модов она не трогает, и её видно только тебе.':
    'A look is spliced into the game’s item schema — it touches no mod files, and only you can see it.',
  '…и ещё {0} — уточни запрос': '…and {0} more — narrow the search',
  // cosmetic slot labels
  'Погода': 'Weather', 'Ландшафт': 'Terrain', 'Интерфейс игры': 'Game HUD',
  'Экран загрузки': 'Loading screen', 'Экран противостояния': 'Versus screen',
  'Курьер': 'Courier', 'Варды': 'Wards', 'Крипы Света': 'Radiant creeps',
  'Крипы Тьмы': 'Dire creeps', 'Осадные Света': 'Radiant siege creeps',
  'Осадные Тьмы': 'Dire siege creeps', 'Башни Света': 'Radiant towers',
  'Башни Тьмы': 'Dire towers', 'Музыка': 'Music', 'Комментатор': 'Announcer',
  'Серия убийств': 'Kill streak',
  'Поиск модов…': 'Search mods…', 'Очистить': 'Clear', 'Свернуть': 'Minimize',
  'Развернуть': 'Maximize', 'Закрыть': 'Close', 'Поиск Dota 2…': 'Looking for Dota 2…',
  'Папка модов': 'Mods folder', 'Играть': 'Play',
  'Открыть папку, куда ставятся моды': 'Open the folder the mods are installed into',
  'Включить/выключить все моды сразу (для запуска ванильной игры)':
    'Turn all mods on/off at once (to launch the vanilla game)',
  'Запустить Dota 2 через Steam с твоими параметрами запуска':
    'Launch Dota 2 through Steam with your launch options',
  'Моды:': 'Mods:', 'вкл': 'on', 'выкл': 'off',

  // ---------- panel grips ----------
  'Потяни, чтобы изменить высоту · двойной клик сбрасывает': 'Drag to resize · double-click to reset',
  'Потяни, чтобы изменить ширину · двойной клик сбрасывает': 'Drag to resize · double-click to reset',
  'Свернуть верхнюю панель': 'Fold the top bar',
  'Развернуть верхнюю панель': 'Unfold the top bar',
  'Скрыть нижнюю панель': 'Hide the bottom bar',
  'Показать нижнюю панель': 'Show the bottom bar',
  'Скрыть категории': 'Hide the categories',
  'Показать категории': 'Show the categories',

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
  'Недавно добавленные': 'Recently added',
  'Категории': 'Categories',
  'Поиск:': 'Search:',
  'Ничего не найдено': 'Nothing found',
  'Ничего не найдено — сбрось фильтры': 'Nothing found — reset the filters',
  'Установленные': 'Installed',
  'Смотреть превью': 'Watch preview',
  'Установлен': 'Installed',
  'Пак': 'Pack',
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
  'Курсор ставится в game\\dota\\resource\\cursor — параметр запуска не нужен. Оригиналы сохраняются автоматически. Включать и выключать его можно в Библиотеке, но активным может быть только один курсор: новый выключит предыдущий.':
    'The cursor is installed into game\\dota\\resource\\cursor — no launch option needed. Originals are backed up automatically. You can switch it on and off in the Library, but only one cursor can be active: a new one turns the previous one off.',
  'Введи название пака': 'Enter a pack name',
  'В паке не осталось модов': 'No mods left in the pack',
  'Пак «{0}» сохранён — он появился в категории Паки': 'Pack «{0}» saved — it appears in the Packs category',
  'Удалить пак «{0}»?': 'Delete pack «{0}»?',
  'Удалить «{0}»?': 'Delete «{0}»?',
  '{0} удалён': '{0} removed',

  // ---------- install ----------
  ' (и ещё {0})': ' (and {0} more)',
  '{0} установлен': '{0} installed',
  '{0} установлен — «{1}» выключен: курсор в игре может быть только один':
    '{0} installed — «{1}» switched off: the game can only show one cursor',
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
  'Разобрать пак обратно на отдельные моды': 'Disband the pack back into separate mods',
  'Разобрать': 'Split',

  // ---------- library: normal rows ----------
  'Выбрать мод': 'Select mod',
  'всегда активен': 'always on',
  'Включить/выключить': 'Enable/disable',
  'Курсор в игре может быть только один — этот выключит остальные':
    'The game can only show one cursor — this one switches the others off',
  'Курсор заменён — «{0}» выключен': 'Cursor replaced — «{0}» switched off',
  'Курсоры в пак не входят — они лежат не в паках, а в resource\\cursor':
    'Cursors cannot go into a pak — they live in resource\\cursor, not in a pak file',
  'Привязать к каталогу': 'Adopt into the catalog',
  'Привязать': 'Adopt',
  'Разбить на отдельные моды по героям': 'Split into separate mods by hero',
  'Сохранить мод одним .vpk файлом (для отправки автору каталога)':
    'Save the mod as a single .vpk (to send to the catalog author)',
  'Сохранить курсор архивом (для отправки или на память)':
    'Save the cursor set as an archive (to pass on or to keep)',
  'Сохранить пак одним .vpk файлом (войдут включённые моды)':
    'Save the pack as a single .vpk (the mods that are on go in)',
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
  'Взять файл в библиотеку — дальше как у обычного мода': 'Take the file into your library — from there it behaves like any mod',
  'Принять': 'Adopt',
  '«{0}» принят из каталога': '«{0}» adopted from the catalog',
  '«{0}» в библиотеке': '«{0}» is in your library',
  'Моды, положенные в папку мимо менеджера. «Принять» берёт файл в библиотеку — с превью, переключателем и всем остальным.':
    'Mods put in the folder without the manager. "Adopt" takes a file into your library — preview, switch and all.',
  'копия': 'copy',
  'копия «{0}»': 'copy of «{0}»',
  'Тот же файл уже стоит как «{0}» — эта копия лишняя': 'The same file is already installed as «{0}» — this copy is redundant',
  'Разбить «{0}» на отдельные моды по героям? Файл заменится на отдельные управляемые моды.':
    'Split «{0}» into separate mods by hero? The file is replaced by separate managed mods.',
  'Удалить файл {0}?': 'Delete file {0}?',

  // ---------- import ----------
  'Импортировано: {0} {1}': 'Imported: {0} {1}',
  '{0} {1} в {2} {3}': '{0} {1} into {2} {3}',
  'Импорт папки': 'Import folder',
  'Импортировать все .vpk из папки — например из распакованного пака Dota 2 Skinchanger':
    'Import every .vpk in a folder — an unpacked Dota 2 Skinchanger pack, for instance',
  'Импортировать можно .vpk файлы, .zip или папку с ними': 'You can import .vpk files, a .zip, or a folder with them',
  'Не удалось прочитать перетащенные файлы': 'Could not read the dropped files',
  'Не удалось прочитать перетащенную папку': 'Could not read the dropped folder',

  // ---------- load order ----------
  'Загружать раньше: при общих файлах победит этот мод': 'Load earlier: on a shared file this mod wins',
  'Загружать позже': 'Load later',
  'Выше в порядке загрузки': 'Earlier in the load order',
  'Ниже в порядке загрузки': 'Later in the load order',
  'Файл игры не совпадает с подписью Dota': "A game file does not match Dota's own signature",
  '. Пока так, клиент может не пускать в матчмейкинг — и моды тут ни при чём. Приложение не смогло восстановить оригинал само: проверь целостность файлов Dota 2 через Steam, это чинит за минуту.':
    ". While that is true the client can refuse to matchmake, and mods have nothing to do with it. The app could not restore the original itself: verify Dota 2's files through Steam, it takes a minute.",
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
  '{0} косметика из игры': '{0} cosmetic from the game',
  'Не удалось прочитать файл пресета': 'Could not read the preset file',
  'Сюда можно бросить моды (.vpk, .zip, папку) или пресет .d2mm':
    'You can drop mods here (.vpk, .zip, a folder) or a .d2mm preset',
  'Обновить': 'Update',
  'Перезаписать пресет тем, что включено сейчас': 'Overwrite the preset with what is enabled right now',
  'Переименовать': 'Rename',
  'Новое название пресета': 'New preset name',
  'Пресет обновлён: {0} {1}': 'Preset updated: {0} {1}',

  // ---------- preset links ----------
  'Ссылка': 'Link',
  'Файл': 'File',
  'Сохранить пресет файлом — донесёт и свои моды тоже': 'Save the preset as a file — it carries your own mods too',
  'Скопировать короткую ссылку на пресет': 'Copy a short link to the preset',
  'В пресете только свои моды — ссылка их не донесёт, отправь файлом':
    'The preset holds only your own mods — a link cannot carry them, send the file',
  'Ссылка донесёт {0} из каталога; свои моды ({1}) в неё не влезут — для них нужен файл':
    'A link carries the {0} catalog mods; your own ({1}) will not fit in one — send the file for those',
  'Ссылкой не уедут: {0}{1} — их нет в каталоге. Отправь файлом, чтобы попали.':
    'A link leaves these behind: {0}{1} — they are not in the catalog. Send the file to include them.',
  'В ссылку вошли {0} {1} из каталога. Свои моды ({2}) она не несёт — отправь файлом.':
    'The link carries {0} catalog {1}. Your own mods ({2}) are not in it — send the file for those.',
  'Добавить': 'Add',

  // ---------- account ----------
  'Показывать в Discord, что ты в Mod Manager': 'Show in Discord that you are in Mod Manager',
  'Друзья увидят «Играет в Dota 2 Mod Manager», текущую вкладку и сколько модов включено. В самом Discord это работает, только если включено «Отображать текущую активность как статус».':
    'Friends will see «Playing Dota 2 Mod Manager», the tab you are on and how many mods are enabled. In Discord itself this only shows while «Display current activity as a status message» is on.',
  'Скопировано': 'Copied',
  'Войти': 'Sign in',
  'Вход нужен, чтобы подписывать свои сборки': 'Signing in puts your name on the builds you share',
  'Выйти': 'Sign out',
  'Выйти из аккаунта': 'Sign out',
  'Выйти из аккаунта «{0}»?': 'Sign out of «{0}»?',
  'Открыл Discord в браузере — подтверди вход там': 'Discord is open in your browser — confirm the sign-in there',
  'Привет, {0}': 'Hi, {0}',
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
  'Интерфейс': 'Interface',
  'Язык': 'Language',
  'Один переключатель на всё: язык приложения, текст в самой Dota и её озвучку (за языком озвучки следует папка модов). Dota при этом должна быть закрыта — иначе она перезапишет настройку при выходе.':
    'One switch for all of it: the language of this app, the text inside Dota and its voices (the mods folder follows the voice language). Dota has to be closed, or it overwrites the setting on exit.',
  'Масштаб': 'Scale',
  'Масштаб всего': 'Scale of everything',
  'Масштаб по частям': 'Scale part by part',
  'Содержимое': 'Content',
  'Верхняя панель': 'Top bar',
  'Нижняя панель': 'Bottom bar',
  'Список категорий': 'Category list',
  'Мельче': 'Smaller',
  'Крупнее': 'Bigger',
  'Сбросить': 'Reset',
  'Сбросить всё': 'Reset all',
  'Двигает содержимое и панели сразу. Ниже каждый масштаб можно задать по отдельности. Те же клавиши: Ctrl + и Ctrl − меняют содержимое, Ctrl + колесо над панелью — эту панель, Ctrl 0 возвращает 100%. За границу панели можно потянуть, чтобы изменить её размер.':
    'Moves the content and the panels together. Below, each one can be set on its own. The same from the keyboard: Ctrl + and Ctrl − scale the content, Ctrl + wheel over a panel scales that panel, Ctrl 0 puts everything back to 100%. Drag a panel’s edge to resize it.',
  'Задать языки Dota по отдельности': 'Set Dota’s languages separately',
  'Текст': 'Text',
  'Озвучка': 'Voice',
  'Применить': 'Apply',
  'Dota хранит эти языки отдельно: моды подхватываются из папки языка озвучки, а текст на них не влияет. Отсюда, например, английский интерфейс игры при русской озвучке.':
    'Dota keeps these two apart: mods load from the voice language’s folder, and the text setting has no say in it. That is how you get an English game interface with Russian voices.',
  'Переключить и текст в самой Dota на {0}? Игра должна быть закрыта.':
    'Switch the text inside Dota to {0} as well? The game has to be closed.',
  'Переключить и саму Dota на {0}? Текст в игре станет {1}, моды переедут в папку dota_{2}{3}. Игра должна быть закрыта, после смены её надо перезапустить.':
    'Switch Dota itself to {0} as well? The game text becomes {1} and the mods move to the dota_{2} folder{3}. The game has to be closed, and needs a restart afterwards.',
  ', а озвучка останется английской — пак «{0}» не скачан':
    ', while the voices stay English because the {0} pack is not downloaded',
  'Переключить': 'Switch',
  'Dota переключена: текст «{0}», моды в dota_{1}. Перезапусти Dota.':
    'Dota switched: text {0}, mods in dota_{1}. Restart Dota.',
  'Озвучка станет {0}': 'Voices will switch to {0}',
  'Озвучка останется английской: пак «{0}» не скачан': 'Voices stay English: the {0} pack is not downloaded',
  'Готово: текст «{0}», моды в dota_{1}. Перезапусти Dota.':
    'Done: text {0}, mods in dota_{1}. Restart Dota.',
  'Языковая папка': 'Language folder',
  'Куда ставятся моды': 'Mods are installed to',
  'Следовать языку озвучки Dota': 'Follow Dota’s audio language',
  'Dota монтирует только папку своего языка озвучки, поэтому придуманные папки вроде dota_123 больше не подхватываются. Параметр -language ни на что не влияет — его можно убрать из свойств Steam.':
    'Dota only mounts the folder of its own audio language, so made-up folders like dota_123 are no longer picked up. The -language option does nothing now — you can remove it from the Steam properties.',
  'Английский интерфейс': 'English interface',
  ': открой «Задать языки Dota по отдельности» в блоке «Интерфейс», поставь Текст = English, а Озвучку оставь той, чья папка уже используется. Языки независимы, моды продолжат работать.':
    ': open “Set Dota’s languages separately” in the Interface block, set Text to English and leave Voice on the language whose folder is already in use. The two are independent, so mods keep working.',
  'Папку dota_{0} создаёт приложение': 'The dota_{0} folder is created by this app',
  ': Valve её не поставляет, и гарантии, что игра её смонтирует, нет. Если моды не появились в игре — выбери в настройках Dota другой Audio Language, например Russian.':
    ': Valve does not ship it, so there is no guarantee the game will mount it. If mods do not show up in game, pick a different Audio Language in Dota’s settings, Russian for example.',
  'Папка dota_{0} больше не работает': 'The dota_{0} folder no longer works',
  ': в ней {0} {1}, игра их не видит.': ': it holds {0} {1} the game cannot see.',
  'Перенести сюда': 'Move here',
  'Обнаружен Minify': 'Minify detected',
  ' (папка ': ' (the ',
  ' рядом). Если Minify ставит моды в ту же папку, что и менеджер, их файлы будут перекрывать друг друга — ставь моды через что-то одно.':
    ' folder is next to it). If Minify installs mods into the same folder as the manager, their files will override each other — install mods through just one of them.',
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
  'Папка модов: dota_{0}': 'Mods folder: dota_{0}',
  'Перенесено файлов: {0}': 'Moved {0} files',
  'Моды перенесены в dota_{0}: игра больше не подхватывает папку dota_{1}':
    'Mods moved to dota_{0}: the game no longer picks up the dota_{1} folder',
  'Скопировано в буфер': 'Copied to clipboard',
  'Кэш очищен': 'Cache cleared',
  'Язык переключён на English': 'Language switched to English',
  'Язык переключён на Русский': 'Language switched to Russian',

  // ---------- status bar ----------
  'Dota 2 подключена': 'Dota 2 connected',
  'Dota 2 не найдена — укажи путь в настройках': 'Dota 2 not found — set the path in Settings',

  // ---------- what's new ----------
  'Что нового': 'What\'s new',
  'версия {0}': 'version {0}',
  'Понятно': 'Got it',
  'Для этой версии заметок нет': 'No notes for this version',

  // ---------- progress + updates ----------
  'Скачивание: {0}': 'Downloading: {0}',
  'Найдено обновление v{0} — скачиваю в фоне…': 'Update v{0} found — downloading in the background…',
  'Обновление ': 'Update ',
  ' готово к установке': ' is ready to install',
  'Перезапустить и обновить': 'Restart and update',
  'Позже': 'Later',
  'Обновляю каталог…': 'Refreshing the catalog…',
  'Каталог обновлён': 'Catalog updated',

  // ---------- diagnostics ----------
  'Диагностика': 'Diagnostics',
  'Один файл с путём и настройками Dota, списком модов, состоянием патча и последними записями журнала приложения — без личных данных, кроме имени в Discord, если ты вошёл. Пришли его вместо скриншотов, если что-то не работает.':
    "One file with Dota's path and settings, the mod list, patch state and the app's recent log entries — no personal data beyond your Discord name, if you're signed in. Send it instead of screenshots when something's broken.",
  'Экспортировать отчёт': 'Export report',
  'Отчёт сохранён': 'Report saved',
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
