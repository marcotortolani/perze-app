import { convert, type ScaledRate } from "@/lib/fx/rate";
import { money } from "@/lib/money/money";
import { transactionsRepo } from "@/lib/repos/transactions-repo";
import type { TransactionRow } from "@/lib/db/schema";

export interface ResolvePendingFxParams {
  transactionId: string;
  /** Moneda base del household — destino de la conversión. */
  baseCurrency: string;
  /** El rate a aplicar, ya resuelto por el caller (manual, del día, o heredado). */
  rate: ScaledRate;
  quoteKind?: TransactionRow["fxQuoteKind"];
}

/**
 * A4 — la única escritura legítima de un `amount_base` después de la
 * inserción: cuando un movimiento `pending` (`fxRate === null`) se resuelve.
 * Antes de esto no existía ninguna función con este nombre — la lógica
 * vivía duplicada e inline en `accounts/resolve-fx/page.tsx`.
 *
 * Nota de alcance: esto resuelve el padre (`transactions`). La propagación
 * a los hijos (`transaction_splits`/`transaction_shares`) es responsabilidad
 * del trigger `AFTER UPDATE ON transactions` de la migración de F4 (A6) —
 * `transaction_shares` ni siquiera tiene espejo en Dexie hoy (vive solo en
 * Supabase, ver `transaction-shares-repo.ts`), así que no hay nada que este
 * módulo pueda recalcular localmente sin duplicar esa lógica del lado
 * cliente. No se ataca acá para no reinventar un camino de escritura que la
 * migración de F4 ya va a cubrir del lado servidor.
 */
export async function resolvePendingFx({ transactionId, baseCurrency, rate, quoteKind = "custom" }: ResolvePendingFxParams): Promise<TransactionRow> {
  const tx = await transactionsRepo.get(transactionId);
  if (!tx) throw new Error(`Movimiento ${transactionId} no encontrado`);
  if (tx.fxRate !== null) {
    // Ya resuelto — nunca se pisa un rate congelado (misma regla que A4 en update-transaction).
    return tx;
  }

  const amountBase = convert(money(tx.amount, tx.currencyCode), baseCurrency, rate).amount;

  return transactionsRepo.update(transactionId, {
    fxRate: rate,
    fxSource: "manual",
    fxProvider: null,
    fxQuoteKind: quoteKind,
    fxResolvedAt: new Date().toISOString(),
    amountBase,
  });
}
