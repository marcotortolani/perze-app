import type { IconName } from "@/design-system/core/Icon";

export type CategoryIconGroupId = "food" | "transport" | "home" | "health" | "leisure" | "shopping" | "money" | "other";

export interface CategoryIconGroup {
  id: CategoryIconGroupId;
  icons: IconName[];
}

/**
 * Set del picker de "editar/crear categoría" — agrupado por tema, con
 * buscador (`IconPicker`). Fuente de verdad; `CATEGORY_ICON_OPTIONS` (lista
 * plana) se deriva de acá. ~57 íconos: los 16 originales del set curado más
 * los glifos que `Icon.tsx` sumó para cubrir transporte, casa, salud, ocio,
 * educación, familia y compras — huecos obvios del set anterior (pensado
 * para el chrome de la app, no para categorías: no había gimnasio,
 * educación, mascotas ni viajes).
 */
export const CATEGORY_ICON_GROUPS: readonly CategoryIconGroup[] = [
  { id: "food", icons: ["shopping-cart", "utensils", "coffee", "basket", "pizza", "beer", "storefront"] },
  { id: "transport", icons: ["car", "fuel", "bus", "train", "plane", "bicycle", "luggage"] },
  { id: "home", icons: ["home", "couch", "key", "wrench", "lightning", "drop", "flame", "tv"] },
  { id: "health", icons: ["heart-pulse", "pharmacy", "stethoscope", "tooth", "eyeglasses", "shield"] },
  { id: "leisure", icons: ["film", "music", "gamepad", "ticket", "popcorn", "ball", "barbell"] },
  { id: "shopping", icons: ["tag", "shirt", "gift", "scissors", "package", "receipt", "phone"] },
  { id: "money", icons: ["wallet", "piggy-bank", "banknote", "credit-card", "bank", "hand-coins", "coins", "trending-up"] },
  { id: "other", icons: ["briefcase", "handshake", "graduation", "books", "paw", "baby", "users"] },
];

/** Lista plana, derivada de los grupos — se mantiene el export: hay callers y tests que ya lo usan. */
export const CATEGORY_ICON_OPTIONS: IconName[] = CATEGORY_ICON_GROUPS.flatMap((g) => g.icons);

/**
 * `IconName` del picker → clave de `reference.icon.*`. Mismo patrón que
 * `CATEGORY_MESSAGE_KEY` (category-i18n.ts): objeto literal, no template
 * string — next-intl tipa `t()` contra la unión exacta de claves. Además de
 * alimentar el buscador, es lo que traduce el `aria-label` de cada botón
 * del picker (antes era la clave cruda en inglés, ej. "heart-pulse" — string
 * hardcodeada que viola "cero strings hardcodeadas").
 */
export const CATEGORY_ICON_MESSAGE_KEY = {
  "shopping-cart": "reference.icon.shoppingCart",
  utensils: "reference.icon.utensils",
  coffee: "reference.icon.coffee",
  basket: "reference.icon.basket",
  pizza: "reference.icon.pizza",
  beer: "reference.icon.beer",
  storefront: "reference.icon.storefront",
  car: "reference.icon.car",
  fuel: "reference.icon.fuel",
  bus: "reference.icon.bus",
  train: "reference.icon.train",
  plane: "reference.icon.plane",
  bicycle: "reference.icon.bicycle",
  luggage: "reference.icon.luggage",
  home: "reference.icon.home",
  couch: "reference.icon.couch",
  key: "reference.icon.key",
  wrench: "reference.icon.wrench",
  lightning: "reference.icon.lightning",
  drop: "reference.icon.drop",
  flame: "reference.icon.flame",
  tv: "reference.icon.tv",
  "heart-pulse": "reference.icon.heartPulse",
  pharmacy: "reference.icon.pharmacy",
  stethoscope: "reference.icon.stethoscope",
  tooth: "reference.icon.tooth",
  eyeglasses: "reference.icon.eyeglasses",
  shield: "reference.icon.shield",
  film: "reference.icon.film",
  music: "reference.icon.music",
  gamepad: "reference.icon.gamepad",
  ticket: "reference.icon.ticket",
  popcorn: "reference.icon.popcorn",
  ball: "reference.icon.ball",
  barbell: "reference.icon.barbell",
  tag: "reference.icon.tag",
  shirt: "reference.icon.shirt",
  gift: "reference.icon.gift",
  scissors: "reference.icon.scissors",
  package: "reference.icon.package",
  receipt: "reference.icon.receipt",
  phone: "reference.icon.phone",
  wallet: "reference.icon.wallet",
  "piggy-bank": "reference.icon.piggyBank",
  banknote: "reference.icon.banknote",
  "credit-card": "reference.icon.creditCard",
  bank: "reference.icon.bank",
  "hand-coins": "reference.icon.handCoins",
  coins: "reference.icon.coins",
  "trending-up": "reference.icon.trendingUp",
  briefcase: "reference.icon.briefcase",
  handshake: "reference.icon.handshake",
  graduation: "reference.icon.graduation",
  books: "reference.icon.books",
  paw: "reference.icon.paw",
  baby: "reference.icon.baby",
  users: "reference.icon.users",
} as const satisfies Partial<Record<IconName, string>>;

export type CategoryIconWithLabel = keyof typeof CATEGORY_ICON_MESSAGE_KEY;

/** `CategoryIconGroupId` → clave de `reference.iconGroup.*`, mismo patrón literal. */
export const CATEGORY_ICON_GROUP_MESSAGE_KEY = {
  food: "reference.iconGroup.food",
  transport: "reference.iconGroup.transport",
  home: "reference.iconGroup.home",
  health: "reference.iconGroup.health",
  leisure: "reference.iconGroup.leisure",
  shopping: "reference.iconGroup.shopping",
  money: "reference.iconGroup.money",
  other: "reference.iconGroup.other",
} as const satisfies Record<CategoryIconGroupId, string>;
