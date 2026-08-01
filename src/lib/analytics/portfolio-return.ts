import { computeXirr, type CashFlow } from "./xirr";

export type TradeKindForXirr =
  | "buy"
  | "sell"
  | "dividend"
  | "coupon"
  | "amortization"
  | "interest"
  | "split"
  | "merger"
  | "fee"
  | "tax"
  | "deposit"
  | "withdrawal"
  | "transfer_in"
  | "transfer_out"
  | "revaluation";

export interface XirrTradeInput {
  kind: TradeKindForXirr;
  executedAt: string;
  amountBase: bigint | null;
}

/** Signo del flujo de caja de cada tipo de operación, desde la óptica del inversor. `null` = no mueve caja (split/merger/revaluation). */
const OUTFLOW_KINDS = new Set<TradeKindForXirr>(["buy", "deposit", "transfer_in", "fee", "tax"]);
const INFLOW_KINDS = new Set<TradeKindForXirr>(["sell", "dividend", "coupon", "amortization", "interest", "withdrawal", "transfer_out"]);

export interface PortfolioReturnResult {
  xirr: number | null;
  excludedCount: number;
  flowCount: number;
}

/**
 * XIRR del portfolio: cada trade con `amount_base` resuelto se vuelve un
 * flujo de caja (signo según el tipo), más el valor de mercado actual
 * como el flujo final positivo — sin esa cifra de cierre, XIRR no tiene
 * con qué "terminar" y da un resultado sin sentido.
 */
export function computePortfolioReturn(trades: readonly XirrTradeInput[], currentValue: bigint, now: Date): PortfolioReturnResult {
  const flows: CashFlow[] = [];
  let excludedCount = 0;

  for (const trade of trades) {
    if (!OUTFLOW_KINDS.has(trade.kind) && !INFLOW_KINDS.has(trade.kind)) continue;
    if (trade.amountBase === null) {
      excludedCount += 1;
      continue;
    }
    const sign = OUTFLOW_KINDS.has(trade.kind) ? -1 : 1;
    flows.push({ date: new Date(trade.executedAt), amount: sign * Number(trade.amountBase) });
  }

  if (flows.length > 0 && currentValue > 0n) {
    flows.push({ date: now, amount: Number(currentValue) });
  }

  const sorted = [...flows].sort((a, b) => a.date.getTime() - b.date.getTime());
  return { xirr: computeXirr(sorted), excludedCount, flowCount: sorted.length };
}
