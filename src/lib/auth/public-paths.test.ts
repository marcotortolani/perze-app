import { describe, expect, it } from "vitest";
import { isPublicPath } from "./public-paths";

/**
 * B1 — el gate real vive en `proxy()` (necesita una sesión de Supabase
 * mockeada para testear el flujo completo, fuera de alcance de un test
 * unitario); lo que sí se puede aislar y es donde vive el riesgo de "se
 * public-fied una ruta de más" es el allowlist en sí.
 */
describe("isPublicPath (B1)", () => {
  it("permite las rutas de la allowlist y sus subrutas", () => {
    expect(isPublicPath("/onboarding")).toBe(true);
    expect(isPublicPath("/onboarding/verify")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
    expect(isPublicPath("/join")).toBe(true);
    expect(isPublicPath("/offline")).toBe(true);
    expect(isPublicPath("/api/fx")).toBe(true);
    expect(isPublicPath("/dev/components")).toBe(true);
    expect(isPublicPath("/about")).toBe(true);
  });

  it("bloquea todo lo demás, incluido lo que arranca parecido a una ruta pública", () => {
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/accounts")).toBe(false);
    expect(isPublicPath("/transactions/123/edit")).toBe(false);
    expect(isPublicPath("/add")).toBe(false);
    // Reversión de la solución de transición de contraseñas
    // (docs/mejora-auth-oauth-y-email.md § 0.1): estos stubs de
    // compatibilidad ya no son públicos — sin sesión, `proxy.ts` los manda
    // a `/onboarding` antes de que rendericen.
    expect(isPublicPath("/login")).toBe(false);
    expect(isPublicPath("/forgot-password")).toBe(false);
    expect(isPublicPath("/reset-password")).toBe(false);
    // no confundir con /onboarding-evil o /apix — el match es por segmento, no por prefijo de string crudo
    expect(isPublicPath("/onboarding-fake")).toBe(false);
    expect(isPublicPath("/apix/fx")).toBe(false);
  });
});
