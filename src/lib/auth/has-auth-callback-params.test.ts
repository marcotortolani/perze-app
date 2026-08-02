import { describe, expect, it } from "vitest";
import { hasAuthCallbackParams } from "./has-auth-callback-params";

/**
 * B12 — el bug real: un link de verificación con `redirect_to` a la raíz
 * vuelve como `?code=...` a CUALQUIER pathname, y `proxy.ts` lo perdía
 * (`url.search = ""`) antes de que nadie lo canjeara. Esto es lo que decide
 * si esa request se reenvía a `/auth/callback` en vez de seguir de largo.
 */
describe("hasAuthCallbackParams (B12)", () => {
  it("detecta code (PKCE, OAuth y signInWithOtp)", () => {
    expect(hasAuthCallbackParams(new URLSearchParams("code=abc123"))).toBe(true);
  });

  it("detecta token_hash (verifyOtp con plantilla propia)", () => {
    expect(hasAuthCallbackParams(new URLSearchParams("token_hash=xyz&type=email"))).toBe(true);
  });

  it("detecta error_code (link vencido o ya usado)", () => {
    expect(hasAuthCallbackParams(new URLSearchParams("error_code=otp_expired"))).toBe(true);
  });

  it("no confunde otros params con los de auth", () => {
    expect(hasAuthCallbackParams(new URLSearchParams("next=/onboarding/country"))).toBe(false);
    expect(hasAuthCallbackParams(new URLSearchParams())).toBe(false);
  });
});
