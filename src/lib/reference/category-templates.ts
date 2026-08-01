export interface CategoryTemplateItem {
  /** Clave de `reference.category.*` — ver `CategoryRow.i18nKey`. */
  i18nKey: string;
  /** Nombre en ES rioplatense: se persiste en `CategoryRow.name` como fallback/búsqueda. */
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
      { i18nKey: "groceriesPantry", name: "Almacén", icon: "shopping-cart", color: "var(--data-1)", kind: "expense" },
      { i18nKey: "groceriesProduce", name: "Verdulería", icon: "shopping-cart", color: "var(--data-1)", kind: "expense" },
      { i18nKey: "groceriesButcher", name: "Carnicería", icon: "shopping-cart", color: "var(--data-1)", kind: "expense" },
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
      { i18nKey: "transportPublic", name: "Transporte público", icon: "car", color: "var(--data-4)", kind: "expense" },
      { i18nKey: "transportParking", name: "Estacionamiento", icon: "car", color: "var(--data-4)", kind: "expense" },
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
      { i18nKey: "healthAppointments", name: "Consultas", icon: "heart-pulse", color: "var(--data-2)", kind: "expense" },
      { i18nKey: "healthInsurance", name: "Seguro médico", icon: "heart-pulse", color: "var(--data-2)", kind: "expense" },
    ],
  },
  { i18nKey: "restaurants", name: "Restaurantes", icon: "utensils", color: "var(--data-3)", kind: "expense" },
  { i18nKey: "housing", name: "Vivienda", icon: "home", color: "var(--data-5)", kind: "expense" },
  { i18nKey: "entertainment", name: "Entretenimiento", icon: "film", color: "var(--violet-400)", kind: "expense" },
  { i18nKey: "clothing", name: "Ropa", icon: "tag", color: "var(--data-3)", kind: "expense" },
  { i18nKey: "education", name: "Educación", icon: "briefcase", color: "var(--data-5)", kind: "expense" },
  { i18nKey: "pets", name: "Mascotas", icon: "heart-pulse", color: "var(--violet-400)", kind: "expense" },
  { i18nKey: "gifts", name: "Regalos", icon: "handshake", color: "var(--data-1)", kind: "expense" },
  { i18nKey: "salary", name: "Sueldo", icon: "briefcase", color: "var(--data-2)", kind: "income" },
  { i18nKey: "otherIncome", name: "Otros ingresos", icon: "trending-up", color: "var(--data-4)", kind: "income" },
];
