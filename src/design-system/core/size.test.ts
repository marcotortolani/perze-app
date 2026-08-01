import { describe, expect, it } from "vitest";
import { normalizeSize } from "./size";

describe("normalizeSize — CON-10", () => {
  it("un number se deja igual", () => {
    expect(normalizeSize(40)).toBe(40);
  });

  it("un string puramente numérico se convierte a number (React le agrega px)", () => {
    expect(normalizeSize("20")).toBe(20);
    expect(normalizeSize("40")).toBe(40);
    expect(normalizeSize("-4")).toBe(-4);
    expect(normalizeSize("3.5")).toBe(3.5);
  });

  it("un string con unidad propia se deja intacto, no pierde la unidad", () => {
    expect(normalizeSize("52%")).toBe("52%");
    expect(normalizeSize("40px")).toBe("40px");
    expect(normalizeSize("100%")).toBe("100%");
    expect(normalizeSize("2rem")).toBe("2rem");
  });
});
