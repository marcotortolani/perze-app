export type ReminderId = "birthdate" | "installPwa" | "modules" | "theme" | "format" | "backdrop";

/** Ruta a la que manda cada recordatorio — todos caen en la misma
 *  pantalla de Ajustes salvo el cumpleaños (perfil) y los módulos
 *  (su propia pantalla). Ver `docs/reminders` — no existe tal doc, la
 *  fuente es este archivo. */
export const REMINDER_ROUTE: Record<ReminderId, string> = {
  birthdate: "/more/profile",
  installPwa: "/more/settings",
  modules: "/more/modules",
  theme: "/more/settings",
  format: "/more/settings",
  backdrop: "/more/settings",
};

export interface ReminderContext {
  hasBirthDate: boolean;
  isStandalone: boolean;
  enabledModulesCount: number;
  themeIsDefault: boolean;
  formatIsDefault: boolean;
  backdropIsDefault: boolean;
}

const TOTAL_MODULES = 6;

/**
 * Qué recordatorios aplican hoy — cada uno es una condición objetiva
 * ("todavía no tocaste esto"), nunca una opinión sobre lo que el usuario
 * "debería" hacer. La idea es contarle qué existe y se puede ajustar, no
 * presionarlo a completar una lista.
 */
export function getEligibleReminders(ctx: ReminderContext): ReminderId[] {
  const ids: ReminderId[] = [];
  if (!ctx.hasBirthDate) ids.push("birthdate");
  if (!ctx.isStandalone) ids.push("installPwa");
  if (ctx.enabledModulesCount < TOTAL_MODULES) ids.push("modules");
  if (ctx.themeIsDefault) ids.push("theme");
  if (ctx.formatIsDefault) ids.push("format");
  if (ctx.backdropIsDefault) ids.push("backdrop");
  return ids;
}

/**
 * Rotación determinística por día del año — sin estado adicional que
 * llevar, y sin depender de `Math.random()` (no disponible en algunos
 * contextos de test/SSR de este repo). El mismo día siempre muestra el
 * mismo recordatorio; al día siguiente, si sigue elegible, pasa al que
 * sigue en la lista.
 */
export function pickRotatingReminder(ids: ReminderId[], date: Date): ReminderId | null {
  if (ids.length === 0) return null;
  const startOfYear = new Date(date.getFullYear(), 0, 0).getTime();
  const dayOfYear = Math.floor((date.getTime() - startOfYear) / 86_400_000);
  return ids[dayOfYear % ids.length] ?? null;
}
