import { describe, expect, it } from "vitest";
import { PASSWORD_PATTERN } from "./password-rules";

/**
 * Mismo criterio que `password_requirements = lower_upper_letters_digits`
 * en `supabase/config.toml` — compartido entre `/onboarding/register`,
 * `/reset-password` y `more/security`.
 */
describe("PASSWORD_PATTERN", () => {
  it("acepta una contraseña con mayúscula, minúscula, número y 8+ caracteres", () => {
    expect(PASSWORD_PATTERN.test("Correct1x")).toBe(true);
  });

  it("rechaza menos de 8 caracteres", () => {
    expect(PASSWORD_PATTERN.test("Cor1x")).toBe(false);
  });

  it("rechaza sin mayúscula", () => {
    expect(PASSWORD_PATTERN.test("correct1x")).toBe(false);
  });

  it("rechaza sin minúscula", () => {
    expect(PASSWORD_PATTERN.test("CORRECT1X")).toBe(false);
  });

  it("rechaza sin número", () => {
    expect(PASSWORD_PATTERN.test("CorrectXx")).toBe(false);
  });
});
