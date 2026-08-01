import type { AccountRow, HouseholdRow, TransactionRow } from "@/lib/db/schema";
import { evaluateKeypadExpression } from "@/lib/money/keypad";
import type { NumberLocale } from "@/lib/money/parse";
import { convert, rateFromInteger } from "@/lib/fx/rate";
import { fxRepo } from "@/lib/repos/fx-repo";
import { transactionsRepo } from "@/lib/repos/transactions-repo";
import type { CaptureDraft } from "@/stores/capture-draft-store";

export interface UpdateDraftParams {
  transactionId: string;
  draft: CaptureDraft;
  household: HouseholdRow;
  account: AccountRow;
  counterAccount?: AccountRow | undefined;
  /** D13/auditoría — ver el mismo comentario en `save-transaction.ts`. */
  numberLocale?: NumberLocale | undefined;
}

/**
 * D4 — mismo cálculo que `saveDraftAsTransaction` (Fase 5) pero como parche
 * sobre un movimiento existente: `transactionsRepo.update` ya revierte el
 * efecto de saldo viejo y aplica el nuevo (`lib/repos/balance-effects`),
 * así que un cambio de cuenta, monto o moneda queda contable sin casos
 * especiales acá.
 */
export async function updateTransactionFromDraft({ transactionId, draft, household, account, counterAccount, numberLocale = "es-UY" }: UpdateDraftParams): Promise<TransactionRow> {
  const date = draft.occurredAt.slice(0, 10);

  // Misma primera conversión que saveDraftAsTransaction: amount/currencyCode
  // siempre terminan en la moneda de la cuenta, nunca en la capturada.
  const capturedCurrency = draft.currency || account.currencyCode;
  const capturedAmount = evaluateKeypadExpression(draft.amountExpression || "0", capturedCurrency, numberLocale);

  let amount = capturedAmount;
  let original: Pick<TransactionRow, "originalAmount" | "originalCurrency" | "originalRate"> = {
    originalAmount: null,
    originalCurrency: null,
    originalRate: null,
  };

  if (capturedCurrency !== account.currencyCode) {
    const captureResolution = await fxRepo.resolve({
      householdId: household.id,
      base: capturedCurrency,
      quote: account.currencyCode,
      date,
    });
    if (captureResolution.rate !== null) {
      amount = convert(capturedAmount, account.currencyCode, captureResolution.rate);
      original = {
        originalAmount: capturedAmount.amount,
        originalCurrency: capturedCurrency,
        originalRate: captureResolution.rate,
      };
    }
  }

  const currency = account.currencyCode;

  let fx: Pick<TransactionRow, "fxRate" | "fxSource" | "fxProvider" | "fxQuoteKind" | "fxResolvedAt" | "amountBase"> = {
    fxRate: null,
    fxSource: "identity",
    fxProvider: null,
    fxQuoteKind: null,
    fxResolvedAt: null,
    amountBase: null,
  };

  if (currency === household.baseCurrency) {
    // `fxRate: null` es needs_fx — identidad de moneda no es "sin resolver".
    fx = { fxRate: rateFromInteger(1), fxSource: "identity", fxProvider: null, fxQuoteKind: null, fxResolvedAt: new Date().toISOString(), amountBase: amount.amount };
  } else {
    const resolution = await fxRepo.resolve({ householdId: household.id, base: currency, quote: household.baseCurrency, date });
    fx = {
      fxRate: resolution.rate,
      fxSource: resolution.source,
      fxProvider: resolution.provider,
      fxQuoteKind: resolution.quoteKind,
      fxResolvedAt: resolution.rate !== null ? new Date().toISOString() : null,
      amountBase: resolution.rate !== null ? convert(amount, household.baseCurrency, resolution.rate).amount : null,
    };
  }

  const patch: Partial<TransactionRow> = {
    kind: draft.kind === "transfer" ? "transfer" : draft.kind,
    accountId: account.id,
    counterAccountId: draft.kind === "transfer" ? (counterAccount?.id ?? null) : null,
    amount: amount.amount,
    currencyCode: currency,
    ...original,
    occurredAt: draft.occurredAt,
    categoryId: draft.kind === "transfer" ? null : draft.categoryId,
    note: draft.note || null,
    ...fx,
  };

  if (draft.kind === "transfer" && counterAccount) {
    let counterAmount = amount.amount;
    let counterFxRate: bigint | null = null;
    if (counterAccount.currencyCode !== currency) {
      const resolution = await fxRepo.resolve({ householdId: household.id, base: currency, quote: counterAccount.currencyCode, date });
      if (resolution.rate !== null) {
        counterAmount = convert(amount, counterAccount.currencyCode, resolution.rate).amount;
        counterFxRate = resolution.rate;
      }
    }
    patch.counterAmount = counterAmount;
    patch.counterCurrencyCode = counterAccount.currencyCode;
    patch.counterFxRate = counterFxRate;
  } else {
    patch.counterAmount = null;
    patch.counterCurrencyCode = null;
    patch.counterFxRate = null;
  }

  return transactionsRepo.update(transactionId, patch);
}
