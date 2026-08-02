import type { IconName } from "@/design-system/core/Icon";

/**
 * Set curado para el picker de "editar categoría" — no todo `IconName` de
 * la app, solo los que ya usan las plantillas de categorías
 * (`category-templates.ts`) más un puñado genérico ya importado en
 * `Icon.tsx` (nada nuevo al bundle). 16 entra parejo en una grilla de 4×4.
 */
export const CATEGORY_ICON_OPTIONS: IconName[] = [
  "shopping-cart",
  "utensils",
  "car",
  "home",
  "heart-pulse",
  "pharmacy",
  "film",
  "coffee",
  "fuel",
  "briefcase",
  "handshake",
  "trending-up",
  "receipt",
  "wallet",
  "piggy-bank",
  "tag",
];
