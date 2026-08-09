import type { IconName } from "@/design-system/core/Icon";

/**
 * Set curado para el picker de ícono del hogar — mismo criterio que
 * `profile-icons.ts` (identidad, no rubro de gasto) pero para un GRUPO, no
 * una persona: sin animales de mascota individual ni objetos de hobby
 * personal, con lugar/pertenencia (casa, edificio, sofá, llave, planta) y
 * ocasión compartida (fiesta, camping, montaña) en vez de eso. Reusa claves
 * de `reference.icon.*` que ya existen (compartidas con `category-icons.ts`
 * y `profile-icons.ts`) — no suma ninguna traducción nueva.
 */
export const HOUSEHOLD_ICON_OPTIONS: readonly IconName[] = [
  "users",
  "home",
  "couch",
  "building",
  "key",
  "plant",
  "gift",
  "confetti",
  "tent",
  "mountains",
  "paw",
  "briefcase",
  "graduation",
  "crown",
  "sunglasses",
  "dog",
  "cat",
  "rabbit",
  "bird",
  "robot",
];

/** `IconName` del picker → clave de `reference.icon.*` — mismas claves que `CATEGORY_ICON_MESSAGE_KEY`/`PROFILE_ICON_MESSAGE_KEY` para los íconos que se comparten. */
export const HOUSEHOLD_ICON_MESSAGE_KEY = {
  users: "reference.icon.users",
  home: "reference.icon.home",
  couch: "reference.icon.couch",
  building: "reference.icon.building",
  key: "reference.icon.key",
  plant: "reference.icon.plant",
  gift: "reference.icon.gift",
  confetti: "reference.icon.confetti",
  tent: "reference.icon.tent",
  mountains: "reference.icon.mountains",
  paw: "reference.icon.paw",
  briefcase: "reference.icon.briefcase",
  graduation: "reference.icon.graduation",
  crown: "reference.icon.crown",
  sunglasses: "reference.icon.sunglasses",
  dog: "reference.icon.dog",
  cat: "reference.icon.cat",
  rabbit: "reference.icon.rabbit",
  bird: "reference.icon.bird",
  robot: "reference.icon.robot",
};

export type HouseholdIconWithLabel = keyof typeof HOUSEHOLD_ICON_MESSAGE_KEY;
