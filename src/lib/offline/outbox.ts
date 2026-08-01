import { getDb } from "../db/client";
import type { OutboxEntryRow, OutboxOp } from "../db/schema";

/**
 * Cola de mutaciones — `docs/01-arquitectura-datos.md` § 4. Hoy (local-first,
 * sin Supabase) no hay a dónde drenarla: existe para que conectar el backend
 * sea enchufar un worker que la recorra, no rediseñar el flujo de escritura.
 */
export const outbox = {
  async enqueue(entry: {
    table: string;
    op: OutboxOp;
    entityId: string;
    payload: unknown;
    clientRev: number;
  }): Promise<number> {
    const row: OutboxEntryRow = {
      ...entry,
      createdAt: new Date().toISOString(),
      status: "pending",
      attempts: 0,
      lastError: null,
    };
    return (await getDb().outbox.add(row)) as number;
  },

  async listPending(): Promise<OutboxEntryRow[]> {
    return getDb().outbox.where("status").anyOf("pending", "failed").toArray();
  },

  /**
   * C3 — una entrada queda en `"syncing"` para siempre si la pestaña se
   * cierra o el dispositivo se duerme entre `markSyncing()` y
   * `markSynced()`/`markFailed()` (lo normal en móvil): `listPending()`
   * nunca la vuelve a levantar, no se reintenta, no se cuenta, y el SyncDot
   * miente "todo bien". Se llama al arrancar `drainOutbox`, antes de
   * `listPending()` — no hay forma de distinguir una entrada huérfana de
   * una que de verdad está sincronizando en otra pestaña ahora mismo, así
   * que el costo de un falso positivo (reintentar una que ya iba a
   * terminar) es mucho menor que el de perderla para siempre.
   */
  async recoverInterrupted(): Promise<number> {
    return getDb().outbox.where("status").equals("syncing").modify({ status: "pending" });
  },

  async count(): Promise<number> {
    return getDb().outbox.where("status").anyOf("pending", "failed").count();
  },

  async markSyncing(id: number): Promise<void> {
    await getDb().outbox.update(id, { status: "syncing" });
  },

  /** Se sincronizó: sale de la cola. */
  async markSynced(id: number): Promise<void> {
    await getDb().outbox.delete(id);
  },

  async markFailed(id: number, error: string): Promise<void> {
    const row = await getDb().outbox.get(id);
    await getDb().outbox.update(id, {
      status: "failed",
      attempts: (row?.attempts ?? 0) + 1,
      lastError: error,
    });
  },

  /** Terminal — a diferencia de `markFailed`, `listPending` no vuelve a levantar esta entrada: espera resolución explícita (`conflicts-repo.ts`). */
  async markConflict(id: number): Promise<void> {
    await getDb().outbox.update(id, { status: "conflict" });
  },
};
