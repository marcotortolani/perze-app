import { describe, expect, it } from "vitest";
import { cardCycle, cardPaymentSources, cycleExpenseTotal, effectiveCardCycleConfig, expectedDueAmount, isCreditCardAccount, tradeSettlementAccounts } from "./card-cycle";
import type { AccountGroupRow, AccountRow } from "@/lib/db/schema";

function account(overrides: Partial<AccountRow>): AccountRow {
  return {
    id: "acc-1",
    householdId: "h1",
    ownerId: "u1",
    name: "Cuenta",
    kind: "checking",
    institutionId: null,
    countryCode: null,
    currencyCode: "UYU",
    openingBalance: 0n,
    openingDate: null,
    currentBalance: 0n,
    creditLimit: null,
    statementDay: null,
    dueDay: null,
    accountGroupId: null,
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
    ...overrides,
  } as AccountRow;
}

describe("isCreditCardAccount", () => {
  it("is true only for kind='credit_card'", () => {
    expect(isCreditCardAccount({ kind: "credit_card" })).toBe(true);
    expect(isCreditCardAccount({ kind: "checking" })).toBe(false);
  });
});

describe("cardPaymentSources", () => {
  const card = account({ id: "card-1", kind: "credit_card" });
  it("excludes the card itself, other credit cards, and archived accounts; includes the rest", () => {
    const checking = account({ id: "acc-checking", kind: "checking" });
    const otherCard = account({ id: "card-2", kind: "credit_card" });
    const archived = account({ id: "acc-archived", kind: "savings", archivedAt: "2026-01-01T00:00:00.000Z" });
    const wallet = account({ id: "acc-wallet", kind: "wallet" });
    const result = cardPaymentSources([card, checking, otherCard, archived, wallet], card);
    expect(result.map((a) => a.id).sort()).toEqual(["acc-checking", "acc-wallet"]);
  });
});

describe("tradeSettlementAccounts", () => {
  it("excludes credit cards and archived accounts", () => {
    const checking = account({ id: "acc-checking", kind: "checking" });
    const card = account({ id: "card-1", kind: "credit_card" });
    const broker = account({ id: "acc-broker", kind: "broker" });
    const archived = account({ id: "acc-archived", kind: "savings", archivedAt: "2026-01-01T00:00:00.000Z" });
    const result = tradeSettlementAccounts([checking, card, broker, archived], null);
    expect(result.map((a) => a.id).sort()).toEqual(["acc-broker", "acc-checking"]);
  });

  it("keeps a legacy trade's current account visible even if it's a credit card", () => {
    const checking = account({ id: "acc-checking", kind: "checking" });
    const card = account({ id: "card-1", kind: "credit_card" });
    const result = tradeSettlementAccounts([checking, card], "card-1");
    expect(result.map((a) => a.id).sort()).toEqual(["acc-checking", "card-1"]);
  });

  it("does not resurrect an archived account just because it's not the current one", () => {
    const archived = account({ id: "acc-archived", kind: "savings", archivedAt: "2026-01-01T00:00:00.000Z" });
    const checking = account({ id: "acc-checking", kind: "checking" });
    const result = tradeSettlementAccounts([archived, checking], "acc-checking");
    expect(result.map((a) => a.id)).toEqual(["acc-checking"]);
  });
});

describe("cardCycle", () => {
  it("statementDay 31 in February clamps to the last real day", () => {
    // Ciclo de referencia en marzo, statementDay 31 → el cierre anterior
    // (período) cae en el 28/29 de febrero, no revienta.
    const c = cardCycle(31, 10, new Date(2026, 2, 5)); // 5 mar 2026
    expect(c.periodStart).toBe("2026-02-28"); // 2026 no es bisiesto
  });

  it("rolls the due date to the next month when dueDay < closingDate's day", () => {
    // statementDay 25, dueDay 5: el resumen cierra el 24 del mes
    // siguiente — el "día 5" de ESE mes ya pasó, así que el vencimiento
    // corre un mes más.
    const c = cardCycle(25, 5, new Date(2026, 5, 10)); // 10 jun 2026
    expect(c.periodStart).toBe("2026-05-25");
    expect(c.closingDate).toBe("2026-06-24");
    expect(c.dueDate).toBe("2026-07-05");
  });

  it("keeps the due date in the closing month when dueDay >= closing day", () => {
    // statementDay 5, dueDay 28: cierra el 4, el 28 del mismo mes es
    // posterior al cierre — no hace falta correr al mes siguiente.
    const c = cardCycle(5, 28, new Date(2026, 5, 10)); // 10 jun 2026
    expect(c.periodStart).toBe("2026-06-05");
    expect(c.closingDate).toBe("2026-07-04");
    expect(c.dueDate).toBe("2026-07-28");
  });

  it("a ref exactly on the statement day belongs to the new cycle", () => {
    const c = cardCycle(15, 25, new Date(2026, 5, 15)); // 15 jun 2026, == statementDay
    expect(c.periodStart).toBe("2026-06-15");
  });
});

describe("cycleExpenseTotal", () => {
  const periodStart = "2026-06-15";
  const closingExclusive = "2026-07-15";
  it("expense adds, income subtracts, adjustment subtracts, transfer is ignored", () => {
    const total = cycleExpenseTotal(
      [
        { kind: "expense", amount: 1000n, occurredAt: "2026-06-20T00:00:00.000Z" },
        { kind: "income", amount: 100n, occurredAt: "2026-06-21T00:00:00.000Z" },
        { kind: "adjustment", amount: 50n, occurredAt: "2026-06-22T00:00:00.000Z" },
        { kind: "transfer", amount: 9999n, occurredAt: "2026-06-23T00:00:00.000Z" },
      ],
      periodStart,
      closingExclusive
    );
    expect(total).toBe(1000n - 100n - 50n);
  });

  it("a legacy investing settlement on a card increases debt like an adjustment (buy negative → subtracting adds to the debt)", () => {
    const total = cycleExpenseTotal(
      [{ kind: "investing", amount: -800n, occurredAt: "2026-06-20T00:00:00.000Z" }],
      periodStart,
      closingExclusive
    );
    expect(total).toBe(800n);
  });

  it("a legacy investing sell on a card reduces debt", () => {
    const total = cycleExpenseTotal(
      [{ kind: "investing", amount: 300n, occurredAt: "2026-06-20T00:00:00.000Z" }],
      periodStart,
      closingExclusive
    );
    expect(total).toBe(-300n);
  });

  it("ignores deleted and out-of-window transactions", () => {
    const total = cycleExpenseTotal(
      [
        { kind: "expense", amount: 1000n, occurredAt: "2026-06-20T00:00:00.000Z", deletedAt: "2026-06-21T00:00:00.000Z" },
        { kind: "expense", amount: 500n, occurredAt: "2026-05-01T00:00:00.000Z" }, // before window
        { kind: "expense", amount: 500n, occurredAt: "2026-08-01T00:00:00.000Z" }, // after window
      ],
      periodStart,
      closingExclusive
    );
    expect(total).toBe(0n);
  });
});

describe("expectedDueAmount", () => {
  it("uses statementBalance - paidAmount when it covers at least the account's real debt", () => {
    const card = account({ kind: "credit_card", currentBalance: -2000n });
    const amount = expectedDueAmount(card, {
      id: "s1",
      accountId: "card-1",
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      closingDate: "2026-06-30",
      dueDate: "2026-07-10",
      statementBalance: 3000n,
      minimumPayment: null,
      currencyCode: "UYU",
      paidAmount: 1000n,
      status: "open",
      settlementTransactionId: null,
      projectionStatus: "confirmed",
    });
    expect(amount).toBe(2000n);
  });

  it("falls back to -currentBalance without a statement", () => {
    const card = account({ kind: "credit_card", currentBalance: -5000n });
    expect(expectedDueAmount(card, null)).toBe(5000n);
  });

  it("never suggests less than the account's real debt, even if the statement's cycle window missed older unpaid charges", () => {
    // La cuenta debe 5000 en total (deuda real, íntegra), pero el resumen
    // del ciclo recién abierto solo capturó 1300 (p. ej. porque el cron
    // corrió después de que ya hubiera consumos de un ciclo anterior sin
    // resumen) — nunca hay que sugerir pagar menos de lo que la cuenta
    // realmente debe.
    const card = account({ kind: "credit_card", currentBalance: -5000n });
    const amount = expectedDueAmount(card, {
      id: "s1",
      accountId: "card-1",
      periodStart: "2026-07-28",
      periodEnd: "2026-08-27",
      closingDate: "2026-08-27",
      dueDate: "2026-09-07",
      statementBalance: 1300n,
      minimumPayment: null,
      currencyCode: "USD",
      paidAmount: 0n,
      status: "open",
      settlementTransactionId: null,
      projectionStatus: "confirmed",
    });
    expect(amount).toBe(5000n);
  });
});

function accountGroup(overrides: Partial<AccountGroupRow>): AccountGroupRow {
  return {
    id: "group-1",
    householdId: "h1",
    kind: "credit_card",
    name: "Visa BBVA",
    creditLimit: null,
    limitCurrency: null,
    statementDay: null,
    dueDay: null,
    createdBy: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    archivedAt: null,
    deletedAt: null,
    clientRev: 1,
    ...overrides,
  };
}

describe("effectiveCardCycleConfig", () => {
  it("sin grupo, usa las columnas propias de la cuenta", () => {
    const card = account({ kind: "credit_card", statementDay: 5, dueDay: 15, creditLimit: 100000n, currencyCode: "ARS" });
    const config = effectiveCardCycleConfig(card, null);
    expect(config).toEqual({ statementDay: 5, dueDay: 15, creditLimit: 100000n, limitCurrency: "ARS", isGrouped: false });
  });

  it("con grupo, usa el límite/ciclo del grupo — nunca el de la cuenta, aunque la cuenta tenga los suyos", () => {
    const card = account({ kind: "credit_card", statementDay: 1, dueDay: 1, creditLimit: 1n, currencyCode: "USD" });
    const group = accountGroup({ statementDay: 5, dueDay: 15, creditLimit: 2000000n, limitCurrency: "ARS" });
    const config = effectiveCardCycleConfig(card, group);
    expect(config).toEqual({ statementDay: 5, dueDay: 15, creditLimit: 2000000n, limitCurrency: "ARS", isGrouped: true });
  });
});
