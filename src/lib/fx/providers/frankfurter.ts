import { invertRate, parseRate, type ScaledRate } from "../rate";
import type { FxProvider, ProviderQuote } from "./types";

interface FrankfurterResponse {
  amount: number;
  base: string;
  date: string; // ISO date
  rates: Record<string, number>;
}

/**
 * Los 30 códigos reales que cubre `GET /v1/currencies` de la API — antes
 * este set tenía solo 14, un recorte inicial arbitrario que no reflejaba
 * la cobertura real del proveedor (a diferencia del recorte de dolarapi a
 * Argentina, que sí es deliberado: dolarapi tiene más endpoints por país
 * pero acá solo se implementó el de Argentina). No cubre crypto ni la
 * mayoría de monedas LatAm (ARS, UYU, CLP quedan fuera).
 */
const SUPPORTED = new Set([
  "AUD", "BRL", "CAD", "CHF", "CNY", "CZK", "DKK", "EUR", "GBP", "HKD",
  "HUF", "IDR", "ILS", "INR", "ISK", "JPY", "KRW", "MXN", "MYR", "NOK",
  "NZD", "PHP", "PLN", "RON", "SEK", "SGD", "THB", "TRY", "USD", "ZAR",
]);

/** Nombre para mostrar en el picker de "agregar una moneda" — mismo alcance que `SUPPORTED`. */
export const FRANKFURTER_CURRENCIES: Array<{ code: string; name: string }> = [
  { code: "AUD", name: "Dólar australiano" },
  { code: "BRL", name: "Real brasileño" },
  { code: "CAD", name: "Dólar canadiense" },
  { code: "CHF", name: "Franco suizo" },
  { code: "CNY", name: "Yuan chino" },
  { code: "CZK", name: "Corona checa" },
  { code: "DKK", name: "Corona danesa" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "Libra esterlina" },
  { code: "HKD", name: "Dólar de Hong Kong" },
  { code: "HUF", name: "Florín húngaro" },
  { code: "IDR", name: "Rupia indonesia" },
  { code: "ILS", name: "Nuevo shekel israelí" },
  { code: "INR", name: "Rupia india" },
  { code: "ISK", name: "Corona islandesa" },
  { code: "JPY", name: "Yen japonés" },
  { code: "KRW", name: "Won surcoreano" },
  { code: "MXN", name: "Peso mexicano" },
  { code: "MYR", name: "Ringgit malayo" },
  { code: "NOK", name: "Corona noruega" },
  { code: "NZD", name: "Dólar neozelandés" },
  { code: "PHP", name: "Peso filipino" },
  { code: "PLN", name: "Zloty polaco" },
  { code: "RON", name: "Leu rumano" },
  { code: "SEK", name: "Corona sueca" },
  { code: "SGD", name: "Dólar de Singapur" },
  { code: "THB", name: "Baht tailandés" },
  { code: "TRY", name: "Lira turca" },
  { code: "USD", name: "Dólar estadounidense" },
  { code: "ZAR", name: "Rand sudafricano" },
];

export function createFrankfurterProvider(fetchImpl: typeof fetch = fetch): FxProvider {
  return {
    id: "frankfurter",
    supports(base, quote) {
      return base !== quote && SUPPORTED.has(base) && SUPPORTED.has(quote);
    },
    async fetchQuotes(base, quote): Promise<ProviderQuote[]> {
      // B5 — encodeURIComponent explícito: hoy `supports()` ya acota
      // `base`/`quote` al allowlist de `SUPPORTED`, pero este provider no
      // debe depender de que el caller lo haya chequeado (inyección de
      // parámetros en la URL del upstream si alguna vez se llama directo).
      const url = `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(quote)}`;
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
