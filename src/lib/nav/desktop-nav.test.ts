import { describe, expect, it } from "vitest";
import { activeNavId, buildDesktopNav } from "./desktop-nav";

describe("buildDesktopNav", () => {
  it("con ningún módulo activo, solo muestra primarios, categorías/etiquetas/reglas y sistema", () => {
    const groups = buildDesktopNav({ enabledModules: [] });
    const ids = groups.map((g) => g.id);
    expect(ids).toEqual(["primary", "money", "system", "more"]);
    const moneyIds = groups.find((g) => g.id === "money")!.items.map((i) => i.id);
    expect(moneyIds).toEqual(["categories", "tags", "rules"]);
  });

  it("cada módulo habilitado agrega su entrada, en orden", () => {
    const groups = buildDesktopNav({ enabledModules: ["budgets", "investments", "family"] });
    const moneyIds = groups.find((g) => g.id === "money")!.items.map((i) => i.id);
    expect(moneyIds).toEqual(["budgets", "investments", "categories", "tags", "rules"]);
    expect(groups.some((g) => g.id === "people")).toBe(true);
  });

  it("sin el módulo family, no hay grupo 'people'", () => {
    const groups = buildDesktopNav({ enabledModules: [] });
    expect(groups.some((g) => g.id === "people")).toBe(false);
  });
});

describe("activeNavId", () => {
  const groups = buildDesktopNav({ enabledModules: [] });

  it("matchea la home exacta y no cualquier ruta", () => {
    expect(activeNavId("/", groups)).toBe("home");
    expect(activeNavId("/transactions", groups)).not.toBe("home");
  });

  it("usa el prefijo más largo: /more/categories enciende 'categories', no 'more'", () => {
    expect(activeNavId("/more/categories", groups)).toBe("categories");
  });

  it("una subruta de /transactions sigue marcando 'movements'", () => {
    expect(activeNavId("/transactions/tx-1", groups)).toBe("movements");
  });

  it("una ruta sin match devuelve null", () => {
    expect(activeNavId("/onboarding", groups)).toBeNull();
  });
});
