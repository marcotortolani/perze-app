import { describe, expect, it } from "vitest";
import { activeNavId, buildDesktopNav } from "./desktop-nav";

describe("buildDesktopNav", () => {
  it("con ningún módulo activo, solo muestra primarios, categorías/etiquetas/reglas y sistema", () => {
    const groups = buildDesktopNav({ enabledModules: [] });
    const ids = groups.map((g) => g.id);
    // Sin grupo "more": su destino (`/more`) es ahora el de "Sistema".
    expect(ids).toEqual(["primary", "money", "system"]);
    const moneyIds = groups.find((g) => g.id === "money")!.items.map((i) => i.id);
    expect(moneyIds).toEqual(["categories", "tags", "rules"]);
  });

  // El sidebar scrolleaba porque Sistema desplegaba siete entradas. Si alguien
  // las vuelve a abrir una por una, esto falla.
  it("sistema es UNA sola entrada a /more, y sin encabezado", () => {
    const system = buildDesktopNav({ enabledModules: [] }).find((g) => g.id === "system")!;
    expect(system.items).toHaveLength(1);
    expect(system.items[0]).toMatchObject({ id: "system", route: "/more" });
    expect(system.captionKey).toBeUndefined();
  });

  it("con todos los módulos, el sidebar no pasa de 14 entradas", () => {
    const groups = buildDesktopNav({ enabledModules: ["budgets", "goals", "recurring", "debts", "investments", "family"] });
    const total = groups.reduce((n, g) => n + g.items.length, 0);
    expect(total).toBe(14);
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

  // La regresión más probable de haber colapsado Sistema en `/more`: esa
  // entrada matchea `/more/*` entero, así que las tres rutas de DINERO que
  // viven bajo `/more/` tienen que seguir ganando por prefijo más largo.
  it("usa el prefijo más largo: las rutas de DINERO bajo /more no encienden 'system'", () => {
    expect(activeNavId("/more/categories", groups)).toBe("categories");
    expect(activeNavId("/more/tags", groups)).toBe("tags");
    expect(activeNavId("/more/rules", groups)).toBe("rules");
  });

  it("/more y sus subrutas de configuración encienden 'system'", () => {
    expect(activeNavId("/more", groups)).toBe("system");
    for (const route of ["/more/profile", "/more/security", "/more/notifications", "/more/sync", "/more/settings", "/more/data", "/more/about", "/more/admin"]) {
      expect(activeNavId(route, groups)).toBe("system");
    }
  });

  it("una subruta de /transactions sigue marcando 'movements'", () => {
    expect(activeNavId("/transactions/tx-1", groups)).toBe("movements");
  });

  it("una ruta sin match devuelve null", () => {
    expect(activeNavId("/onboarding", groups)).toBeNull();
  });
});
