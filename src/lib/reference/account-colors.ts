/**
 * 12 slots de identidad para `accounts.color` — se guarda esta clave
 * (nunca un hex), igual que `--data-N`: el valor real lo resuelve el CSS
 * por tema. 12, no 5 ni 10, porque arma grillas exactas según el ancho de
 * pantalla del picker (2×6, 3×4, 4×3, 6×2). Los primeros 5 son los slots
 * de datos ya validados (`docs/02-design-system.md`); los otros 7 son una
 * extensión de una sola pasada — ver el comentario en `globals.css` junto
 * a los tokens `--account-color-*`.
 */
export const ACCOUNT_COLOR_KEYS = [
  "violet",
  "aqua",
  "orange",
  "blue",
  "magenta",
  "gold",
  "cyan",
  "indigo",
  "rose",
  "brown",
  "teal",
  "slate",
] as const;

export type AccountColorKey = (typeof ACCOUNT_COLOR_KEYS)[number];

const ACCOUNT_COLOR_VAR: Record<AccountColorKey, string> = {
  violet: "var(--account-color-1)",
  aqua: "var(--account-color-2)",
  orange: "var(--account-color-3)",
  blue: "var(--account-color-4)",
  magenta: "var(--account-color-5)",
  gold: "var(--account-color-6)",
  cyan: "var(--account-color-7)",
  indigo: "var(--account-color-8)",
  rose: "var(--account-color-9)",
  brown: "var(--account-color-10)",
  teal: "var(--account-color-11)",
  slate: "var(--account-color-12)",
};

function isAccountColorKey(value: string): value is AccountColorKey {
  return (ACCOUNT_COLOR_KEYS as readonly string[]).includes(value);
}

/** `accounts.color` → valor CSS listo para `background`, o `undefined` si es `null`/no reconocido (cae al `--surface-2` neutro de `ListRow`). */
export function accountColorVar(color: string | null | undefined): string | undefined {
  if (!color || !isAccountColorKey(color)) return undefined;
  return ACCOUNT_COLOR_VAR[color];
}
