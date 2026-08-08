import type { AccountKind, HouseholdRow } from "@/lib/db/schema";
import { fxRepo } from "@/lib/repos/fx-repo";
import { transactionsRepo } from "@/lib/repos/transactions-repo";
import { todayIso } from "@/lib/repos/ids";
import { resolveFxForAccountCurrency } from "@/features/capture/save-transaction";
import { money } from "@/lib/money/money";
import { computeSettlementAmount } from "./settlement-transaction";

export class SettlementError extends Error {}

export interface SettlementTransactionInput {
  household: HouseholdRow;
  userId: string;
  tradeId: string;
  /** `trades.net_amount`, ya firmado (positivo compra, negativo venta). */
  netAmount: bigint;
  instrumentCurrency: string;
  instrumentSymbol: string;
  accountId: string;
  accountCurrency: string;
  accountKind: AccountKind;
}

/**
 * Crea la transacción `kind: 'investing'` que mueve la cuenta de
 * liquidación de verdad — compartido entre `trades/new` y
 * `trades/[tradeId]/edit`: el alta y la edición resuelven exactamente la
 * misma cadena de FX, así que un trade editado no puede quedar con una
 * transacción vieja calculada distinto.
 *
 * Mensaje en inglés técnico a propósito, como `PayCardError`
 * (`src/features/cards/pay-card.ts`): es un invariante de programación —
 * `tradeSettlementAccounts` ya filtra las tarjetas del picker antes de que
 * el usuario pueda llegar acá — no un mensaje que el usuario tenga que leer
 * traducido. La única forma legítima de llegar con `accountKind ===
 * 'credit_card'` es reeditando un trade viejo sin cambiar de cuenta; la UI
 * de edición ya avisa con `newTradePage.creditCardNotAllowed`.
 */
export async function createSettlementTransaction(input: SettlementTransactionInput): Promise<void> {
  const { household, userId, tradeId, netAmount, instrumentCurrency, instrumentSymbol, accountId, accountCurrency, accountKind } = input;

  if (accountKind === "credit_card") throw new SettlementError("settlement account cannot be a credit_card account");

  let conversionRate: bigint | null = null;
  if (instrumentCurrency !== accountCurrency) {
    const captureResolution = await fxRepo.resolve({ householdId: household.id, base: instrumentCurrency, quote: accountCurrency, date: todayIso() });
    conversionRate = captureResolution.rate;
  }
  const settlement = computeSettlementAmount({ netAmount, instrumentCurrency, accountCurrency, conversionRate });
  const settlementFx = await resolveFxForAccountCurrency(household, accountCurrency, money(settlement.amount, accountCurrency), todayIso());

  await transactionsRepo.create({
    householdId: household.id,
    createdBy: userId,
    kind: "investing",
    occurredAt: new Date().toISOString(),
    accountId,
    counterAccountId: null,
    amount: settlement.amount,
    currencyCode: settlement.currencyCode,
    originalAmount: settlement.originalAmount,
    originalCurrency: settlement.originalCurrency,
    originalRate: settlement.originalRate,
    ...settlementFx,
    counterAmount: null,
    counterCurrencyCode: null,
    counterFxRate: null,
    categoryId: null,
    payeeId: null,
    note: instrumentSymbol,
    attachments: [],
    location: null,
    status: "cleared",
    visibility: "household",
    recurringId: null,
    installmentGroupId: null,
    installmentNumber: null,
    installmentTotal: null,
    source: "manual",
    tradeId,
  });
}

/** Edición: la transacción vieja se descarta y se recrea entera — mismo criterio que `recompute_account_balance` (recomputar completo, no parchear, para no arriesgar drift). */
export async function resyncSettlementTransaction(input: SettlementTransactionInput): Promise<void> {
  const existing = await transactionsRepo.findByTradeId(input.tradeId);
  if (existing) await transactionsRepo.softDelete(existing.id);
  await createSettlementTransaction(input);
}

/**
 * Borrar un trade (`tradesRepo.softDelete`) borra su transacción de
 * settlement — sin esto queda un movimiento fantasma que ya no tiene
 * trade. Devuelve el id de la transacción borrada (o `null` si el trade no
 * tenía una) para que el caller pueda ofrecer "deshacer" simétrico
 * (`instrumentDetailPage.tradeDeleted`, "Reversible, no confirmable").
 */
export async function deleteSettlementTransaction(tradeId: string): Promise<string | null> {
  const existing = await transactionsRepo.findByTradeId(tradeId);
  if (!existing) return null;
  await transactionsRepo.softDelete(existing.id);
  return existing.id;
}

export async function restoreSettlementTransaction(transactionId: string): Promise<void> {
  await transactionsRepo.restore(transactionId);
}
