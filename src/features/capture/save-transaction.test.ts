import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "@/lib/db/client";
import { accountsRepo } from "@/lib/repos/accounts-repo";
import { fxRepo } from "@/lib/repos/fx-repo";
import { rateFromInteger } from "@/lib/fx/rate";
import type { HouseholdRow } from "@/lib/db/schema";
import type { CaptureDraft } from "@/stores/capture-draft-store";
import { computeExpenseDebitAmount, hasNonZeroAmount, saveDraftAsTransaction } from "./save-transaction";

describe("hasNonZeroAmount — elegir categoría antes de tipear el monto no debería poder guardar en $0", () => {
  it("expresión vacía no es un monto válido", () => {
    expect(hasNonZeroAmount("", "UYU")).toBe(false);
  });

  it("'0' explícito tampoco lo es", () => {
    expect(hasNonZeroAmount("0", "UYU")).toBe(false);
  });

  it("una cuenta que evalúa a cero (\"5-5\") tampoco", () => {
    expect(hasNonZeroAmount("5-5", "UYU")).toBe(false);
  });

  it("un monto real sí", () => {
    expect(hasNonZeroAmount("1250", "UYU")).toBe(true);
  });

  it("una expresión inválida no revienta, cae a `false`", () => {
    expect(hasNonZeroAmount("++", "UYU")).toBe(false);
  });
});

const HOUSEHOLD_UYU: HouseholdRow = {
  id: "hh-1",
  name: "Casa",
  baseCurrency: "UYU",
  baseCountry: "UY",
  periodStartDay: 1,
  weekStart: 1,
  enabledModules: [],
  settings: {},
  createdBy: "user-1",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
  clientRev: 1,
  purgedAt: null,
};

function baseDraft(overrides: Partial<CaptureDraft> = {}): CaptureDraft {
  return {
    kind: "expense",
    amountExpression: "1250",
    currency: "",
    accountId: null,
    counterAccountId: null,
    counterFxRateOverride: null,
    captureFxRateOverride: null,
    amountPinnedTo: "account",
    categoryId: "cat-1",
    occurredAt: "2026-07-27T12:00:00.000Z",
    payeeName: "",
    note: "",
    tagIds: [],
    burstMode: false,
    burstCount: 0,
    ...overrides,
  };
}

describe("saveDraftAsTransaction", () => {
  beforeEach(() => {
    resetDbForTests(`perze-test-save-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await getDb().delete();
  });

  it("gasto en la moneda base: identity, sin conversión", async () => {
    const account = await accountsRepo.create({
      householdId: HOUSEHOLD_UYU.id,
      ownerId: "user-1",
      name: "Efectivo",
      kind: "cash",
      institutionId: null,
      countryCode: "UY",
      currencyCode: "UYU",
      openingBalance: 100_000n,
      openingDate: "2026-07-01",
      creditLimit: null,
      statementDay: null,
      dueDay: null,
      interestRate: null,
      termMonths: null,
      includeInNetWorth: true,
      visibility: "household",
      color: null,
      icon: null,
      archivedAt: null,
      createdBy: "user-1",
    });

    const tx = await saveDraftAsTransaction({ draft: baseDraft(), household: HOUSEHOLD_UYU, userId: "user-1", account });

    expect(tx.amount).toBe(125_000n);
    expect(tx.fxSource).toBe("identity");
    expect(tx.amountBase).toBe(125_000n);
    expect((await accountsRepo.get(account.id))?.currentBalance).toBe(-25_000n);
  });

  it("gasto en una moneda distinta a la base: usa el override manual si existe", async () => {
    const account = await accountsRepo.create({
      householdId: HOUSEHOLD_UYU.id,
      ownerId: "user-1",
      name: "Ahorros USD",
      kind: "wallet",
      institutionId: null,
      countryCode: "US",
      currencyCode: "USD",
      openingBalance: 100_00n,
      openingDate: "2026-07-01",
      creditLimit: null,
      statementDay: null,
      dueDay: null,
      interestRate: null,
      termMonths: null,
      includeInNetWorth: true,
      visibility: "household",
      color: null,
      icon: null,
      archivedAt: null,
      createdBy: "user-1",
    });

    await fxRepo.setManualOverride(HOUSEHOLD_UYU.id, "USD", "UYU", rateFromInteger(40));

    const tx = await saveDraftAsTransaction({ draft: baseDraft({ amountExpression: "10" }), household: HOUSEHOLD_UYU, userId: "user-1", account });

    expect(tx.amount).toBe(1000n); // USD 10.00
    expect(tx.fxSource).toBe("manual");
    expect(tx.amountBase).toBe(40_000n); // 10 USD * 40 = 400.00 UYU
  });

  it("sin ningún rate disponible: se guarda igual, needs_fx", async () => {
    const account = await accountsRepo.create({
      householdId: HOUSEHOLD_UYU.id,
      ownerId: "user-1",
      name: "Cuenta ARS",
      kind: "wallet",
      institutionId: null,
      countryCode: "AR",
      currencyCode: "ARS",
      openingBalance: 0n,
      openingDate: "2026-07-01",
      creditLimit: null,
      statementDay: null,
      dueDay: null,
      interestRate: null,
      termMonths: null,
      includeInNetWorth: true,
      visibility: "household",
      color: null,
      icon: null,
      archivedAt: null,
      createdBy: "user-1",
    });

    const tx = await saveDraftAsTransaction({ draft: baseDraft({ amountExpression: "500" }), household: HOUSEHOLD_UYU, userId: "user-1", account });

    expect(tx.amount).toBe(50_000n);
    expect(tx.fxSource).toBe("pending");
    expect(tx.fxRate).toBeNull();
    expect(tx.amountBase).toBeNull();
  });

  it("A3 — captura en otra moneda sin cotización: nunca reinterpreta el número tipeado", async () => {
    const account = await accountsRepo.create({
      householdId: HOUSEHOLD_UYU.id,
      ownerId: "user-1",
      name: "Cuenta ARS",
      kind: "wallet",
      institutionId: null,
      countryCode: "AR",
      currencyCode: "ARS",
      openingBalance: 0n,
      openingDate: "2026-07-01",
      creditLimit: null,
      statementDay: null,
      dueDay: null,
      interestRate: null,
      termMonths: null,
      includeInNetWorth: true,
      visibility: "household",
      color: null,
      icon: null,
      archivedAt: null,
      createdBy: "user-1",
    });

    // Se tipea "100" en USD (draft.currency), la cuenta es ARS, y no hay
    // ningún rate USD/ARS cargado (ni manual ni cache): antes de A3, esto
    // guardaba amount=10000 (100.00) reinterpretado como si ya fuera ARS.
    const tx = await saveDraftAsTransaction({
      draft: baseDraft({ amountExpression: "100", currency: "USD" }),
      household: HOUSEHOLD_UYU,
      userId: "user-1",
      account,
    });

    expect(tx.amount).toBe(0n); // nunca 10000n (el bug de A3)
    expect(tx.currencyCode).toBe("ARS");
    expect(tx.originalAmount).toBe(10_000n); // 100.00 USD, preservado tal cual se tipeó
    expect(tx.originalCurrency).toBe("USD");
    expect(tx.originalRate).toBeNull();
    expect((await accountsRepo.get(account.id))?.currentBalance).toBe(0n); // no corrompe el saldo
  });

  it("transferencia entre cuentas de la misma moneda", async () => {
    const from = await accountsRepo.create({
      householdId: HOUSEHOLD_UYU.id,
      ownerId: "user-1",
      name: "Origen",
      kind: "checking",
      institutionId: null,
      countryCode: "UY",
      currencyCode: "UYU",
      openingBalance: 200_000n,
      openingDate: "2026-07-01",
      creditLimit: null,
      statementDay: null,
      dueDay: null,
      interestRate: null,
      termMonths: null,
      includeInNetWorth: true,
      visibility: "household",
      color: null,
      icon: null,
      archivedAt: null,
      createdBy: "user-1",
    });
    const to = await accountsRepo.create({
      householdId: HOUSEHOLD_UYU.id,
      ownerId: "user-1",
      name: "Destino",
      kind: "savings",
      institutionId: null,
      countryCode: "UY",
      currencyCode: "UYU",
      openingBalance: 0n,
      openingDate: "2026-07-01",
      creditLimit: null,
      statementDay: null,
      dueDay: null,
      interestRate: null,
      termMonths: null,
      includeInNetWorth: true,
      visibility: "household",
      color: null,
      icon: null,
      archivedAt: null,
      createdBy: "user-1",
    });

    const tx = await saveDraftAsTransaction({
      draft: baseDraft({ kind: "transfer", amountExpression: "500", categoryId: null }),
      household: HOUSEHOLD_UYU,
      userId: "user-1",
      account: from,
      counterAccount: to,
    });

    expect(tx.kind).toBe("transfer");
    expect(tx.counterAmount).toBe(50_000n);
    expect((await accountsRepo.get(from.id))?.currentBalance).toBe(150_000n);
    expect((await accountsRepo.get(to.id))?.currentBalance).toBe(50_000n);
  });
});

/**
 * Gastar en la moneda del ticket con una cuenta en otra moneda: pagar 4.200
 * pesos uruguayos con una tarjeta emitida en dólares. El usuario tipea lo
 * que dice el ticket y la conversión la hace la app, dejando registrado lo
 * uno y lo otro (`CLAUDE.md` § "son dos conversiones, no una").
 */
describe("moneda de captura distinta a la de la cuenta", () => {
  // Misma base aislada por test que el bloque de `saveDraftAsTransaction`:
  // sin esto Dexie queda cerrada de la suite anterior.
  beforeEach(() => {
    resetDbForTests(`perze-test-capture-fx-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await getDb().delete();
  });

  async function usdAccount() {
    return accountsRepo.create({
      householdId: HOUSEHOLD_UYU.id,
      ownerId: "user-1",
      name: "Itau USD",
      kind: "savings",
      institutionId: null,
      countryCode: "UY",
      currencyCode: "USD",
      openingBalance: 100_000n,
      openingDate: "2026-07-01",
      creditLimit: null,
      statementDay: null,
      dueDay: null,
      interestRate: null,
      termMonths: null,
      includeInNetWorth: true,
      visibility: "household",
      color: null,
      icon: null,
      archivedAt: null,
      createdBy: "user-1",
    });
  }

  /** 1 UYU = 0,025 USD, o sea 1 USD = 40 UYU. */
  const UYU_PER_USD_40 = rateFromInteger(1) / 40n;
  const UYU_PER_USD_50 = rateFromInteger(1) / 50n;

  it("convierte a la moneda de la cuenta y preserva lo tipeado en original_*", async () => {
    const account = await usdAccount();
    await fxRepo.setManualOverride(HOUSEHOLD_UYU.id, "UYU", "USD", UYU_PER_USD_40);

    const tx = await saveDraftAsTransaction({
      draft: baseDraft({ amountExpression: "4200", currency: "UYU" }),
      household: HOUSEHOLD_UYU,
      userId: "user-1",
      account,
    });

    // `amount`/`currency_code` SIEMPRE en la moneda de la cuenta.
    expect(tx.currencyCode).toBe("USD");
    expect(tx.amount).toBe(10_500n);
    // Y lo que decía el ticket, intacto.
    expect(tx.originalAmount).toBe(420_000n);
    expect(tx.originalCurrency).toBe("UYU");
    expect(tx.originalRate).not.toBeNull();
  });

  it("una tasa tocada a mano le gana a la resuelta", async () => {
    const account = await usdAccount();
    await fxRepo.setManualOverride(HOUSEHOLD_UYU.id, "UYU", "USD", UYU_PER_USD_40);

    const tx = await saveDraftAsTransaction({
      draft: baseDraft({ amountExpression: "4200", currency: "UYU", captureFxRateOverride: UYU_PER_USD_50 }),
      household: HOUSEHOLD_UYU,
      userId: "user-1",
      account,
    });

    expect(tx.amount).toBe(8_400n);
    expect(tx.originalRate).toBe(UYU_PER_USD_50);
  });

  it("la tasa a mano vale incluso sin ninguna cotizacion disponible", async () => {
    // Sin `setManualOverride` no hay nada que resolver. Un rate que escribió
    // el usuario no es un 1 inventado, que es lo único que `needs_fx` prohíbe.
    const account = await usdAccount();

    const tx = await saveDraftAsTransaction({
      draft: baseDraft({ amountExpression: "4200", currency: "UYU", captureFxRateOverride: UYU_PER_USD_50 }),
      household: HOUSEHOLD_UYU,
      userId: "user-1",
      account,
    });

    expect(tx.amount).toBe(8_400n);
    expect(tx.originalAmount).toBe(420_000n);
    expect(tx.originalRate).toBe(UYU_PER_USD_50);
  });

  it("sin cotizacion y sin tasa a mano: guarda igual, sin reinterpretar el numero tipeado", async () => {
    const account = await usdAccount();

    const tx = await saveDraftAsTransaction({
      draft: baseDraft({ amountExpression: "4200", currency: "UYU" }),
      household: HOUSEHOLD_UYU,
      userId: "user-1",
      account,
    });

    // Lo que NO puede pasar: que 4.200 UYU se guarden como USD 4.200.
    expect(tx.amount).toBe(0n);
    expect(tx.originalAmount).toBe(420_000n);
    expect(tx.originalCurrency).toBe("UYU");
    expect(tx.originalRate).toBeNull();
  });
});

describe("computeExpenseDebitAmount", () => {
  const account = { id: "acc-1", currencyCode: "USD", currentBalance: 100_000n, kind: "savings" } as never;

  it("sin conversion, devuelve el monto tipeado", () => {
    expect(computeExpenseDebitAmount(baseDraft({ amountExpression: "50" }), account, null, "es-UY")).toBe(5_000n);
  });

  it("convierte a la moneda de la cuenta antes de compararlo contra el saldo", () => {
    // El bug que esto cubre: devolvía 420.000 (UYU) y el llamador lo
    // comparaba contra un saldo en USD, avisando "saldo insuficiente" sobre
    // una cuenta con plata de sobra.
    expect(computeExpenseDebitAmount(baseDraft({ amountExpression: "4200", currency: "UYU" }), account, rateFromInteger(1) / 40n, "es-UY")).toBe(10_500n);
  });

  it("sin rate devuelve null en vez de un numero comparable con el saldo", () => {
    expect(computeExpenseDebitAmount(baseDraft({ amountExpression: "4200", currency: "UYU" }), account, null, "es-UY")).toBeNull();
  });
});
