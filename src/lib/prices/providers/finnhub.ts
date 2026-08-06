import { env } from "@/env";
import type { PriceProvider, PriceQuote } from "./types";

/** D10 — mismo criterio que `data912.ts`: server-only, sin zona horaria de nadie. */
function serverTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const BASE_URL = "https://finnhub.io/api/v1";

/**
 * I10 — acciones y ETFs de EE.UU. (NYSE/NASDAQ), fuera de lo que cubre
 * Data912 (mercado argentino, incluidos CEDEARs de las mismas compañías,
 * pero no la acción de origen). `providerSymbol` es el ticker de Finnhub
 * tal cual (`"AAPL"`), igual al símbolo que ve el usuario — a diferencia
 * de CoinGecko (id propio) o Data912 (mismo símbolo pero con sufijo D/C
 * para la variante dólar), acá no hace falta traducir nada.
 *
 * Sin `FINNHUB_API_KEY`, ambas funciones devuelven vacío/null en vez de
 * lanzar — mismo contrato que Resend (CLAUDE.md): un self-host sin la
 * key configurada no se rompe, simplemente no ofrece resultados de esta
 * fuente.
 */
export function createFinnhubProvider(fetchImpl: typeof fetch = fetch): PriceProvider {
  return {
    id: "finnhub",
    async fetchPrice(providerSymbol: string): Promise<PriceQuote | null> {
      if (!env.FINNHUB_API_KEY) return null;
      const url = `${BASE_URL}/quote?symbol=${encodeURIComponent(providerSymbol)}&token=${env.FINNHUB_API_KEY}`;
      const res = await fetchImpl(url);
      if (!res.ok) throw new Error(`finnhub respondió ${res.status}`);
      const data = (await res.json()) as { c: number; t: number };
      // Símbolo inexistente: Finnhub responde 200 con todos los campos en
      // 0 en vez de un 404 — `t === 0` (timestamp epoch) es la señal real,
      // `c === 0` sola no alcanza (una acción podría cerrar en $0 en un
      // escenario extremo, pero nunca sin timestamp).
      if (data.t === 0) return null;
      return { close: data.c, asOf: serverTodayIso() };
    },
  };
}

export interface FinnhubSearchResult {
  symbol: string;
  name: string;
  assetClass: "Acciones" | "ETFs";
}

/**
 * Solo `Common Stock`/`ETF` (el resto — ADR, mutual fund, index— no tiene
 * una clase de activo sembrada que le calce bien) y solo tickers SIN
 * sufijo de mercado (`AAPL.MX`, `AAPL.L`): Finnhub devuelve listados
 * cruzados de bolsas de todo el mundo para la misma búsqueda, y el
 * alcance pedido es NYSE/NASDAQ. Un ticker de EE.UU. nunca lleva punto.
 */
export async function searchFinnhubInstruments(query: string, fetchImpl: typeof fetch = fetch): Promise<FinnhubSearchResult[]> {
  if (!env.FINNHUB_API_KEY) return [];
  const needle = query.trim();
  if (needle.length < 2) return [];

  const url = `${BASE_URL}/search?q=${encodeURIComponent(needle)}&token=${env.FINNHUB_API_KEY}`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`finnhub respondió ${res.status}`);
  const data = (await res.json()) as { result: { symbol: string; description: string; type: string }[] };

  const assetClassByType: Record<string, "Acciones" | "ETFs"> = { "Common Stock": "Acciones", ETF: "ETFs" };

  return data.result
    .filter((r) => !r.symbol.includes(".") && r.type in assetClassByType)
    .map((r) => ({ symbol: r.symbol, name: r.description, assetClass: assetClassByType[r.type]! }));
}
