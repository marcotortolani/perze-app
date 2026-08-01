import type { AccountRow, HouseholdRow, TransactionRow } from "@/lib/db/schema";
import { evaluateKeypadExpression } from "@/lib/money/keypad";
import { money } from "@/lib/money/money";
import { convert, rateFromInteger } from "@/lib/fx/rate";
import { fxRepo } from "@/lib/repos/fx-repo";
import { todayIso } from "@/lib/repos/ids";
import { transactionsRepo, type NewTransactionInput } from "@/lib/repos/transactions-repo";
import { categorizationRulesRepo } from "@/lib/repos/categorization-rules-repo";
import { evaluateCategorizationRules } from "@/lib/analytics/categorization-rules";
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
  const date = draft.occurredAt.slice(0, 10);

  // Primera conversión (CLAUDE.md § dinero, "SON DOS CONVERSIONES, NO UNA"):
  // lo que el usuario tipeó puede estar en otra moneda que la de la cuenta
  // — `amount`/`currencyCode` SIEMPRE terminan en la moneda de la cuenta,
  // nunca en la capturada. Esa conversión ocurre acá, en la captura.
  const capturedCurrency = draft.currency || account.currencyCode;
  const capturedAmount = evaluateKeypadExpression(draft.amountExpression || "0", capturedCurrency);

  let amount = capturedAmount;
  let original: Pick<NewTransactionInput, "originalAmount" | "originalCurrency" | "originalRate"> = {
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
    } else {
      // A3 — sin cotización para la conversión de captura: nunca se
      // reinterpreta el número tipeado como si ya estuviera en la moneda
      // de la cuenta (100 USD tipeados no se guardan como 100 ARS).
      // `amount` queda en 0 — placeholder no-corruptor, sin inventar un
      // rate — y lo tipeado se preserva en `original_*` con
      // `originalRate: null`; `needs_capture_fx` (columna generada en
      // Postgres) marca el movimiento para resolución posterior.
      amount = money(0n, account.currencyCode);
      original = {
        originalAmount: capturedAmount.amount,
        originalCurrency: capturedCurrency,
        originalRate: null,
      };
    }
  }

  const currency = account.currencyCode;

  // K7 — auto-categorización: solo entra si el usuario no eligió categoría
  // él mismo. Una elección explícita nunca se pisa con una regla.
  let matchedCategoryId = draft.categoryId;
  let matchedRuleId: string | null = null;
  if (!draft.categoryId && draft.kind !== "transfer") {
    const rules = await categorizationRulesRepo.list(household.id);
    const matched = evaluateCategorizationRules(rules, { note: draft.note || null, payeeName: draft.payeeName || null });
    if (matched?.actions.categoryId) {
      matchedCategoryId = matched.actions.categoryId;
      matchedRuleId = matched.id;
    }
  }
  if (matchedRuleId) void categorizationRulesRepo.recordHit(matchedRuleId);

  const base: Omit<NewTransactionInput, "kind" | "accountId" | "counterAccountId" | "amount" | "counterAmount" | "counterCurrencyCode" | "counterFxRate"> = {
    householdId: household.id,
    createdBy: userId,
    occurredAt: draft.occurredAt,
    currencyCode: currency,
    ...original,
    fxRate: null,
    fxSource: "identity",
    fxProvider: null,
    fxQuoteKind: null,
    fxResolvedAt: null,
    amountBase: null,
    categoryId: matchedCategoryId,
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
