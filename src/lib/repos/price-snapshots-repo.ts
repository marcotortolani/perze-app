import { createClient } from "../supabase/client";
import { todayIso } from "../dates/today";
import { nearestPriceOnOrBefore } from "../investments/investments-trend-math";

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

  /**
   * H-dashboard — serie histórica para el sparkline de "Investing" del
   * home: a diferencia de `latestFor` (un valor por instrumento), acá
   * hace falta la serie completa desde `sinceDate` para reconstruir el
   * valor de la posición día a día (`computeDayValue`/
   * `nearestPriceOnOrBefore`, que hacen carry-forward de fines de
   * semana/feriados sin snapshot nuevo).
   */
  async historyFor(instrumentIds: string[], sinceDate: string): Promise<Map<string, { asOf: string; close: number }[]>> {
    if (instrumentIds.length === 0) return new Map();
    const supabase = createClient();
    const { data, error } = await supabase
      .from("price_snapshots")
      .select("instrument_id, close, as_of")
      .in("instrument_id", instrumentIds)
      .gte("as_of", sinceDate)
      .order("as_of", { ascending: true });
    if (error) throw error;
    const history = new Map<string, { asOf: string; close: number }[]>();
    for (const row of data ?? []) {
      const list = history.get(row.instrument_id) ?? [];
      list.push({ asOf: row.as_of, close: row.close });
      history.set(row.instrument_id, list);
    }
    return history;
  },

  /**
   * "Change" del día (tabla de posiciones estilo Google Finance) — cierre
   * de AYER contra el que se compara el precio de hoy. Reusa `historyFor` +
   * `nearestPriceOnOrBefore` (mismo carry-forward que el sparkline del
   * home): si ayer fue fin de semana/feriado sin snapshot nuevo, toma el
   * último conocido antes de hoy, nunca el de hoy mismo.
   */
  async previousCloseFor(instrumentIds: string[]): Promise<Map<string, number>> {
    if (instrumentIds.length === 0) return new Map();
    const today = todayIso();
    const yesterday = new Date(`${today}T12:00:00Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    // Buffer de 7 días antes de "ayer" para poder hacer carry-forward si
    // ayer mismo no tuvo snapshot — mismo criterio que `computeInvestmentsTrend`.
    const since = new Date(yesterday);
    since.setUTCDate(since.getUTCDate() - 7);
    const history = await this.historyFor(instrumentIds, since.toISOString().slice(0, 10));
    const previousClose = new Map<string, number>();
    for (const [instrumentId, points] of history) {
      const close = nearestPriceOnOrBefore(points, yesterday.toISOString().slice(0, 10));
      if (close !== null) previousClose.set(instrumentId, close);
    }
    return previousClose;
  },

  /** Fase C (gráfico de tendencia) — primer `as_of` disponible por instrumento, para calcular hasta qué rango se puede mostrar sin inventar historial. */
  async earliestFor(instrumentIds: string[]): Promise<Map<string, string>> {
    if (instrumentIds.length === 0) return new Map();
    const supabase = createClient();
    const { data, error } = await supabase.from("price_snapshots").select("instrument_id, as_of").in("instrument_id", instrumentIds).order("as_of", { ascending: true });
    if (error) throw error;
    const earliest = new Map<string, string>();
    for (const row of data ?? []) {
      if (earliest.has(row.instrument_id)) continue; // ya ordenado asc — el primero que aparece es el más viejo
      earliest.set(row.instrument_id, row.as_of);
    }
    return earliest;
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
};
