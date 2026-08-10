/**
 * `new Date("2026-08-03")` parsea como medianoche UTC — en cualquier huso
 * horario negativo (Uruguay/Argentina, UTC-3) `.getMonth()`/`.getDate()`
 * en horario LOCAL devuelven el día anterior. Con eso, cargar el
 * cumpleaños de HOY nunca coincidía con "hoy" para el usuario típico de
 * esta app. Se parsean los componentes a mano, como fecha local.
 */
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
}

/** `profiles.birth_date_precision` — `exact` = día real, `year` = solo la edad; `birth_date` es entonces el 1 de julio sintético. */
export type BirthDatePrecision = "exact" | "year";

/** `birthDate` en formato `YYYY-MM-DD` (lo que ya guarda `profiles.birth_date`). */
export function ageFromBirthDate(birthDate: string, now: Date = new Date()): number {
  const birth = parseLocalDate(birthDate);
  let age = now.getFullYear() - birth.getFullYear();
  const hadBirthdayThisYear = now.getMonth() > birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

/**
 * Inversa de `ageFromBirthDate` para cuando el usuario solo da su edad en
 * años, no el día exacto (A4a). El 1 de julio es el punto medio del año:
 * error máximo de ~6 meses en los rangos etarios de `admin_metrics()`, que
 * sigue leyendo `age(birth_date)` sin cambios.
 *
 * El año se elige para que `ageFromBirthDate(birthDateFromAge(30, hoy))`
 * dé exactamente 30 HOY — no el año que viene. Si el 1 de julio de este
 * año todavía no pasó, el cumpleaños sintético de este año no pasó
 * tampoco, así que hay que restar un año más; si no, alguien que escribe
 * "30" en marzo vería "29 años" en la línea de abajo.
 */
export function birthDateFromAge(age: number, now: Date = new Date()): string {
  const julyFirstPassed = now.getMonth() > 6 || (now.getMonth() === 6 && now.getDate() >= 1);
  const year = now.getFullYear() - age - (julyFirstPassed ? 0 : 1);
  return `${year}-07-01`;
}

/**
 * `precision` es requerido a propósito: con "year" el día es sintético
 * (1 de julio) y no representa un cumpleaños real — el banner del home y
 * el recordatorio `birthdate` no deben dispararse ese día.
 */
export function isBirthdayToday(birthDate: string, precision: BirthDatePrecision | null, now: Date = new Date()): boolean {
  if (precision === "year") return false;
  const birth = parseLocalDate(birthDate);
  return birth.getMonth() === now.getMonth() && birth.getDate() === now.getDate();
}
