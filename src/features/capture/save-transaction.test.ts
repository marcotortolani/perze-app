import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "@/lib/db/client";
import { accountsRepo } from "@/lib/repos/accounts-repo";
import { fxRepo } from "@/lib/repos/fx-repo";
import { rateFromInteger } from "@/lib/fx/rate";
import type { HouseholdRow } from "@/lib/db/schema";
import type { CaptureDraft } from "@/stores/capture-draft-store";
import { hasNonZeroAmount, saveDraftAsTransaction } from "./save-transaction";

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
};

function baseDraft(overrides: Partial<CaptureDraft> = {}): CaptureDraft {
  return {
    kind: "expense",
    amountExpression: "1250",
    currency: "",
    accountId: null,
    counterAccountId: null,
    counterFxRateOverride: null,
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
