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
      nextAttemptAt: null,
    };
    return (await getDb().outbox.add(row)) as number;
  },

  /**
   * C8 — orden FIFO real: se itera la tabla por clave primaria (`++id`,
   * monótona con la llegada), nunca por el índice de `status`. C9 — una
   * entrada `"failed"` con `nextAttemptAt` en el futuro no se levanta
   * todavía (backoff en curso). `"dead"` nunca vuelve sola — C32.
   */
  async listPending(): Promise<OutboxEntryRow[]> {
    const now = new Date().toISOString();
    return getDb()
      .outbox.toCollection()
      .filter((row) => (row.status === "pending" || row.status === "failed") && (row.nextAttemptAt === null || row.nextAttemptAt <= now))
      .toArray();
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

  /**
   * C9/C32 — backoff exponencial con jitter (base 5s, factor 2, techo
   * 5 min) hasta `DEAD_LETTER_THRESHOLD` intentos; a partir de ahí la
   * entrada pasa a `"dead"` y `listPending` deja de levantarla sola —
   * espera reintento manual desde la pantalla de diagnóstico en Más.
   */
  async markFailed(id: number, error: string): Promise<void> {
    const row = await getDb().outbox.get(id);
    const attempts = (row?.attempts ?? 0) + 1;
    if (attempts >= DEAD_LETTER_THRESHOLD) {
      await getDb().outbox.update(id, {
        status: "dead",
        attempts,
        lastError: error,
        nextAttemptAt: null,
      });
      return;
    }
    await getDb().outbox.update(id, {
      status: "failed",
      attempts,
      lastError: error,
      nextAttemptAt: nextAttemptAtFor(attempts),
    });
  },

  /** Terminal — a diferencia de `markFailed`, `listPending` no vuelve a levantar esta entrada: espera resolución explícita (`conflicts-repo.ts`). */
  async markConflict(id: number): Promise<void> {
    await getDb().outbox.update(id, { status: "conflict" });
  },

  /** Todas las entradas, en orden de llegada — pantalla de diagnóstico (C32). */
  async listAll(): Promise<OutboxEntryRow[]> {
    return getDb().outbox.toCollection().toArray();
  },

  /**
   * Reintento manual (C32) — vuelve a `"pending"` con `nextAttemptAt: null`
   * para que el próximo drenaje la levante de inmediato. `attempts` y
   * `lastError` quedan tal cual: son historia, no se borran hasta que un
   * intento nuevo los reemplace (éxito los borra del todo al sincronizar).
   */
  async retry(id: number): Promise<void> {
    await getDb().outbox.update(id, { status: "pending", nextAttemptAt: null });
  },
};

/** Techo de reintentos automáticos antes de dead-letter (C32) — exportado para el test de backoff. */
export const DEAD_LETTER_THRESHOLD = 8;
const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 5 * 60_000;

/** Pura y exportada para test directo — evita fake timers sobre IndexedDB (cuelga transacciones reales). */
export function nextAttemptAtFor(attempts: number): string {
  const raw = BASE_DELAY_MS * 2 ** (attempts - 1);
  const capped = Math.min(raw, MAX_DELAY_MS);
  // Jitter ±20% — evita que muchas entradas atrasadas reintenten todas en el mismo instante.
  const jittered = capped * (0.8 + Math.random() * 0.4);
  return new Date(Date.now() + jittered).toISOString();
}
