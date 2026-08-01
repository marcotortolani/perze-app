import { createClient } from "../supabase/client";

export interface PriceIndexEntry {
  id: string;
  currencyCode: string;
  period: string; // ISO date, primer día del mes
  indexValue: number;
  source: string;
}

/**
 * H7 — índice de precios (IPC u otro). Catálogo global (Patrón C):
 * lectura para todo autenticado, **sin escritura desde el cliente a
 * propósito** — es un solo índice compartido por todos los households de
 * esa moneda, así que dejar que cualquier usuario lo edite corrompería el
 * dato de todos los demás. Se carga por seeds/Edge Function/cron, no
 * existe todavía (documentado en `20260801011100_system.sql`), así que
 * H7 se muestra sin ajuste hasta que haya un feed real — nunca se
 * inventa un valor ni se abre una escritura insegura para evitarlo.
 */
export const priceIndexRepo = {
  async list(currencyCode: string): Promise<PriceIndexEntry[]> {
    const supabase = createClient();
    const { data, error } = await supabase.from("price_index").select("id, currency_code, period, index_value, source").eq("currency_code", currencyCode).order("period", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => ({ id: row.id, currencyCode: row.currency_code, period: row.period, indexValue: row.index_value, source: row.source }));
  },
};
