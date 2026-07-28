/**
 * Curvas de motion de PERZE — `docs/02-design-system.md` § 5.1.
 * Springs, no easings. Ninguna transición de interfaz supera 320ms; las
 * cuatro excepciones (count-up, guardado, celebración, línea de gráfico)
 * viven en sus propios componentes, no acá.
 */
export const spring = {
  /** chips, toggles, keypad */
  snappy: { type: "spring", stiffness: 500, damping: 32, mass: 0.7 },
  /** cards, listas */
  default: { type: "spring", stiffness: 400, damping: 30, mass: 1 },
  /** sheets, pantallas */
  soft: { type: "spring", stiffness: 260, damping: 26, mass: 1.1 },
  /** solo celebraciones */
  bouncy: { type: "spring", stiffness: 420, damping: 18, mass: 0.9 },
} as const;

export const duration = {
  micro: 120,
  fast: 180,
  base: 240,
  slow: 320,
} as const;

/** Excepciones documentadas — no bloqueantes, "celebración o lectura". */
export const exceptionDuration = {
  /** count-up de cifra (odómetro) */
  countUp: 400,
  /** secuencia de guardado: botón → check → vuelo a la lista */
  save: 700,
  /** celebración de hito */
  celebration: 900,
  /** dibujado de línea en gráficos, solo en la carga inicial de analytics */
  lineDraw: 600,
} as const;

export const press = {
  scale: 0.96,
  transition: spring.snappy,
} as const;

export const stagger = {
  list: 0.024,
  keypad: 0.012,
  /** entrada de lista: solo los primeros 8 items llevan stagger */
  listMaxItems: 8,
} as const;
