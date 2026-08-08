import { getDb } from "../db/client";
import type { OutboxEntryRow, OutboxOp } from "../db/schema";

/**
 * Cola de mutaciones — `docs/01-arquitectura-datos.md` § 4. Hoy (local-first,
 * sin Supabase) no hay a dónde drenarla: existe para que conectar el backend
 * sea enchufar un worker que la recorra, no rediseñar el flujo de escritura.
 */
let suppressed = false;

/**
 * Ejecuta `fn` sin que `outbox.enqueue()` escriba nada — el household de
 * demo (`seedDemoHousehold()`) es 100% local y no debe intentar sincronizar
 * jamás: sus filas llevan `created_by = DEMO_USER_ID`, que ninguna policy
 * de RLS reconoce, así que esas ~55 entradas se quedaban colgadas en la cola
 * para siempre (B15). El flag es de módulo, no por-repo: los repos no
 * cambian su firma, y el seed corre secuencial (sin escrituras concurrentes
 * de otro flujo real durante la ventana).
 */
export async function withoutOutbox<T>(fn: () => Promise<T>): Promise<T> {
  const previous = suppressed;
  suppressed = true;
  try {
    return await fn();
  } finally {
    suppressed = previous;
  }
}

export const outbox = {
  async enqueue(entry: {
    table: string;
    op: OutboxOp;
    entityId: string;
    payload: unknown;
    clientRev: number;
  }): Promise<number> {
    if (suppressed) return -1;
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
      // Una entrada muerta deja de bloquear el saldo (`blockingAccountIds`
      // solo cuenta estados activos), así que la fila local sigue visible
      // pero el saldo ya no la incluye — marcarla `rejected` es lo que
      // permite a la lista señalar ese desfasaje en vez de mostrarlo mudo.
      // Mismo patrón que `recordConflict` en `sync-worker.ts`.
      if (row?.table === "transactions") {
        await getDb().transactions.update(row.entityId, { syncState: "rejected", syncError: error });
      }
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

  /**
   * Reintento masivo (AC-17) — después de corregir la causa por la que TODA
   * la cola moría (el upsert que RLS rechazaba), las entradas `dead` son
   * legítimas de nuevo: un solo botón en la pantalla de diagnóstico en vez
   * de resucitarlas de a una. `attempts`/`lastError` quedan como historia,
   * igual que en `retry()`.
   */
  async retryAllDead(): Promise<number> {
    return getDb().outbox.where("status").equals("dead").modify({ status: "pending", nextAttemptAt: null });
  },

  /**
   * Descarte manual (pantalla de diagnóstico en Más) — saca una entrada
   * `"failed"`/`"dead"`/`"conflict"` de la cola para siempre, sin
   * reintentar. Solo borra la fila del outbox: no toca la fila de la
   * entidad ni su efecto local (eso lo resuelve el caller, ver
   * `outbox-actions.ts` para `transactions`).
   */
  async discard(id: number): Promise<void> {
    await getDb().outbox.delete(id);
  },

  /**
   * Limpia la(s) entrada(s) `"conflict"` de una entidad ya resuelta desde
   * `conflicts-repo.ts` (`keepLocal`/`keepServer`). Sin esto, la entrada
   * original que disparó el conflicto queda huérfana en el outbox para
   * siempre — nada la vuelve a tocar (`listPending` la ignora, es
   * terminal), así que sigue apareciendo en el diagnóstico como si el
   * conflicto siguiera abierto.
   */
  async clearConflict(table: string, entityId: string): Promise<void> {
    const stale = await getDb()
      .outbox.where("entityId")
      .equals(entityId)
      .filter((e) => e.table === table && e.status === "conflict")
      .toArray();
    if (stale.length) await getDb().outbox.bulkDelete(stale.map((e) => e.id!));
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
