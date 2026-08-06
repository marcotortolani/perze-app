import { invertRate, parseRate, type ScaledRate } from "../rate";
import type { FxProvider, ProviderQuote } from "./types";

/** Respuesta de `GET https://uy.dolarapi.com/v1/cotizaciones` — forma distinta a la de `dolarapi.ts` (AR): `moneda` es el código cotizado, sin variantes (`casa`) por moneda. */
interface UyDolarApiEntry {
  moneda: string;
  nombre: string;
  compra: number | null;
  venta: number | null;
  fechaActualizacion: string; // ISO datetime
}

function isoDate(datetime: string): string {
  return datetime.slice(0, 10);
}

/** Códigos de moneda real que trae el endpoint hoy — deja afuera `UI` (Unidad Indexada, no es moneda) y `XAU` (oro, no está en el catálogo `currencies`). */
const SUPPORTED_FOREIGN = new Set(["USD", "EUR", "ARS", "BRL", "GBP", "CHF", "PYG"]);

/**
 * `uy.dolarapi.com` cotiza siempre "cuántos UYU por 1 unidad de `moneda`"
 * (USD, EUR, ARS, BRL, GBP, CHF, PYG…) — sin variantes de mercado (no hay
 * `casa` como en el endpoint argentino, así que `quoteKind` es siempre
 * `"oficial"`). Cierra el hueco de cobertura de UYU, la moneda default de
 * un household nuevo, que ni `dolarapi.ts` (solo USD↔ARS) ni
 * `frankfurter.ts` (no cubre monedas LatAm) resuelven.
 */
export function createDolarApiUyProvider(fetchImpl: typeof fetch = fetch): FxProvider {
  return {
    id: "dolarapi-uy",
    supports(base, quote) {
      if (base === "UYU") return SUPPORTED_FOREIGN.has(quote);
      if (quote === "UYU") return SUPPORTED_FOREIGN.has(base);
      return false;
    },
    async fetchQuotes(base, quote): Promise<ProviderQuote[]> {
      const res = await fetchImpl("https://uy.dolarapi.com/v1/cotizaciones");
      if (!res.ok) throw new Error(`dolarapi-uy respondió ${res.status}`);
      const entries = (await res.json()) as UyDolarApiEntry[];

      const foreignCode = base === "UYU" ? quote : base;
      const entry = entries.find((e) => e.moneda === foreignCode && e.venta !== null);
      if (!entry || entry.venta === null) return [];

      // venta: cuánto cuesta comprar 1 unidad de `moneda` en UYU — misma
      // referencia ("lo que sale comprar") que usa `dolarapi.ts` para AR.
      const foreignToUyu: ScaledRate = parseRate(entry.venta.toString());
      const rate = base === "UYU" ? invertRate(foreignToUyu) : foreignToUyu;
      return [
        {
          base,
          quote,
          quoteKind: "oficial",
          rate,
          asOf: isoDate(entry.fechaActualizacion),
        },
      ];
    },
  };
}
