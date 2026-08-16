import type { FxResolution } from "@/lib/fx/resolve";
import { convert } from "@/lib/fx/rate";
import { fromMajorUnitsUnsafe, money } from "@/lib/money/money";
import type { Position } from "./positions";

/** Subconjunto de `Instrument` (instruments-repo.ts) que la valuación necesita — evita acoplar este módulo puro al repo entero. */
export interface ValuationInstrument {
  id: string;
  currencyCode: string;
  assetClassId: string | null;
}

/** Subconjunto de `LatestPrice` (price-snapshots-repo.ts) que la valuación necesita. */
export interface ValuationPrice {
  close: number;
}

export interface ValuedPosition {
  instrumentId: string;
  quantity: number;
  /** Siempre en `baseCurrency` — ya convertido. */
  baseValue: bigint;
}

export interface PositionsValuation {
  items: ValuedPosition[];
  totalValue: bigint;
  /** Posiciones con precio conocido pero sin `fx_rate` resuelto (moneda del instrumento → moneda base). */
  excludedFxCount: number;
  /** Posiciones sin precio de mercado (`price_snapshots` vacío para el instrumento). */
  excludedNoPriceCount: number;
}

/**
 * Valúa un mapa de `Position` (de `computePositions`) en la moneda base del
 * household, en dólares/pesos reales — no `quantity * price.close` crudo, que
 * suma monedas distintas sin convertir (V9). Único cálculo compartido por
 * `allocation/page.tsx` y `rebalance/page.tsx`: antes de este helper cada
 * pantalla reimplementaba el mismo loop de FX/precio, y una de las dos
 * quedando desactualizada es exactamente el tipo de bug que `cash-flow.ts`
 * ya documenta para el signo de flujo.
 *
 * `needs_fx` (CLAUDE.md): una posición sin cotización resuelta se EXCLUYE del
 * total, nunca se cuenta como si valiera 0 — `excludedFxCount` es lo que el
 * caller muestra vía `NeedsFxBanner`. Sin precio de mercado es una causa
 * distinta (`excludedNoPriceCount`, copy propio, no es `needs_fx`).
 */
export function valuePositionsInBase(params: {
  positions: Map<string, Position>;
  instrumentById: Map<string, ValuationInstrument>;
  prices: Map<string, ValuationPrice>;
  baseCurrency: string;
  /** Resoluciones de FX por moneda de instrumento (ya resueltas por el caller vía `fxRepo.resolve`), moneda del instrumento → moneda base. */
  fxResolutions: Map<string, FxResolution>;
}): PositionsValuation {
  const { positions, instrumentById, prices, baseCurrency, fxResolutions } = params;

  let totalValue = 0n;
  let excludedFxCount = 0;
  let excludedNoPriceCount = 0;
  const items: ValuedPosition[] = [];

  for (const [instrumentId, position] of positions) {
    if (position.quantity <= 0) continue;
    const instrument = instrumentById.get(instrumentId);
    const price = prices.get(instrumentId);
    if (!instrument) continue;
    if (!price) {
      excludedNoPriceCount += 1;
      continue;
    }
    const value = fromMajorUnitsUnsafe(position.quantity * price.close, instrument.currencyCode);
    let baseValue: bigint | null;
    if (instrument.currencyCode === baseCurrency) {
      baseValue = value;
    } else {
      const resolution = fxResolutions.get(instrument.currencyCode);
      baseValue = resolution?.rate ? convert(money(value, instrument.currencyCode), baseCurrency, resolution.rate).amount : null;
    }
    if (baseValue === null) {
      excludedFxCount += 1;
      continue;
    }
    totalValue += baseValue;
    items.push({ instrumentId, quantity: position.quantity, baseValue });
  }

  return { items, totalValue, excludedFxCount, excludedNoPriceCount };
}
