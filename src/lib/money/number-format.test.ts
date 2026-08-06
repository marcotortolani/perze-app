import { describe, expect, it, afterEach } from "vitest";
import { useFormatPreferencesStore } from "@/stores/format-preferences-store";
import { currentSeparators, groupDigits, resolveSeparators } from "./number-format";

describe("resolveSeparators", () => {
  it("\"locale\" respeta el default del idioma (coma decimal → punto de miles)", () => {
    expect(resolveSeparators("locale", true)).toEqual({ decimal: ",", group: "." });
  });

  it("\"locale\" en inglés (punto decimal → coma de miles)", () => {
    expect(resolveSeparators("locale", false)).toEqual({ decimal: ".", group: "," });
  });

  it("D53 — un ajuste explícito SIEMPRE deriva el de miles del mismo decimal, sin importar el idioma", () => {
    // El bug real: ajuste \"coma\" + UI en inglés daba coma de miles (por
    // `Intl.NumberFormat(\"en-US\")`) Y coma decimal — dos separadores
    // iguales. Acá el de miles tiene que salir punto, sea cual sea el idioma.
    expect(resolveSeparators("comma", false)).toEqual({ decimal: ",", group: "." });
    expect(resolveSeparators("period", true)).toEqual({ decimal: ".", group: "," });
  });
});

describe("currentSeparators", () => {
  afterEach(() => {
    useFormatPreferencesStore.setState({ decimalSeparator: "locale" });
  });

  it("lee el ajuste guardado en el store", () => {
    useFormatPreferencesStore.setState({ decimalSeparator: "comma" });
    expect(currentSeparators(false)).toEqual({ decimal: ",", group: "." });
  });
});

describe("groupDigits", () => {
  it("agrupa cada 3 dígitos desde la derecha", () => {
    expect(groupDigits("1500", ".")).toBe("1.500");
    expect(groupDigits("1234567", ",")).toBe("1,234,567");
  });

  it("no agrega separador si no hace falta", () => {
    expect(groupDigits("0", ".")).toBe("0");
    expect(groupDigits("999", ".")).toBe("999");
  });

  it("exactamente en el borde de un grupo (múltiplo de 3 dígitos)", () => {
    expect(groupDigits("100000", ".")).toBe("100.000");
  });
});
