import { describe, expect, it } from "vitest";
import { detectAnomalies, type DetectableTransaction } from "./anomaly-detection";

let seq = 0;
function tx(overrides: Partial<DetectableTransaction>): DetectableTransaction {
  seq += 1;
  return {
    id: `tx-${seq}`,
    occurredAt: "2026-06-01T12:00:00.000Z",
    kind: "expense",
    amountBase: 1000n,
    categoryId: "cat-restaurants",
    status: "cleared",
    deletedAt: null,
    ...overrides,
  };
}

/**
 * Categoría "pareja" de 19 movimientos (9×980 + 10×1020) + 1 movimiento
 * distinguido — la mediana de los 20 da 1020 y el MAD da 20 sin importar
 * el valor del movimiento distinguido (queda fuera del bloque central).
 * Mismo dataset base para los tres casos de umbral: solo cambia el monto
 * del movimiento 20.
 */
function categoryWithOutlier(categoryId: string, outlierAmount: bigint, outlierId = "outlier"): DetectableTransaction[] {
  const base: DetectableTransaction[] = [];
  for (let i = 0; i < 9; i++) base.push(tx({ categoryId, amountBase: 980n }));
  for (let i = 0; i < 10; i++) base.push(tx({ categoryId, amountBase: 1020n }));
  base.push(tx({ id: outlierId, categoryId, amountBase: outlierAmount, occurredAt: "2026-06-20T12:00:00.000Z" }));
  return base;
}

describe("detectAnomalies", () => {
  it("no dispara con menos de 20 movimientos en la categoría", () => {
    const txs = [
      tx({ categoryId: "cat-chico", amountBase: 1000n }),
      tx({ categoryId: "cat-chico", amountBase: 1000n }),
      tx({ categoryId: "cat-chico", amountBase: 1000n }),
      tx({ categoryId: "cat-chico", amountBase: 1000n }),
      tx({ id: "outlier-chico", categoryId: "cat-chico", amountBase: 50_000n }),
    ];
    const { anomalies } = detectAnomalies(txs);
    expect(anomalies).toHaveLength(0);
  });

  it("dispara un movimiento ~3x la mediana con mz >= 3.5", () => {
    // mediana=1020, MAD=20 → mz = 0.6745 * (3060-1020) / 20 ≈ 68.8, notable: 3060 >= 2.5*1020.
    const txs = categoryWithOutlier("cat-a", 3060n, "tx-3x");
    const { anomalies } = detectAnomalies(txs);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]).toMatchObject({ transactionId: "tx-3x", categoryId: "cat-a", amountBase: 3060n, medianAmountBase: 1020n, categoryTransactionCount: 20 });
  });

  it("NO dispara un movimiento 1.2x la mediana aunque mz sea alto (falla el NOTABLE_MULTIPLIER)", () => {
    // mediana=1020, MAD=20 → mz = 0.6745 * (1224-1020) / 20 ≈ 6.9 (>= 3.5), pero 1224 < 2.5*1020 = 2550.
    const txs = categoryWithOutlier("cat-b", 1224n, "tx-1.2x");
    const { anomalies } = detectAnomalies(txs);
    expect(anomalies).toHaveLength(0);
  });

  it("excluye needs_fx del cálculo y lo cuenta, sin tratarlo como 0", () => {
    const txs = [
      tx({ categoryId: "cat-chico", amountBase: 1000n }),
      tx({ categoryId: "cat-chico", amountBase: null }),
      tx({ categoryId: "cat-chico", amountBase: null }),
    ];
    const { anomalies, excludedCount } = detectAnomalies(txs);
    expect(excludedCount).toBe(2);
    expect(anomalies).toHaveLength(0);
  });

  it("ignora ingresos, movimientos borrados y anulados", () => {
    const txs = categoryWithOutlier("cat-c", 3060n, "tx-would-trigger").map((t) => ({ ...t }));
    txs[19]!.kind = "income";
    const { anomalies: withIncome } = detectAnomalies(txs);
    expect(withIncome).toHaveLength(0);

    const deleted = categoryWithOutlier("cat-d", 3060n, "tx-deleted");
    deleted[19]!.deletedAt = "2026-06-21T00:00:00.000Z";
    const { anomalies: withDeleted } = detectAnomalies(deleted);
    expect(withDeleted).toHaveLength(0);

    const voided = categoryWithOutlier("cat-e", 3060n, "tx-void");
    voided[19]!.status = "void";
    const { anomalies: withVoid } = detectAnomalies(voided);
    expect(withVoid).toHaveLength(0);
  });
});
