import type { AccountRow, HouseholdRow, TransactionRow } from "@/lib/db/schema";
import { evaluateKeypadExpression } from "@/lib/money/keypad";
import { convert, rateFromInteger } from "@/lib/fx/rate";
import { fxRepo } from "@/lib/repos/fx-repo";
import { todayIso } from "@/lib/repos/ids";
import { transactionsRepo, type NewTransactionInput } from "@/lib/repos/transactions-repo";
import type { CaptureDraft } from "@/stores/capture-draft-store";

export interface SaveDraftParams {
  draft: CaptureDraft;
  household: HouseholdRow;
  userId: string;
  account: AccountRow;
  counterAccount?: AccountRow | undefined;
}

/**
 * Traduce el borrador de captura a un movimiento real: resuelve el monto
 * (keypad), la conversión a la moneda base del household (`lib/fx`), y —
 * para transferencias — el lado de entrada. Guardar no puede fallar: si
 * no hay tipo de cambio, el movimiento se guarda igual, sin conversión
 * (`needs_fx`), nunca se bloquea.
 */
export async function saveDraftAsTransaction({ draft, household, userId, account, counterAccount }: SaveDraftParams): Promise<TransactionRow> {
  const currency = draft.currency || account.currencyCode;
  const amount = evaluateKeypadExpression(draft.amountExpression || "0", currency);
  const date = draft.occurredAt.slice(0, 10);

  const base: Omit<NewTransactionInput, "kind" | "accountId" | "counterAccountId" | "amount" | "counterAmount" | "counterCurrencyCode" | "counterFxRate"> = {
    householdId: household.id,
    createdBy: userId,
    occurredAt: draft.occurredAt,
    currencyCode: currency,
    fxRate: null,
    fxSource: "identity",
    fxProvider: null,
    fxQuoteKind: null,
    fxResolvedAt: null,
    amountBase: null,
    categoryId: draft.categoryId,
    payeeId: null,
    note: draft.note || null,
    attachments: [],
    location: null,
    status: "cleared",
    visibility: "household",
    recurringId: null,
    installmentGroupId: null,
    installmentNumber: null,
    installmentTotal: null,
    source: "manual",
  };

  let fx: Pick<NewTransactionInput, "fxRate" | "fxSource" | "fxProvider" | "fxQuoteKind" | "fxResolvedAt" | "amountBase"> = {
    fxRate: null,
    fxSource: "identity",
    fxProvider: null,
    fxQuoteKind: null,
    fxResolvedAt: null,
    amountBase: null,
  };

  if (currency === household.baseCurrency) {
    // `fxRate: null` es la señal de `needs_fx` (`docs/01-arquitectura-datos.md`
    // § 2.5) — identidad de moneda no es lo mismo que "sin resolver", así que
    // acá va 1 explícito, igual que hace `resolveFxRate` para `base === quote`.
    fx = {
      fxRate: rateFromInteger(1),
      fxSource: "identity",
      fxProvider: null,
      fxQuoteKind: null,
      fxResolvedAt: todayIso(),
      amountBase: amount.amount,
    };
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

  if (draft.kind === "transfer") {
    if (!counterAccount) throw new Error("Una transferencia necesita cuenta de destino");

    let counterAmount = amount.amount;
    let counterFxRate = null as bigint | null;
    if (counterAccount.currencyCode !== currency) {
      const resolution = await fxRepo.resolve({ householdId: household.id, base: currency, quote: counterAccount.currencyCode, date });
      if (resolution.rate !== null) {
        counterAmount = convert(amount, counterAccount.currencyCode, resolution.rate).amount;
        counterFxRate = resolution.rate;
      }
    }

    return transactionsRepo.create({
      ...base,
      kind: "transfer",
      accountId: account.id,
      counterAccountId: counterAccount.id,
      amount: amount.amount,
      counterAmount,
      counterCurrencyCode: counterAccount.currencyCode,
      counterFxRate,
      ...fx,
    });
  }

  return transactionsRepo.create({
    ...base,
    kind: draft.kind,
    accountId: account.id,
    counterAccountId: null,
    amount: amount.amount,
    counterAmount: null,
    counterCurrencyCode: null,
    counterFxRate: null,
    ...fx,
  });
}
