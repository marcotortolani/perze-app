/**
 * `CategoryRow.i18nKey` → clave de mensaje de `reference.category.*`. Un
 * objeto literal en vez de un template string dinámico porque next-intl
 * tipa `t()` contra la unión exacta de claves de `messages/es.json` (ver
 * `global.ts`) — indexar acá devuelve esa misma unión, un template
 * `reference.category.${string}` no tipa.
 */
export const CATEGORY_MESSAGE_KEY = {
  groceries: "reference.category.groceries",
  restaurants: "reference.category.restaurants",
  transport: "reference.category.transport",
  housing: "reference.category.housing",
  health: "reference.category.health",
  entertainment: "reference.category.entertainment",
  salary: "reference.category.salary",
  otherIncome: "reference.category.otherIncome",
} as const;

export type CategoryI18nKey = keyof typeof CATEGORY_MESSAGE_KEY;

export function isCategoryI18nKey(key: string | null): key is CategoryI18nKey {
  return !!key && key in CATEGORY_MESSAGE_KEY;
}
