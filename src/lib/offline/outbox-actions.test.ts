import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, resetDbForTests } from "../db/client";
import type { AccountRow, TransactionRow } from "../db/schema";
import { accountsRepo } from "../repos/accounts-repo";
import { transactionsRepo } from "../repos/transactions-repo";
import { newId } from "../repos/ids";
import { discardOutboxEntry, undoDiscardOutboxEntry } from "./outbox-actions";

// El refetch puntual de `restoreServerTransaction` habla con Supabase — el
// fake devuelve la fila que cada test declare en `mocks.serverRow` (o null,
// "no existe en el servidor"). `fetchCount` permite afirmar que un insert
// descartado NO gasta un round-trip.
const mocks = vi.hoisted(() => ({ serverRow: null as Record<string, unknown> | null, fetchCount: 0 }));
vi.mock("../supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            mocks.fetchCount++;
            return { data: mocks.serverRow, error: null };
          },
        }),
      }),
    }),
  }),
}));

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

/** La fila como la devolvería el servidor (snake_case, montos `::text`). */
function rawFromTx(tx: TransactionRow, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: tx.id,
    household_id: tx.householdId,
    created_by: tx.createdBy,
    kind: tx.kind,
    occurred_at: tx.occurredAt,
    account_id: tx.accountId,
    counter_account_id: tx.counterAccountId,
    amount: tx.amount.toString(),
    currency_code: tx.currencyCode,
    original_amount: null,
    original_currency: null,
    original_rate: null,
    fx_rate: null,
    fx_source: tx.fxSource,
    fx_provider: null,
    fx_quote_kind: null,
    fx_resolved_at: null,
    amount_base: null,
    counter_amount: null,
    counter_currency_code: null,
    counter_fx_rate: null,
    category_id: tx.categoryId,
    payee_id: tx.payeeId,
    note: tx.note,
    attachments: [],
    location: null,
    status: tx.status,
    visibility: tx.visibility,
    recurring_id: null,
    recurring_occurrence_date: null,
    installment_group_id: null,
    installment_number: null,
    installment_total: null,
    created_at: tx.createdAt,
    updated_at: tx.updatedAt,
    deleted_at: null,
    client_rev: tx.clientRev,
    source: tx.source,
    trade_id: null,
    ...overrides,
  };
}

async function soleOutboxEntry() {
  const entries = await getDb().outbox.toArray();
  expect(entries).toHaveLength(1);
  return entries[0]!;
}

describe("discardOutboxEntry", () => {
  beforeEach(() => {
    resetDbForTests(`perze-test-outbox-actions-${crypto.randomUUID()}`);
    mocks.serverRow = null;
    mocks.fetchCount = 0;
  });

  afterEach(async () => {
    await getDb().delete();
  });

  it("insert dead: revierte el saldo, borra la fila local y no gasta un round-trip al servidor", async () => {
    const account = await accountsRepo.create(baseAccount({ openingBalance: 100_000n }));
    await getDb().outbox.clear();
    const tx = await transactionsRepo.create(baseTx({ kind: "expense", accountId: account.id, amount: 10_000n }));
    const entry = await soleOutboxEntry();
    await getDb().outbox.update(entry.id!, { status: "dead" });

    await discardOutboxEntry({ ...entry, status: "dead" });

    expect(await getDb().transactions.get(tx.id)).toBeUndefined();
    expect((await accountsRepo.get(account.id))?.currentBalance).toBe(100_000n);
    expect(await getDb().outbox.count()).toBe(0);
    expect(mocks.fetchCount).toBe(0);
  });

  it("update dead con fila en el servidor: re-adopta la versión remota en vez de hacerla desaparecer", async () => {
    // El caso que el watermark no cubre: la fila remota no cambió desde el
    // último pull (su `updated_at` quedó debajo del cursor), así que si el
    // descarte solo borrara la fila local, ningún pull la traería de vuelta.
    const account = await accountsRepo.create(baseAccount({ openingBalance: 100_000n }));
    const tx = await transactionsRepo.create(baseTx({ kind: "expense", accountId: account.id, amount: 10_000n }));
    mocks.serverRow = rawFromTx(tx); // el servidor conoce la versión original: 10.000
    await getDb().outbox.clear();

    await transactionsRepo.update(tx.id, { amount: 25_000n }); // edición local que va a quedar atascada
    expect((await accountsRepo.get(account.id))?.currentBalance).toBe(75_000n);
    const entry = await soleOutboxEntry();
    await getDb().outbox.update(entry.id!, { status: "dead" });

    await discardOutboxEntry({ ...entry, status: "dead" });

    const restored = await getDb().transactions.get(tx.id);
    expect(restored?.amount).toBe(10_000n);
    expect(restored?.syncState).toBe("ok");
    expect((await accountsRepo.get(account.id))?.currentBalance).toBe(90_000n);
    expect(await getDb().outbox.count()).toBe(0);
    expect(mocks.fetchCount).toBe(1);
  });

  it("update dead cuya fila ya no existe en el servidor: queda borrada, sin resucitar nada", async () => {
    const account = await accountsRepo.create(baseAccount({ openingBalance: 100_000n }));
    const tx = await transactionsRepo.create(baseTx({ kind: "expense", accountId: account.id, amount: 10_000n }));
    mocks.serverRow = null; // borrada remotamente (hard delete / nunca existió)
    await getDb().outbox.clear();

    await transactionsRepo.update(tx.id, { amount: 25_000n });
    const entry = await soleOutboxEntry();
    await getDb().outbox.update(entry.id!, { status: "dead" });

    await discardOutboxEntry({ ...entry, status: "dead" });

    expect(await getDb().transactions.get(tx.id)).toBeUndefined();
    expect((await accountsRepo.get(account.id))?.currentBalance).toBe(100_000n);
    expect(await getDb().outbox.count()).toBe(0);
  });

  it("una entrada conflict borra también su fila espejo de db.conflicts", async () => {
    // Sin esto, la card de resolución sobrevive al descarte y su `keepLocal`
    // resucitaría la mutación recién descartada.
    const account = await accountsRepo.create(baseAccount({ openingBalance: 100_000n }));
    const tx = await transactionsRepo.create(baseTx({ kind: "expense", accountId: account.id, amount: 10_000n }));
    await getDb().outbox.clear();

    await transactionsRepo.update(tx.id, { amount: 25_000n });
    mocks.serverRow = rawFromTx(tx);
    const entry = await soleOutboxEntry();
    await getDb().outbox.update(entry.id!, { status: "conflict" });
    await getDb().conflicts.add({
      id: newId(),
      table: "transactions",
      entityId: tx.id,
      localPayload: {},
      serverPayload: {},
      detectedAt: "2026-08-08T12:00:00.000Z",
    });

    await discardOutboxEntry({ ...entry, status: "conflict" });

    expect(await getDb().conflicts.count()).toBe(0);
    expect(await getDb().outbox.count()).toBe(0);
    expect((await getDb().transactions.get(tx.id))?.amount).toBe(10_000n);
  });

  it("no descarta una entrada que el sync-worker ya tomó (syncing)", async () => {
    const account = await accountsRepo.create(baseAccount({ openingBalance: 100_000n }));
    await getDb().outbox.clear();
    const tx = await transactionsRepo.create(baseTx({ kind: "expense", accountId: account.id, amount: 10_000n }));
    const entry = await soleOutboxEntry();
    await getDb().outbox.update(entry.id!, { status: "syncing" });

    // El usuario tapea sobre la fila todavía renderizada como "failed".
    expect(await discardOutboxEntry({ ...entry, status: "failed" })).toBeNull();

    expect(await getDb().outbox.count()).toBe(1);
    expect(await getDb().transactions.get(tx.id)).toBeDefined();
  });

  it("descarta también las entradas hermanas de la misma transacción", async () => {
    // Una hermana pending que sobreviviera re-empujaría al servidor el
    // estado recién descartado en el próximo drain.
    const account = await accountsRepo.create(baseAccount({ openingBalance: 100_000n }));
    await getDb().outbox.clear();
    const tx = await transactionsRepo.create(baseTx({ kind: "expense", accountId: account.id, amount: 10_000n }));
    mocks.serverRow = rawFromTx(tx);
    await transactionsRepo.update(tx.id, { amount: 25_000n });
    const entries = await getDb().outbox.toArray();
    const updateEntry = entries.find((e) => e.op === "update")!;
    await getDb().outbox.update(updateEntry.id!, { status: "dead" });

    const snapshot = await discardOutboxEntry({ ...updateEntry, status: "dead" });

    expect(snapshot?.entries).toHaveLength(2);
    expect(await getDb().outbox.count()).toBe(0);
    expect((await getDb().transactions.get(tx.id))?.amount).toBe(10_000n);
    expect((await accountsRepo.get(account.id))?.currentBalance).toBe(90_000n);
  });

  it("deshacer repone la fila local, su efecto de saldo y las entradas del outbox", async () => {
    const account = await accountsRepo.create(baseAccount({ openingBalance: 100_000n }));
    const tx = await transactionsRepo.create(baseTx({ kind: "expense", accountId: account.id, amount: 10_000n }));
    mocks.serverRow = rawFromTx(tx);
    await getDb().outbox.clear();
    await transactionsRepo.update(tx.id, { amount: 25_000n });
    const entry = await soleOutboxEntry();
    await getDb().outbox.update(entry.id!, { status: "dead" });

    const snapshot = await discardOutboxEntry({ ...entry, status: "dead" });
    expect(snapshot).not.toBeNull();

    await undoDiscardOutboxEntry(snapshot!);

    expect((await getDb().transactions.get(tx.id))?.amount).toBe(25_000n);
    expect((await accountsRepo.get(account.id))?.currentBalance).toBe(75_000n);
    const restored = await getDb().outbox.toArray();
    expect(restored).toHaveLength(1);
    expect(restored[0]?.status).toBe("dead");
  });
});
