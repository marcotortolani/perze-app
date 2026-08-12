import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "../db/client";
import type { AccountRow, TransactionRow } from "../db/schema";
import { outbox } from "../offline/outbox";
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
    originalAmount: null,
    originalCurrency: null,
    originalRate: null,
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

  describe("BASE-05 — cada escritura encola en el outbox", () => {
    it("create encola un insert", async () => {
      const account = await accountsRepo.create(baseAccount());
      const before = await outbox.count();
      const tx = await transactionsRepo.create(baseTx({ accountId: account.id, amount: 1000n }));

      const pending = await outbox.listPending();
      const own = pending.filter((e) => e.entityId === tx.id);
      expect(own).toHaveLength(1);
      expect(own[0]?.table).toBe("transactions");
      expect(own[0]?.op).toBe("insert");
      expect(await outbox.count()).toBeGreaterThan(before);
    });

    it("update, softDelete y restore encolan un update cada uno, con clientRev creciente", async () => {
      const account = await accountsRepo.create(baseAccount());
      const tx = await transactionsRepo.create(baseTx({ accountId: account.id, amount: 1000n }));
      await outbox.markSynced((await outbox.listPending()).find((e) => e.entityId === tx.id)!.id!);

      await transactionsRepo.update(tx.id, { note: "actualizado" });
      await transactionsRepo.softDelete(tx.id);
      await transactionsRepo.restore(tx.id);

      const entries = (await outbox.listPending()).filter((e) => e.entityId === tx.id);
      expect(entries).toHaveLength(3);
      expect(entries.every((e) => e.op === "update")).toBe(true);
      expect(entries.map((e) => e.clientRev)).toEqual([2, 3, 4]);
    });
  });

  describe("cuenta fantasma (purge incompleto — v0.30.25)", () => {
    it("softDelete no tira si la cuenta ya no existe: no hay saldo vivo que corregir", async () => {
      const account = await accountsRepo.create(baseAccount({ openingBalance: 100_000n }));
      const tx = await transactionsRepo.create(baseTx({ kind: "expense", accountId: account.id, amount: 10_000n }));
      const { getDb } = await import("../db/client");
      await getDb().accounts.delete(account.id);

      await expect(transactionsRepo.softDelete(tx.id)).resolves.toBeUndefined();
      expect((await transactionsRepo.get(tx.id))?.deletedAt).not.toBeNull();
    });

    it("discardLocal no tira si la cuenta ya no existe, y borra la fila de verdad", async () => {
      const account = await accountsRepo.create(baseAccount({ openingBalance: 100_000n }));
      const tx = await transactionsRepo.create(baseTx({ kind: "expense", accountId: account.id, amount: 10_000n }));
      const { getDb } = await import("../db/client");
      await getDb().accounts.delete(account.id);

      await expect(transactionsRepo.discardLocal(tx.id)).resolves.toBeUndefined();
      expect(await transactionsRepo.get(tx.id)).toBeNull();
    });

    // create/update siguen tirando a propósito: ahí una cuenta ausente es
    // un bug real (el picker solo ofrece cuentas vivas), no un ghost
    // esperable — no hay que silenciarlo con la misma tolerancia.
    it("create sigue tirando si la cuenta no existe", async () => {
      await expect(transactionsRepo.create(baseTx({ kind: "expense", accountId: "cuenta-inexistente", amount: 1_000n }))).rejects.toThrow();
    });
  });
});

describe("transactionsRepo.yearRange — para /transactions/history", () => {
  beforeEach(() => {
    resetDbForTests(`perze-test-yearrange-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    const { getDb } = await import("../db/client");
    await getDb().delete();
  });

  it("household sin movimientos: null", async () => {
    expect(await transactionsRepo.yearRange(HOUSEHOLD)).toBeNull();
  });

  it("un solo movimiento: min y max son el mismo año", async () => {
    const account = await accountsRepo.create(baseAccount());
    await transactionsRepo.create(baseTx({ accountId: account.id, occurredAt: "2026-03-10T12:00:00.000Z" }));

    expect(await transactionsRepo.yearRange(HOUSEHOLD)).toEqual({ minYear: 2026, maxYear: 2026 });
  });

  it("varios años: min y max son el más viejo y el más nuevo, sin importar el orden de creación", async () => {
    const account = await accountsRepo.create(baseAccount());
    await transactionsRepo.create(baseTx({ accountId: account.id, occurredAt: "2026-07-20T12:00:00.000Z" }));
    await transactionsRepo.create(baseTx({ accountId: account.id, occurredAt: "2023-01-05T12:00:00.000Z" }));
    await transactionsRepo.create(baseTx({ accountId: account.id, occurredAt: "2025-11-30T12:00:00.000Z" }));

    expect(await transactionsRepo.yearRange(HOUSEHOLD)).toEqual({ minYear: 2023, maxYear: 2026 });
  });

  it("no se confunde entre households distintos", async () => {
    const account = await accountsRepo.create(baseAccount());
    await transactionsRepo.create(baseTx({ accountId: account.id, occurredAt: "2026-01-01T12:00:00.000Z" }));
    const otherAccount = await accountsRepo.create(baseAccount({ householdId: "hh-2" }));
    await transactionsRepo.create(baseTx({ householdId: "hh-2", accountId: otherAccount.id, occurredAt: "2020-01-01T12:00:00.000Z" }));

    expect(await transactionsRepo.yearRange(HOUSEHOLD)).toEqual({ minYear: 2026, maxYear: 2026 });
  });
});
