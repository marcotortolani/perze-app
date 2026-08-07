import { describe, expect, it } from "vitest";
import { squarify } from "./treemap";

function totalArea(rects: { rect: { width: number; height: number } }[]): number {
  return rects.reduce((s, r) => s + r.rect.width * r.rect.height, 0);
}

function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
  const eps = 1e-6;
  return a.x + a.width > b.x + eps && b.x + b.width > a.x + eps && a.y + a.height > b.y + eps && b.y + b.height > a.y + eps;
}

describe("squarify", () => {
  it("cubre exactamente el área del contenedor, sin overlaps", () => {
    const items = [{ w: 40 }, { w: 30 }, { w: 20 }, { w: 10 }];
    const nodes = squarify(items, (i) => i.w, 400, 300);
    expect(totalArea(nodes)).toBeCloseTo(400 * 300, 3);
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        expect(overlaps(nodes[i]!.rect, nodes[j]!.rect)).toBe(false);
      }
    }
  });

  it("el área de cada bloque es proporcional a su peso", () => {
    const items = [{ w: 60 }, { w: 30 }, { w: 10 }];
    const nodes = squarify(items, (i) => i.w, 500, 400);
    const total = 500 * 400;
    for (const n of nodes) {
      const expectedArea = (n.item.w / 100) * total;
      expect(n.rect.width * n.rect.height).toBeCloseTo(expectedArea, 1);
    }
  });

  it("un solo item ocupa el rectángulo entero", () => {
    const nodes = squarify([{ w: 1 }], (i) => i.w, 200, 100);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.rect).toEqual({ x: 0, y: 0, width: 200, height: 100 });
  });

  it("descarta items de peso cero o negativo", () => {
    const items = [{ w: 10 }, { w: 0 }, { w: -5 }];
    const nodes = squarify(items, (i) => i.w, 100, 100);
    expect(nodes).toHaveLength(1);
  });

  it("contenedor sin área o sin items no rompe, devuelve vacío", () => {
    expect(squarify([], () => 1, 100, 100)).toEqual([]);
    expect(squarify([{ w: 1 }], (i: { w: number }) => i.w, 0, 100)).toEqual([]);
    expect(squarify([{ w: 1 }], (i: { w: number }) => i.w, 100, 0)).toEqual([]);
  });

  it("todos los pesos en cero devuelve vacío en vez de dividir por cero", () => {
    expect(squarify([{ w: 0 }, { w: 0 }], (i) => i.w, 100, 100)).toEqual([]);
  });
});
