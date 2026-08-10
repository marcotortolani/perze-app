import type { AccountRow } from "@/lib/db/schema";
import { computeTransactionEffects, type TransactionForEffects } from "@/lib/repos/balance-effects";
import { classifyCashFlow } from "./cash-flow";
import type { PeriodTransactionInput } from "./period-summary";

export type BalanceTransaction = TransactionForEffects & { occurredAt: string };

/**
 * Saldo de una cuenta a una fecha, reconstruido desde `opening_balance` +
 * los efectos de todo lo anterior a esa fecha.
 *
 * **No se usa `account.currentBalance`**, por el mismo motivo que
 * `computeAccountEvolution` (D66): ese campo lo puede pisar un pull en
 * background con un valor del servidor a medio recalcular mientras el
 * outbox todavía tiene movimientos en tránsito. Sumar desde
 * `opening_balance` usa solo la lista de transacciones, que siempre está
 * al día.
 *
 * `atIso` es exclusivo: el saldo "al inicio del período" no incluye lo que
 * pasó ese mismo día a partir del corte, y el saldo "al cierre" se pide con
 * el inicio del período siguiente.
 */
export function accountBalanceAt(
  account: Pick<AccountRow, "id" | "openingBalance" | "openingDate">,
  transactions: readonly BalanceTransaction[],
  atIso: string
): bigint {
  // Antes de `opening_date` la cuenta no existía. Devolver
  // `opening_balance` ahí fabricaría un saldo que nunca fue cierto — es la
  // misma distinción que hace `computeAccountEvolution` (D66b).
  if (account.openingDate && atIso <= account.openingDate) return 0n;

  let balance = account.openingBalance;
  for (const tx of transactions) {
    if (tx.occurredAt >= atIso) continue;
    const effect = computeTransactionEffects(tx).find((e) => e.accountId === account.id);
    if (effect) balance += effect.delta;
  }
  return balance;
}

export interface AccountPeriodBalance {
  accountId: string;
  name: string;
  currencyCode: string;
  opening: bigint;
  closing: bigint;
  /** `closing - opening`. Positivo = la cuenta terminó con más plata. */
  delta: bigint;
}

/**
 * Cómo empezó y cómo terminó cada cuenta en el período.
 *
 * **Cada saldo queda en la moneda de SU cuenta y no se consolida.** Sumar
 * una caja de ahorro en dólares con una en pesos daría un número sin
 * significado, y convertir saldos a la moneda base exigiría una cotización
 * por cuenta y por fecha que no está guardada (`amount_base` es por
 * movimiento, no por saldo). El resumen los lista; no inventa un total.
 */
export function periodAccountBalances(
  accounts: readonly Pick<AccountRow, "id" | "name" | "currencyCode" | "openingBalance" | "openingDate" | "archivedAt">[],
  transactions: readonly BalanceTransaction[],
  fromIso: string,
  toIso: string
): AccountPeriodBalance[] {
  return accounts
    .filter((account) => account.archivedAt === null)
    .map((account) => {
      const opening = accountBalanceAt(account, transactions, fromIso);
      const closing = accountBalanceAt(account, transactions, toIso);
      return { accountId: account.id, name: account.name, currencyCode: account.currencyCode, opening, closing, delta: closing - opening };
    });
}

export interface InvestingActivity {
  /** Plata que salió a comprar instrumentos, en moneda base. */
  invested: bigint;
  /** Plata que entró por ventas, en moneda base. */
  divested: bigint;
  /** Cuántos movimientos de inversión hubo — si es 0, el resumen no muestra la sección. */
  count: number;
  /** Movimientos de inversión sin cotización, excluidos de los totales de arriba. */
  excludedCount: number;
}

/**
 * Compras y ventas de instrumentos del período.
 *
 * Sale de los movimientos `investing` (el settlement de cada trade), no de
 * la tabla `trades`: es la misma plata que ya movió una cuenta, así que el
 * resumen habla de flujo y no de posiciones. Un resumen mensual no es un
 * estado de cartera.
 *
 * `count === 0` es la señal para no dibujar la sección: quien no invierte
 * no tiene por qué recibir un bloque vacío.
 */
export function investingActivity(transactions: readonly PeriodTransactionInput[], from: Date, to: Date): InvestingActivity {
  let invested = 0n;
  let divested = 0n;
  let count = 0;
  let excludedCount = 0;

  for (const tx of transactions) {
    if (tx.kind !== "investing") continue;
    const occurred = new Date(tx.occurredAt);
    if (occurred < from || occurred >= to) continue;

    count += 1;
    const { bucket, magnitude } = classifyCashFlow(tx);
    if (bucket === "needsFx") {
      excludedCount += 1;
      continue;
    }
    if (bucket === "outflow") invested += magnitude;
    else if (bucket === "inflow") divested += magnitude;
  }

  return { invested, divested, count, excludedCount };
}
