/**
 * What Russian players call each hero, and the form they type it in.
 *
 * Dota has no official Russian hero names, so this is not a translation - it is the nickname
 * the game is played under. Nobody searches "Queen of Pain": they search "голая квопа". Nobody
 * types "Techies": they type "араб течис". A page that only ever writes the Latin name has
 * nothing for either query to match, which is the same lexical hole the rest of the Russian
 * site had.
 *
 * Two forms, because the query is almost always "моды на <hero>" and that takes the
 * accusative: "Пудж" is how you name him, "Пуджа" is how you ask for mods for him. Getting
 * that wrong writes "моды на Пудж", which is what a machine translation sounds like.
 *
 * `alt` holds the other spellings people use - abbreviations mostly, which is how a Russian
 * player writes a hero whose name is long. They go in the page's text, not its title.
 *
 * Heroes missing from here keep the Latin name on both halves of the site. That is deliberate:
 * inventing a nickname nobody uses adds a word to the page that no search will ever contain,
 * and there are heroes Russian players simply say in English.
 */
export interface RuHeroName {
  /** How you name him: "Пудж". */
  nom: string;
  /** How you ask for mods for him: "моды на Пуджа". */
  acc: string;
  /** Other spellings, for the body text. */
  alt?: string[];
}

export const ruHeroNames: Record<string, RuHeroName> = {
  'Pudge': { nom: 'Пудж', acc: 'Пуджа', alt: ['Пуджик'] },
  'Shadow Fiend': { nom: 'СФ', acc: 'СФ', alt: ['Неверморе', 'Шадоу Фиенд'] },
  'Invoker': { nom: 'Инвокер', acc: 'Инвокера', alt: ['Инвок'] },
  'Lion': { nom: 'Лион', acc: 'Лиона' },
  'Tinker': { nom: 'Тинкер', acc: 'Тинкера' },
  'Huskar': { nom: 'Хускар', acc: 'Хускара' },
  'Storm Spirit': { nom: 'Шторм', acc: 'Шторма', alt: ['Сторм'] },
  'Luna': { nom: 'Луна', acc: 'Луну' },
  'Morphling': { nom: 'Морфлинг', acc: 'Морфлинга', alt: ['Морф'] },
  'Skywrath Mage': { nom: 'Скай маг', acc: 'Скай мага', alt: ['Скайврат', 'Скай'] },
  'Crystal Maiden': { nom: 'ЦМка', acc: 'ЦМку', alt: ['ЦМ', 'Кристалка'] },
  'Terrorblade': { nom: 'ТБ', acc: 'ТБ', alt: ['Террорблейд'] },
  'Dazzle': { nom: 'Даззл', acc: 'Даззла' },
  'Drow Ranger': { nom: 'Дровка', acc: 'Дровку', alt: ['Дроу'] },
  'Io': { nom: 'Висп', acc: 'Виспа', alt: ['Ио'] },
  'Arc Warden': { nom: 'Арк', acc: 'Арка', alt: ['Арк варден'] },
  'Enigma': { nom: 'Энигма', acc: 'Энигму' },
  'Lina': { nom: 'Лина', acc: 'Лину' },
  'Natures Prophet': { nom: 'Фурион', acc: 'Фуриона', alt: ['Профет'] },
  'Outworld Destroyer': { nom: 'ОД', acc: 'ОД', alt: ['Аутворлд'] },
  'Queen of Pain': { nom: 'Квопа', acc: 'Квопу', alt: ['КВ'] },
  'Sniper': { nom: 'Снайпер', acc: 'Снайпера' },
  'Techies': { nom: 'Течис', acc: 'Течиса', alt: ['Минёр', 'Техис'] },
  'Templar Assassin': { nom: 'ТА', acc: 'ТА', alt: ['Ланая'] },
  'Death Prophet': { nom: 'ДП', acc: 'ДП' },
  'Disruptor': { nom: 'Дисраптор', acc: 'Дисраптора' },
  'Hoodwink': { nom: 'Худвинк', acc: 'Худвинка', alt: ['Белка'] },
  'Kez': { nom: 'Кез', acc: 'Кеза' },
  'Lone Druid': { nom: 'Друид', acc: 'Друида', alt: ['ЛД'] },
  'Razor': { nom: 'Разор', acc: 'Разора' },
  'Rubick': { nom: 'Рубик', acc: 'Рубика' },
  'Venomancer': { nom: 'Вено', acc: 'Вено', alt: ['Веномансер'] },
  'Ancient Apparition': { nom: 'АА', acc: 'АА' },
  'Brewmaster': { nom: 'Брю', acc: 'Брю', alt: ['Панда', 'Брюмастер'] },
  'Chen': { nom: 'Чен', acc: 'Чена' },
  'Dragon Knight': { nom: 'ДК', acc: 'ДК', alt: ['Драгон найт'] },
  'Jakiro': { nom: 'Джакиро', acc: 'Джакиро' },
  'Keeper of the Light': { nom: 'Кипер', acc: 'Кипера', alt: ['КОТЛ'] },
  'Lich': { nom: 'Лич', acc: 'Лича' },
  'Medusa': { nom: 'Медуза', acc: 'Медузу' },
  'Monkey King': { nom: 'Манки кинг', acc: 'Манки кинга', alt: ['МК', 'Обезьяна'] },
  'Necrophos': { nom: 'Некр', acc: 'Некра', alt: ['Некрофос'] },
  'Oracle': { nom: 'Оракл', acc: 'Оракла' },
  'Phantom Lancer': { nom: 'ПЛ', acc: 'ПЛ' },
  'Shadow Shaman': { nom: 'Шаман', acc: 'Шамана', alt: ['Раст'] },
  'Viper': { nom: 'Вайпер', acc: 'Вайпера' },
  'Centaur': { nom: 'Кентавр', acc: 'Кентавра' },
  'Enchantress': { nom: 'Энча', acc: 'Энчу' },
  'Grimstroke': { nom: 'Гримстроук', acc: 'Гримстроука' },
  'Phoenix': { nom: 'Феникс', acc: 'Феникса' },
  'Puck': { nom: 'Пак', acc: 'Пака' },
  'Silencer': { nom: 'Сайленсер', acc: 'Сайленсера' },
  'Snapfire': { nom: 'Снапфаер', acc: 'Снапфаера', alt: ['Снап', 'Бабка'] },
  'Troll Warlord': { nom: 'Тролль', acc: 'Тролля' },
  'Vengeful Spirit': { nom: 'Венга', acc: 'Венгу' },
  'Visage': { nom: 'Визаж', acc: 'Визажа' },
  'Weaver': { nom: 'Вивер', acc: 'Вивера' },
  'Zeus': { nom: 'Зевс', acc: 'Зевса' },
  'Anti-Mage': { nom: 'Антимаг', acc: 'Антимага', alt: ['АМка', 'АМ'] },
  'Bane': { nom: 'Бейн', acc: 'Бейна' },
  'Batrider': { nom: 'Бат', acc: 'Бата', alt: ['Батрайдер'] },
  'Juggernaut': { nom: 'Джаггер', acc: 'Джаггера', alt: ['Джага', 'Джаггернаут'] },
  'Tidehunter': { nom: 'Тайд', acc: 'Тайда', alt: ['Тайдхантер'] },
  'Ursa': { nom: 'Урса', acc: 'Урсу' },
  'Marci': { nom: 'Марси', acc: 'Марси' },
  'Ringmaster': { nom: 'Рингмастер', acc: 'Рингмастера' },
  'Tiny': { nom: 'Тини', acc: 'Тини', alt: ['Тайни'] },
  'Axe': { nom: 'Акс', acc: 'Акса' },
  'Sven': { nom: 'Свен', acc: 'Свена' },
  'Mirana': { nom: 'Мирана', acc: 'Мирану', alt: ['Потм'] },
  'Slark': { nom: 'Сларк', acc: 'Сларка' },
  'Riki': { nom: 'Рики', acc: 'Рики' },
  'Phantom Assassin': { nom: 'ПА', acc: 'ПА', alt: ['Фантомка'] },
  'Legion Commander': { nom: 'Легион', acc: 'Легиона', alt: ['ЛК'] },
  'Faceless Void': { nom: 'Войд', acc: 'Войда' },
  'Skeleton King': { nom: 'ВК', acc: 'ВК', alt: ['Скелет', 'Врайт кинг'] },
  'Life Stealer': { nom: 'Наикс', acc: 'Наикса', alt: ['Лайфстилер'] },
  'Windrunner': { nom: 'Винда', acc: 'Винду', alt: ['Виндрейнджер'] },
  'Earthshaker': { nom: 'Шейкер', acc: 'Шейкера', alt: ['Эса'] },
  'Ember Spirit': { nom: 'Эмбер', acc: 'Эмбера' },
  'Void Spirit': { nom: 'Войд спирит', acc: 'Войд спирита' },
  'Pangolier': { nom: 'Панго', acc: 'Панго', alt: ['Панголир'] },
  'Mars': { nom: 'Марс', acc: 'Марса' },
  'Spectre': { nom: 'Спектра', acc: 'Спектру' },
  'Meepo': { nom: 'Мипо', acc: 'Мипо' },
  'Clinkz': { nom: 'Клинкз', acc: 'Клинкза' },
  'Bloodseeker': { nom: 'БС', acc: 'БС', alt: ['Бладсикер'] },
  'Night Stalker': { nom: 'Балар', acc: 'Балара', alt: ['Найт сталкер'] },
  'Broodmother': { nom: 'Брудка', acc: 'Брудку', alt: ['Паучиха'] },
  'Chaos Knight': { nom: 'ЦК', acc: 'ЦК', alt: ['Хаос найт'] },
  'Bounty Hunter': { nom: 'БХ', acc: 'БХ' },
  'Spirit Breaker': { nom: 'Баратрум', acc: 'Баратрума', alt: ['СБ', 'Барат'] },
  'Magnus': { nom: 'Магнус', acc: 'Магнуса' },
  'Timbersaw': { nom: 'Тимбер', acc: 'Тимбера' },
  'Underlord': { nom: 'Андер', acc: 'Андера', alt: ['Андерлорд'] },
  'Abaddon': { nom: 'Абаддон', acc: 'Абаддона' },
  'Omniknight': { nom: 'Омник', acc: 'Омника' },
  'Winter Wyvern': { nom: 'Виверна', acc: 'Виверну' },
  'Witch Doctor': { nom: 'ВД', acc: 'ВД', alt: ['Вич доктор'] },
  'Warlock': { nom: 'Варлок', acc: 'Варлока' },
  'Leshrac': { nom: 'Лешрак', acc: 'Лешрака' },
  'Beastmaster': { nom: 'Бист', acc: 'Биста', alt: ['Бистмастер'] },
  'Alchemist': { nom: 'Алхимик', acc: 'Алхимика', alt: ['Алхим'] },
  'Rattletrap': { nom: 'Клок', acc: 'Клока', alt: ['Клокверк'] },
  'Kunkka': { nom: 'Кунка', acc: 'Кунку' },
  'Elder Titan': { nom: 'ЕТ', acc: 'ЕТ' },
  'Tusk': { nom: 'Таск', acc: 'Таска' },
  'Dawnbreaker': { nom: 'Давн', acc: 'Давна' },
  'Primal Beast': { nom: 'Примал', acc: 'Примала' },
  'Muerta': { nom: 'Муэрта', acc: 'Муэрту' },
  'Doom': { nom: 'Дум', acc: 'Дума' },
  'Nyx Assassin': { nom: 'Никс', acc: 'Никса' },
  'Sand King': { nom: 'СК', acc: 'СК', alt: ['Сенд кинг'] },
  'Slardar': { nom: 'Слардар', acc: 'Слардара' },
  'Lycan': { nom: 'Ликан', acc: 'Ликана' },
  'Gyrocopter': { nom: 'Гиро', acc: 'Гиру', alt: ['Гирокоптер'] },
  'Pugna': { nom: 'Пугна', acc: 'Пугну' },
  'Dark Seer': { nom: 'ДС', acc: 'ДС', alt: ['Дарк сир'] },
  'Dark Willow': { nom: 'Виллоу', acc: 'Виллоу' },
  'Treant': { nom: 'Трент', acc: 'Трента' },
  'Undying': { nom: 'Андай', acc: 'Андая', alt: ['Андаинг'] },
  'Naga Siren': { nom: 'Нага', acc: 'Нагу' },
  'Ogre Magi': { nom: 'Огр', acc: 'Огра', alt: ['Огр маг'] },
  'Wisp': { nom: 'Висп', acc: 'Виспа' },
  'Bristleback': { nom: 'Бристл', acc: 'Бристла', alt: ['Бристлбек'] },
  'Clockwerk': { nom: 'Клок', acc: 'Клока' },
  'Marksman': { nom: 'Марксмен', acc: 'Марксмена' },
};

/** The nickname if there is one, otherwise nothing and the page keeps the Latin name. */
export function ruName(hero: string): RuHeroName | null {
  return ruHeroNames[hero] ?? null;
}
