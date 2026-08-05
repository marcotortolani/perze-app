import type { CategoryI18nKey } from "./category-i18n";

export interface CategoryTemplateItem {
  /**
   * La identidad de la categoría, y lo único que la UI muestra: se traduce
   * con `CATEGORY_MESSAGE_KEY` (`reference.category.*`, ES/EN/PT).
   *
   * Tipada contra la unión de claves reales y no como `string`: agregar un
   * ítem de plantilla sin su mensaje ahora no compila, en vez de aparecer en
   * pantalla como una clave cruda o como el `name` en español.
   */
  i18nKey: CategoryI18nKey;
  /**
   * Nombre en ES rioplatense. **No es lo que se muestra** — se persiste en
   * `CategoryRow.name` como fallback y para búsqueda; lo visible sale de
   * `useCategoryLabel()`, que traduce mientras la categoría siga gobernada
   * por la plantilla (`isSystem`).
   */
  name: string;
  icon: string;
  color: string;
  kind: "expense" | "income";
  /** Subcategorías — solo la plantilla "Completa" las usa (A8). */
  children?: CategoryTemplateItem[] | undefined;
}

/**
 * Plantilla "Básica" (8 categorías) — A8 la aplica en silencio (queda
 * editable en K5 después); es también la que usa el household de demo.
 * Compartida acá para que las dos no diverjan.
 */
export const BASIC_CATEGORY_TEMPLATE: CategoryTemplateItem[] = [
  { i18nKey: "groceries", name: "Supermercado", icon: "shopping-cart", color: "var(--data-1)", kind: "expense" },
  { i18nKey: "restaurants", name: "Restaurantes", icon: "utensils", color: "var(--data-3)", kind: "expense" },
  { i18nKey: "transport", name: "Transporte", icon: "car", color: "var(--data-4)", kind: "expense" },
  { i18nKey: "housing", name: "Vivienda", icon: "home", color: "var(--data-5)", kind: "expense" },
  { i18nKey: "health", name: "Salud", icon: "heart-pulse", color: "var(--data-2)", kind: "expense" },
  { i18nKey: "entertainment", name: "Entretenimiento", icon: "film", color: "var(--violet-400)", kind: "expense" },
  { i18nKey: "salary", name: "Sueldo", icon: "briefcase", color: "var(--data-2)", kind: "income" },
  { i18nKey: "otherIncome", name: "Otros ingresos", icon: "trending-up", color: "var(--data-4)", kind: "income" },
];

/**
 * Plantilla "Completa" (A8) — 20 categorías, tres con subcategorías
 * (supermercado, transporte, salud). `applyCategoryTemplate()` la aplana
 * en dos pasadas porque las hijas necesitan el id real del padre, que Dexie
 * recién asigna al crearlo.
 */
export const COMPLETE_CATEGORY_TEMPLATE: CategoryTemplateItem[] = [
  {
    i18nKey: "groceries",
    name: "Supermercado",
    icon: "shopping-cart",
    color: "var(--data-1)",
    kind: "expense",
    children: [
      { i18nKey: "groceriesPantry", name: "Almacén", icon: "basket", color: "var(--data-1)", kind: "expense" },
      { i18nKey: "groceriesProduce", name: "Verdulería", icon: "carrot", color: "var(--data-1)", kind: "expense" },
      { i18nKey: "groceriesButcher", name: "Carnicería", icon: "cow", color: "var(--data-1)", kind: "expense" },
    ],
  },
  {
    i18nKey: "transport",
    name: "Transporte",
    icon: "car",
    color: "var(--data-4)",
    kind: "expense",
    children: [
      { i18nKey: "transportFuel", name: "Nafta", icon: "fuel", color: "var(--data-4)", kind: "expense" },
      { i18nKey: "transportPublic", name: "Transporte público", icon: "bus", color: "var(--data-4)", kind: "expense" },
      { i18nKey: "transportParking", name: "Estacionamiento", icon: "letter-circle-p", color: "var(--data-4)", kind: "expense" },
    ],
  },
  {
    i18nKey: "health",
    name: "Salud",
    icon: "heart-pulse",
    color: "var(--data-2)",
    kind: "expense",
    children: [
      { i18nKey: "healthPharmacy", name: "Farmacia", icon: "pharmacy", color: "var(--data-2)", kind: "expense" },
      { i18nKey: "healthAppointments", name: "Consultas", icon: "stethoscope", color: "var(--data-2)", kind: "expense" },
      { i18nKey: "healthInsurance", name: "Seguro médico", icon: "shield", color: "var(--data-2)", kind: "expense" },
    ],
  },
  { i18nKey: "restaurants", name: "Restaurantes", icon: "utensils", color: "var(--data-3)", kind: "expense" },
  { i18nKey: "housing", name: "Vivienda", icon: "home", color: "var(--data-5)", kind: "expense" },
  { i18nKey: "entertainment", name: "Entretenimiento", icon: "film", color: "var(--violet-400)", kind: "expense" },
  { i18nKey: "clothing", name: "Ropa", icon: "shirt", color: "var(--data-3)", kind: "expense" },
  { i18nKey: "education", name: "Educación", icon: "graduation", color: "var(--data-5)", kind: "expense" },
  { i18nKey: "pets", name: "Mascotas", icon: "paw", color: "var(--violet-400)", kind: "expense" },
  { i18nKey: "gifts", name: "Regalos", icon: "gift", color: "var(--data-1)", kind: "expense" },
  { i18nKey: "salary", name: "Sueldo", icon: "briefcase", color: "var(--data-2)", kind: "income" },
  { i18nKey: "otherIncome", name: "Otros ingresos", icon: "trending-up", color: "var(--data-4)", kind: "income" },
];
