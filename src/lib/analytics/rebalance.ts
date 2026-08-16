import { money, scaleByFraction, subtract } from "@/lib/money/money";
import type { TargetAllocation, TargetAllocationDimension } from "@/lib/repos/target-allocations-repo";
import type { ValuationInstrument, ValuedPosition } from "./position-valuation";

/** Clase de activo mínima que este cálculo necesita — `assetClasses-repo.AssetClass` cumple. */
export interface RebalanceAssetClass {
  id: string;
  defaultRisk: string | null;
}

export interface RebalanceRow {
  /** `asset_class_id`, código de moneda o `'low'|'medium'|'high'`, según `dimension`. */
  key: string;
  actualPct: number;
  targetPct: number;
  bandPct: number;
  /** `actualPct - targetPct`. Positivo = sobreponderado, negativo = subponderado. */
  driftPct: number;
  withinBand: boolean;
  /** Positivo = comprar para cerrar la brecha, negativo = vender. `null` si no hay `totalValue` contra el que calcular (portfolio vacío). */
  suggestedAmount: bigint | null;
}

export interface RebalanceResult {
  rows: RebalanceRow[];
  /** Suma de `needs_fx` + sin precio de mercado — heredado tal cual de la valuación de posiciones (CLAUDE.md § needs_fx: nunca se cuenta como si valiera 0). */
  excludedCount: number;
  totalValue: bigint;
}

/**
 * Agrupa posiciones ya valuadas (`valuePositionsInBase`) por la `key` de
 * la dimensión elegida y compara contra los `target_allocations`
 * definidos, para armar la tabla de desvío de I-rebalance.
 *
 * - `asset_class`: agrupa por `instrument.assetClassId`.
 * - `risk`: agrupa por `assetClass.defaultRisk` del instrumento (vía su
 *   `assetClassId` — no hay `default_risk` en `instruments`, se deriva).
 * - `currency`: agrupa por `instrument.currencyCode`.
 * - `instrument`: la `key` es el propio `instrumentId`.
 *
 * Una posición sin `key` resoluble para la dimensión (p. ej. un
 * instrumento sin `assetClassId` en la dimensión `asset_class`) cae en
 * `UNASSIGNED_KEY` — así el total sigue cuadrando contra `totalValue` y no
 * desaparece silenciosamente del denominador.
 */
export const UNASSIGNED_KEY = "__unassigned__";

export function computeRebalance(params: {
  dimension: TargetAllocationDimension;
  valuedPositions: readonly ValuedPosition[];
  totalValue: bigint;
  excludedCount: number;
  instrumentById: Map<string, ValuationInstrument>;
  assetClassById: Map<string, RebalanceAssetClass>;
  targets: readonly TargetAllocation[];
  /** Moneda base del household — todos los valores ya vienen convertidos por `valuePositionsInBase`. */
  baseCurrency: string;
}): RebalanceResult {
  const { dimension, valuedPositions, totalValue, excludedCount, instrumentById, assetClassById, targets, baseCurrency } = params;

  const keyOf = (instrumentId: string): string => {
    const instrument = instrumentById.get(instrumentId);
    if (!instrument) return UNASSIGNED_KEY;
    switch (dimension) {
      case "instrument":
        return instrumentId;
      case "currency":
        return instrument.currencyCode;
      case "asset_class":
        return instrument.assetClassId ?? UNASSIGNED_KEY;
      case "risk": {
        const assetClass = instrument.assetClassId ? assetClassById.get(instrument.assetClassId) : undefined;
        return assetClass?.defaultRisk ?? UNASSIGNED_KEY;
      }
      // 'country' y 'sector' quedan en el CHECK del schema para el futuro
      // (ni `instruments` ni `asset_classes` tienen esas columnas hoy —
      // ver nota en `rebalance/page.tsx`).
      default:
        return UNASSIGNED_KEY;
    }
  };

  const actualByKey = new Map<string, bigint>();
  for (const position of valuedPositions) {
    const key = keyOf(position.instrumentId);
    actualByKey.set(key, (actualByKey.get(key) ?? 0n) + position.baseValue);
  }

  const targetByKey = new Map(targets.map((t) => [t.key, t]));
  const allKeys = new Set<string>([...actualByKey.keys(), ...targetByKey.keys()]);

  const rows: RebalanceRow[] = [...allKeys]
    .filter((key) => targetByKey.has(key)) // solo se muestra desvío para lo que tiene objetivo definido
    .map((key) => {
      const target = targetByKey.get(key)!;
      const actualValue = actualByKey.get(key) ?? 0n;
      const actualPct = totalValue > 0n ? (Number(actualValue) / Number(totalValue)) * 100 : 0;
      const driftPct = actualPct - target.targetPct;
      const withinBand = Math.abs(driftPct) <= target.bandPct;
      let suggestedAmount: bigint | null = null;
      if (totalValue > 0n) {
        // targetPct tiene hasta 3 decimales (numeric(6,3)) — se lleva a
        // fracción entera ×1000/100000 para no tocar `number` de punto
        // flotante en el cálculo de plata (CLAUDE.md § dinero).
        const targetNumerator = BigInt(Math.round(target.targetPct * 1000));
        const targetValue = scaleByFraction(money(totalValue, baseCurrency), targetNumerator, 100000n).amount;
        suggestedAmount = subtract(money(targetValue, baseCurrency), money(actualValue, baseCurrency)).amount;
      }
      return { key, actualPct, targetPct: target.targetPct, bandPct: target.bandPct, driftPct, withinBand, suggestedAmount };
    })
    .sort((a, b) => Math.abs(b.driftPct) - Math.abs(a.driftPct));

  return { rows, excludedCount, totalValue };
}
