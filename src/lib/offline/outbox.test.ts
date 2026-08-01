import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "../db/client";
import { outbox } from "./outbox";

describe("outbox", () => {
  beforeEach(() => {
    resetDbForTests(`perze-test-outbox-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await getDb().delete();
  });

  it("encola y cuenta pendientes", async () => {
    await outbox.enqueue({ table: "transactions", op: "insert", entityId: "tx-1", payload: {}, clientRev: 1 });
    await outbox.enqueue({ table: "transactions", op: "insert", entityId: "tx-2", payload: {}, clientRev: 1 });

    expect(await outbox.count()).toBe(2);
  });

  it("markSynced la saca de la cola", async () => {
    const id = await outbox.enqueue({ table: "accounts", op: "update", entityId: "acc-1", payload: {}, clientRev: 1 });
    await outbox.markSynced(id);
    expect(await outbox.count()).toBe(0);
  });

  it("markFailed suma intentos y guarda el error, sigue contando como pendiente", async () => {
    const id = await outbox.enqueue({ table: "accounts", op: "update", entityId: "acc-1", payload: {}, clientRev: 1 });
    await outbox.markFailed(id, "network error");
    await outbox.markFailed(id, "network error otra vez");

    const [entry] = await outbox.listPending();
    expect(entry?.attempts).toBe(2);
    expect(entry?.lastError).toBe("network error otra vez");
    expect(await outbox.count()).toBe(1);
  });

  it("C3 — una entrada 'syncing' interrumpida no queda huérfana: listPending la ignora hasta recoverInterrupted", async () => {
    const id = await outbox.enqueue({ table: "transactions", op: "insert", entityId: "tx-1", payload: {}, clientRev: 1 });
    await outbox.markSyncing(id);

    // Simula el cierre de la pestaña entre markSyncing y markSynced/markFailed.
    expect(await outbox.listPending()).toHaveLength(0);
    expect(await outbox.count()).toBe(0);

    await outbox.recoverInterrupted();

    expect(await outbox.listPending()).toHaveLength(1);
    expect(await outbox.count()).toBe(1);
  });
});
