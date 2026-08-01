import { createClient } from "../supabase/client";

export interface LatestPrice {
  instrumentId: string;
  close: number;
  currencyCode: string;
  asOf: string;
  provider: string;
}

/** Bloque I — `price_snapshots` es Patrón C puro (dato de mercado, no de household): lectura para todo autenticado. */
export const priceSnapshotsRepo = {
  async latestFor(instrumentIds: string[]): Promise<Map<string, LatestPrice>> {
    if (instrumentIds.length === 0) return new Map();
    const supabase = createClient();
    const { data, error } = await supabase
      .from("price_snapshots")
      .select("instrument_id, close, currency_code, as_of, provider")
      .in("instrument_id", instrumentIds)
      .order("as_of", { ascending: false });
    if (error) throw error;
    const latest = new Map<string, LatestPrice>();
    for (const row of data ?? []) {
      if (latest.has(row.instrument_id)) continue; // ya ordenado por as_of desc — el primero que aparece es el más reciente
      latest.set(row.instrument_id, { instrumentId: row.instrument_id, close: row.close, currencyCode: row.currency_code, asOf: row.as_of, provider: row.provider });
    }
    return latest;
  },

  /** I12 — precio cargado a mano cuando ningún proveedor lo trae. Queda como snapshot con `provider: 'manual'`, igual que cualquier otra fuente. */
  async setManual(instrumentId: string, close: number, currencyCode: string): Promise<void> {
    const supabase = createClient();
    const asOf = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("price_snapshots").upsert({ instrument_id: instrumentId, as_of: asOf, provider: "manual", close, currency_code: currencyCode } as never);
    if (error) throw error;
  },
};
