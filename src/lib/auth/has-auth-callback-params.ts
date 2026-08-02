/**
 * B12 — separado de `proxy.ts` a propósito, mismo criterio que
 * `public-paths.ts`/`safe-next-path.ts`: así se testea sin mockear
 * `NextRequest`/Supabase. `code` es PKCE (OAuth y `signInWithOtp`),
 * `token_hash` es el canje directo (`verifyOtp` con plantilla propia,
 * cuando exista), `error_code` es el fallo que GoTrue reporta en el mismo
 * lugar cuando el link venció o ya se usó.
 */
export function hasAuthCallbackParams(searchParams: URLSearchParams): boolean {
  return searchParams.has("code") || searchParams.has("token_hash") || searchParams.has("error_code");
}
