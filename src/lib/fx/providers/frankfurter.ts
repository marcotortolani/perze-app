import { invertRate, parseRate, type ScaledRate } from "../rate";
import type { FxProvider, ProviderQuote } from "./types";

interface FrankfurterResponse {
  amount: number;
  base: string;
  date: string; // ISO date
  rates: Record<string, number>;
}

/** ~30 monedas del BCE + histórico. No cubre crypto ni la mayoría de LatAm. */
const SUPPORTED = new Set([
  "EUR", "USD", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "BRL", "MXN", "CNY", "SEK", "NOK", "DKK",
]);

export function createFrankfurterProvider(fetchImpl: typeof fetch = fetch): FxProvider {
  return {
    id: "frankfurter",
    supports(base, quote) {
      return base !== quote && SUPPORTED.has(base) && SUPPORTED.has(quote);
    },
    async fetchQuotes(base, quote): Promise<ProviderQuote[]> {
      const url = `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${quote}`;
      const res = await fetchImpl(url);
      if (!res.ok) throw new Error(`frankfurter respondió ${res.status}`);
      const data = (await res.json()) as FrankfurterResponse;

      const raw = data.rates[quote];
      if (raw === undefined) return [];

      const rate: ScaledRate = parseRate(raw.toString());
      return [
        {
          base,
          quote,
          quoteKind: "default",
          rate,
          asOf: data.date,
        },
      ];
    },
  };
}

/** Variante invertida, para cuando frankfurter no tiene `base` directo pero sí el par al revés. */
export function invertProviderQuote(q: ProviderQuote): ProviderQuote {
  return { ...q, base: q.quote, quote: q.base, rate: invertRate(q.rate) };
}
