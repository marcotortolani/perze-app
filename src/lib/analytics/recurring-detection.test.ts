import { describe, expect, it } from "vitest";
import { detectRecurringCandidates, type DetectableRule, type DetectableTransaction } from "./recurring-detection";

let seq = 0;
function tx(overrides: Partial<DetectableTransaction>): DetectableTransaction {
  seq += 1;
  return {
    id: `tx-${seq}`,
    occurredAt: "2026-01-01T12:00:00.000Z",
    kind: "expense",
    amount: 1000n,
    currencyCode: "UYU",
    categoryId: "cat-streaming",
    accountId: "acc-1",
    payeeId: "payee-netflix",
    status: "cleared",
    recurringId: null,
    deletedAt: null,
    ...overrides,
  };
}

const NO_RULES: DetectableRule[] = [];
const PAYEES = new Map([["payee-netflix", "Netflix"]]);
const TODAY = "2026-06-15";

describe("detectRecurringCandidates", () => {
  it("detecta un patrón mensual con monto estable", () => {
    const txs = [
      tx({ occurredAt: "2026-03-05T12:00:00.000Z" }),
      tx({ occurredAt: "2026-04-05T12:00:00.000Z" }),
      tx({ occurredAt: "2026-05-05T12:00:00.000Z" }),
    ];
    const candidates = detectRecurringCandidates(txs, PAYEES, NO_RULES, TODAY);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ payeeId: "payee-netflix", frequency: "monthly", expectedAmount: 1000n, dayOfMonth: 5, matchCount: 3 });
  });

  it("tolera un monto que varía dentro de ±15% (factura de luz)", () => {
    const txs = [
      tx({ occurredAt: "2026-03-10T12:00:00.000Z", amount: 1000n }),
      tx({ occurredAt: "2026-04-10T12:00:00.000Z", amount: 1080n }),
      tx({ occurredAt: "2026-05-10T12:00:00.000Z", amount: 950n }),
    ];
    const candidates = detectRecurringCandidates(txs, PAYEES, NO_RULES, TODAY);
    expect(candidates).toHaveLength(1);
  });

  it("descarta si el monto varía más del 15%", () => {
    const txs = [
      tx({ occurredAt: "2026-03-10T12:00:00.000Z", amount: 1000n }),
      tx({ occurredAt: "2026-04-10T12:00:00.000Z", amount: 1500n }),
      tx({ occurredAt: "2026-05-10T12:00:00.000Z", amount: 1000n }),
    ];
    expect(detectRecurringCandidates(txs, PAYEES, NO_RULES, TODAY)).toHaveLength(0);
  });

  it("menos de 3 cargos no es un patrón", () => {
    const txs = [tx({ occurredAt: "2026-04-05T12:00:00.000Z" }), tx({ occurredAt: "2026-05-05T12:00:00.000Z" })];
    expect(detectRecurringCandidates(txs, PAYEES, NO_RULES, TODAY)).toHaveLength(0);
  });

  it("descarta si ya existe una regla activa para ese comercio", () => {
    const txs = [
      tx({ occurredAt: "2026-03-05T12:00:00.000Z" }),
      tx({ occurredAt: "2026-04-05T12:00:00.000Z" }),
      tx({ occurredAt: "2026-05-05T12:00:00.000Z" }),
    ];
    const rules: DetectableRule[] = [{ name: "Netflix", archivedAt: null }];
    expect(detectRecurringCandidates(txs, PAYEES, rules, TODAY)).toHaveLength(0);
  });

  it("descarta si el comercio ya tiene AL MENOS UN movimiento vinculado a una regla", () => {
    const txs = [
      tx({ occurredAt: "2026-02-05T12:00:00.000Z", recurringId: "rule-1" }),
      tx({ occurredAt: "2026-03-05T12:00:00.000Z" }),
      tx({ occurredAt: "2026-04-05T12:00:00.000Z" }),
      tx({ occurredAt: "2026-05-05T12:00:00.000Z" }),
    ];
    expect(detectRecurringCandidates(txs, PAYEES, NO_RULES, TODAY)).toHaveLength(0);
  });

  it("ignora movimientos fuera de la ventana de lookback (6 meses)", () => {
    const txs = [
      tx({ occurredAt: "2025-01-05T12:00:00.000Z" }),
      tx({ occurredAt: "2025-02-05T12:00:00.000Z" }),
      tx({ occurredAt: "2025-03-05T12:00:00.000Z" }),
    ];
    expect(detectRecurringCandidates(txs, PAYEES, NO_RULES, TODAY)).toHaveLength(0);
  });

  it("ignora movimientos soft-deleted, void, sin payee, o transferencias", () => {
    const txs = [
      tx({ occurredAt: "2026-03-05T12:00:00.000Z", deletedAt: "2026-03-06T00:00:00.000Z" }),
      tx({ occurredAt: "2026-04-05T12:00:00.000Z", status: "void" }),
      tx({ occurredAt: "2026-05-05T12:00:00.000Z", payeeId: null }),
      tx({ occurredAt: "2026-05-06T12:00:00.000Z", kind: "transfer" }),
    ];
    expect(detectRecurringCandidates(txs, PAYEES, NO_RULES, TODAY)).toHaveLength(0);
  });

  it("detecta un patrón semanal", () => {
    const txs = [
      tx({ occurredAt: "2026-05-01T12:00:00.000Z", payeeId: "payee-gym", categoryId: "cat-gym" }),
      tx({ occurredAt: "2026-05-08T12:00:00.000Z", payeeId: "payee-gym", categoryId: "cat-gym" }),
      tx({ occurredAt: "2026-05-15T12:00:00.000Z", payeeId: "payee-gym", categoryId: "cat-gym" }),
      tx({ occurredAt: "2026-05-22T12:00:00.000Z", payeeId: "payee-gym", categoryId: "cat-gym" }),
    ];
    const payees = new Map([...PAYEES, ["payee-gym", "Gimnasio"]]);
    const candidates = detectRecurringCandidates(txs, payees, NO_RULES, TODAY);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ frequency: "weekly", dayOfMonth: null });
  });

  it("la clave (`key`) es estable para el mismo patrón y cambia si el monto cambia de verdad", () => {
    const txsA = [tx({ occurredAt: "2026-03-05T12:00:00.000Z" }), tx({ occurredAt: "2026-04-05T12:00:00.000Z" }), tx({ occurredAt: "2026-05-05T12:00:00.000Z" })];
    const [a] = detectRecurringCandidates(txsA, PAYEES, NO_RULES, TODAY);
    const txsB = txsA.map((t) => ({ ...t, amount: 5000n }));
    const [b] = detectRecurringCandidates(txsB, PAYEES, NO_RULES, TODAY);
    expect(a!.key).not.toBe(b!.key);
  });
});
