import { useTranslations } from "next-intl";
import type { CategoryRow } from "@/lib/db/schema";
import { CATEGORY_MESSAGE_KEY, isCategoryI18nKey } from "@/lib/reference/category-i18n";

/**
 * Nombre a mostrar de una categoría: traducido si viene de la plantilla del
 * seed/onboarding y sigue gobernada por ella (`isSystem: true` + `i18nKey`
 * presente), tal cual si el usuario la creó o la editó (`isSystem: false`).
 *
 * El gate es `isSystem`, no solo `i18nKey` — `detachFromTemplate`
 * (`categories-repo.ts`) deja `i18nKey` intacto al desprender una categoría
 * editada, precisamente para que `applyCategoryTemplate` la siga
 * reconociendo como "esta identidad de plantilla ya está resuelta" y no
 * cree una segunda fila para la misma clave. Si acá se tradujera por
 * `i18nKey` solo, una categoría renombrada ("Salud" → "Médicos") volvería a
 * mostrarse como "Salud" — el nombre editado quedaría invisible.
 */
export function useCategoryLabel(): (category: Pick<CategoryRow, "name" | "i18nKey" | "isSystem">) => string {
  const t = useTranslations();
  return (category) => (category.isSystem && isCategoryI18nKey(category.i18nKey) ? t(CATEGORY_MESSAGE_KEY[category.i18nKey]) : category.name);
}
