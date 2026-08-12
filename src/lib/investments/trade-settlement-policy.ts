import type { TradeKind } from "@/lib/repos/trades-repo";

/**
 * Qué `kind` de trade mueve plata de verdad (crea/actualiza la
 * transacción `kind: 'investing'` de liquidación) — equivalente, para
 * trades, de `classifyCashFlow`/`classifyConsumption`
 * (`src/lib/analytics/cash-flow.ts`) para transactions: **una sola
 * función, nunca un `if` inline** en cada call site. `buy`/`sell` son las
 * únicas dos que hoy tienen UI (`trades/new`, `trades/[tradeId]/edit`);
 * `transfer_in` (posición inicial, I3) es la primera excepción real —
 * registra un holding que ya existía, sin que ninguna cuenta se mueva.
 */
export function tradeMovesCash(kind: TradeKind): boolean {
  return kind === "buy" || kind === "sell";
}
