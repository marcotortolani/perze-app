export interface PriceQuote {
  /** Precio de cierre, en la moneda nativa del instrumento. */
  close: number;
  /** ISO `YYYY-MM-DD`. */
  asOf: string;
}

/**
 * Interfaz común de proveedor de precios de instrumentos — mismo criterio
 * que `FxProvider` (`src/lib/fx/providers/types.ts`): intercambiables, un
 * módulo nuevo por fuente. A diferencia de FX (que cotiza un PAR de
 * monedas), acá se cotiza UN instrumento por su `providerSymbol` — la
 * columna `instruments.provider_symbol` es la que decide qué pedirle a
 * cada proveedor, nunca el símbolo que el usuario ve en pantalla (pueden
 * diferir: un CEDEAR puede necesitar un sufijo distinto en Data912).
 */
export interface PriceProvider {
  readonly id: string;
  fetchPrice(providerSymbol: string): Promise<PriceQuote | null>;
}
