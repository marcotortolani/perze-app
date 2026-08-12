import { describe, expect, it } from "vitest";
import { hideBlock, moveBlock, resetLayout, showBlock } from "./layout-actions";
import { resolveHomeLayout, type HomeLayoutCatalog } from "./resolve-layout";
import type { HomeBlockId } from "../blocks/registry";

const CATALOG: HomeLayoutCatalog = {
  catalog: ["a", "b", "c", "d", "e"] as unknown as HomeBlockId[],
  defaultLeft: ["a", "b", "c"] as unknown as HomeBlockId[],
  defaultRight: ["d", "e"] as unknown as HomeBlockId[],
};

describe("moveBlock", () => {
  it("mueve dentro de la misma columna", () => {
    const next = moveBlock(null, { id: "a" as HomeBlockId, toColumn: "left", toIndex: 2 }, CATALOG);
    const resolved = resolveHomeLayout(next, CATALOG);
    expect(resolved.left).toEqual(["b", "c", "a"]);
  });

  it("mueve de una columna a la otra", () => {
    const next = moveBlock(null, { id: "a" as HomeBlockId, toColumn: "right", toIndex: 0 }, CATALOG);
    const resolved = resolveHomeLayout(next, CATALOG);
    expect(resolved.left).toEqual(["b", "c"]);
    expect(resolved.right).toEqual(["a", "d", "e"]);
  });

  it("clampea un toIndex fuera de rango", () => {
    const next = moveBlock(null, { id: "a" as HomeBlockId, toColumn: "left", toIndex: 999 }, CATALOG);
    const resolved = resolveHomeLayout(next, CATALOG);
    expect(resolved.left).toEqual(["b", "c", "a"]);
  });
});

describe("hideBlock / showBlock", () => {
  it("hideBlock saca el bloque de su columna y lo manda a la bandeja", () => {
    const next = hideBlock(null, "b" as HomeBlockId, CATALOG);
    const resolved = resolveHomeLayout(next, CATALOG);
    expect(resolved.left).toEqual(["a", "c"]);
    expect(resolved.hidden).toEqual(["b"]);
  });

  it("showBlock lo reinserta junto a su vecino default, no al final", () => {
    const hidden = hideBlock(null, "b" as HomeBlockId, CATALOG);
    const shown = showBlock(hidden, "b" as HomeBlockId, CATALOG);
    const resolved = resolveHomeLayout(shown, CATALOG);
    expect(resolved.left).toEqual(["a", "b", "c"]);
    expect(resolved.hidden).toEqual([]);
  });
});

describe("resetLayout", () => {
  it("vuelve a null, no a una copia de los defaults", () => {
    expect(resetLayout()).toBeNull();
  });
});

describe("preservación de ids desconocidos", () => {
  it("un id que un cliente viejo no reconoce sobrevive moveBlock/hideBlock", () => {
    const docConIdFuturo = { v: 1 as const, left: ["a", "zzz-futuro", "b", "c"], right: ["d", "e"], hidden: [] };
    const afterMove = moveBlock(docConIdFuturo, { id: "a" as HomeBlockId, toColumn: "right", toIndex: 0 }, CATALOG);
    expect([...afterMove.left, ...afterMove.right, ...afterMove.hidden]).toContain("zzz-futuro");

    const afterHide = hideBlock(afterMove, "b" as HomeBlockId, CATALOG);
    expect([...afterHide.left, ...afterHide.right, ...afterHide.hidden]).toContain("zzz-futuro");
  });
});
