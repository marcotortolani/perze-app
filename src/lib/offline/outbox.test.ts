import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "../db/client";
import { DEAD_LETTER_THRESHOLD, nextAttemptAtFor, outbox } from "./outbox";

/** Simula que ya pasó la ventana de backoff, sin fake timers (cuelgan las transacciones reales de fake-indexeddb). */
async function expireBackoff(id: number): Promise<void> {
  await getDb().outbox.update(id, { nextAttemptAt: new Date(Date.now() - 1_000).toISOString() });
}

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
    await expireBackoff(id);
    await outbox.markFailed(id, "network error otra vez");
    await expireBackoff(id);

    const [entry] = await outbox.listPending();
    expect(entry?.attempts).toBe(2);
    expect(entry?.lastError).toBe("network error otra vez");
    expect(await outbox.count()).toBe(1);
  });

  // C8 — el orden de llegada (PK autoincremental) se respeta aunque el
  // índice de `status` intercale distinto: una entrada vieja "failed" no
  // queda detrás de una nueva "pending".
  it("listPending respeta el orden de llegada (FIFO), no el de status", async () => {
    const first = await outbox.enqueue({ table: "accounts", op: "update", entityId: "acc-1", payload: {}, clientRev: 1 });
    await outbox.enqueue({ table: "accounts", op: "update", entityId: "acc-2", payload: {}, clientRev: 1 });
    const third = await outbox.enqueue({ table: "accounts", op: "update", entityId: "acc-3", payload: {}, clientRev: 1 });

    // La primera falla (pasa a "failed") pero sigue siendo la más vieja.
    await outbox.markFailed(first, "network error");
    await expireBackoff(first);

    const pending = await outbox.listPending();
    expect(pending.map((e) => e.id)).toEqual([first, expect.any(Number), third]);
  });

  // C9 — backoff exponencial: una entrada recién fallida no vuelve a
  // levantarse hasta que pasa su ventana de espera.
  it("markFailed aplica backoff — la entrada no vuelve hasta que pasa el tiempo de espera", async () => {
    const id = await outbox.enqueue({ table: "accounts", op: "update", entityId: "acc-1", payload: {}, clientRev: 1 });
    await outbox.markFailed(id, "network error");

    expect(await outbox.listPending()).toHaveLength(0);

    await expireBackoff(id);
    const pending = await outbox.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.attempts).toBe(1);
    expect(pending[0]?.lastError).toBe("network error");
  });

  it("nextAttemptAtFor crece exponencialmente con techo, y siempre queda en el futuro", () => {
    const before = Date.now();
    const first = new Date(nextAttemptAtFor(1)).getTime();
    const fourth = new Date(nextAttemptAtFor(4)).getTime();
    const capped = new Date(nextAttemptAtFor(20)).getTime();

    expect(first).toBeGreaterThan(before);
    expect(fourth).toBeGreaterThan(first);
    // El techo de 5 min con jitter de hasta +20% nunca supera 6 min de acá.
    expect(capped - Date.now()).toBeLessThanOrEqual(6 * 60_000);
  });

  // C32 — pasado el techo de reintentos automáticos, la entrada pasa a
  // "dead" y deja de levantarse sola.
  it("markFailed repetido pasa a dead-letter y deja de reintentarse solo", async () => {
    const id = await outbox.enqueue({ table: "accounts", op: "update", entityId: "acc-1", payload: {}, clientRev: 1 });

    for (let i = 0; i < DEAD_LETTER_THRESHOLD; i++) {
      await outbox.markFailed(id, `error ${i}`);
      await expireBackoff(id);
    }

    expect(await outbox.listPending()).toHaveLength(0);
    const [entry] = await outbox.listAll();
    expect(entry?.status).toBe("dead");
    expect(entry?.attempts).toBe(DEAD_LETTER_THRESHOLD);

    // Reintento manual: vuelve a levantarse de inmediato.
    await outbox.retry(id);
    const pending = await outbox.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.status).toBe("pending");
  });
});
