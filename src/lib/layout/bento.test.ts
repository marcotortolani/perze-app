import { describe, expect, it } from "vitest";
import { assignBentoSlots, bentoLayout } from "./bento";

/** Sumas parciales de una fila, sin contar 0 ni 12 (eso es el borde del grid, no un límite entre cards). */
function breakpoints(row: number[]): number[] {
  const bps: number[] = [];
  let acc = 0;
  for (let i = 0; i < row.length - 1; i++) {
    acc += row[i]!;
    bps.push(acc);
  }
  return bps;
}

describe("bentoLayout", () => {
  for (let n = 1; n <= 24; n++) {
    describe(`n = ${n}`, () => {
      const rows = bentoLayout(n);

      it("suma exacto 12 en cada fila", () => {
        for (const row of rows) expect(row.reduce((a, b) => a + b, 0)).toBe(12);
      });

      it("cubre exactamente n cards, sin perder ni duplicar ninguna", () => {
        expect(rows.reduce((sum, row) => sum + row.length, 0)).toBe(n);
      });

      it("ninguna fila tiene una sola card, salvo n === 1", () => {
        for (const row of rows) {
          if (n === 1) expect(row.length).toBe(1);
          else expect(row.length).toBeGreaterThanOrEqual(2);
        }
      });

      it("ningún span es menor a 3", () => {
        for (const row of rows) for (const span of row) expect(span).toBeGreaterThanOrEqual(3);
      });

      it("dos filas vecinas nunca comparten un límite de columna", () => {
        for (let i = 1; i < rows.length; i++) {
          const prevBp = new Set(breakpoints(rows[i - 1]!));
          const overlap = breakpoints(rows[i]!).filter((bp) => prevBp.has(bp));
          expect(overlap).toEqual([]);
        }
      });

      it("la fila 1 contiene el slot más ancho de toda la grilla", () => {
        const maxOverall = Math.max(...rows.flat());
        expect(Math.max(...rows[0]!)).toBe(maxOverall);
      });
    });
  }

  it("no genera filas para 0 cuentas", () => {
    expect(bentoLayout(0)).toEqual([]);
  });
});

describe("assignBentoSlots", () => {
  it("el item de mayor peso cae en el slot más ancho de la fila 1", () => {
    const items = [{ id: "a", weight: 10 }, { id: "b", weight: 500 }, { id: "c", weight: 50 }];
    const { gridItems, gridSpans } = assignBentoSlots(items, (i) => i.weight);
    const widestIdx = gridSpans.indexOf(Math.max(...gridSpans));
    expect(gridItems[widestIdx]!.id).toBe("b");
  });

  it("preserva todos los items, sin perder ni duplicar ninguno", () => {
    const items = Array.from({ length: 9 }, (_, i) => ({ id: `item-${i}`, weight: Math.random() * 1000 }));
    const { gridItems, gridSpans } = assignBentoSlots(items, (i) => i.weight);
    expect(gridItems.map((i) => i.id).sort()).toEqual(items.map((i) => i.id).sort());
    expect(gridSpans.length).toBe(items.length);
  });

  it("dentro de cada fila, el más pesado va al slot más ancho DE ESA FILA", () => {
    // 5 items -> bentoLayout(5) = [7,5] en la primera fila (n===2 no aplica,
    // pero n=5 cae en c1=2 con split threes=1 -> fila 1 [7,5], fila 2 de 3).
    const items = [
      { id: "biggest", weight: 1000 },
      { id: "second", weight: 500 },
      { id: "third", weight: 300 },
      { id: "fourth", weight: 200 },
      { id: "fifth", weight: 100 },
    ];
    const { gridItems, gridSpans } = assignBentoSlots(items, (i) => i.weight);
    const rows = bentoLayout(5);
    let pointer = 0;
    for (const row of rows) {
      const rowItems = gridItems.slice(pointer, pointer + row.length);
      const rowSpans = gridSpans.slice(pointer, pointer + row.length);
      pointer += row.length;
      const widestInRow = rowSpans.indexOf(Math.max(...rowSpans));
      const heaviestInRow = rowItems.reduce((best, cur, idx) => ((rowItems[best]?.weight ?? -Infinity) >= cur.weight ? best : idx), 0);
      expect(widestInRow).toBe(heaviestInRow);
    }
  });
});
