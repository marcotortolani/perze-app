import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, resetDbForTests } from "../db/client";
import type { AccountRow, TagRow, TransactionRow } from "../db/schema";
import { outbox } from "./outbox";

/**
 * AC-14 (`docs/plan-sync-incremental.md`) — doble mínimo de Supabase, mismo
 * espíritu que `sync-worker.test.ts`: un store en memoria por tabla, con
 * los únicos métodos de query builder que `pull.ts` de verdad usa
 * (`eq`/`is`/`gt`/`or`/`order`/`range`/`maybeSingle`). El `.or()` acá NO es
 * un parser genérico de PostgREST — solo entiende el patrón de keyset
 * exacto que `pull.ts` genera (`updated_at.gt.A,and(updated_at.eq.A,id.gt.B)`),
 * que es lo único que este doble necesita reconocer.
 */
function parseKeysetOr(expr: string): (row: Record<string, unknown>) => boolean {
  const m = /^updated_at\.gt\.(.+?),and\(updated_at\.eq\.\1,id\.gt\.(.+?)\)$/.exec(expr);
  if (!m) throw new Error(`doble no reconoce este .or(): ${expr}`);
  const [, a, b] = m as unknown as [string, string, string];
  return (row) => (row.updated_at as string) > a || ((row.updated_at as string) === a && (row.id as string) > b);
}

function makeFakeSupabase(tables: Record<string, Record<string, unknown>[]>) {
  function from(tableName: string) {
    const rows = tables[tableName] ?? [];
    const filters: Array<(r: Record<string, unknown>) => boolean> = [];
    const orders: Array<{ col: string; asc: boolean }> = [];
    let limitN: number | null = null;

    function resolve(): { data: Record<string, unknown>[]; error: null } {
      let result = rows.filter((r) => filters.every((f) => f(r)));
      for (const { col, asc } of [...orders].reverse()) {
        result = [...result].sort((a, b) => {
          const av = String(a[col]);
          const bv = String(b[col]);
          return asc ? av.localeCompare(bv) : bv.localeCompare(av);
        });
      }
      if (limitN !== null) result = result.slice(0, limitN);
      return { data: result, error: null };
    }

    const builder = {
      select: () => builder,
      eq: (col: string, val: unknown) => {
        filters.push((r) => r[col] === val);
        return builder;
      },
      is: (col: string, val: unknown) => {
        filters.push((r) => r[col] === val);
        return builder;
      },
      gt: (col: string, val: unknown) => {
        filters.push((r) => (r[col] as string) > (val as string));
        return builder;
      },
      or: (expr: string) => {
        filters.push(parseKeysetOr(expr));
        return builder;
      },
      order: (col: string, opts?: { ascending?: boolean }) => {
        orders.push({ col, asc: opts?.ascending !== false });
        return builder;
      },
      limit: (n: number) => {
        limitN = n;
        return builder;
      },
      range: async (from: number, to: number) => {
        const { data } = resolve();
        return { data: data.slice(from, to + 1), error: null };
      },
      maybeSingle: async () => {
        const { data } = resolve();
        return { data: data[0] ?? null, error: null };
      },
      // `pullTransactions` (`pull.ts`) no llama a `.range()` — pagina por
      // keyset con `.limit()` y awaitea el builder directo, igual que el
      // query builder real de supabase-js (que es PromiseLike). Sin esto,
      // `await base.gt(...)` resuelve al objeto builder tal cual (no es una
      // promesa), nunca a `{ data, error }`.
      then: (onFulfilled: (value: { data: Record<string, unknown>[]; error: null }) => unknown) => {
        return Promise.resolve(resolve()).then(onFulfilled);
      },
    };
    return builder;
  }
  return { from } as unknown as ReturnType<typeof import("@supabase/supabase-js").createClient>;
}

vi.mock("../supabase/client", () => ({ createClient: () => currentFakeSupabase }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- reasignado por cada test antes de llamar pullFromRemote
let currentFakeSupabase: any;

const { pullFromRemote } = await import("./pull");

const HOUSEHOLD_ID = "hh-1";

function rawTx(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: "tx-1",
    household_id: HOUSEHOLD_ID,
    created_by: "u1",
    kind: "expense",
    occurred_at: "2026-07-01T12:00:00.000Z",
    account_id: "acc-1",
    counter_account_id: null,
    amount: "-1000",
    currency_code: "UYU",
    original_amount: null,
    original_currency: null,
    original_rate: null,
    fx_rate: "1000000000000",
    fx_source: "identity",
    fx_provider: null,
    fx_quote_kind: null,
    fx_resolved_at: null,
    amount_base: "-1000",
    counter_amount: null,
    counter_currency_code: null,
    counter_fx_rate: null,
    category_id: null,
    payee_id: null,
    note: null,
    attachments: [],
    location: null,
    status: "cleared",
    visibility: "household",
    recurring_id: null,
    installment_group_id: null,
    installment_number: null,
    installment_total: null,
    created_at: "2026-07-01T12:00:00.000Z",
    updated_at: "2026-07-01T12:00:00.000Z",
    deleted_at: null,
    client_rev: 1,
    source: "manual",
    ...overrides,
  };
}

function localTx(id: string, updatedAt: string, note: string): TransactionRow {
  return {
    id,
    householdId: HOUSEHOLD_ID,
    createdBy: "u1",
    kind: "expense",
    occurredAt: updatedAt,
    accountId: "acc-1",
    counterAccountId: null,
    amount: -1000n,
    currencyCode: "UYU",
    originalAmount: null,
    originalCurrency: null,
    originalRate: null,
    fxRate: 1_000_000_000_000n,
    fxSource: "identity",
    fxProvider: null,
    fxQuoteKind: null,
    fxResolvedAt: null,
    amountBase: -1000n,
    counterAmount: null,
    counterCurrencyCode: null,
    counterFxRate: null,
    categoryId: null,
    payeeId: null,
    note,
    attachments: [],
    location: null,
    status: "cleared",
    visibility: "household",
    recurringId: null,
    recurringOccurrenceDate: null,
    installmentGroupId: null,
    installmentNumber: null,
    installmentTotal: null,
    tradeId: null,
    createdAt: updatedAt,
    updatedAt,
    deletedAt: null,
    clientRev: 1,
    source: "manual",
    syncState: "ok",
    syncError: null,
  };
}

function localAccount(overrides: Partial<AccountRow> = {}): AccountRow {
  return {
    id: "acc-1",
    householdId: HOUSEHOLD_ID,
    ownerId: "u1",
    name: "Efectivo",
    kind: "cash",
    institutionId: null,
    countryCode: "UY",
    currencyCode: "UYU",
    openingBalance: 0n,
    openingDate: "2026-01-01",
    currentBalance: 10_000n,
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
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    clientRev: 1,
    ...overrides,
  };
}

function localTag(id: string, name: string): TagRow {
  return { id, householdId: HOUSEHOLD_ID, name, color: null, clientRev: 1 };
}

describe("pullFromRemote", () => {
  beforeEach(() => {
    resetDbForTests(`perze-test-pull-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await getDb().delete();
  });

  it("baja transactions nuevas y avanza el watermark con el solape de 5s", async () => {
    currentFakeSupabase = makeFakeSupabase({
      households: [],
      household_members: [],
      accounts: [],
      categories: [],
      tags: [],
      payees: [],
      budgets: [],
      goals: [],
      recurring_rules: [],
      rules: [],
      transactions: [rawTx({ id: "tx-1", updated_at: "2026-07-01T12:00:00.000Z" }), rawTx({ id: "tx-2", updated_at: "2026-07-01T12:05:00.000Z" })],
    });

    const result = await pullFromRemote(HOUSEHOLD_ID);

    expect(result.transactions).toBe(2);
    const rows = await getDb().transactions.toArray();
    expect(rows.map((r) => r.id).sort()).toEqual(["tx-1", "tx-2"]);

    const watermark = (await getDb().meta.get(`pullWatermark:${HOUSEHOLD_ID}`))?.value as string;
    // max(updated_at) - 5s: 12:05:00 - 5s = 12:04:55.
    expect(watermark).toBe("2026-07-01T12:04:55.000Z");
  });

  it("un segundo pull no pierde una fila vieja fuera de la ventana de solape, y sí trae la nueva", async () => {
    currentFakeSupabase = makeFakeSupabase({
      households: [],
      household_members: [],
      accounts: [],
      categories: [],
      tags: [],
      payees: [],
      budgets: [],
      goals: [],
      recurring_rules: [],
      rules: [],
      transactions: [rawTx({ id: "tx-1", updated_at: "2026-07-01T12:00:00.000Z" })],
    });
    await pullFromRemote(HOUSEHOLD_ID);
    expect((await getDb().transactions.toArray()).map((r) => r.id)).toEqual(["tx-1"]);

    // Nueva fila del lado del servidor. El watermark quedó en 11:59:55 (5s
    // de solape), así que este segundo pull vuelve a pedir tx-1 también —
    // a propósito (§ 3 del plan): el re-download es idempotente vía
    // `bulkPut`, y es el precio de no perder una fila por skew de reloj.
    currentFakeSupabase = makeFakeSupabase({
      households: [],
      household_members: [],
      accounts: [],
      categories: [],
      tags: [],
      payees: [],
      budgets: [],
      goals: [],
      recurring_rules: [],
      rules: [],
      transactions: [rawTx({ id: "tx-1", updated_at: "2026-07-01T12:00:00.000Z" }), rawTx({ id: "tx-2", updated_at: "2026-07-01T13:00:00.000Z" })],
    });

    await pullFromRemote(HOUSEHOLD_ID);
    expect((await getDb().transactions.toArray()).map((r) => r.id).sort()).toEqual(["tx-1", "tx-2"]);
  });

  it("regla de merge: una transaction con entrada en el outbox no se pisa, y el watermark no avanza más allá de ella", async () => {
    await getDb().transactions.add(localTx("tx-1", "2026-07-01T12:00:00.000Z", "mi nota local sin subir"));
    await outbox.enqueue({ table: "transactions", op: "update", entityId: "tx-1", payload: {}, clientRev: 2 });

    currentFakeSupabase = makeFakeSupabase({
      households: [],
      household_members: [],
      accounts: [],
      categories: [],
      tags: [],
      payees: [],
      budgets: [],
      goals: [],
      recurring_rules: [],
      rules: [],
      transactions: [rawTx({ id: "tx-1", updated_at: "2026-07-01T12:00:00.000Z", note: "la del servidor" })],
    });

    const result = await pullFromRemote(HOUSEHOLD_ID);
    expect(result.transactions).toBe(0); // se vio, pero no se contó como aplicada

    const local = await getDb().transactions.get("tx-1");
    expect(local?.note).toBe("mi nota local sin subir"); // NO se pisó

    // El watermark no avanzó (0 - 5s por debajo del epoch se trunca a la
    // misma fila): el próximo pull la vuelve a pedir.
    const watermark = (await getDb().meta.get(`pullWatermark:${HOUSEHOLD_ID}`))?.value as string;
    expect(new Date(watermark).getTime()).toBeLessThan(new Date("2026-07-01T12:00:00.000Z").getTime());
  });

  it("una vez que el outbox se vacía, el próximo pull sí aplica la fila que antes estaba bloqueada", async () => {
    await getDb().transactions.add(localTx("tx-1", "2026-07-01T12:00:00.000Z", "vieja"));
    const entryId = await outbox.enqueue({ table: "transactions", op: "update", entityId: "tx-1", payload: {}, clientRev: 2 });

    currentFakeSupabase = makeFakeSupabase({
      households: [],
      household_members: [],
      accounts: [],
      categories: [],
      tags: [],
      payees: [],
      budgets: [],
      goals: [],
      recurring_rules: [],
      rules: [],
      transactions: [rawTx({ id: "tx-1", updated_at: "2026-07-01T12:00:00.000Z", note: "consolidada por el servidor" })],
    });

    await pullFromRemote(HOUSEHOLD_ID);
    expect((await getDb().transactions.get("tx-1"))?.note).toBe("vieja");

    await outbox.markSynced(entryId); // el push la consolidó — sale de la cola

    await pullFromRemote(HOUSEHOLD_ID);
    expect((await getDb().transactions.get("tx-1"))?.note).toBe("consolidada por el servidor");
  });

  it("poda tags que ya no vienen del refresh completo, salvo que tengan una entrada de outbox en camino", async () => {
    await getDb().tags.bulkAdd([localTag("tag-borrada", "vieja"), localTag("tag-pendiente", "en camino"), localTag("tag-viva", "sigue")]);
    await outbox.enqueue({ table: "tags", op: "insert", entityId: "tag-pendiente", payload: {}, clientRev: 1 });

    currentFakeSupabase = makeFakeSupabase({
      households: [],
      household_members: [],
      accounts: [],
      categories: [],
      tags: [{ id: "tag-viva", household_id: HOUSEHOLD_ID, name: "sigue", color: null, client_rev: 1 }],
      payees: [],
      budgets: [],
      goals: [],
      recurring_rules: [],
      rules: [],
      transactions: [],
    });

    await pullFromRemote(HOUSEHOLD_ID);

    const localIds = (await getDb().tags.toArray()).map((t) => t.id).sort();
    // "tag-borrada" no vino del servidor y no tiene outbox → se poda.
    // "tag-pendiente" no vino del servidor pero SÍ tiene outbox → sobrevive.
    expect(localIds).toEqual(["tag-pendiente", "tag-viva"]);
  });

  it("excepción de accounts.currentBalance: con transactions pendientes en el outbox, el saldo local no se pisa", async () => {
    await getDb().accounts.add(localAccount({ currentBalance: 5_000n }));
    await outbox.enqueue({ table: "transactions", op: "insert", entityId: "tx-nueva", payload: { accountId: "acc-1" }, clientRev: 1 });

    currentFakeSupabase = makeFakeSupabase({
      households: [],
      household_members: [],
      accounts: [
        {
          id: "acc-1",
          household_id: HOUSEHOLD_ID,
          owner_id: "u1",
          name: "Efectivo",
          kind: "cash",
          institution_id: null,
          country_code: "UY",
          currency_code: "UYU",
          opening_balance: "0",
          opening_date: "2026-01-01",
          current_balance: "999999", // lo que el servidor cree que vale SIN la transaction todavía en vuelo
          credit_limit: null,
          statement_day: null,
          due_day: null,
          interest_rate: null,
          term_months: null,
          include_in_net_worth: true,
          visibility: "household",
          color: null,
          icon: null,
          sort_order: 0,
          archived_at: null,
          created_by: "u1",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-02T00:00:00.000Z",
          deleted_at: null,
          client_rev: 1,
        },
      ],
      categories: [],
      tags: [],
      payees: [],
      budgets: [],
      goals: [],
      recurring_rules: [],
      rules: [],
      transactions: [],
    });

    await pullFromRemote(HOUSEHOLD_ID);
    const local = await getDb().accounts.get("acc-1");
    expect(local?.currentBalance).toBe(5_000n); // preservado, no 999999n

    // Se resuelve el outbox de transactions — el próximo pull SÍ actualiza el saldo.
    const [entry] = await outbox.listAll();
    await outbox.markSynced(entry!.id!);
    await pullFromRemote(HOUSEHOLD_ID);
    expect((await getDb().accounts.get("acc-1"))?.currentBalance).toBe(999_999n);
  });

  it("dos dispositivos: lo que A empuja al servidor, B lo ve en su próximo pull (sin outbox propio de por medio)", async () => {
    // El "servidor" es el mismo store en memoria que comparten los dos pulls.
    const serverTransactions = [rawTx({ id: "tx-de-a", updated_at: "2026-07-05T09:00:00.000Z", note: "cargado desde el dispositivo A" })];
    currentFakeSupabase = makeFakeSupabase({
      households: [],
      household_members: [],
      accounts: [],
      categories: [],
      tags: [],
      payees: [],
      budgets: [],
      goals: [],
      recurring_rules: [],
      rules: [],
      transactions: serverTransactions,
    });

    // Dispositivo B nunca escribió nada — su outbox está vacío por definición.
    expect(await outbox.count()).toBe(0);

    const result = await pullFromRemote(HOUSEHOLD_ID);

    expect(result.transactions).toBe(1);
    const seenByB = await getDb().transactions.get("tx-de-a");
    expect(seenByB?.note).toBe("cargado desde el dispositivo A");
  });
});
