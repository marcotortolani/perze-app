import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "../db/client";
import type { AccountRow, TransactionRow } from "../db/schema";
import { accountsRepo } from "./accounts-repo";
import { transactionsRepo } from "./transactions-repo";

const HOUSEHOLD = "hh-1";

function baseAccount(overrides: Partial<AccountRow> = {}): Parameters<typeof accountsRepo.create>[0] {
  return {
    householdId: HOUSEHOLD,
    ownerId: "user-1",
    name: "Cuenta",
    kind: "checking",
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
    ...overrides,
  };
}

function baseTx(overrides: Partial<TransactionRow>): Parameters<typeof transactionsRepo.create>[0] {
  return {
    householdId: HOUSEHOLD,
    createdBy: "user-1",
    kind: "expense",
    occurredAt: "2026-07-20T12:00:00.000Z",
    accountId: "",
    counterAccountId: null,
    amount: 0n,
    currencyCode: "UYU",
    fxRate: null,
    fxSource: "identity",
    fxProvider: null,
    fxQuoteKind: null,
    fxResolvedAt: null,
    amountBase: null,
    counterAmount: null,
    counterCurrencyCode: null,
    counterFxRate: null,
    categoryId: null,
    payeeId: null,
    note: null,
    attachments: [],
    location: null,
    status: "cleared",
    visibility: "household",
    recurringId: null,
    installmentGroupId: null,
    installmentNumber: null,
    installmentTotal: null,
    source: "manual",
    ...overrides,
  };
}

describe("transactionsRepo — mantiene el saldo de cuenta sin trigger de Postgres", () => {
  beforeEach(() => {
    resetDbForTests(`perze-test-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    const { getDb } = await import("../db/client");
    await getDb().delete();
  });

  it("un gasto baja el saldo de la cuenta", async () => {
    const account = await accountsRepo.create(baseAccount({ openingBalance: 100_000n }));
    await transactionsRepo.create(baseTx({ kind: "expense", accountId: account.id, amount: 10_000n }));

    const updated = await accountsRepo.get(account.id);
    expect(updated?.currentBalance).toBe(90_000n);
  });

  it("un ingreso sube el saldo", async () => {
    const account = await accountsRepo.create(baseAccount({ openingBalance: 100_000n }));
    await transactionsRepo.create(baseTx({ kind: "income", accountId: account.id, amount: 20_000n }));

    const updated = await accountsRepo.get(account.id);
    expect(updated?.currentBalance).toBe(120_000n);
  });

  it("una transferencia mueve el saldo entre dos cuentas", async () => {
    const from = await accountsRepo.create(baseAccount({ name: "Origen", openingBalance: 100_000n }));
    const to = await accountsRepo.create(baseAccount({ name: "Destino", openingBalance: 0n }));

    await transactionsRepo.create(
      baseTx({ kind: "transfer", accountId: from.id, counterAccountId: to.id, amount: 30_000n })
    );

    expect((await accountsRepo.get(from.id))?.currentBalance).toBe(70_000n);
    expect((await accountsRepo.get(to.id))?.currentBalance).toBe(30_000n);
  });

  it("editar el monto ajusta el saldo por el delta, no lo duplica", async () => {
    const account = await accountsRepo.create(baseAccount({ openingBalance: 100_000n }));
    const tx = await transactionsRepo.create(
      baseTx({ kind: "expense", accountId: account.id, amount: 10_000n })
    );

    await transactionsRepo.update(tx.id, { amount: 25_000n });

    expect((await accountsRepo.get(account.id))?.currentBalance).toBe(75_000n);
  });

  it("borrar (soft delete) revierte el efecto en el saldo", async () => {
    const account = await accountsRepo.create(baseAccount({ openingBalance: 100_000n }));
    const tx = await transactionsRepo.create(
      baseTx({ kind: "expense", accountId: account.id, amount: 10_000n })
    );

    await transactionsRepo.softDelete(tx.id);
    expect((await accountsRepo.get(account.id))?.currentBalance).toBe(100_000n);

    const deleted = await transactionsRepo.get(tx.id);
    expect(deleted?.deletedAt).not.toBeNull();
  });

  it("restore (deshacer el borrado) reaplica el efecto original", async () => {
    const account = await accountsRepo.create(baseAccount({ openingBalance: 100_000n }));
    const tx = await transactionsRepo.create(
      baseTx({ kind: "expense", accountId: account.id, amount: 10_000n })
    );

    await transactionsRepo.softDelete(tx.id);
    await transactionsRepo.restore(tx.id);

    expect((await accountsRepo.get(account.id))?.currentBalance).toBe(90_000n);
  });

  it("needs_fx: guarda igual, sin conversión, y aparece en listNeedingFx", async () => {
    const account = await accountsRepo.create(baseAccount({ currencyCode: "ARS", openingBalance: 0n }));
    await transactionsRepo.create(
      baseTx({
        kind: "expense",
        accountId: account.id,
        amount: 5_000n,
        currencyCode: "USD",
        fxRate: null,
        fxSource: "pending",
        amountBase: null,
      })
    );

    // el saldo de la cuenta no se afecta por needs_fx: está en su propia moneda
    const pending = await transactionsRepo.listNeedingFx(HOUSEHOLD);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.fxSource).toBe("pending");
  });
});
