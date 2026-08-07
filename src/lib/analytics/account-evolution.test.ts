import { describe, expect, it } from "vitest";
import { computeAccountEvolution, type EvolutionTransaction } from "./account-evolution";
import type { AccountRow } from "@/lib/db/schema";

function account(overrides: Partial<AccountRow>): AccountRow {
  return {
    id: "acc-1",
    householdId: "h1",
    ownerId: "u1",
    name: "Cuenta",
    kind: "checking",
    institutionId: null,
    countryCode: null,
    currencyCode: "ARS",
    openingBalance: 0n,
    openingDate: null,
    currentBalance: 0n,
    creditLimit: null,
    statementDay: null,
    dueDay: null,
    interestRate: null,
    termMonths: null,
    includeInNetWorth: true,
    visibility: "household",
    color: null,
    icon: null,
    sortOrder: 0,
    archivedAt: null,
    createdBy: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    clientRev: 0,
    ...overrides,
  };
}

function tx(overrides: Partial<EvolutionTransaction> & { occurredAt: string }): EvolutionTransaction {
  return {
    kind: "expense",
    amount: 0n,
    accountId: "acc-1",
    counterAccountId: null,
    counterAmount: null,
    ...overrides,
  };
}

describe("D66 — computeAccountEvolution no depende de currentBalance", () => {
  it("muestra 0 en todos los días anteriores a la primera transacción real, incluso si currentBalance está stale/desincronizado", () => {
    // La cuenta arrancó en $0 y su única historia es un ingreso el 2026-08-02.
    // `currentBalance` está deliberadamente MAL (valor parcial de una sync a
    // medio terminar) para probar que la reconstrucción no lo usa.
    const acc = account({ openingBalance: 0n, currentBalance: 12_000_00n });
    const transactions: EvolutionTransaction[] = [
      tx({ kind: "income", amount: 1_200_000_00n, occurredAt: "2026-08-02T12:00:00.000Z" }),
      tx({ kind: "expense", amount: 155_00n, occurredAt: "2026-08-02T15:00:00.000Z" }),
      tx({ kind: "expense", amount: 25_896_00n, occurredAt: "2026-08-02T16:00:00.000Z" }),
    ];
    const now = new Date("2026-08-05T20:00:00.000Z");

    const points = computeAccountEvolution({ account: acc, transactions, windowDays: 90, now });

    const beforeHistory = points.filter((p) => p.isoDate < "2026-08-02");
    expect(beforeHistory.length).toBeGreaterThan(0);
    for (const p of beforeHistory) {
      expect(p.value).toBe(0);
    }

    const today = points[points.length - 1]!;
    expect(today.isoDate).toBe("2026-08-05");
    // 1.200.000 - 155 - 25.896 = 1.173.949
    expect(today.value).toBeCloseTo(1_173_949, 6);
  });

  it("un movimiento fuera de la ventana de 90 días se refleja en el saldo inicial de la ventana, no se pierde", () => {
    const acc = account({ openingBalance: 0n });
    const transactions: EvolutionTransaction[] = [
      tx({ kind: "income", amount: 500_00n, occurredAt: "2025-01-01T00:00:00.000Z" }),
    ];
    const now = new Date("2026-08-05T00:00:00.000Z");

    const points = computeAccountEvolution({ account: acc, transactions, windowDays: 90, now });

    for (const p of points) {
      expect(p.value).toBe(500);
    }
  });

  it("tarjeta de crédito: grafica el consumo (signo invertido), nunca el saldo negativo crudo", () => {
    const acc = account({ kind: "credit_card", openingBalance: 0n });
    const transactions: EvolutionTransaction[] = [
      tx({ kind: "expense", amount: 10_000_00n, occurredAt: "2026-08-01T00:00:00.000Z" }),
    ];
    const now = new Date("2026-08-05T00:00:00.000Z");

    const points = computeAccountEvolution({ account: acc, transactions, windowDays: 90, now });
    const today = points[points.length - 1]!;
    expect(today.value).toBe(10_000);
  });
});

describe("D66b — opening_balance no cero no es opening_balance de siempre", () => {
  it("no grafica ningún punto anterior a opening_date: la cuenta no existía, no valía opening_balance", () => {
    // Caso real reportado: la cuenta se creó el 2026-08-02 con
    // opening_balance $120.000 (dinero que ya existía en otro lado antes
    // de empezar a usar la app) — mostrar $120.000 plano desde hace 90
    // días (mucho antes de que la cuenta existiera) es tan fabricado como
    // el bug original de D66, solo que con un valor distinto de cero.
    const acc = account({ openingBalance: 120_000_00n, openingDate: "2026-08-02" });
    const transactions: EvolutionTransaction[] = [
      tx({ kind: "income", amount: 1_200_000_00n, occurredAt: "2026-08-02T12:00:00.000Z" }),
    ];
    const now = new Date("2026-08-06T20:00:00.000Z");

    const points = computeAccountEvolution({ account: acc, transactions, windowDays: 90, now });

    for (const p of points) {
      expect(p.isoDate >= "2026-08-02").toBe(true);
    }
    // El primer punto es el día de arranque, YA con el ingreso del mismo
    // día aplicado (mismo criterio que "hoy": los movimientos del propio
    // día se ven reflejados, no el instante justo antes de ellos).
    expect(points[0]!.isoDate).toBe("2026-08-02");
    expect(points[0]!.value).toBe(1_320_000);
  });

  it("sin opening_date (cuentas viejas sin esa columna poblada), no trunca — mismo comportamiento que antes", () => {
    const acc = account({ openingBalance: 120_000_00n, openingDate: null });
    const now = new Date("2026-08-06T20:00:00.000Z");

    const points = computeAccountEvolution({ account: acc, transactions: [], windowDays: 90, now });

    expect(points[0]!.isoDate < "2026-08-02").toBe(true);
    expect(points[0]!.value).toBe(120_000);
  });
});
