/**
 * `asset_classes.name` en español es el nombre canónico de la semilla
 * global (`docs/01-arquitectura-datos.md` § 2.8, 12 filas fijas,
 * `household_id = NULL`) — no un string de UI. Varios lugares del código lo
 * usan como VALOR de lógica, no de display: `decimalsForQuantity()`
 * (`lib/money/decimals.ts`) busca por el nombre exacto "Crypto" para saber
 * que una cantidad va con 8 decimales, y `assetClassId` se resuelve
 * matcheando este mismo string contra la lista del household
 * (`instruments/new/page.tsx`). Ese uso nunca pasa por acá.
 *
 * Este mapa es solo para lo que se MUESTRA: una fila global (household_id
 * NULL) sin traducir se ve en español aunque la app esté en inglés/
 * portugués — un usuario que clona-y-edita una fila (Patrón C) sí ve y
 * guarda lo que escribió, eso es dato real suyo y nunca se traduce.
 */
/** Unión literal, no `string` — así `t(\`assetClassLabels.${key}\`)` sigue tipado contra los mensajes reales en vez de degradar a `string` genérico. */
export type AssetClassLabelKey = "acciones" | "cedears" | "bonosSoberanos" | "ons" | "letras" | "fci" | "plazoFijo" | "crypto" | "etfs" | "inmuebles" | "efectivo" | "otros";

export const ASSET_CLASS_LABEL_KEYS: Record<string, AssetClassLabelKey> = {
  Acciones: "acciones",
  CEDEARs: "cedears",
  "Bonos soberanos": "bonosSoberanos",
  ONs: "ons",
  Letras: "letras",
  FCI: "fci",
  "Plazo fijo": "plazoFijo",
  Crypto: "crypto",
  ETFs: "etfs",
  Inmuebles: "inmuebles",
  Efectivo: "efectivo",
  Otros: "otros",
};

export function assetClassLabelKey(canonicalName: string): AssetClassLabelKey | undefined {
  return ASSET_CLASS_LABEL_KEYS[canonicalName];
}
