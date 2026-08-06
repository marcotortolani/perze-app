import { createClient } from "../supabase/client";
import { todayIso } from "../dates/today";

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
    const asOf = todayIso(); // D10 — día calendario local, no UTC
    const { error } = await supabase.from("price_snapshots").upsert({ instrument_id: instrumentId, as_of: asOf, provider: "manual", close, currency_code: currencyCode } as never);
    if (error) throw error;
  },

  /**
   * "Actualizar" de I12/I4 — pega a `/api/prices` para un instrumento con
   * proveedor real (`data912`/`coingecko`). Nunca llama al proveedor
   * externo directo (`CLAUDE.md`). Devuelve `null` si el instrumento no
   * tiene proveedor, o si el proveedor no devolvió nada — nunca lanza por
   * eso, es un estado esperado (FCI, plazo fijo, inmuebles).
   */
  async refreshFromProvider(instrumentId: string): Promise<LatestPrice | null> {
    const res = await fetch(`/api/prices?instrumentId=${encodeURIComponent(instrumentId)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { close: number | null; provider: string | null; asOf: string | null; currencyCode: string; isStale: boolean };
    if (data.close === null || data.provider === null || data.asOf === null) return null;
    return { instrumentId, close: data.close, currencyCode: data.currencyCode, asOf: data.asOf, provider: data.provider };
  },

  /**
   * I4 — serie histórica para el gráfico de fluctuación. Un cierre por día
   * (los escribe `daily-price-sync`, el cron), así que el rango "día" no
   * da un gráfico intradía real — eso queda resuelto aparte con la
   * variación día a día entre los dos últimos cierres, no con este método.
   */
  async historyFor(instrumentId: string, sinceIso: string): Promise<{ asOf: string; close: number }[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("price_snapshots")
      .select("as_of, close")
      .eq("instrument_id", instrumentId)
      .gte("as_of", sinceIso)
      .order("as_of", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => ({ asOf: row.as_of, close: row.close }));
  },
};
