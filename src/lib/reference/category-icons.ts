import type { IconName } from "@/design-system/core/Icon";

export type CategoryIconGroupId = "food" | "transport" | "home" | "health" | "leisure" | "shopping" | "money" | "other";

export interface CategoryIconGroup {
  id: CategoryIconGroupId;
  icons: IconName[];
}

/**
 * Set del picker de "editar/crear categoría" — agrupado por tema, con
 * buscador (`IconPicker`). Fuente de verdad; `CATEGORY_ICON_OPTIONS` (lista
 * plana) se deriva de acá. ~104 íconos: los 16 originales del set curado, los
 * glifos que `Icon.tsx` sumó para cubrir transporte, casa, salud, ocio,
 * educación, familia y compras, y una segunda tanda por rubros que seguían
 * cayendo en un glifo genérico — panadería, delivery, peaje, expensas,
 * limpieza, terapia, streaming, impuestos, suscripciones y donaciones.
 */
export const CATEGORY_ICON_GROUPS: readonly CategoryIconGroup[] = [
  { id: "food", icons: ["shopping-cart", "utensils", "coffee", "basket", "pizza", "beer", "storefront", "carrot", "cow", "bone", "bread", "fish", "ice-cream", "bowl-food", "wine", "cake"] },
  { id: "transport", icons: ["car", "fuel", "bus", "train", "plane", "bicycle", "luggage", "letter-circle-p", "taxi", "motorcycle", "road", "ferry", "toll", "globe"] },
  { id: "home", icons: ["home", "couch", "key", "wrench", "lightning", "drop", "flame", "tv", "building", "broom", "washing-machine", "plant", "wifi", "toolbox"] },
  { id: "health", icons: ["heart-pulse", "pharmacy", "stethoscope", "tooth", "eyeglasses", "shield", "pill", "syringe", "brain", "hospital"] },
  { id: "leisure", icons: ["film", "music", "gamepad", "ticket", "popcorn", "ball", "barbell", "monitor-play", "guitar", "confetti", "tent", "mountains", "park", "museum", "running", "camera"] },
  { id: "shopping", icons: ["tag", "shirt", "gift", "scissors", "package", "receipt", "phone", "sneaker", "bag", "watch", "laptop", "smartphone"] },
  { id: "money", icons: ["wallet", "piggy-bank", "banknote", "credit-card", "bank", "hand-coins", "coins", "trending-up", "vault", "percent", "calculator", "invoice", "invest"] },
  { id: "other", icons: ["briefcase", "handshake", "graduation", "books", "paw", "baby", "users", "scales", "gavel", "hand-heart", "dog", "cat", "cloud"] },
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
  bread: "reference.icon.bread",
  fish: "reference.icon.fish",
  "ice-cream": "reference.icon.iceCream",
  "bowl-food": "reference.icon.bowlFood",
  wine: "reference.icon.wine",
  cake: "reference.icon.cake",
  carrot: "reference.icon.carrot",
  cow: "reference.icon.cow",
  bone: "reference.icon.bone",
  car: "reference.icon.car",
  fuel: "reference.icon.fuel",
  bus: "reference.icon.bus",
  train: "reference.icon.train",
  plane: "reference.icon.plane",
  bicycle: "reference.icon.bicycle",
  luggage: "reference.icon.luggage",
  taxi: "reference.icon.taxi",
  motorcycle: "reference.icon.motorcycle",
  road: "reference.icon.road",
  ferry: "reference.icon.ferry",
  toll: "reference.icon.toll",
  globe: "reference.icon.globe",
  "letter-circle-p": "reference.icon.letterCircleP",
  home: "reference.icon.home",
  couch: "reference.icon.couch",
  key: "reference.icon.key",
  wrench: "reference.icon.wrench",
  lightning: "reference.icon.lightning",
  drop: "reference.icon.drop",
  flame: "reference.icon.flame",
  tv: "reference.icon.tv",
  building: "reference.icon.building",
  broom: "reference.icon.broom",
  "washing-machine": "reference.icon.washingMachine",
  plant: "reference.icon.plant",
  wifi: "reference.icon.wifi",
  toolbox: "reference.icon.toolbox",
  "heart-pulse": "reference.icon.heartPulse",
  pharmacy: "reference.icon.pharmacy",
  stethoscope: "reference.icon.stethoscope",
  tooth: "reference.icon.tooth",
  eyeglasses: "reference.icon.eyeglasses",
  shield: "reference.icon.shield",
  pill: "reference.icon.pill",
  syringe: "reference.icon.syringe",
  brain: "reference.icon.brain",
  hospital: "reference.icon.hospital",
  film: "reference.icon.film",
  music: "reference.icon.music",
  gamepad: "reference.icon.gamepad",
  ticket: "reference.icon.ticket",
  popcorn: "reference.icon.popcorn",
  ball: "reference.icon.ball",
  barbell: "reference.icon.barbell",
  "monitor-play": "reference.icon.monitorPlay",
  guitar: "reference.icon.guitar",
  confetti: "reference.icon.confetti",
  tent: "reference.icon.tent",
  mountains: "reference.icon.mountains",
  park: "reference.icon.park",
  museum: "reference.icon.museum",
  running: "reference.icon.running",
  camera: "reference.icon.camera",
  tag: "reference.icon.tag",
  shirt: "reference.icon.shirt",
  gift: "reference.icon.gift",
  scissors: "reference.icon.scissors",
  package: "reference.icon.package",
  receipt: "reference.icon.receipt",
  phone: "reference.icon.phone",
  sneaker: "reference.icon.sneaker",
  bag: "reference.icon.bag",
  watch: "reference.icon.watch",
  laptop: "reference.icon.laptop",
  smartphone: "reference.icon.smartphone",
  wallet: "reference.icon.wallet",
  "piggy-bank": "reference.icon.piggyBank",
  banknote: "reference.icon.banknote",
  "credit-card": "reference.icon.creditCard",
  bank: "reference.icon.bank",
  "hand-coins": "reference.icon.handCoins",
  coins: "reference.icon.coins",
  "trending-up": "reference.icon.trendingUp",
  vault: "reference.icon.vault",
  percent: "reference.icon.percent",
  calculator: "reference.icon.calculator",
  invoice: "reference.icon.invoice",
  invest: "reference.icon.invest",
  briefcase: "reference.icon.briefcase",
  handshake: "reference.icon.handshake",
  graduation: "reference.icon.graduation",
  books: "reference.icon.books",
  paw: "reference.icon.paw",
  baby: "reference.icon.baby",
  users: "reference.icon.users",
  scales: "reference.icon.scales",
  gavel: "reference.icon.gavel",
  "hand-heart": "reference.icon.handHeart",
  dog: "reference.icon.dog",
  cat: "reference.icon.cat",
  cloud: "reference.icon.cloud",
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
