import { computeLots, type LotTradeInput } from "./lots";

/**
 * Bloque I — agrega los lotes de `computeLots` en una posición por
 * instrumento (cantidad tenida y costo base). El cálculo por lote (FIFO)
 * es la única fuente de verdad — acá solo se suma lo que sigue abierto,
 * no se reimplementa ningún prorrateo propio. Antes este archivo hacía su
 * propio promedio ponderado; con más de un lote a precios distintos ese
 * número podía diferir del que da FIFO (ver el comentario largo en
 * `lots.ts`) — es un cambio de número intencional, no una regresión.
 */
export type PositionTradeInput = LotTradeInput;

export interface Position {
  instrumentId: string;
  quantity: number;
  /** Costo base proporcional a lo que todavía se tiene (se reduce en una venta). */
  costBasis: bigint;
}

export function computePositions(trades: readonly PositionTradeInput[]): Map<string, Position> {
  const { lotsByInstrument } = computeLots(trades);
  const positions = new Map<string, Position>();

  for (const [instrumentId, lots] of lotsByInstrument) {
    let quantity = 0;
    let costBasis = 0n;
    for (const lot of lots) {
      quantity += lot.remainingQuantity;
      costBasis += lot.costBasisRemaining;
    }
    // Instrumentos vendidos del todo no son una posición — se cierran, no se muestran en 0 para siempre.
    if (quantity > 0) positions.set(instrumentId, { instrumentId, quantity, costBasis });
  }

  return positions;
}
