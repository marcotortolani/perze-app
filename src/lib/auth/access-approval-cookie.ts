/**
 * Fase 2 del plan de fluidez de navegación — cachea el resultado de
 * `SELECT access_status FROM profiles` que `proxy.ts` hoy corre en CADA
 * navegación. httpOnly (nunca la toca el cliente) y atada al `userId` que
 * la emitió: si otra persona inicia sesión en el mismo dispositivo, el
 * valor de la cookie no coincide con su `sub` y `proxy.ts` vuelve a
 * consultar `profiles` en vez de heredar la aprobación de otro usuario.
 *
 * Consecuencia a asumir: revocar un acceso (`access_status` deja de ser
 * `'approved'`) tarda hasta `ACCESS_APPROVAL_TTL_SECONDS` en expulsar a
 * alguien que ya está navegando con la cookie puesta. RLS sigue siendo la
 * barrera real — ninguna fila se lee sin `auth.uid()` — esto es un gate de
 * UX (evitar el round-trip), no la última línea de defensa.
 */
export const ACCESS_APPROVAL_COOKIE_NAME = "perze_access_ok";
export const ACCESS_APPROVAL_TTL_SECONDS = 15 * 60;

export function isAccessApprovalCookieValidFor(userId: string, value: string | undefined): boolean {
  return value === userId;
}
