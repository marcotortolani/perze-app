import { useTranslations } from "next-intl";
import type { CategoryRow } from "@/lib/db/schema";
import { CATEGORY_MESSAGE_KEY, isCategoryI18nKey } from "@/lib/reference/category-i18n";

/**
 * Nombre a mostrar de una categoría: traducido si viene de la plantilla del
 * seed/onboarding (`i18nKey` presente), tal cual si el usuario la creó o
 * renombró (`i18nKey: null` — ver `CategoryRow.i18nKey`).
 */
export function useCategoryLabel(): (category: Pick<CategoryRow, "name" | "i18nKey">) => string {
  const t = useTranslations();
  return (category) => (isCategoryI18nKey(category.i18nKey) ? t(CATEGORY_MESSAGE_KEY[category.i18nKey]) : category.name);
}
