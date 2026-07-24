// Minimal i18n for the main process (main.js, installer.js, vpk.js).
// Russian is the source language; English strings are keyed by the exact Russian text
// (with {0},{1}... placeholders for interpolated values). A missing key falls back to
// the Russian source, so the app never shows an empty/undefined string.

let currentLang = 'en';

function setLang(lang) {
  currentLang = lang === 'ru' ? 'ru' : 'en';
}

function getLang() {
  return currentLang;
}

// English dictionary. Key = canonical Russian string with {n} placeholders.
const EN = {
  // ---- errors / dialogs (main.js) ----
  'Выбери папку game внутри dota 2 beta': 'Pick the "game" folder inside "dota 2 beta"',
  'В этой папке не найдена Dota 2 (нет подпапки dota)': 'No Dota 2 here (there is no "dota" subfolder)',
  'Уже установлено': 'Already installed',
  'Мод не найден': 'Mod not found',
  'Сохранить мод одним .vpk файлом': 'Save the mod as a single .vpk file',
  'VPK мод': 'VPK mod',
  'Выбери .vpk файлы модов или .zip с ними': 'Pick mod .vpk files, or a .zip holding them',
  'Моды (.vpk, .zip)': 'Mods (.vpk, .zip)',
  'Выбери папку с модами': 'Pick a folder with mods',
  'Нет _dir.vpk для разбора': 'No _dir.vpk to split',
  'В файле меньше двух героев — разбирать нечего': 'Fewer than two heroes in the file — nothing to split',
  'Совпадение с каталогом не найдено': 'No catalog match found',
  'Папка курсора не найдена': 'Cursor folder not found',
  'Выбери минимум 2 мода (или пак и мод / два пака)': 'Pick at least 2 mods (or a pack and a mod / two packs)',
  'Пак ({0})': 'Pack ({0})',
  'Пак не найден': 'Pack not found',
  'Нет совместимых модов для добавления': 'No compatible mods to add',
  'Мод в паке не найден': 'Mod not found in the pack',
  'Пресет не найден': 'Preset not found',
  'Сохранить пресет для друга': 'Save the preset to share',
  'Пресет Mod Manager': 'Mod Manager preset',
  'Выбери файл пресета (.d2mm)': 'Pick a preset file (.d2mm)',
  'сборка пресета': 'building preset',
  'В пресете нет модов': 'The preset has no mods',
  'нет в каталоге': 'not in the catalog',
  'нет в каталоге и нечего вложить': 'not in the catalog and there is nothing to embed',
  'файл участника пака не найден': 'the pack member file is missing',
  'отправитель не вложил файл': 'the sender left the file out',
  'файл пресета недоступен': 'the preset file is gone',
  'нет в файле': 'not in the file',
  'В пресете есть свои моды — ссылкой не поделиться, только файлом':
    'This preset has mods of your own — share it as a file, a link cannot carry them',

  // ---- preset-link.js ----
  'Это не похоже на ссылку на пресет': 'That does not look like a preset link',
  'Ссылка слишком длинная': 'The link is too long',
  'Ссылка повреждена': 'The link is damaged',

  // ---- discord-auth.js ----
  'Вход через Discord пока не настроен в этой сборке': 'Discord sign-in is not configured in this build yet',
  'Ответ Discord не совпал с запросом': "Discord's answer did not match the request",
  'Discord не выдал токен': 'Discord returned no token',
  'Вход занял слишком много времени': 'Sign-in took too long',
  'Порт {0} занят — закрой другой вход и попробуй снова': 'Port {0} is busy — close the other sign-in and try again',
  'Discord не отдал профиль (HTTP {0})': 'Discord did not return the profile (HTTP {0})',
  'exe не найден в папке инструмента': 'No .exe found in the tool folder',

  // ---- installer.js ----
  'Путь к Dota 2 не задан': 'Dota 2 path is not set',
  'Dota не знает такого языка': 'Dota does not know that language',
  'Сначала закрой Dota 2 — она перезапишет настройку при выходе':
    'Close Dota 2 first, it overwrites this setting on exit',
  'HTTP {0} — не удалось скачать {1}': 'HTTP {0} — could not download {1}',
  'Свободных слотов pakNN не осталось (10-99 заняты)': 'No free pakNN slots left (10-99 are taken)',
  'установка': 'installing',
  '{0}: в архиве не найдено assets/custom': '{0}: no assets/custom found in the archive',
  '{0}: в архиве не найдена папка cursor': '{0}: no cursor folder found in the archive',
  'Неизвестный root: {0}': 'Unknown root: {0}',
  'У этого мода нет _dir.vpk — объединять нечего': 'This mod has no _dir.vpk — nothing to merge',
  'не .vpk файл': 'not a .vpk file',
  'нет {0}_dir.vpk рядом с data-частями': 'no {0}_dir.vpk next to the data parts',
  'в папке нет .vpk файлов': 'no .vpk files in this folder',
  'в архиве нет .vpk файлов': 'no .vpk files in this archive',
  'Курсор': 'Cursor',

  'Пустой VPK': 'Empty VPK',

  // ---- preset-share.js (.d2mm validation) ----
  'preset.json повреждён': 'preset.json is damaged',
  'Это не файл пресета Mod Manager': 'This is not a Mod Manager preset file',
  'Файл собран более новой версией приложения': 'The file was made by a newer version of the app',
  'Слишком много модов в пресете': 'Too many mods in the preset',
  'Файл не открывается как пресет': 'The file cannot be opened as a preset',
  'Недопустимое имя файла в архиве': 'Bad file name inside the archive',
  'файла нет в архиве': 'the file is not in the archive',
  'Пресет': 'Preset',

  // ---- discord-presence.js (status text friends see) ----
  'Смотрит каталог модов': 'Browsing the mod catalog',
  'В своей библиотеке': 'In their mod library',
  'Собирает пресет': 'Putting a preset together',
  'В инструментах': 'In the tools',
  'Читает гайды': 'Reading the guides',
  'В настройках': 'In the settings',
  '{0} модов включено': '{0} mods enabled',
  'Ещё без модов': 'No mods yet',
  'Моды выключены': 'Mods turned off',
  'Скачать Mod Manager': 'Get Mod Manager',

  // ---- vpk.js (parse errors + content labels) ----
  'VPK: незакрытая строка в дереве': 'VPK: unterminated string in the tree',
  'VPK: неверная сигнатура': 'VPK: bad signature',
  // slot labels
  'голова': 'head', 'оружие': 'weapon', 'оружие (2)': 'weapon (2)', 'щит': 'shield', 'броня': 'armor',
  'плечи': 'shoulders', 'пояс': 'belt', 'руки': 'arms', 'спина': 'back', 'крылья': 'wings', 'хвост': 'tail',
  'ноги': 'legs', 'ездовое': 'mount', 'эффекты': 'effects', 'разное': 'misc', 'модель': 'model',
  'перекраска': 'recolor',
  // kind labels (short)
  'варды': 'wards', 'курьер': 'courier', 'интерфейс': 'UI', 'звуки': 'sounds', 'террейн': 'terrain',
  // kind names (title-case)
  'Варды': 'Wards', 'Курьер': 'Courier', 'Интерфейс меню': 'Menu UI', 'Звуки': 'Sounds', 'Ландшафт': 'Terrain',
  'Сборка · {0} героев': 'Bundle · {0} heroes',
};

function fill(tmpl, values) {
  return tmpl.replace(/\{(\d+)\}/g, (_, i) => (values[+i] != null ? String(values[+i]) : ''));
}

// t('Мод не найден') or t('HTTP {0} — не удалось скачать {1}', status, name)
function t(ru, ...values) {
  const tmpl = currentLang === 'en' && EN[ru] != null ? EN[ru] : ru;
  return values.length ? fill(tmpl, values) : tmpl;
}

module.exports = { setLang, getLang, t };
