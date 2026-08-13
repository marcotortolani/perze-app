/**
 * Iniciales para el monograma de identidad de un usuario — la app no usa
 * avatares (ver `InstitutionTile.initials()`, el mismo patrón para
 * instituciones); acá el nombre de origen es `displayName ?? email`, así
 * que a diferencia del de instituciones hay que tolerar un email sin
 * espacios ("vale.mendez@gmail.com" → "V").
 */
export function userInitials(nameOrEmail: string): string {
  const words = nameOrEmail.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length >= 2) return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
  return words[0]!.slice(0, 1).toUpperCase();
}
