import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDb, resetDbForTests } from "../db/client";
import { outbox } from "./outbox";
import { drainOutbox } from "./sync-worker";

/**
 * Doble de Supabase mínimo: registra cada llamada a `.from(table)` y deja
 * que el test controle si `upsert`/`update`/`delete` fallan, sin pegarle a
 * una red real — BASE-05 no puede probarse end-to-end sin sesión (C7,
 * pendiente), así que esto es lo que sí se puede verificar hoy: el
 * enrutamiento por tabla, la traducción camelCase→snake_case, y que un
 * error en una fila no frena las demás.
 */
function fakeSupabase(
  opts: { failTables?: Set<string>; postgrestErrorTables?: Set<string>; duplicateTables?: Set<string>; serverRowsById?: Record<string, Record<string, unknown>> } = {}
) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const shouldFail = (table: string) => opts.failTables?.has(table) ?? false;
  // Un `PostgrestError` real es un objeto plano (`{ message, code, ... }`),
  // NUNCA una subclase de `Error` — a diferencia de `new Error(...)`, que
  // el resto de este archivo usa para simular fallas. Esta es la forma que
  // de verdad expuso el bug de "[object Object]" en `lastError`.
  const shouldFailPostgrest = (table: string) => opts.postgrestErrorTables?.has(table) ?? false;

  const from = vi.fn((table: string) => ({
    insert: vi.fn(async (row: unknown) => {
      calls.push({ table, method: "insert", args: [row] });
      // 23505 = duplicate key — el reintento de un insert ya sincronizado (AC-17).
      if (opts.duplicateTables?.has(table)) return { error: { code: "23505", message: `duplicate key para ${table}` } };
      if (shouldFailPostgrest(table)) return { error: { code: "42501", message: `permiso denegado para ${table}` } };
      return shouldFail(table) ? { error: new Error(`insert falló para ${table}`) } : { error: null };
    }),
    upsert: vi.fn(async (row: unknown) => {
      calls.push({ table, method: "upsert", args: [row] });
      return shouldFail(table) ? { error: new Error(`upsert falló para ${table}`) } : { error: null };
    }),
    update: vi.fn((patch: unknown) => ({
      eq: vi.fn(async (col: string, val: unknown) => {
        calls.push({ table, method: "update", args: [patch, col, val] });
        return shouldFail(table) ? { error: new Error(`update falló para ${table}`) } : { error: null };
      }),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(async (col: string, val: unknown) => {
        calls.push({ table, method: "delete", args: [col, val] });
        return shouldFail(table) ? { error: new Error(`delete falló para ${table}`) } : { error: null };
      }),
    })),
    select: vi.fn(() => ({
      eq: vi.fn((_col: string, val: unknown) => ({
        maybeSingle: vi.fn(async () => ({ data: opts.serverRowsById?.[val as string] ?? null, error: null })),
      })),
    })),
  }));

  return { client: { from } as unknown as SupabaseClient, calls };
}

describe("drainOutbox — BASE-05", () => {
  beforeEach(() => {
    resetDbForTests(`perze-test-sync-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await getDb().delete();
  });

  it("hace INSERT plano de un insert de accounts, con bigint convertido a string", async () => {
    await outbox.enqueue({
      table: "accounts",
      op: "insert",
      entityId: "acc-1",
      payload: {
        id: "acc-1",
        householdId: "hh-1",
        ownerId: "user-1",
        name: "Cuenta",
        kind: "checking",
        institutionId: null,
        countryCode: "UY",
        currencyCode: "UYU",
        openingBalance: 500_00n,
        openingDate: "2026-01-01",
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
        createdBy: "user-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        deletedAt: null,
      },
      clientRev: 1,
    });

    const { client, calls } = fakeSupabase();
    const result = await drainOutbox(client);

    expect(result).toEqual({ synced: 1, failed: 0, conflicts: 0 });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.table).toBe("accounts");
    // AC-17 — insert plano, NUNCA upsert: `INSERT ... ON CONFLICT` bajo RLS
    // muere con 42501 para filas cuya policy depende de una membresía que
    // todavía no sincronizó (households y todo lo que cuelga de él).
    expect(calls[0]?.method).toBe("insert");
    const row = calls[0]?.args[0] as Record<string, unknown>;
    expect(row.opening_balance).toBe("50000"); // bigint -> string, nunca number
    expect(row.current_balance).toBeUndefined(); // nunca se pushea: lo mantiene el trigger
    expect(await outbox.count()).toBe(0); // se sacó de la cola
  });

  it("un 23505 (duplicate key) en un insert cuenta como sincronizada — reintento de un intento interrumpido", async () => {
    await outbox.enqueue({
      table: "tags",
      op: "insert",
      entityId: "tag-dup",
      payload: { id: "tag-dup", householdId: "hh-1", name: "viaje", color: null },
      clientRev: 1,
    });

    const { client } = fakeSupabase({ duplicateTables: new Set(["tags"]) });
    const result = await drainOutbox(client);

    expect(result).toEqual({ synced: 1, failed: 0, conflicts: 0 });
    expect(await outbox.count()).toBe(0);
  });

  it("un update sí usa upsert — a esa altura la fila y la membresía ya existen en el servidor", async () => {
    await outbox.enqueue({
      table: "tags",
      op: "update",
      entityId: "tag-up",
      payload: { id: "tag-up", householdId: "hh-1", name: "trabajo", color: null },
      clientRev: 2,
    });

    const { client, calls } = fakeSupabase();
    const result = await drainOutbox(client);

    expect(result).toEqual({ synced: 1, failed: 0, conflicts: 0 });
    const upsertCall = calls.find((c) => c.method === "upsert");
    expect(upsertCall?.table).toBe("tags");
  });

  it("traduce un delete de transactions a un UPDATE de deleted_at, nunca un DELETE real", async () => {
    await outbox.enqueue({ table: "transactions", op: "delete", entityId: "tx-1", payload: {}, clientRev: 1 });

    const { client, calls } = fakeSupabase();
    await drainOutbox(client);

    expect(calls[0]?.method).toBe("update");
    expect(calls[0]?.args[0]).toMatchObject({ deleted_at: expect.any(String) });
    expect(calls[0]?.args[1]).toBe("id");
    expect(calls[0]?.args[2]).toBe("tx-1");
  });

  it("un delete de tags (sin deleted_at) sí hace un DELETE real", async () => {
    await outbox.enqueue({ table: "tags", op: "delete", entityId: "tag-1", payload: {}, clientRev: 1 });

    const { client, calls } = fakeSupabase();
    await drainOutbox(client);

    expect(calls[0]?.method).toBe("delete");
  });

  it("una tabla sin mapeo (insights, generada por el sistema) se deja pendiente, sin marcarla fallida", async () => {
    await outbox.enqueue({ table: "insights", op: "insert", entityId: "in-1", payload: {}, clientRev: 1 });

    const { client } = fakeSupabase();
    const result = await drainOutbox(client);

    expect(result).toEqual({ synced: 0, failed: 0, conflicts: 0 });
    expect(await outbox.count()).toBe(1); // sigue en la cola, no se perdió
  });

  it("un error en una entrada no bloquea las demás — sigue en la cola con el intento contado", async () => {
    await outbox.enqueue({ table: "accounts", op: "delete", entityId: "acc-fail", payload: {}, clientRev: 1 });
    await outbox.enqueue({
      table: "tags",
      op: "insert",
      entityId: "tag-1",
      payload: { id: "tag-1", householdId: "hh-1", name: "viaje", color: null },
      clientRev: 1,
    });

    const { client, calls } = fakeSupabase({ failTables: new Set(["accounts"]) });
    const result = await drainOutbox(client);

    expect(result).toEqual({ synced: 1, failed: 1, conflicts: 0 });
    expect(calls).toHaveLength(2); // ambas se intentaron, la falla de una no frenó la otra

    // No con `listPending()`: C9 puso la entrada en backoff, así que no
    // se levanta sola hasta pasar la ventana de espera. Sigue en la cola
    // igual (nunca se pierde) — se verifica con `listAll()`.
    const [stillQueued] = await outbox.listAll();
    expect(stillQueued?.table).toBe("accounts");
    expect(stillQueued?.status).toBe("failed");
    expect(stillQueued?.attempts).toBe(1);
    expect(stillQueued?.lastError).toContain("accounts");
  });

  it("un error de Supabase (PostgrestError, objeto plano — no una instancia de Error) guarda el mensaje real, nunca '[object Object]'", async () => {
    await outbox.enqueue({
      table: "tags",
      op: "insert",
      entityId: "tag-1",
      payload: { id: "tag-1", householdId: "hh-1", name: "viaje", color: null },
      clientRev: 1,
    });

    const { client } = fakeSupabase({ postgrestErrorTables: new Set(["tags"]) });
    await drainOutbox(client);

    const [stillQueued] = await outbox.listAll();
    expect(stillQueued?.lastError).toBe("permiso denegado para tags");
    expect(stillQueued?.lastError).not.toContain("object Object");
  });

  it("households y household_members (C7 — creación de household real) se traducen bien", async () => {
    await outbox.enqueue({
      table: "households",
      op: "insert",
      entityId: "hh-1",
      payload: {
        id: "hh-1",
        name: "Casa",
        baseCurrency: "UYU",
        baseCountry: "UY",
        periodStartDay: 1,
        weekStart: 1,
        enabledModules: [],
        settings: {},
        createdBy: "user-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      clientRev: 1,
    });
    await outbox.enqueue({
      table: "household_members",
      op: "insert",
      entityId: "hh-1:user-1",
      payload: { householdId: "hh-1", profileId: "user-1", role: "owner", displayName: "Vos", color: null, joinedAt: "2026-01-01T00:00:00.000Z" },
      clientRev: 1,
    });

    const { client, calls } = fakeSupabase();
    const result = await drainOutbox(client);

    expect(result).toEqual({ synced: 2, failed: 0, conflicts: 0 });
    const hhCall = calls.find((c) => c.table === "households");
    const memberCall = calls.find((c) => c.table === "household_members");
    expect((hhCall?.args[0] as Record<string, unknown>).base_currency).toBe("UYU");
    expect((memberCall?.args[0] as Record<string, unknown>).role).toBe("owner");
  });

  it("un update de transactions cuyo client_rev de servidor ya avanzó se registra como conflicto, no se pisa en silencio", async () => {
    // Edición local: rev 1 → 2 (base = 1). El servidor YA está en rev 2 —
    // otro miembro subió su propia edición mientras esta estaba offline.
    await getDb().transactions.add({
      id: "tx-1",
      householdId: "hh-1",
      createdBy: "user-1",
      kind: "expense",
      occurredAt: "2026-07-20T12:00:00.000Z",
      accountId: "acc-1",
      counterAccountId: null,
      amount: 1000n,
      currencyCode: "UYU",
      originalAmount: null,
      originalCurrency: null,
      originalRate: null,
      fxRate: null,
      fxSource: "identity",
      fxProvider: null,
      fxQuoteKind: null,
      fxResolvedAt: null,
      amountBase: 1000n,
      counterAmount: null,
      counterCurrencyCode: null,
      counterFxRate: null,
      categoryId: null,
      payeeId: null,
      note: "mi nota",
      attachments: [],
      location: null,
      status: "cleared",
      visibility: "household",
      recurringId: null,
      installmentGroupId: null,
      installmentNumber: null,
      installmentTotal: null,
      createdAt: "2026-07-20T12:00:00.000Z",
      updatedAt: "2026-07-20T12:00:00.000Z",
      deletedAt: null,
      clientRev: 2,
      source: "manual",
      syncState: "ok",
      syncError: null,
    });
    await outbox.enqueue({
      table: "transactions",
      op: "update",
      entityId: "tx-1",
      payload: { id: "tx-1", householdId: "hh-1", note: "mi nota", amount: 1000n, currencyCode: "UYU", clientRev: 2 },
      clientRev: 2,
    });

    const { client } = fakeSupabase({ serverRowsById: { "tx-1": { id: "tx-1", client_rev: 2, note: "la nota del otro", household_id: "hh-1" } } });
    const result = await drainOutbox(client);

    expect(result).toEqual({ synced: 0, failed: 0, conflicts: 1 });
    expect(await outbox.count()).toBe(0); // "conflict" no es "pending"/"failed" — no se reintenta solo

    const conflicts = await getDb().conflicts.toArray();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.entityId).toBe("tx-1");
    expect(conflicts[0]?.serverPayload).toMatchObject({ note: "la nota del otro" });

    const localRow = await getDb().transactions.get("tx-1");
    expect(localRow?.syncState).toBe("conflict");
  });

  it("un update de transactions cuyo servidor sigue en la revisión esperada sincroniza normal, sin falso conflicto", async () => {
    await outbox.enqueue({
      table: "transactions",
      op: "update",
      entityId: "tx-2",
      payload: { id: "tx-2", householdId: "hh-1", note: "ok", amount: 500n, currencyCode: "UYU", clientRev: 2 },
      clientRev: 2,
    });

    const { client, calls } = fakeSupabase({ serverRowsById: { "tx-2": { id: "tx-2", client_rev: 1 } } });
    const result = await drainOutbox(client);

    expect(result).toEqual({ synced: 1, failed: 0, conflicts: 0 });
    expect(calls.some((c) => c.method === "upsert")).toBe(true);
  });
});
