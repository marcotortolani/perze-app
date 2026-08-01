/**
 * Nombre de la cookie de modo demo, compartido entre `proxy.ts` (server,
 * lee `RequestCookies`) y `demo-mode.ts` (cliente, lee `document.cookie`).
 * Módulo aparte y sin `"use client"` a propósito, igual que
 * `lib/auth/public-paths.ts`: así el proxy lo importa sin arrastrar nada
 * que dependa del DOM.
 *
 * El demo (§0 del plan de acceso controlado) nunca crea sesión de
 * Supabase — la cookie es la única señal que el servidor puede ver de que
 * el household activo es local. No habilita ninguna lectura contra
 * Supabase: RLS sigue exigiendo `auth.uid()` real para cualquier fila.
 */
export const DEMO_COOKIE_NAME = "perze-demo";

export function isDemoCookieValue(value: string | undefined): boolean {
  return value === "1";
}
