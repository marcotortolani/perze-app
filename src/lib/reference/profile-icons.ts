import type { IconName } from "@/design-system/core/Icon";

/**
 * Set curado para el picker de ícono de perfil (K2b) — deliberadamente
 * DISTINTO del set de `category-icons.ts`: ahí los glifos son de rubros de
 * gasto (pizza, wrench, banknote), acá tienen que leerse como identidad de
 * una persona, no como una categoría de movimiento. Sin agrupar por tema
 * (a diferencia del picker de categorías): con ~25 íconos entra entero en
 * una sola grilla, no hace falta buscador ni secciones.
 */
export const PROFILE_ICON_OPTIONS: readonly IconName[] = [
  "user",
  "cat",
  "dog",
  "paw",
  "baby",
  "running",
  "bicycle",
  "guitar",
  "music",
  "gamepad",
  "ball",
  "camera",
  "mountains",
  "tent",
  "plant",
  "coffee",
  "gift",
  "confetti",
  "watch",
  "sneaker",
  "bag",
  "briefcase",
  "graduation",
  "brain",
];

/** `IconName` del picker → clave de `reference.icon.*` — mismas claves que ya usa `CATEGORY_ICON_MESSAGE_KEY` para los íconos que se comparten; "user" es el único nuevo acá. */
export const PROFILE_ICON_MESSAGE_KEY = {
  user: "reference.icon.user",
  cat: "reference.icon.cat",
  dog: "reference.icon.dog",
  paw: "reference.icon.paw",
  baby: "reference.icon.baby",
  running: "reference.icon.running",
  bicycle: "reference.icon.bicycle",
  guitar: "reference.icon.guitar",
  music: "reference.icon.music",
  gamepad: "reference.icon.gamepad",
  ball: "reference.icon.ball",
  camera: "reference.icon.camera",
  mountains: "reference.icon.mountains",
  tent: "reference.icon.tent",
  plant: "reference.icon.plant",
  coffee: "reference.icon.coffee",
  gift: "reference.icon.gift",
  confetti: "reference.icon.confetti",
  watch: "reference.icon.watch",
  sneaker: "reference.icon.sneaker",
  bag: "reference.icon.bag",
  briefcase: "reference.icon.briefcase",
  graduation: "reference.icon.graduation",
  brain: "reference.icon.brain",
};

export type ProfileIconWithLabel = keyof typeof PROFILE_ICON_MESSAGE_KEY;
