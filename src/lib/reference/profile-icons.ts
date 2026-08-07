import type { IconName } from "@/design-system/core/Icon";

/**
 * Set curado para el picker de ícono de perfil (K2b) — deliberadamente
 * DISTINTO del set de `category-icons.ts`: ahí los glifos son de rubros de
 * gasto (pizza, wrench, banknote), acá tienen que leerse como identidad de
 * una persona, no como una categoría de movimiento ni un objeto decorativo.
 * El criterio de corte: un alien, un gatito o un perrito dicen algo de
 * quién sos — una taza de café, un moño de regalo o una nota musical
 * genérica no (por eso "guitarra" entra, como instrumento específico, pero
 * "música" no). Sin agrupar por tema (a diferencia del picker de
 * categorías): con ~30 íconos entra entero en una sola grilla scrolleable,
 * no hace falta buscador ni secciones.
 */
export const PROFILE_ICON_OPTIONS: readonly IconName[] = [
  "user",
  "cat",
  "dog",
  "rabbit",
  "bird",
  "horse",
  "butterfly",
  "alien",
  "robot",
  "ghost",
  "skull",
  "crown",
  "sunglasses",
  "baby",
  "running",
  "bicycle",
  "ball",
  "sneaker",
  "gamepad",
  "dice",
  "guitar",
  "headphones",
  "camera",
  "paint-brush",
  "mask-happy",
  "mountains",
  "tent",
  "plant",
  "rocket",
  "briefcase",
  "graduation",
  "brain",
];

/** `IconName` del picker → clave de `reference.icon.*` — mismas claves que ya usa `CATEGORY_ICON_MESSAGE_KEY` para los íconos que se comparten. */
export const PROFILE_ICON_MESSAGE_KEY = {
  user: "reference.icon.user",
  cat: "reference.icon.cat",
  dog: "reference.icon.dog",
  rabbit: "reference.icon.rabbit",
  bird: "reference.icon.bird",
  horse: "reference.icon.horse",
  butterfly: "reference.icon.butterfly",
  alien: "reference.icon.alien",
  robot: "reference.icon.robot",
  ghost: "reference.icon.ghost",
  skull: "reference.icon.skull",
  crown: "reference.icon.crown",
  sunglasses: "reference.icon.sunglasses",
  baby: "reference.icon.baby",
  running: "reference.icon.running",
  bicycle: "reference.icon.bicycle",
  ball: "reference.icon.ball",
  sneaker: "reference.icon.sneaker",
  gamepad: "reference.icon.gamepad",
  dice: "reference.icon.dice",
  guitar: "reference.icon.guitar",
  headphones: "reference.icon.headphones",
  camera: "reference.icon.camera",
  "paint-brush": "reference.icon.paintBrush",
  "mask-happy": "reference.icon.maskHappy",
  mountains: "reference.icon.mountains",
  tent: "reference.icon.tent",
  plant: "reference.icon.plant",
  rocket: "reference.icon.rocket",
  briefcase: "reference.icon.briefcase",
  graduation: "reference.icon.graduation",
  brain: "reference.icon.brain",
};

export type ProfileIconWithLabel = keyof typeof PROFILE_ICON_MESSAGE_KEY;
