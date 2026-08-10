import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next-path";

describe("safeNextPath (B11)", () => {
  it("acepta un path relativo normal", () => {
    expect(safeNextPath("/accounts")).toBe("/accounts");
  });

  it("null/vacío cae al default", () => {
    expect(safeNextPath(null)).toBe("/onboarding/profile");
  });

  it("rechaza un userinfo-style open redirect", () => {
    expect(safeNextPath("@evil.com")).toBe("/onboarding/profile");
  });

  it("rechaza un protocol-relative URL (//evil.com)", () => {
    expect(safeNextPath("//evil.com")).toBe("/onboarding/profile");
  });

  it("rechaza la variante con backslash (/\\evil.com, normalizada a // por el navegador)", () => {
    expect(safeNextPath("/\\evil.com")).toBe("/onboarding/profile");
  });

  it("rechaza una URL absoluta a otro esquema/host", () => {
    expect(safeNextPath("https://evil.com")).toBe("/onboarding/profile");
  });

  it("respeta un fallback distinto si se pasa", () => {
    expect(safeNextPath("@evil.com", "/join")).toBe("/join");
  });
});
