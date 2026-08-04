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

/** `birthDate` en formato `YYYY-MM-DD` (lo que ya guarda `profiles.birth_date`). */
export function ageFromBirthDate(birthDate: string, now: Date = new Date()): number {
  const birth = parseLocalDate(birthDate);
  let age = now.getFullYear() - birth.getFullYear();
  const hadBirthdayThisYear = now.getMonth() > birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

export function isBirthdayToday(birthDate: string, now: Date = new Date()): boolean {
  const birth = parseLocalDate(birthDate);
  return birth.getMonth() === now.getMonth() && birth.getDate() === now.getDate();
}
