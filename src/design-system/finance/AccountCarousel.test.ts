import { describe, expect, it } from "vitest";
import { bentoLayout } from "./AccountCarousel";

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
