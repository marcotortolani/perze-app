import { describe, expect, it } from "vitest";
import { biggestPeriodByExpense, buildMonthlySummary, type MonthlySummaryTransactionInput } from "./monthly-summary";

const FROM = new Date("2026-07-01T00:00:00.000Z");
const TO = new Date("2026-08-01T00:00:00.000Z");
const PREV_FROM = new Date("2026-06-01T00:00:00.000Z");

function tx(partial: Partial<MonthlySummaryTransactionInput> = {}): MonthlySummaryTransactionInput {
  return {
    kind: "expense",
    amountBase: 100_000n,
    occurredAt: "2026-07-10T15:00:00.000Z",
    categoryId: "cat-super",
    categoryName: "Supermercado",
    ...partial,
  };
}

function build(overrides: Partial<Parameters<typeof buildMonthlySummary>[0]> = {}) {
  return buildMonthlySummary({
    from: FROM,
    to: TO,
    previousFrom: PREV_FROM,
    transactions: [tx()],
    previousTransactions: [],
    accounts: [{ name: "Itaú", currencyCode: "UYU", opening: 500_000n, closing: 400_000n }],
    ...overrides,
  });
}

describe("buildMonthlySummary", () => {
  it("suma ingresos y egresos de consumo, y el neto es su diferencia", () => {
    const summary = build({
      transactions: [tx({ kind: "income", amountBase: 800_000n }), tx({ amountBase: 300_000n })],
    });
    expect(summary.income).toBe(800_000n);
    expect(summary.expenses).toBe(300_000n);
    expect(summary.net).toBe(500_000n);
  });

  it("una compra de instrumentos no cuenta como gasto del mes", () => {
    // `investing` mueve liquidez pero no es consumo (`cash-flow.ts`). Si
    // entrara en `expenses`, el mail diría que alguien gastó de más el mes
    // que movió plata al broker.
    const summary = build({
      transactions: [tx({ amountBase: 200_000n }), tx({ kind: "investing", amountBase: -1_000_000n, categoryId: null, categoryName: null })],
    });
    expect(summary.expenses).toBe(200_000n);
    expect(summary.investing).toEqual({ invested: 1_000_000n, divested: 0n });
  });

  it("sin un solo movimiento de inversión no dibuja la sección", () => {
    expect(build().investing).toBeNull();
  });

  it("excluye los movimientos sin cotización y declara cuántos fueron", () => {
    const summary = build({
      transactions: [tx({ amountBase: 300_000n }), tx({ amountBase: null }), tx({ amountBase: null })],
    });
    expect(summary.expenses).toBe(300_000n);
    expect(summary.excludedCount).toBe(2);
  });

  it("compara contra el período anterior con SUS límites, no con los del actual", () => {
    // El bug natural acá es resumir las filas del mes anterior con el rango
    // del mes en curso: quedan todas fuera, el total previo da 0 y la
    // comparación dice "no hay con qué comparar" siempre.
    const summary = build({
      transactions: [tx({ amountBase: 220_000n })],
      previousTransactions: [{ kind: "expense", amountBase: 200_000n, occurredAt: "2026-06-12T12:00:00.000Z" }],
    });
    expect(summary.expenseChangePct).toBeCloseTo(10, 6);
  });

  it("sin período anterior no inventa un 0%", () => {
    expect(build({ previousTransactions: [] }).expenseChangePct).toBeNull();
  });

  it("recorta las categorías al tope y las ordena de mayor a menor", () => {
    const summary = build({
      topCategoryLimit: 2,
      transactions: [
        tx({ categoryId: "a", categoryName: "Alquiler", amountBase: 900_000n }),
        tx({ categoryId: "b", categoryName: "Super", amountBase: 500_000n }),
        tx({ categoryId: "c", categoryName: "Nafta", amountBase: 100_000n }),
      ],
    });
    expect(summary.topCategories).toEqual([
      { label: "Alquiler", total: 900_000n },
      { label: "Super", total: 500_000n },
    ]);
  });

  it("una categoría que ese miembro no puede ver no viaja por mail, pero su plata sigue en el total", () => {
    // El movimiento es household (por eso lo ve), la categoría es privada
    // de otro miembro. Sacarlo del total sería mentir; nombrarlo sería
    // filtrar por mail lo que la app oculta en pantalla.
    const summary = build({
      transactions: [tx({ categoryId: "privada", categoryName: null, amountBase: 400_000n }), tx({ amountBase: 100_000n })],
    });
    expect(summary.expenses).toBe(500_000n);
    expect(summary.topCategories).toEqual([{ label: "Supermercado", total: 100_000n }]);
  });

  it("un período sin movimientos no tiene actividad — no se manda mail", () => {
    expect(build({ transactions: [] }).hasActivity).toBe(false);
    expect(build().hasActivity).toBe(true);
  });

  it("los saldos de cada cuenta pasan derecho, cada uno en su moneda", () => {
    const summary = build({
      accounts: [
        { name: "Itaú", currencyCode: "UYU", opening: 500_000n, closing: 400_000n },
        { name: "Broker", currencyCode: "USD", opening: 0n, closing: 120_000n },
      ],
    });
    expect(summary.accounts.map((a) => a.currencyCode)).toEqual(["UYU", "USD"]);
    expect(summary.accounts[1]!.closing).toBe(120_000n);
  });
});

describe("biggestPeriodByExpense", () => {
  const CUTS = [new Date("2026-01-01T00:00:00.000Z"), new Date("2026-02-01T00:00:00.000Z"), new Date("2026-03-01T00:00:00.000Z"), new Date("2026-04-01T00:00:00.000Z")];

  it("elige el período con más gasto de consumo", () => {
    const biggest = biggestPeriodByExpense(
      [
        { kind: "expense", amountBase: 100_000n, occurredAt: "2026-01-10T12:00:00.000Z" },
        { kind: "expense", amountBase: 900_000n, occurredAt: "2026-02-14T12:00:00.000Z" },
        { kind: "expense", amountBase: 300_000n, occurredAt: "2026-03-02T12:00:00.000Z" },
      ],
      CUTS
    );
    expect(biggest?.start.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(biggest?.total).toBe(900_000n);
  });

  it("una compra grande de instrumentos no convierte a ese mes en el de mayor gasto", () => {
    const biggest = biggestPeriodByExpense(
      [
        { kind: "expense", amountBase: 100_000n, occurredAt: "2026-01-10T12:00:00.000Z" },
        { kind: "investing", amountBase: -5_000_000n, occurredAt: "2026-02-14T12:00:00.000Z" },
      ],
      CUTS
    );
    expect(biggest?.start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("sin un solo gasto no inventa un mes ganador", () => {
    expect(biggestPeriodByExpense([], CUTS)).toBeNull();
    expect(biggestPeriodByExpense([{ kind: "income", amountBase: 500_000n, occurredAt: "2026-01-10T12:00:00.000Z" }], CUTS)).toBeNull();
  });

  it("los movimientos sin cotización no eligen el mes", () => {
    const biggest = biggestPeriodByExpense(
      [
        { kind: "expense", amountBase: 10_000n, occurredAt: "2026-01-10T12:00:00.000Z" },
        { kind: "expense", amountBase: null, occurredAt: "2026-02-14T12:00:00.000Z" },
      ],
      CUTS
    );
    expect(biggest?.start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});
