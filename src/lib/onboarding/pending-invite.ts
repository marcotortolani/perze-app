/**
 * El código de invitación de alguien que todavía no tiene cuenta.
 *
 * `accept_invite` exige `auth.uid()`, así que quien abre el link de
 * invitación sin sesión tiene que registrarse primero — y sin esto, al
 * volver de A2 caía en A4 y terminaba **creando un household propio** en
 * vez de entrar al que lo invitaron. `resolveOnboardingDestination()` lee
 * esta marca antes de mandarlo a A4.
 *
 * `localStorage` y no un search param: el registro por magic link sale del
 * navegador y vuelve por `/auth/callback`, así que el código tiene que
 * sobrevivir a un viaje de ida y vuelta por el mail. Mismo criterio que
 * `welcome-flag.ts`.
 */
export const PENDING_INVITE_KEY = "perze:pendingInvite";

export function setPendingInviteCode(code: string): void {
  if (typeof window !== "undefined") window.localStorage.setItem(PENDING_INVITE_KEY, code);
}

export function getPendingInviteCode(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(PENDING_INVITE_KEY);
}

export function clearPendingInviteCode(): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(PENDING_INVITE_KEY);
}
