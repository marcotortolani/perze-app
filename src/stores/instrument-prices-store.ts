import { create } from "zustand";
import { persist } from "zustand/middleware";
import { sanitizedPersist } from "@/lib/stores/persist-sanitize";

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

/** Un precio más viejo que esto ya no cuenta como "último conocido" — se poda en vez de mostrarse indefinidamente. */
export const PRICE_CACHE_MAX_AGE_DAYS = 30;

/** Descarta entradas con `asOf` más viejo que `PRICE_CACHE_MAX_AGE_DAYS`, y cualquier entrada con `asOf` no parseable. `nowMs` se pasa explícito para no depender del reloj en tests. */
export function prunePrices(
  prices: Record<string, CachedInstrumentPrice>,
  nowMs: number
): Record<string, CachedInstrumentPrice> {
  const maxAgeMs = PRICE_CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const pruned: Record<string, CachedInstrumentPrice> = {};
  for (const [id, price] of Object.entries(prices)) {
    const asOfMs = Date.parse(price.asOf);
    if (Number.isNaN(asOfMs)) continue;
    if (nowMs - asOfMs > maxAgeMs) continue;
    pruned[id] = price;
  }
  return pruned;
}

function isValidPrice(v: unknown): v is CachedInstrumentPrice {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return typeof p.close === "number" && typeof p.currencyCode === "string" && typeof p.asOf === "string" && typeof p.provider === "string";
}

function sanitize(persisted: unknown): { prices: Record<string, CachedInstrumentPrice> } {
  const p = ((persisted ?? {}) as Record<string, unknown>).prices as Record<string, unknown> | undefined;
  const prices: Record<string, CachedInstrumentPrice> = {};
  for (const [id, entry] of Object.entries(p ?? {})) {
    if (isValidPrice(entry)) prices[id] = entry;
  }
  return { prices: prunePrices(prices, Date.now()) };
}

/**
 * D36 — último valor de mercado conocido por instrumento, persistido en
 * localStorage. Entrar a "mi portfolio" con la API caída o lenta antes
 * mostraba `$ 0,00` (el fallback de `value = price ? ... : 0n` cuando no
 * había precio todavía) — un 0 inventado es tan engañoso ahí como en
 * cualquier otro lado de la app. Con esto, el primer render usa el último
 * precio que se conoció (aunque sea de otra sesión), y se pisa solo
 * cuando la consulta real a la API trae uno nuevo — nunca al revés.
 *
 * Se poda por edad (`prunePrices`) tanto al escribir (`setPrices`) como al
 * rehidratar, y se limpia por completo en el logout (`sign-out.ts`) — un
 * precio de otra cuenta no debe sobrevivir al cambio de usuario en el
 * mismo navegador.
 */
export const useInstrumentPricesStore = create<InstrumentPricesState>()(
  persist(
    (set) => ({
      prices: {},
      setPrices: (updates) => set((s) => ({ prices: prunePrices({ ...s.prices, ...updates }, Date.now()) })),
    }),
    {
      name: "perze-instrument-prices",
      version: 1,
      ...sanitizedPersist<InstrumentPricesState, { prices: Record<string, CachedInstrumentPrice> }>(sanitize),
    }
  )
);
