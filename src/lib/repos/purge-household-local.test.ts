import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "../db/client";
import { watermarkKeyFor } from "../offline/sync-keys";
import { wipeLocalHouseholdData } from "./purge-household-local";

const HOUSEHOLD = "hh-1";
const OTHER_HOUSEHOLD = "hh-2";

describe("wipeLocalHouseholdData", () => {
  beforeEach(async () => {
    resetDbForTests(`perze-test-purge-${crypto.randomUUID()}`);
    const db = getDb();

    // Una fila de cada tabla propia del household, más su equivalente en OTRO
    // household — el purge no puede tocar ese.
    await db.accounts.add({ id: "acc-1", householdId: HOUSEHOLD, visibility: "household" } as never);
    await db.accounts.add({ id: "acc-2", householdId: OTHER_HOUSEHOLD, visibility: "household" } as never);
    await db.categories.add({ id: "cat-1", householdId: HOUSEHOLD } as never);
    await db.tags.add({ id: "tag-1", householdId: HOUSEHOLD } as never);
    await db.payees.add({ id: "payee-1", householdId: HOUSEHOLD } as never);
    await db.budgets.add({ id: "budget-1", householdId: HOUSEHOLD } as never);
    await db.goals.add({ id: "goal-1", householdId: HOUSEHOLD } as never);
    await db.recurringRules.add({ id: "rr-1", householdId: HOUSEHOLD } as never);
    await db.categorizationRules.add({ id: "rule-1", householdId: HOUSEHOLD } as never);
    await db.transactions.add({ id: "tx-1", householdId: HOUSEHOLD, occurredAt: "2026-07-01T00:00:00.000Z", deletedAt: null } as never);
    await db.transactionTags.add({ transactionId: "tx-1", tagId: "tag-1" } as never);

    // Entradas de outbox de CADA tabla que de verdad pasa por ahí — ver el
    // comentario de `wipeOutboxFor`. `transaction_tags` con su entityId
    // compuesto, y una entrada `op: "delete"` con payload vacío (como
    // `payees-repo.ts`/`tags-repo.ts` mandan de verdad) para probar que el
    // match por `entityId` funciona SIN depender del payload.
    await db.outbox.add({ table: "accounts", op: "insert", entityId: "acc-1", payload: {}, clientRev: 1, createdAt: "", status: "pending", attempts: 0, lastError: null, nextAttemptAt: null });
    await db.outbox.add({ table: "categories", op: "insert", entityId: "cat-1", payload: {}, clientRev: 1, createdAt: "", status: "pending", attempts: 0, lastError: null, nextAttemptAt: null });
    await db.outbox.add({ table: "payees", op: "delete", entityId: "payee-1", payload: {}, clientRev: 1, createdAt: "", status: "pending", attempts: 0, lastError: null, nextAttemptAt: null });
    await db.outbox.add({ table: "transactions", op: "insert", entityId: "tx-1", payload: {}, clientRev: 1, createdAt: "", status: "pending", attempts: 0, lastError: null, nextAttemptAt: null });
    await db.outbox.add({ table: "transaction_tags", op: "insert", entityId: "tx-1:tag-1", payload: {}, clientRev: 1, createdAt: "", status: "pending", attempts: 0, lastError: null, nextAttemptAt: null });
    // Entrada de OTRO household — no puede desaparecer.
    await db.outbox.add({ table: "accounts", op: "insert", entityId: "acc-2", payload: {}, clientRev: 1, createdAt: "", status: "pending", attempts: 0, lastError: null, nextAttemptAt: null });

    await db.meta.put({ key: watermarkKeyFor(HOUSEHOLD), value: "2026-07-01T00:00:00.000Z" });
    await db.meta.put({ key: watermarkKeyFor(OTHER_HOUSEHOLD), value: "2026-07-01T00:00:00.000Z" });

    await db.conflicts.add({ id: "c1", table: "accounts", entityId: "acc-1", localPayload: {}, serverPayload: {}, detectedAt: "" });
    await db.conflicts.add({ id: "c2", table: "accounts", entityId: "acc-2", localPayload: {}, serverPayload: {}, detectedAt: "" });

    await db.fxRates.put({ base: "USD", quote: "UYU", asOf: "2026-07-01", provider: "test", quoteKind: "sell", rate: 40n, householdId: HOUSEHOLD } as never);
    await db.fxRates.put({ base: "USD", quote: "UYU", asOf: "2026-07-01", provider: "test", quoteKind: "buy", rate: 39n, householdId: OTHER_HOUSEHOLD } as never);
  });

  afterEach(async () => {
    await getDb().delete();
  });

  it("vacía todas las tablas propias del household, sin tocar las de otro", async () => {
    await wipeLocalHouseholdData(HOUSEHOLD);
    const db = getDb();

    expect(await db.accounts.where("householdId").equals(HOUSEHOLD).count()).toBe(0);
    expect(await db.accounts.where("householdId").equals(OTHER_HOUSEHOLD).count()).toBe(1);
    expect(await db.transactions.count()).toBe(0);
    expect(await db.transactionTags.count()).toBe(0);
  });

  it("borra las entradas de outbox que apuntan a entidades de este household, deja las de otro", async () => {
    await wipeLocalHouseholdData(HOUSEHOLD);
    const db = getDb();
    const remaining = await db.outbox.toArray();
    expect(remaining.map((e) => e.entityId).sort()).toEqual(["acc-2"]);
  });

  it("borra el watermark de pull de este household, deja el de otro", async () => {
    await wipeLocalHouseholdData(HOUSEHOLD);
    const db = getDb();
    expect(await db.meta.get(watermarkKeyFor(HOUSEHOLD))).toBeUndefined();
    expect(await db.meta.get(watermarkKeyFor(OTHER_HOUSEHOLD))).toBeDefined();
  });

  it("borra los conflictos de entidades de este household, deja los de otro", async () => {
    await wipeLocalHouseholdData(HOUSEHOLD);
    const db = getDb();
    const remaining = await db.conflicts.toArray();
    expect(remaining.map((c) => c.id)).toEqual(["c2"]);
  });

  it("borra las cotizaciones cacheadas de este household, deja las de otro", async () => {
    await wipeLocalHouseholdData(HOUSEHOLD);
    const db = getDb();
    const remaining = await db.fxRates.toArray();
    expect(remaining.every((r) => r.householdId === OTHER_HOUSEHOLD)).toBe(true);
    expect(remaining.length).toBe(1);
  });
});
