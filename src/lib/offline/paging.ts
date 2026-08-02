import type { PostgrestError } from "@supabase/supabase-js";

/**
 * AC-14 (`docs/plan-sync-incremental.md` § 1) — extraído de `hydrate.ts` para
 * que el pull incremental (`pull.ts`) pueda reusarlo sin duplicar la lógica
 * de paginado. PostgREST corta en `max_rows` (1000) EN SILENCIO — todo se
 * pagina, no solo `transactions`.
 */
export const PAGE_SIZE = 1000;

/** Paginado por offset — para consultas sin predicado que pueda moverse mientras se pagina (refresh completo). */
export async function fetchPaged<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) return all;
  }
}

export interface KeysetCursor {
  updatedAt: string;
  id: string;
}

/**
 * Paginado por keyset sobre `(updated_at, id)` — a diferencia de
 * `fetchPaged`, que usa `.range(from, to)` por offset, esto arranca cada
 * página desde la última fila de la anterior. Necesario para el pull
 * incremental de `transactions`: con filas entrando al conjunto mientras se
 * pagina (el household sigue en uso durante el pull), un offset puede
 * saltear una fila que se corrió de página entre dos requests. Devuelve
 * TODAS las filas del predicado, ya reunidas — el caller nunca ve páginas
 * individuales.
 */
export async function fetchKeyset<T extends { updated_at: string; id: string }>(
  fetchPage: (cursor: KeysetCursor | null) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>
): Promise<T[]> {
  const all: T[] = [];
  let cursor: KeysetCursor | null = null;
  for (;;) {
    const { data, error } = await fetchPage(cursor);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) return all;
    const last = rows[rows.length - 1]!;
    cursor = { updatedAt: last.updated_at, id: last.id };
  }
}
