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
    },
  }),
}));

import { setOwnPassword, signInWithPassword } from "./password-auth";

describe("signInWithPassword", () => {
  it("propone la corrección en vez de nombrar el error crudo de Supabase", async () => {
    const { error } = await signInWithPassword("a@b.com", "wrong");
    expect(error).toBe("No encontramos una cuenta con esa combinación de email y contraseña — probá con el código por email en vez de la contraseña.");
  });

  it("no da error si Supabase no lo da", async () => {
    const { error } = await signInWithPassword("a@b.com", "Correct1x");
    expect(error).toBeNull();
  });
});

describe("setOwnPassword", () => {
  it("mapea el error de requisitos a copy correctivo con la regla concreta", async () => {
    const { error } = await setOwnPassword("weak");
    expect(error).toBe("La contraseña necesita al menos 8 caracteres, con una mayúscula, una minúscula y un número.");
  });
});
