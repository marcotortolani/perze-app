import { describe, expect, it } from "vitest";
import { accountBalanceAt, investingActivity, periodAccountBalances, type BalanceTransaction } from "./period-balances";

const CASH = { id: "acc-cash", name: "Efectivo", currencyCode: "UYU", openingBalance: 100_000n, openingDate: "2026-06-01", archivedAt: null };

function expense(occurredAt: string, amount: bigint, accountId = CASH.id): BalanceTransaction {
  return { kind: "expense", amount, accountId, counterAccountId: null, counterAmount: null, occurredAt };
}

describe("accountBalanceAt", () => {
  it("reconstruye desde opening_balance, no desde current_balance", () => {
    const txs = [expense("2026-07-05", 10_000n), expense("2026-07-20", 5_000n)];
    // Al inicio del período todavía no pasó nada de julio.
    expect(accountBalanceAt(CASH, txs, "2026-07-01")).toBe(100_000n);
    // Al cierre, los dos gastos ya ocurrieron.
    expect(accountBalanceAt(CASH, txs, "2026-08-01")).toBe(85_000n);
  });

  it("el corte es exclusivo: lo del propio día del cierre no entra", () => {
    const txs = [expense("2026-08-01", 1_000n)];
    expect(accountBalanceAt(CASH, txs, "2026-08-01")).toBe(100_000n);
  });

  it("antes de opening_date el saldo es 0, no el opening_balance", () => {
    // La cuenta no existía: devolver su saldo inicial fabricaría un dato
    // que nunca fue cierto.
    expect(accountBalanceAt(CASH, [], "2026-05-01")).toBe(0n);
  });

  it("ignora los movimientos de otras cuentas", () => {
    const txs = [expense("2026-07-05", 10_000n, "otra-cuenta")];
    expect(accountBalanceAt(CASH, txs, "2026-08-01")).toBe(100_000n);
  });
});

describe("periodAccountBalances", () => {
  it("da apertura, cierre y variación por cuenta, cada una en su moneda", () => {
    const usd = { id: "acc-usd", name: "Ahorros USD", currencyCode: "USD", openingBalance: 50_000n, openingDate: "2026-06-01", archivedAt: null };
    const txs = [expense("2026-07-10", 20_000n), expense("2026-07-11", 1_000n, usd.id)];

    const result = periodAccountBalances([CASH, usd], txs, "2026-07-01", "2026-08-01");

    expect(result).toEqual([
      { accountId: "acc-cash", name: "Efectivo", currencyCode: "UYU", opening: 100_000n, closing: 80_000n, delta: -20_000n },
      { accountId: "acc-usd", name: "Ahorros USD", currencyCode: "USD", opening: 50_000n, closing: 49_000n, delta: -1_000n },
    ]);
  });

  it("deja afuera las cuentas archivadas", () => {
    const archived = { ...CASH, id: "acc-old", name: "Vieja", archivedAt: "2026-06-15T00:00:00.000Z" };
    expect(periodAccountBalances([archived], [], "2026-07-01", "2026-08-01")).toEqual([]);
  });
});

describe("investingActivity", () => {
  const from = new Date(2026, 6, 1);
  const to = new Date(2026, 7, 1);

  it("separa lo invertido de lo desinvertido", () => {
    const result = investingActivity(
      [
        { kind: "investing", amountBase: -30_000n, occurredAt: "2026-07-05" },
        { kind: "investing", amountBase: 12_000n, occurredAt: "2026-07-20" },
        { kind: "expense", amountBase: 5_000n, occurredAt: "2026-07-06" },
      ],
      from,
      to
    );

    expect(result.invested).toBe(30_000n);
    expect(result.divested).toBe(12_000n);
    expect(result.count).toBe(2);
  });

  it("sin movimientos de inversión devuelve count 0 — la señal para no dibujar la sección", () => {
    const result = investingActivity([{ kind: "expense", amountBase: 5_000n, occurredAt: "2026-07-06" }], from, to);
    expect(result.count).toBe(0);
  });

  it("cuenta los que no tienen cotización en vez de sumarlos como cero", () => {
    const result = investingActivity(
      [
        { kind: "investing", amountBase: -30_000n, occurredAt: "2026-07-05" },
        { kind: "investing", amountBase: null, occurredAt: "2026-07-06" },
      ],
      from,
      to
    );

    expect(result.invested).toBe(30_000n);
    expect(result.count).toBe(2);
    expect(result.excludedCount).toBe(1);
  });
});
