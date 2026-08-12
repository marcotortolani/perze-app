/**
 * Bloque I — agrega trades en posiciones por instrumento: cantidad
 * tenida y costo base. `buy`/`transfer_in` suman cantidad,
 * `sell`/`transfer_out` restan; el resto (dividendos, intereses,
 * comisiones, `revaluation`...) son flujo de caja o ajuste de valor del
 * portfolio, no cambian cuánto del instrumento se tiene.
 *
 * `transfer_in` es la posición inicial (I3): un holding que ya existía
 * antes de usar la app, cargado sin que ninguna cuenta se mueva (ver
 * `tradeMovesCash`, `src/lib/investments/trade-settlement-policy.ts`) —
 * para el cálculo de la posición es exactamente una compra: suma cantidad
 * y costo base igual. `transfer_out` es su espejo (salida de una posición
 * sin venta real, p. ej. mover el activo a otro broker).
 */
const ADDS_QUANTITY = new Set(["buy", "transfer_in"]);
const REMOVES_QUANTITY = new Set(["sell", "transfer_out"]);

export interface PositionTradeInput {
  id: string;
  instrumentId: string;
  kind: string;
  quantity: number;
  /** Costo total de la operación en unidades mínimas de la moneda del trade. */
  netAmount: bigint;
  executedAt: string;
}

export interface Position {
  instrumentId: string;
  quantity: number;
  /** Costo base proporcional a lo que todavía se tiene (se reduce en una venta). */
  costBasis: bigint;
}

/**
 * `tradesRepo.listForPortfolio` devuelve `executed_at DESC` (para mostrar
 * lo más reciente primero) — este cálculo necesita el orden cronológico
 * inverso: una venta procesada antes que su compra reduce una posición
 * vacía (no hace nada) y la compra que sigue suma el costo completo sin
 * descontar nada, dejando costBasis inflado. Desempate estable por `id`
 * para que dos trades del mismo instante no dependan del orden de entrada.
 */
function chronological(trades: readonly PositionTradeInput[]): PositionTradeInput[] {
  return [...trades].sort((a, b) => (a.executedAt < b.executedAt ? -1 : a.executedAt > b.executedAt ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function computePositions(trades: readonly PositionTradeInput[]): Map<string, Position> {
  const positions = new Map<string, Position>();

  for (const trade of chronological(trades)) {
    const current = positions.get(trade.instrumentId) ?? { instrumentId: trade.instrumentId, quantity: 0, costBasis: 0n };

    if (ADDS_QUANTITY.has(trade.kind)) {
      positions.set(trade.instrumentId, {
        instrumentId: trade.instrumentId,
        quantity: current.quantity + trade.quantity,
        costBasis: current.costBasis + trade.netAmount,
      });
    } else if (REMOVES_QUANTITY.has(trade.kind)) {
      const remainingQty = current.quantity - trade.quantity;
      // Costo base proporcional al remanente — vender (o transferir afuera)
      // la mitad de la posición se lleva la mitad del costo acumulado,
      // nunca todo ni nada.
      const remainingCostBasis = current.quantity > 0 ? (current.costBasis * BigInt(Math.round(Math.max(remainingQty, 0) * 1_000_000))) / BigInt(Math.round(current.quantity * 1_000_000)) : 0n;
      positions.set(trade.instrumentId, {
        instrumentId: trade.instrumentId,
        quantity: remainingQty,
        costBasis: remainingQty > 0 ? remainingCostBasis : 0n,
      });
    } else {
      positions.set(trade.instrumentId, current);
    }
  }

  // Instrumentos vendidos del todo no son una posición — se cierran, no se muestran en 0 para siempre.
  for (const [id, position] of positions) {
    if (position.quantity <= 0) positions.delete(id);
  }

  return positions;
}
