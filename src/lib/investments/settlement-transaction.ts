import { convert } from "@/lib/fx/rate";
import { money } from "@/lib/money/money";

export interface SettlementAmountInput {
  /** `trades.net_amount`, ya firmado con la convención de `trades`: positivo en una compra, negativo en una venta. */
  netAmount: bigint;
  instrumentCurrency: string;
  accountCurrency: string;
  /** `instrumentCurrency` → `accountCurrency`, `null` si no hay cotización disponible (mismo criterio que la captura normal, `save-transaction.ts`). */
  conversionRate: bigint | null;
}

export interface SettlementAmount {
  /** Firmado en la moneda de la cuenta: negativo (sale plata) en una compra, positivo (entra plata) en una venta. */
  amount: bigint;
  currencyCode: string;
  originalAmount: bigint | null;
  originalCurrency: string | null;
  originalRate: bigint | null;
}

/**
 * El settlement de un trade es el espejo de `trades.net_amount`: lo que
 * para el trade es "capital comprado" (positivo) es, para la cuenta de
 * liquidación, plata que SALE (negativo) — y viceversa en una venta. Por
 * eso el signo se invierte acá, una sola vez, en vez de que cada caller lo
 * reinterprete.
 *
 * Mismo patrón que la primera conversión de captura normal
 * (`save-transaction.ts`): si el instrumento cotiza en una moneda distinta
 * de la cuenta de liquidación y no hay cotización, `amount` NUNCA se
 * inventa — queda en 0 (placeholder que no corrompe el saldo) y el importe
 * real se preserva en `original_amount`/`original_currency`, con
 * `original_rate: null` (activa `needs_capture_fx`, columna generada en
 * Postgres, para resolución posterior).
 */
export function computeSettlementAmount(input: SettlementAmountInput): SettlementAmount {
  const settlementSigned = -input.netAmount;

  if (input.instrumentCurrency === input.accountCurrency) {
    return { amount: settlementSigned, currencyCode: input.accountCurrency, originalAmount: null, originalCurrency: null, originalRate: null };
  }

  if (input.conversionRate === null) {
    return { amount: 0n, currencyCode: input.accountCurrency, originalAmount: settlementSigned, originalCurrency: input.instrumentCurrency, originalRate: null };
  }

  const converted = convert(money(settlementSigned, input.instrumentCurrency), input.accountCurrency, input.conversionRate).amount;
  return { amount: converted, currencyCode: input.accountCurrency, originalAmount: settlementSigned, originalCurrency: input.instrumentCurrency, originalRate: input.conversionRate };
}
