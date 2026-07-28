import { invertRate, parseRate, type ScaledRate } from "../rate";
import type { FxProvider, ProviderQuote } from "./types";

/** Respuesta de `GET https://dolarapi.com/v1/dolares` — ver dolarapi.com/docs. */
interface DolarApiEntry {
  casa: string;
  nombre: string;
  compra: number;
  venta: number;
  fechaActualizacion: string; // ISO datetime
}

const CASA_TO_QUOTE_KIND: Record<string, string> = {
  oficial: "oficial",
  blue: "blue",
  bolsa: "mep",
  contadoconliqui: "ccl",
  mayorista: "mayorista",
  cripto: "cripto",
  tarjeta: "tarjeta",
};

function isoDate(datetime: string): string {
  return datetime.slice(0, 10);
}

/**
 * DolarApi cotiza siempre USD → ARS (cuántos ARS por 1 USD). Cubre además
 * UY/CL/BO/BR/CO/VE/MX vía endpoints propios — por ahora solo se
 * implementa el de Argentina, que es el que trae varias cotizaciones por
 * par (oficial/blue/MEP/CCL), el caso que de verdad diferencia esta app.
 */
export function createDolarApiProvider(fetchImpl: typeof fetch = fetch): FxProvider {
  return {
    id: "dolarapi",
    supports(base, quote) {
      return (base === "USD" && quote === "ARS") || (base === "ARS" && quote === "USD");
    },
    async fetchQuotes(base, quote): Promise<ProviderQuote[]> {
      const res = await fetchImpl("https://dolarapi.com/v1/dolares");
      if (!res.ok) throw new Error(`dolarapi respondió ${res.status}`);
      const entries = (await res.json()) as DolarApiEntry[];

      return entries
        .filter((e) => e.casa in CASA_TO_QUOTE_KIND)
        .map((e): ProviderQuote => {
          // venta: lo que cuesta comprar 1 USD en ARS — la referencia habitual para gastos.
          const usdToArs: ScaledRate = parseRate(e.venta.toString());
          const rate = base === "USD" ? usdToArs : invertRate(usdToArs);
          return {
            base,
            quote,
            quoteKind: CASA_TO_QUOTE_KIND[e.casa] ?? e.casa,
            rate,
            asOf: isoDate(e.fechaActualizacion),
          };
        });
    },
  };
}
