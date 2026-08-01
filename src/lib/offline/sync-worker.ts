import type { SupabaseClient } from "@supabase/supabase-js";
import type { OutboxEntryRow } from "../db/schema";
import { getDb } from "../db/client";
import { newId, nowIso } from "../repos/ids";
import { outbox } from "./outbox";
import { SYNC_TABLES } from "./sync-config";
import { detectRevisionConflict } from "./conflict-detection";

export interface DrainResult {
  synced: number;
  failed: number;
  conflicts: number;
}

/** Señal interna — nunca cruza el límite de `syncOne`, `drainOutbox` la atrapa aparte de un error real. */
class SyncConflictError extends Error {
  constructor(public readonly serverRow: Record<string, unknown>) {
    super("sync conflict");
  }
}

/**
 * Drena el outbox contra Supabase — BASE-05. No puede empujar nada
 * hasta que exista una sesión autenticada real (C7): toda policy de
 * INSERT/UPDATE exige `created_by = auth.uid()` y membresía del household,
 * así que sin login esto falla en la primera fila con un 401/403 de RLS
 * (comportamiento esperado, no un bug de este módulo).
 *
 * Falla-uno-sigue-los-demás: un error en una entrada no bloquea el resto
 * de la cola (`markFailed` incrementa `attempts` y queda para el próximo
 * intento, nunca se pierde).
 */
export async function drainOutbox(supabase: SupabaseClient): Promise<DrainResult> {
  await outbox.recoverInterrupted();
  const pending = await outbox.listPending();
  let synced = 0;
  let failedCount = 0;
  let conflictCount = 0;

  for (const entry of pending) {
    const config = SYNC_TABLES[entry.table];
    if (!config) {
      // Tabla sin mapeo todavía (ej. household_members) — no es un error
      // de esta entrada puntual, es que BASE-05 no la cubre aún. Se deja
      // en la cola tal cual, sin marcar como fallida (evita spam de
      // reintentos sobre algo que nunca va a poder resolver solo).
      continue;
    }

    try {
      await outbox.markSyncing(entry.id!);
      await syncOne(supabase, entry, config);
      await outbox.markSynced(entry.id!);
      synced++;
    } catch (error) {
      if (error instanceof SyncConflictError) {
        await recordConflict(entry, error.serverRow);
        await outbox.markConflict(entry.id!);
        conflictCount++;
        continue;
      }
      await outbox.markFailed(entry.id!, error instanceof Error ? error.message : String(error));
      failedCount++;
    }
  }

  return { synced, failed: failedCount, conflicts: conflictCount };
}

/** Guarda el conflicto para que `conflicts-repo.ts` lo resuelva, y marca la fila local como `syncState: 'conflict'` — nunca se pisa en silencio. */
async function recordConflict(entry: OutboxEntryRow, serverRow: Record<string, unknown>): Promise<void> {
  const db = getDb();
  await db.conflicts.add({
    id: newId(),
    table: entry.table,
    entityId: entry.entityId,
    localPayload: entry.payload as Record<string, unknown>,
    serverPayload: serverRow,
    detectedAt: nowIso(),
  });
  if (entry.table === "transactions") {
    await db.transactions.update(entry.entityId, { syncState: "conflict" });
  }
}

async function syncOne(
  supabase: SupabaseClient,
  entry: OutboxEntryRow,
  config: (typeof SYNC_TABLES)[string]
): Promise<void> {
  const payload = entry.payload as Record<string, unknown>;

  if (entry.op === "delete") {
    if (config.deletedAtColumn) {
      // DELETE nunca se expone por RLS — el borrado real es un UPDATE.
      const { error } = await supabase
        .from(config.supabaseTable)
        .update({ [config.deletedAtColumn]: new Date().toISOString() })
        .eq("id", entry.entityId);
      if (error) throw error;
    } else {
      // Tabla sin significado financiero (tags/payees): DELETE real sí
      // está expuesto (ver la migración de transaction_tags/tags/payees).
      const { error } = await supabase.from(config.supabaseTable).delete().eq("id", entry.entityId);
      if (error) throw error;
    }
    return;
  }

  if (config.conflictSensitive && entry.op === "update") {
    const { data: serverRow, error: fetchError } = await supabase
      .from(config.supabaseTable)
      .select("*")
      .eq("id", entry.entityId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    const serverRev = (serverRow as Record<string, unknown> | null)?.client_rev as number | undefined;
    if (detectRevisionConflict(entry.clientRev, serverRev ?? null)) {
      throw new SyncConflictError(serverRow as Record<string, unknown>);
    }
  }

  const row = config.toRow(payload);
  const { error } = await supabase.from(config.supabaseTable).upsert(row);
  if (error) throw error;
}
