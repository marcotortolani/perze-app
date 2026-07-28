"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "../db/client";

/**
 * Cantidad de mutaciones pendientes de sincronizar, reactivo — lo consume
 * `<SyncDot>` (Fase 3) y el banner de offline. `undefined` mientras Dexie
 * resuelve la primera lectura.
 */
export function usePendingMutations(): number | undefined {
  return useLiveQuery(async () => getDb().outbox.where("status").anyOf("pending", "failed").count(), []);
}
