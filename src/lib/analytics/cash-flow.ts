import type { TransactionKind } from "@/lib/db/schema";

/**
 * El único lugar donde `kind` se traduce a "esto es plata que entra/sale" —
 * reemplaza los `if (kind === "expense") ... else ...` sueltos que había en
 * cada agregado (period-summary, money-flow, weekly-summary, wrapped, home,
 * net-worth, history). Dos preguntas distintas, dos funciones con nombre:
 *
 * - `classifyCashFlow`: ¿movió liquidez? `investing` cuenta — comprar o
 *   vender un instrumento es plata real que sale o entra de la misma cuenta
 *   que se usa para todo lo demás.
 * - `classifyConsumption`: ¿fue consumo? `investing` NO cuenta — comprar
 *   acciones no es gastar, y contarlo contaminaría presupuestos y gasto por
 *   categoría.
 *
 * Las dos excluyen `needs_fx` (`amountBase === null`) de la misma forma
 * (CLAUDE.md § needs_fx): nunca se cuenta como si valiera 0, y el caller
 * incrementa su propio `excludedCount` cuando el bucket es `needsFx`.
 */

export type CashFlowBucket = "inflow" | "outflow" | "structural" | "needsFx";

export interface CashFlowInput {
  kind: TransactionKind;
  amountBase: bigint | null;
}

export interface CashFlowClass {
  bucket: CashFlowBucket;
  /** Siempre >= 0n — el caller decide el signo según `bucket`. */
  magnitude: bigint;
}

const STRUCTURAL: CashFlowClass = { bucket: "structural", magnitude: 0n };

function classify(tx: CashFlowInput, investingCounts: boolean): CashFlowClass {
  // transfer/adjustment van antes del chequeo de amountBase: una transferencia
  // sin cotización no debe inflar el conteo de excluidos de nadie.
  if (tx.kind === "transfer" || tx.kind === "adjustment") return STRUCTURAL;

  if (tx.amountBase === null) return { bucket: "needsFx", magnitude: 0n };

  if (tx.kind === "expense") return { bucket: "outflow", magnitude: tx.amountBase };
  if (tx.kind === "income") return { bucket: "inflow", magnitude: tx.amountBase };

  // kind === "investing"
  if (!investingCounts) return STRUCTURAL;
  if (tx.amountBase < 0n) return { bucket: "outflow", magnitude: -tx.amountBase };
  if (tx.amountBase > 0n) return { bucket: "inflow", magnitude: tx.amountBase };
  // amountBase === 0n: placeholder de `computeSettlementAmount` cuando falta
  // la cotización de captura (needs_capture_fx) — no es un movimiento real
  // todavía, no debe sumar a ningún lado.
  return STRUCTURAL;
}

/** ¿Movió liquidez? Compras y ventas de instrumentos cuentan. */
export function classifyCashFlow(tx: CashFlowInput): CashFlowClass {
  return classify(tx, true);
}

/** ¿Fue consumo? Compras y ventas de instrumentos NO cuentan. */
export function classifyConsumption(tx: CashFlowInput): CashFlowClass {
  return classify(tx, false);
}

/** Delta neto de `classifyCashFlow`: positivo en inflow, negativo en outflow, 0n en cualquier otro caso. */
export function cashFlowNetBase(tx: CashFlowInput): bigint {
  const { bucket, magnitude } = classifyCashFlow(tx);
  if (bucket === "inflow") return magnitude;
  if (bucket === "outflow") return -magnitude;
  return 0n;
}
