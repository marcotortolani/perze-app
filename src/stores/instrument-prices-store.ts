import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CachedInstrumentPrice {
  close: number;
  currencyCode: string;
  asOf: string;
  provider: string;
}

interface InstrumentPricesState {
  prices: Record<string, CachedInstrumentPrice>;
  setPrices: (updates: Record<string, CachedInstrumentPrice>) => void;
}

/**
 * D36 — último valor de mercado conocido por instrumento, persistido en
 * localStorage. Entrar a "mi portfolio" con la API caída o lenta antes
 * mostraba `$ 0,00` (el fallback de `value = price ? ... : 0n` cuando no
 * había precio todavía) — un 0 inventado es tan engañoso ahí como en
 * cualquier otro lado de la app. Con esto, el primer render usa el último
 * precio que se conoció (aunque sea de otra sesión), y se pisa solo
 * cuando la consulta real a la API trae uno nuevo — nunca al revés.
 */
export const useInstrumentPricesStore = create<InstrumentPricesState>()(
  persist(
    (set) => ({
      prices: {},
      setPrices: (updates) => set((s) => ({ prices: { ...s.prices, ...updates } })),
    }),
    { name: "perze-instrument-prices" }
  )
);
