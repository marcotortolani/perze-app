import { createClient } from "../supabase/client";
import { newId } from "./ids";

/** Dimensiones soportadas por la pantalla de rebalanceo. El schema (`target_allocations.dimension`, CHECK) también admite `'country' | 'instrument'` — no expuestas en la UI todavía, ver nota en `rebalance/page.tsx`. */
export type TargetAllocationDimension = "asset_class" | "currency" | "risk" | "country" | "instrument" | "sector";

export interface TargetAllocation {
  id: string;
  portfolioId: string;
  dimension: TargetAllocationDimension;
  /** `asset_class_id`, código de moneda, `'low'|'medium'|'high'`, etc. según `dimension`. */
  key: string;
  targetPct: number;
  bandPct: number;
}

/**
 * Bloque I (rebalanceo) — mismo patrón que `instruments-repo.ts`/`asset_classes`:
 * directo a Supabase, sin Dexie/outbox. Un objetivo de cartera se define
 * con poca frecuencia y no compite con el objetivo de 5s (misma nota de
 * arquitectura que `portfolios-repo.ts`).
 */
export const targetAllocationsRepo = {
  async list(portfolioId: string, dimension: TargetAllocationDimension): Promise<TargetAllocation[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("target_allocations")
      .select("id, portfolio_id, dimension, key, target_pct, band_pct")
      .eq("portfolio_id", portfolioId)
      .eq("dimension", dimension);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      portfolioId: row.portfolio_id,
      dimension: row.dimension as TargetAllocationDimension,
      key: row.key,
      targetPct: row.target_pct,
      bandPct: row.band_pct,
    }));
  },

  /**
   * Reemplaza TODOS los targets de una dimensión de una — la pantalla
   * siempre edita la lista completa (agregar/sacar una fila cambia cuánto
   * suman las demás), así que un diff de updates individuales no ahorra
   * nada y agrega complejidad de sincronización sin beneficio.
   */
  async upsertMany(portfolioId: string, dimension: TargetAllocationDimension, rows: readonly { key: string; targetPct: number; bandPct: number }[]): Promise<void> {
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("target_allocations").delete().eq("portfolio_id", portfolioId).eq("dimension", dimension);
    if (deleteError) throw deleteError;
    if (rows.length === 0) return;
    const { error: insertError } = await supabase.from("target_allocations").insert(
      rows.map((r) => ({
        id: newId(),
        portfolio_id: portfolioId,
        dimension,
        key: r.key,
        target_pct: r.targetPct,
        band_pct: r.bandPct,
      })) as never
    );
    if (insertError) throw insertError;
  },

  async deleteDimension(portfolioId: string, dimension: TargetAllocationDimension): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from("target_allocations").delete().eq("portfolio_id", portfolioId).eq("dimension", dimension);
    if (error) throw error;
  },
};
