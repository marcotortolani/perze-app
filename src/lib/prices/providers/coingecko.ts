import type { PriceProvider, PriceQuote } from "./types";

function serverTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Precio de instrumentos `Crypto` en USD — mismo proveedor que ya usa
 * `src/lib/fx/providers/coingecko.ts` para el FX de una moneda cripto,
 * pero acá se pide el precio de UN instrumento suelto (`providerSymbol`
 * = id de CoinGecko, ej. `"bitcoin"` — se guarda tal cual en
 * `instruments.provider_symbol` al crear el instrumento, no el ticker).
 * Siempre en USD: convertir a la moneda del instrumento/portfolio es
 * trabajo de FX, no de este proveedor — mismo criterio de "dos
 * conversiones, no una" que rige `amount`/`amount_base`.
 */
export function createCoinGeckoPriceProvider(fetchImpl: typeof fetch = fetch): PriceProvider {
  return {
    id: "coingecko",
    async fetchPrice(providerSymbol: string): Promise<PriceQuote | null> {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(providerSymbol)}&vs_currencies=usd`;
      const res = await fetchImpl(url);
      if (!res.ok) throw new Error(`coingecko respondió ${res.status}`);
      const data = (await res.json()) as Record<string, { usd?: number }>;
      const price = data[providerSymbol]?.usd;
      if (price === undefined) return null;
      return { close: price, asOf: serverTodayIso() };
    },
  };
}
