import type { ScaledRate } from "../rate";

export interface ProviderQuote {
  base: string;
  quote: string;
  quoteKind: string;
  rate: ScaledRate;
  /** ISO `YYYY-MM-DD` */
  asOf: string;
}

/**
 * Interfaz común de proveedor de cotizaciones — intercambiables, para que
 * sumar una fuente nueva sea un módulo más, no tocar el resto del sistema.
 * Solo se invocan desde el servidor (`src/app/api/fx/route.ts`); el
 * cliente nunca llama a una API de cotización directo.
 */
export interface FxProvider {
  readonly id: string;
  /** true si este proveedor puede cotizar el par pedido. */
  supports(base: string, quote: string): boolean;
  fetchQuotes(base: string, quote: string): Promise<ProviderQuote[]>;
}
