import type { ConflictRecordRow, OutboxEntryRow, TransactionRow } from "../db/schema";
import { getDb } from "../db/client";
import { createClient } from "../supabase/client";
import { TRANSACTIONS_COLUMNS } from "./sync-columns";
import { transactionFromRow, type RawTransaction } from "./hydrate";
import { transactionsRepo } from "../repos/transactions-repo";
import { fromServerTransaction } from "../repos/conflicts-repo";

/** Todo lo que borra un descarte, para poder deshacerlo desde el toast. */
export interface DiscardSnapshot {
  entries: OutboxEntryRow[];
  localRow: TransactionRow | null;
  conflictRows: ConflictRecordRow[];
}

/**
 * Recupera la versión del servidor de una transacción cuya mutación local
 * se acaba de descartar. Hace falta porque el watermark del pull ya avanzó
 * por encima del `updated_at` remoto de esa fila (la última vez que cambió
 * en el servidor fue ANTES de la mutación descartada), así que ningún pull
 * futuro la va a volver a pedir: sin este fetch puntual, descartar un
 * `update` atascado haría desaparecer la transacción del dispositivo hasta
 * una edición remota o un resync completo. Best-effort a propósito — sin
 * red, el caller cae al `serverPayload` del conflicto si lo hay.
 */
async function restoreServerTransaction(entityId: string): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("transactions").select(TRANSACTIONS_COLUMNS).eq("id", entityId).maybeSingle();
    if (error || !data) return false;
    await transactionsRepo.adoptServerRow(transactionFromRow(data as unknown as RawTransaction));
    return true;
  } catch {
    return false;
  }
}

/**
 * Descartar una entrada `"failed"`/`"dead"`/`"conflict"` desde la pantalla
 * de diagnóstico (Más → Estado de sincronización) — el usuario decide que
 * esa mutación no vale la pena reintentar más. En un módulo aparte de
 * `outbox.ts` (no en el objeto `outbox`) porque importar `transactions-repo`
 * ahí crearía un ciclo: `transactions-repo.ts` ya importa `outbox.ts` para
 * encolar sus propias mutaciones.
 *
 * Semántica: descarta TODAS las entradas de la entidad, no solo la tocada —
 * cada edición encola una fila nueva, y una hermana `pending` que
 * sobreviviera re-empujaría al servidor el estado que el usuario acaba de
 * tirar. El "claim" inicial es atómico y aborta si el sync-worker ya tomó
 * alguna entrada (`syncing`) o si la tocada volvió a la cola (`pending`):
 * sin eso, descartar una `failed` cuyo backoff venció corre una carrera con
 * el drain y la mutación "descartada" reaparece en el próximo pull.
 *
 * Para `transactions`, revierte el efecto de saldo optimista y borra la
 * fila local (`transactionsRepo.discardLocal`); si alguna mutación
 * descartada era sobre una fila que existe en el servidor (`op !==
 * 'insert'`), la versión remota se re-adopta en el momento — por red, o
 * desde el `serverPayload` del conflicto si no hay red. Para el resto de
 * las tablas alcanza con soltar el bloqueo del outbox — el próximo refresh
 * completo (`commitSimpleTable` en `pull.ts`) reconcilia contra el
 * servidor.
 *
 * La fila espejo de `db.conflicts` (creada por `recordConflict` en
 * `sync-worker.ts`) se borra también: dejarla viva mostraría una card de
 * resolución cuyo `keepLocal` resucitaría la mutación recién descartada.
 *
 * Devuelve el snapshot para `undoDiscardOutboxEntry`, o `null` si no se
 * pudo tomar la entrada (el caller no debe anunciar el descarte).
 */
export async function discardOutboxEntry(entry: OutboxEntryRow): Promise<DiscardSnapshot | null> {
  if (entry.id === undefined) return null;
  const db = getDb();

  const claimed = await db.transaction("rw", db.outbox, async () => {
    const current = await db.outbox.get(entry.id!);
    if (!current || current.status === "pending" || current.status === "syncing") return null;
    const siblings = await db.outbox
      .where("entityId")
      .equals(entry.entityId)
      .filter((e) => e.table === entry.table)
      .toArray();
    if (siblings.some((e) => e.status === "syncing")) return null;
    await db.outbox.bulkDelete(siblings.map((e) => e.id!));
    return siblings;
  });
  if (!claimed) return null;

  const conflictRows = await db.conflicts
    .where("entityId")
    .equals(entry.entityId)
    .filter((c) => c.table === entry.table)
    .toArray();
  let localRow: TransactionRow | null = null;

  if (entry.table === "transactions") {
    localRow = (await db.transactions.get(entry.entityId)) ?? null;
    await transactionsRepo.discardLocal(entry.entityId);
    if (claimed.some((e) => e.op !== "insert")) {
      const restored = await restoreServerTransaction(entry.entityId);
      if (!restored && conflictRows.length > 0) {
        try {
          await transactionsRepo.adoptServerRow(fromServerTransaction(conflictRows[conflictRows.length - 1]!.serverPayload));
        } catch {
          // payload incompleto de una versión vieja: mejor sin fila (el resync la trae) que abortar el descarte a medias.
        }
      }
    }
  }
  if (conflictRows.length) await db.conflicts.bulkDelete(conflictRows.map((c) => c.id));
  return { entries: claimed, localRow, conflictRows };
}

/**
 * Deshacer del toast — repone lo que el descarte borró: la fila local con
 * su efecto de saldo (sacando antes la versión del servidor re-adoptada, si
 * la hubo), las entradas del outbox con sus ids y estados originales, y las
 * filas de conflicto.
 */
export async function undoDiscardOutboxEntry(snapshot: DiscardSnapshot): Promise<void> {
  const db = getDb();
  if (snapshot.localRow) {
    await transactionsRepo.discardLocal(snapshot.localRow.id);
    await transactionsRepo.adoptServerRow(snapshot.localRow);
  }
  await db.outbox.bulkPut(snapshot.entries);
  if (snapshot.conflictRows.length) await db.conflicts.bulkPut(snapshot.conflictRows);
}
