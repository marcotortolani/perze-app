/** `birthDate` en formato `YYYY-MM-DD` (lo que ya guarda `profiles.birth_date`). */
export function ageFromBirthDate(birthDate: string, now: Date = new Date()): number {
  const birth = new Date(birthDate);
  let age = now.getFullYear() - birth.getFullYear();
  const hadBirthdayThisYear = now.getMonth() > birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

export function isBirthdayToday(birthDate: string, now: Date = new Date()): boolean {
  const birth = new Date(birthDate);
  return birth.getMonth() === now.getMonth() && birth.getDate() === now.getDate();
}
