<div align="center">

<img src=".github/banner.ru.svg" alt="Dota 2 Mod Manager" width="900">

<p>
  <a href="https://github.com/TheFleece/dota2-mod-manager/releases/latest/download/Dota-2-Mod-Manager-Setup.exe">
    <img src="https://img.shields.io/github/v/release/TheFleece/dota2-mod-manager?style=for-the-badge&color=8b6ff0&label=%D0%A1%D0%BA%D0%B0%D1%87%D0%B0%D1%82%D1%8C&logo=github&logoColor=white" alt="Скачать последнюю версию"></a>
  <img src="https://img.shields.io/github/downloads/TheFleece/dota2-mod-manager/Dota-2-Mod-Manager-Setup.exe?style=for-the-badge&color=4f378b&label=%D0%A3%D1%81%D1%82%D0%B0%D0%BD%D0%BE%D0%B2%D0%BE%D0%BA" alt="Загрузок установщика">
  <img src="https://img.shields.io/badge/Windows%20%7C%20Linux-211f26?style=for-the-badge&logo=windows&logoColor=d0bcff" alt="Windows и Linux">
</p>

<p>
  <a href="https://github.com/TheFleece/dota2-mod-manager/actions/workflows/test.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/TheFleece/dota2-mod-manager/test.yml?style=flat-square&label=%D1%82%D0%B5%D1%81%D1%82%D1%8B&labelColor=211f26&color=2bffa3" alt="Статус тестов"></a>
  <a href="https://github.com/TheFleece/dota2-mod-manager/actions/workflows/codeql.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/TheFleece/dota2-mod-manager/codeql.yml?style=flat-square&label=codeql&labelColor=211f26&color=2bffa3" alt="Статус CodeQL"></a>
  <img src="https://img.shields.io/github/last-commit/TheFleece/dota2-mod-manager?style=flat-square&label=%D0%BF%D0%BE%D1%81%D0%BB%D0%B5%D0%B4%D0%BD%D0%B8%D0%B9%20%D0%BA%D0%BE%D0%BC%D0%BC%D0%B8%D1%82&labelColor=211f26&color=8b6ff0" alt="Последний коммит">
  <a href="LICENSE"><img src="https://img.shields.io/badge/%D0%BB%D0%B8%D1%86%D0%B5%D0%BD%D0%B7%D0%B8%D1%8F-GPL--3.0-c4b5fd?style=flat-square&labelColor=211f26" alt="Лицензия"></a>
  <a href="https://dota2modmanager.com/ru/"><img src="https://img.shields.io/badge/%D1%81%D0%B0%D0%B9%D1%82-dota2modmanager.com-c4b5fd?style=flat-square&labelColor=211f26" alt="Сайт"></a>
</p>

<p>
  <b>
  <a href="#что-умеет">Что умеет</a> &nbsp;·&nbsp;
  <a href="#установка">Установка</a> &nbsp;·&nbsp;
  <a href="#как-это-работает">Как это работает</a> &nbsp;·&nbsp;
  <a href="#рядом-с-dota2-minify">Рядом с Minify</a> &nbsp;·&nbsp;
  <a href="#документация">Документация</a> &nbsp;·&nbsp;
  <a href="#сообщить-о-проблеме">Сообщить о проблеме</a> &nbsp;·&nbsp;
  <a href="#жизнь-проекта">Жизнь проекта</a> &nbsp;·&nbsp;
  <a href="README.md">English</a>
  </b>
</p>

<img src="site/public/screenshots/dota-2-mod-manager-catalog-ru.webp" alt="Каталог" width="100%">

</div>

> [!NOTE]
> С Valve не связаны. Все моды здесь клиентские: их не видит никто, кроме тебя, и чужую игру они
> не трогают. Безопасный режим включён по умолчанию и вообще не пускает приложение в файлы Доты;
> единственная функция, которая их меняет, сначала спрашивает и откатывается байт в байт.

> **А почему не скопировать файлы руками?** Можно, и так делают. Приложение добавляет всё, что
> идёт дальше: выключить мод перед матчем, не удаляя его, бесплатную косметику из таблицы
> предметов самой игры, сборку одной ссылкой и работающую игру после патча Доты.

<br>

## Что умеет

<table>
<tr><td width="230"><b>Весь каталог</b></td><td>1000+ модов в 41 категории, читается вживую из репозитория <a href="https://github.com/h6rd/Dota2PornFxWeb">D2PFX</a>, поэтому мод, добавленный сегодня, сегодня же и ставится</td></tr>
<tr><td><b>Один клик туда, один обратно</b></td><td>Приложение скачивает мод, занимает свободный слот pak и убирает за собой. Категории, которым надо грузиться раньше, сами получают низкие слоты</td></tr>
<tr><td><b>Выключить, а не удалять</b></td><td>Выключи мод перед матчем и включи после. Библиотека остаётся, папка игры остаётся чистой</td></tr>
<tr><td><b>Бесплатная косметика</b></td><td>Погода, курьеры, варды, экраны загрузки, аннонсеры, мега-киллы: читаются из таблицы предметов самой игры, поэтому всё новое от Valve появляется само</td></tr>
<tr><td><b>Говорит, когда моды конфликтуют</b></td><td>Два мода с одним и тем же файлом не могут победить оба. Приложение называет файл, говорит, из какого мода игра его берёт, и даёт поменять порядок</td></tr>
<tr><td><b>Сборки ссылкой</b></td><td>Сохрани то, что стоит, пресетом и отправь одним сообщением. На той стороне откроют и получат тот же вид</td></tr>
<tr><td><b>Переживает патчи Доты</b></td><td>Приложение замечает обновление игры и возвращает то, что патч стёр, и никогда не пишет, пока Дота запущена</td></tr>
</table>

<details>
<summary><b>И остальное</b></summary>
<br>
<table>
<tr><td width="230"><b>Список установки</b></td><td>Откладывай моды, пока смотришь каталог, и поставь все разом. У списка свой поиск: люди ставили по восемьдесят модов по одному</td></tr>
<tr><td><b>Фильтры и поиск</b></td><td>Чипы по тому, что мод меняет, выпадашка по слоту предмета, список героев и один поиск по всему каталогу</td></tr>
<tr><td><b>Шрифты и курсоры</b></td><td>Ставятся в файлы игры с бэкапом оригиналов; удаление возвращает ваниль</td></tr>
<tr><td><b>Объединённые паки</b></td><td>Слепи несколько модов в один слот и разбери обратно</td></tr>
<tr><td><b>Свои файлы</b></td><td>Импортируй <code>.vpk</code> или подхвати то, что оставила в папке чужая программа. Приложение сверит отпечаток с каталогом и скажет, что это</td></tr>
<tr><td><b>Автообновление</b></td><td>Приложение само смотрит GitHub Releases и ставит новые версии</td></tr>
<tr><td><b>Windows и Linux</b></td><td>Оба в каждом релизе: установщик и портативная сборка под Windows, AppImage под Linux. Steam находится сам, включая flatpak</td></tr>
<tr><td><b>Без аккаунта и телеметрии</b></td><td>Ничего не собирается и никуда не уходит. Вход через Discord необязателен и нужен только чтобы подписать сборку, которой делишься</td></tr>
</table>
</details>

<div align="center">
  <img src="site/public/screenshots/dota-2-mod-manager-heroes-ru.webp" alt="Моды по героям" width="49%">
  <img src="site/public/screenshots/dota-2-mod-manager-my-mods-ru.webp" alt="Мои моды и порядок загрузки" width="49%">
</div>

<br>

## Установка

1. Скачай **[Dota 2 Mod Manager Setup](https://github.com/TheFleece/dota2-mod-manager/releases/latest/download/Dota-2-Mod-Manager-Setup.exe)** — прямая ссылка, всегда последняя версия
2. Запусти. Приложение установится, создаст ярлык и откроется
3. Путь к Доте найдётся сам. Никаких параметров запуска и правок свойств Steam

**На Linux** это [AppImage](https://github.com/TheFleece/dota2-mod-manager/releases/latest/download/Dota-2-Mod-Manager.AppImage):
`chmod +x` и запускай.

> [!IMPORTANT]
> Windows скажет, что издатель неизвестен: у установщика нет платной подписи. Жми **Подробнее**,
> потом **Выполнить в любом случае**. Каждый релиз собирается из этих исходников
> [публичным воркфлоу](https://github.com/TheFleece/dota2-mod-manager/actions/workflows/release.yml),
> а не заливается с чьего-то компьютера, и лог сборки ровно того файла, что ты скачал, открыт.

<br>

## Как это работает

В процесс Доты ничего не внедряется, и ни один файл игры не открывается, пока она запущена.

- Дота монтирует **одну** папку, названную по языку **озвучки**. Приложение ставит этот язык в
  настройках самой игры и туда же ставит моды — **без параметра запуска**, и это стоит перечитать
  дважды. [Почему так работает](https://dota2modmanager.com/ru/docs/language/)
- VPK-моды ложатся как `pakNN_dir.vpk`, слоты с 10 по 99. Кому надо грузиться первым, достаются
  `pak02`-`pak09`. [Слоты и порядок загрузки](https://dota2modmanager.com/ru/docs/vpk/)
- Выключенный мод переименовывается в `.off`: игра его пропускает, файл остаётся
- Шрифты и курсоры уезжают в папки игры, оригиналы сохраняются заранее
- Всё, что пишется в папку игры, делается одной транзакцией: упало на середине — откатывается
  целиком, вместе с файлами, которые подвинули
- Безопасный режим включён по умолчанию и означает, что приложение не трогает файлы Доты. Если
  его выключить, добавляется одна строка в `gameinfo_branchspecific.gi` и подпись в
  `dota.signatures` — обе сохраняются до первой правки и возвращаются байт в байт.
  [Что это даёт и чего стоит](https://dota2modmanager.com/ru/docs/safe/)

Загрузки лежат в `%APPDATA%/dota2-mod-manager/downloads`, манифест установки рядом. Полная
картина — в [ARCHITECTURE.md](ARCHITECTURE.md), а все модули перечислены в
[docs/API.md](docs/API.md), который генерируется из исходников, а не пишется руками.

<br>

## Рядом с Dota2 Minify

[Dota2 Minify](https://github.com/Egezenn/dota2-minify) — инструмент другого рода и другого
автора: он собирает моды, патча саму игру, а это приложение ставит готовые из каталога.
**Держи обе.** Приложение ставит моды в ту папку, которую игра смонтирует на самом деле, включая
выбранную Minify, никогда не занимает его слоты паков и не трогает его файлы. Minify с версии
v1.14rc7 проверяет принадлежность перед чисткой папки карт, поэтому поставленный здесь ландшафт
переживает его удаление.

[Что такое Minify и как держать обе](https://dota2modmanager.com/ru/docs/minify/).

<br>

## Документация

| | |
|---|---|
| [Установка модов](https://dota2modmanager.com/ru/docs/install/) | Весь путь, руками и приложением |
| [Языковая папка](https://dota2modmanager.com/ru/docs/language/) | Почему `-language` не нужен и что он делает, когда стоит |
| [VPK и порядок загрузки](https://dota2modmanager.com/ru/docs/vpk/) | Слоты pak, кто побеждает и при чём тут `gameinfo.gi` |
| [Безопасный режим](https://dota2modmanager.com/ru/docs/safe/) | Что приложение пишет в игру, а что нет |
| [Бесплатная косметика](https://dota2modmanager.com/ru/docs/cosmetics/) | Таблица предметов: что она может дать, а что нет |
| [После патча Доты](https://dota2modmanager.com/ru/docs/troubleshooting/) | Что ломается и что приложение возвращает |
| [Все цифры, проверяемые](https://dota2modmanager.com/ru/facts/) | Версия, платформы, счётчики и как проверить каждую |
| [ARCHITECTURE.md](ARCHITECTURE.md) · [docs/API.md](docs/API.md) | Кто за какое решение отвечает и что экспортирует каждый модуль |
| [CONTRIBUTING.md](CONTRIBUTING.md) · [AGENTS.md](AGENTS.md) · [SECURITY.md](SECURITY.md) | Как работать над проектом, с ИИ-ассистентом и без, и как сообщить о дыре |
| [PRIVACY.md](PRIVACY.md) | Что собирается (ничего) и каждый адрес, куда приложение может пойти |
| [DECISIONS.md](DECISIONS.md) | Что решено осознанно, чего действительно не хватает, и команда, которой это проверяется |
| [CHANGELOG.md](CHANGELOG.md) · [CHANGELOG.ru.md](CHANGELOG.ru.md) | Что менялось в каждом релизе |

<br>

## Сообщить о проблеме

| | |
|---|---|
| [Баг](https://github.com/TheFleece/dota2-mod-manager/issues/new?template=bug_report.yml) | Что-то сломалось. **Настройки → Диагностика → Экспортировать отчёт** соберёт всё нужное в один файл |
| [Идея](https://github.com/TheFleece/dota2-mod-manager/issues/new?template=feature_request.yml) | Предложение, как приложение должно работать |
| [Обсуждения](https://github.com/TheFleece/dota2-mod-manager/discussions) | Вопросы, сборки, которые не грех показать, и всё, что пока не баг |
| [Discord](https://discord.gg/PBvG8D9MxT) | Быстрая помощь, в сообществе каталога |
| [Безопасность](SECURITY.md) | Уязвимости — лично, никогда публичным issue |

Сначала две вещи: убедись, что стоит последняя версия, и если Дота недавно обновлялась — открой
приложение и дай ему вернуть патч на место.

<br>

## Жизнь проекта

<div align="center">
  <img src="https://dota2modmanager.com/activity.svg" alt="Коммиты по дням за последние 60, отдельно руками и отдельно из CI, с отметками релизов" width="100%">
</div>

Картинка рисуется из `git log` этого же репозитория, когда пересобирается
[сайт](https://dota2modmanager.com/ru/), а он пересобирается каждый день и после каждого релиза.
Никакого стороннего виджета: тот, кто открыл эту страницу, не грузит ничей трекер, и чтобы
картинка изменилась, коммитить ничего не надо.

**Что запускается на каждый пуш:**

| | |
|---|---|
| [Тесты](.github/workflows/test.yml) | Весь набор с порогом покрытия. Среди них четыре проверки проекта на согласие с самим собой: у каждого IPC-канала есть обработчик, у каждой русской строки есть английский близнец, версия и оба чейнджлога сходятся, а `docs/API.md` всё ещё соответствует исходникам |
| [CodeQL](.github/workflows/codeql.yml) | Анализ на безопасность и качество, плюс прогон раз в неделю |
| [Релиз](.github/workflows/release.yml) | Только на тег: собирает установщик, портативную сборку и AppImage из того самого коммита и публикует их с секцией чейнджлога для этой версии |
| [Сайт](.github/workflows/site.yml) | Пересобирает сайт, чтобы его счётчики, версия и эта картинка оставались правдой |
| [Зеркало](.github/workflows/mirror.yml) | Толкает ту же историю на [GitLab](https://gitlab.com/TheFleece/dota2-mod-manager), чтобы код пережил этот репозиторий |

Ничто из этого не коммитит обратно в `main`. То, что воркфлоу нужно помнить между запусками,
лежит в кеше Actions: коммит от бота на каждый прогон — это то, из-за чего лог перестаёт читаться.

<br>

## Разработка

```bash
npm install
npm start                 # запустить приложение
npm test                  # весь набор тестов, без фреймворков и моков
npm run test:coverage     # то же с порогом, который держит CI
npm run docs              # пересобрать docs/API.md из src/
npm run sandbox:seed      # одноразовое дерево игры с настоящими модами
npm run start:sandbox     # приложение против него, а не против своей игры
```

Node 24, Electron 43, без сборщика: рендерер — обычные HTML, CSS и JavaScript. Каждый релиз
делает [`release.yml`](.github/workflows/release.yml) из того коммита, на который указывает тег.

**Если задумал больше, чем починку — сначала issue.** Это одно сообщение, и оно спасает от
случая, когда одно и то же делают дважды по-разному, или когда ответ был «так задумано, и вот
почему». Остальное — в [CONTRIBUTING.md](CONTRIBUTING.md); [AGENTS.md](AGENTS.md) — то же самое
для тех, кто работает с ИИ-ассистентом.

<br>

## На чём построено

Всё стороннее, что приложение везёт с собой или качает, с лицензией. Полные тексты и две добавки
по седьмой секции GPL — в [NOTICE](NOTICE).

| | Зачем | Лицензия |
|---|---|---|
| [Electron](https://github.com/electron/electron) | Окно и процесс за ним | MIT |
| [electron-updater](https://github.com/electron-userland/electron-builder) | Проверка обновлений и их установка | MIT |
| [adm-zip](https://github.com/cthackers/adm-zip) | Чтение архивов модов, за нашими проверками размера и путей | MIT |
| [Source 2 Viewer](https://github.com/ValveResourceFormat/ValveResourceFormat) | Расшифровка текстур игры для иконок предметов. Качается по требованию, в сборку не входит | MIT |
| [Inter](https://github.com/rsms/inter), [Exo 2](https://github.com/NDISCOVER/Exo-2.0), [Material Symbols](https://github.com/google/material-design-icons) | Шрифты и иконки, лежат внутри приложения, а не тянутся из сети | OFL-1.1, Apache-2.0 |
| [Astro](https://github.com/withastro/astro) | Сайт документации, не приложение | MIT |

В `package.json` их ровно четыре: `adm-zip` и `electron-updater` едут внутри приложения,
`electron` и `electron-builder` только собирают его. Тесты и всё в `tools/` не зависят ни от
чего. Чтение и запись VPK, разбор KeyValues, защита от zip-бомб и логика обновления написаны
здесь, потому что каждая зависимость — это чужак с правом записи в папку игры на десятках тысяч
машин.

Валвовский `vpk.exe` сюда сознательно **не** добавлен и добавлен не будет: он проприетарный, а
проект, который его везёт, уже не открытый в том смысле, в каком это понимает SignPath. Поэтому
и существует `src/vpk.js`.

<br>

## Благодарности

Все моды, превью, гайды и данные каталога приходят из открытого репозитория
[**D2PFX**](https://github.com/h6rd/Dota2PornFxWeb) от [h6rd](https://github.com/h6rd) и
сообщества моддеров Доты. Это приложение — десктопный клиент к их каталогу, и каждая карточка
мода в нём называет автора.

**[hanta](https://www.youtube.com/@hqnta)** снял
[разбор приложения](https://www.youtube.com/watch?v=Z_yalpuP6pA) — там ответов больше, чем на
этой странице, если удобнее посмотреть, чем читать.

<br>

## Лицензия

[GPL-3.0](LICENSE). Copyright (C) 2026 Mykhailo Lynnyk. Подробности и две добавки по седьмой
секции лицензии — в [NOTICE](NOTICE).

<div align="center">
<sub>С Valve Corporation не связаны. Файлы игры ты меняешь на свой страх и риск.</sub>
</div>
