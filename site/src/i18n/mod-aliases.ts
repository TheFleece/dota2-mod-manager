/**
 * What a particular mod is called in Russian, when that is nothing like its catalog name.
 *
 * A search for "банан для тини" is a search for one specific mod, by somebody who saw it in a
 * clip and never learned it is filed as "Tiny Banana". The page already lists it; what the
 * page did not have is the words they typed. Same for "гопник тайдхантер" (Gopo Tidehunter),
 * "скай маг танатос" (Skywrath Mage Thanatos), "дисраптор на тракторе" (Disruptor Tractor).
 *
 * This is a hand-written list and it is meant to stay one. Machine-transliterating every mod
 * name would produce a page of noise nobody searches for; these are the ones people actually
 * ask for by a Russian name. Keyed by the catalog's exact mod name.
 */
export const modAliases: Record<string, string[]> = {
  'Techies Mine Radius': ['радиус мин Течиса', 'как включить радиус мин у Течиса'],
  'Tiny Banana': ['банан для Тини', 'Тини банан'],
  'Gopo Pudge': ['гопник Пудж', 'Пудж в адидасе'],
  'Gopo Tidehunter': ['гопник Тайдхантер', 'Тайд гопник'],
  'Pudge CM': ['Пудж ЦМка', 'Пудж Кристал Мейден'],
  'Skywrath Mage Thanatos': ['Скай маг Танатос', 'Танатос на Скайврата'],
  'Techies Arab': ['араб Течис', 'Течис араб'],
  'Russian Ursa': ['русская Урса', 'Урса в ушанке'],
  'Sniper Dragon Lore': ['Снайпер Драгон Лор', 'Драгон Лор из КС'],
  'Disruptor Tractor': ['Дисраптор на тракторе', 'трактор Дисраптор'],
  'Joker Ringmaster': ['Рингмастер Джокер', 'Джокер на Рингмастера'],
  'Invoker Patchouli': ['Инвокер Пачули', 'аниме Инвокер'],
  'Pudge Toy Butcher': ['игрушечный Пудж'],
  'Pudge Clown Toy': ['Пудж клоун'],
  'Marci Atri': ['Марси Атри', 'аниме Марси'],
  'Maid Marci': ['Марси горничная'],
  'Crystal Maiden Cirno': ['ЦМка Сырно', 'аниме ЦМка'],
};

/** The Russian names for one mod, or nothing. */
export function aliasesFor(name: string): string[] {
  return modAliases[name] ?? [];
}
