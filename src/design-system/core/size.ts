/**
 * CON-10 (docs/plan-de-trabajo.md § 4): toda prop de tamaño se normaliza
 * adentro del componente — ya rompió dos veces (`SplitBar height="20"`,
 * `Skeleton height="40"` colapsaron a 0) porque React solo le agrega `px`
 * a un `number` de JS, nunca a un string, aunque el string sea "20".
 *
 * La regla del contrato es `typeof v === 'number' ? v : parseFloat(v)`,
 * pero aplicada tal cual le rompería los strings con unidad real que ya
 * usa el sistema (`width="52%"` en `SkeletonRow`): `parseFloat("52%")` da
 * `52`, y sin el `%` React le agrega `px` en vez de dejarlo relativo. Acá
 * solo se convierte un string puramente numérico ("20", sin unidad); un
 * string que ya trae su propia unidad (`%`, `px`, `em`, `rem`, `vh`, ...)
 * se deja intacto para que la unidad no se pierda.
 */
export type SizeValue = number | string;

const PURE_NUMBER = /^-?\d+(\.\d+)?$/;

export function normalizeSize(value: SizeValue): SizeValue {
  if (typeof value === "number") return value;
  return PURE_NUMBER.test(value.trim()) ? Number(value) : value;
}
