import type { QueryClient } from "@tanstack/react-query";
import type { PullResult } from "./pull";

/**
 * Fase 3 del plan de fluidez de navegación — reemplaza el
 * `queryClient.invalidateQueries()` sin key que corría en CADA tick de
 * `use-sync-loop.ts` (cada 30s) y en cada evento de Realtime, tirara o no
 * el pull una sola fila nueva.
 *
 * `pullFromRemote()` refresca la mayoría de las tablas con un fetch
 * completo (`commitSimpleTable`), no un diff — así que su `count` es
 * "cuántas filas hay del lado del servidor", no "cuántas cambiaron", y no
 * sirve como señal de "hubo novedad" tabla por tabla. Las dos señales que
 * SÍ son confiables:
 *
 * - `transactions` es la única tabla incremental (cursor por `updated_at`):
 *   `count === 0` significa, en serio, "nada nuevo desde el watermark".
 * - `prunedTotal` cuenta borrados detectados por diff de ids — siempre un
 *   cambio real cuando es > 0.
 *
 * Mismo criterio que accounts/categories/budgets/goals/etc.: su `count`
 * fetch-completo no entra en `changed`, así que una alta pura en otro
 * dispositivo (sin ningún borrado ni movimiento nuevo en el mismo tick) no
 * dispara invalidación — igual que siempre pasó con el resto de esas
 * tablas. `trades` (auditoría de outbox de inversiones) se suma a este
 * mismo criterio: SALE de `NEVER_TOUCHED_BY_PULL` porque ahora
 * `pullFromRemote` sí la sincroniza — antes estaba excluida porque
 * `useTrades`/`useTrade` leían Supabase directo y el pull nunca la tocaba.
 *
 * Cuando ninguna de las dos señala novedad (el caso normal: nadie está
 * editando nada en ningún dispositivo ahora mismo), no se invalida nada —
 * es el 95% de los ticks. Cuando sí hay novedad, se invalida TODO el cache
 * salvo un puñado de claves que `pullFromRemote` nunca toca (sesión,
 * household actual, inversiones): antes esas también se invalidaban cada
 * 30s sin motivo, forzando un refetch de datos con `staleTime: Infinity`
 * que por definición no necesitan revalidarse solos.
 */
const NEVER_TOUCHED_BY_PULL: readonly (readonly unknown[])[] = [
  ["household", "current"],
  // Household switcher (PR 3) — lista remota de TODOS los households del
  // usuario, no una tabla que `pullFromRemote` sincronice.
  ["households", "mine"],
  ["auth"],
  ["asset-classes"],
  ["portfolios"],
  ["instruments"],
];

function matchesPrefix(queryKey: readonly unknown[], prefix: readonly unknown[]): boolean {
  return prefix.every((segment, i) => queryKey[i] === segment);
}

export function invalidateAfterPull(queryClient: QueryClient, result: PullResult): void {
  const changed = result.transactions > 0 || result.prunedTotal > 0;
  if (!changed) return;

  void queryClient.invalidateQueries({
    predicate: (query) => !NEVER_TOUCHED_BY_PULL.some((prefix) => matchesPrefix(query.queryKey, prefix)),
  });
}
