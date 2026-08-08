"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { formatAmountCompact } from "@/lib/money/format";
import type { Money } from "@/lib/money/money";

export interface TransactionsSummaryStripProps {
  income: Money;
  expense: Money;
  balance: Money;
  style?: CSSProperties | undefined;
}

/**
 * Ingresos · Egresos · Balance de un conjunto de movimientos.
 *
 * Vivía inline en `TransactionsListContent` (el resumen del período) y se
 * extrajo al aparecer un segundo consumidor. Hoy volvió a tener uno solo: el
 * calendario dejó de ser una pantalla con su propia lista y pasó a ser una
 * vista de `/transactions`, así que el día elegido es un rango de fecha sobre
 * ESTA lista y sus totales ya salen de acá. Se mantiene como componente
 * propio: la franja es sticky adentro del scroller y tiene entidad suficiente.
 *
 * "Egresos", no "Gastos": el total incluye compras de instrumentos además de
 * consumo (`src/lib/analytics/cash-flow.ts`) — es toda la liquidez que salió
 * de las cuentas, no solo lo que se gastó. Presupuestos y gasto por
 * categoría siguen midiendo consumo puro y siguen diciendo "Gastos".
 *
 * Polaridad: ingresos en `--money-positive` (aqua, nunca verde), egresos en
 * tinta neutra y balance con signo — `CLAUDE.md` § polaridad del dinero. El
 * color nunca porta el significado solo: el balance siempre lleva su signo.
 *
 * Quien lo instancia es responsable de EXCLUIR los movimientos sin cotización
 * (`amountBase === null`) de los tres totales y de declarar el conteo excluido
 * con `NeedsFxBanner` — un agregado que los sume como si valieran cero muestra
 * un número falso.
 */
export function TransactionsSummaryStrip({ income, expense, balance, style }: TransactionsSummaryStripProps) {
  const t = useTranslations();
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 12px", borderBottom: "1px solid var(--border)", flexShrink: 0, ...style }}>
      <div>
        <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("transactions.list.income")}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--money-positive)" }}>{formatAmountCompact(income, { showSign: false })}</div>
      </div>
      <div>
        <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("transactions.list.outflows")}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--text-primary)" }}>{formatAmountCompact(expense, { showSign: false })}</div>
      </div>
      <div>
        <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("transactions.list.balance")}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--text-primary)" }}>{formatAmountCompact(balance, { showSign: true })}</div>
      </div>
    </div>
  );
}
