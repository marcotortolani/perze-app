/**
 * Bloque I — lotes FIFO por instrumento: cada compra (`buy`/`transfer_in`)
 * abre un lote propio con su cantidad, precio y costo; cada venta
 * (`sell`/`transfer_out`) consume los lotes abiertos más antiguos primero
 * (FIFO, la decisión de producto tomada — no promedio ponderado). Es la
 * única fuente de verdad del cálculo de posiciones: `computePositions`
 * (`positions.ts`) se deriva sumando lotes abiertos, no reimplementa su
 * propio prorrateo.
 *
 * FIFO reemplaza al promedio ponderado que corría antes en `positions.ts`
 * — con más de un lote a precios distintos, el costo base remanente
 * después de una venta puede diferir del que daba el promedio (vender se
 * lleva el costo de la compra más vieja entera, no una porción de todas).
 * Es un cambio de número intencional, no una regresión.
 */
const ADDS_QUANTITY = new Set(["buy", "transfer_in"]);
const REMOVES_QUANTITY = new Set(["sell", "transfer_out"]);

/** Escala fija para prorratear un `bigint` por una fracción de `number` sin pasar por punto flotante en el resultado. */
const PRORATION_SCALE = 1_000_000;

export interface LotTradeInput {
  id: string;
  instrumentId: string;
  kind: string;
  quantity: number;
  price: number;
  /** Costo total de la operación en unidades mínimas de la moneda del trade. */
  netAmount: bigint;
  executedAt: string;
}

export interface Lot {
  buyTradeId: string;
  instrumentId: string;
  executedAt: string;
  originalQuantity: number;
  /** 0 = lote cerrado del todo. */
  remainingQuantity: number;
  unitPrice: number;
  /** Costo base proporcional a `remainingQuantity` — se reduce cuando una venta consume de este lote. */
  costBasisRemaining: bigint;
}

export interface LotAllocation {
  buyTradeId: string;
  quantity: number;
}

export interface LotsResult {
  lotsByInstrument: Map<string, Lot[]>;
  /** Qué lote(s) consumió cada venta, en el orden en que los consumió. */
  allocationsBySellTradeId: Map<string, LotAllocation[]>;
}

/**
 * Mismo criterio que `positions.ts`: `tradesRepo.listForPortfolio` devuelve
 * `executed_at DESC` (para mostrar lo más reciente primero), pero FIFO
 * necesita el orden cronológico real. Desempate estable por `id`.
 */
function chronological(trades: readonly LotTradeInput[]): LotTradeInput[] {
  return [...trades].sort((a, b) => (a.executedAt < b.executedAt ? -1 : a.executedAt > b.executedAt ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Prorratea `costBasis` por `consumedQty / totalQty`, en `bigint`, sin pasar la plata por punto flotante. */
function proratedCost(costBasis: bigint, consumedQty: number, totalQty: number): bigint {
  if (totalQty <= 0) return 0n;
  return (costBasis * BigInt(Math.round(consumedQty * PRORATION_SCALE))) / BigInt(Math.round(totalQty * PRORATION_SCALE));
}

export function computeLots(trades: readonly LotTradeInput[]): LotsResult {
  const lotsByInstrument = new Map<string, Lot[]>();
  const allocationsBySellTradeId = new Map<string, LotAllocation[]>();

  for (const trade of chronological(trades)) {
    const lots = lotsByInstrument.get(trade.instrumentId) ?? [];
    if (!lotsByInstrument.has(trade.instrumentId)) lotsByInstrument.set(trade.instrumentId, lots);

    if (ADDS_QUANTITY.has(trade.kind)) {
      lots.push({
        buyTradeId: trade.id,
        instrumentId: trade.instrumentId,
        executedAt: trade.executedAt,
        originalQuantity: trade.quantity,
        remainingQuantity: trade.quantity,
        unitPrice: trade.price,
        costBasisRemaining: trade.netAmount,
      });
      continue;
    }

    if (REMOVES_QUANTITY.has(trade.kind)) {
      let toConsume = trade.quantity;
      const allocations: LotAllocation[] = [];
      // FIFO: el lote abierto más antiguo primero — `lots` ya está en
      // orden de apertura porque se pushea en orden cronológico.
      for (const lot of lots) {
        if (toConsume <= 0) break;
        if (lot.remainingQuantity <= 0) continue;
        const consumed = Math.min(toConsume, lot.remainingQuantity);
        const consumedCost = proratedCost(lot.costBasisRemaining, consumed, lot.remainingQuantity);
        lot.remainingQuantity -= consumed;
        lot.costBasisRemaining -= consumedCost;
        toConsume -= consumed;
        allocations.push({ buyTradeId: lot.buyTradeId, quantity: consumed });
      }
      // `toConsume > 0` acá sería vender más de lo que hay — la UI de
      // `trades/new` ya lo bloquea (`exceedsHeldQuantity`) antes de llegar
      // acá, así que no hace falta un tercer estado de error: simplemente
      // no queda nada más que consumir.
      allocationsBySellTradeId.set(trade.id, allocations);
    }
    // El resto de los `kind` (dividend, coupon, fee, tax, interest,
    // revaluation, ...) no abren ni consumen lotes — mismo criterio que
    // `positions.ts`.
  }

  return { lotsByInstrument, allocationsBySellTradeId };
}
