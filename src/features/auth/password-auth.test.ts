// @vitest-environment happy-dom
// `requestPasswordReset` lee `window.location.origin` — el entorno default
// del repo es `node` (`vitest.config.ts`), sin `window`.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: vi.fn(async ({ password }: { password: string }) => {
        if (password === "wrong") return { error: { message: "Invalid login credentials" } };
        return { error: null };
      }),
      updateUser: vi.fn(async ({ password }: { password: string }) => {
        if (password === "weak") return { error: { message: "Password should contain at least one character of each: lowercase, uppercase, digit." } };
        return { error: null };
      }),
      resetPasswordForEmail: vi.fn(async (email: string) => {
        if (email === "toomany@b.com") return { error: { message: "Rate limit exceeded" } };
        return { error: null };
      }),
    },
  }),
}));

import { requestPasswordReset, setOwnPassword, signInWithPassword, translateAuthError } from "./password-auth";

// `translateAuthError` espera el `t` de `next-intl` — un stub que devuelve
// la clave sirve para verificar el CÓDIGO sin acoplar el test a las
// traducciones concretas de `messages/es.json`.
const t = ((key: string) => key) as Parameters<typeof translateAuthError>[1];

describe("signInWithPassword", () => {
  it("mapea credenciales inválidas al código correctivo, no al mensaje crudo", async () => {
    const result = await signInWithPassword("a@b.com", "wrong");
    expect(result.errorCode).toBe("invalid_credentials");
    expect(translateAuthError(result, t)).toBe("auth.errors.invalid_credentials");
  });

  it("no da error si Supabase no lo da", async () => {
    const result = await signInWithPassword("a@b.com", "Correct1x");
    expect(result.errorCode).toBeNull();
  });
});

describe("setOwnPassword", () => {
  it("mapea el error de requisitos a un código correctivo con la regla concreta", async () => {
    const result = await setOwnPassword("weak");
    expect(result.errorCode).toBe("weak_password");
  });
});

describe("requestPasswordReset", () => {
  it("mapea el rate limit a un código correctivo", async () => {
    const result = await requestPasswordReset("toomany@b.com");
    expect(result.errorCode).toBe("rate_limited");
  });

  it("no da error si Supabase no lo da (existe o no la cuenta)", async () => {
    const result = await requestPasswordReset("nadie@b.com");
    expect(result.errorCode).toBeNull();
  });
});
