import type { AccountRow, HouseholdRow, TransactionRow } from "@/lib/db/schema";
import { evaluateKeypadExpression } from "@/lib/money/keypad";
import { money, type Money } from "@/lib/money/money";
import type { NumberLocale } from "@/lib/money/parse";
import { convert, invertRate, rateFromInteger } from "@/lib/fx/rate";
import { fxRepo } from "@/lib/repos/fx-repo";
import { transactionsRepo } from "@/lib/repos/transactions-repo";
import { transactionTagsRepo } from "@/lib/repos/transaction-tags-repo";
import type { CaptureDraft } from "@/stores/capture-draft-store";

export interface UpdateDraftParams {
  transactionId: string;
  draft: CaptureDraft;
  household: HouseholdRow;
  account: AccountRow;
  counterAccount?: AccountRow | undefined;
  /**
   * El movimiento tal como está guardado hoy — necesario para A4: congelar
   * `fx` en la edición salvo que el monto/cuenta/moneda haya cambiado de
   * verdad y el rate previo siguiera `pending` (`NULL`).
   */
  existing: TransactionRow;
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
export async function updateTransactionFromDraft({ transactionId, draft, household, account, counterAccount, existing, numberLocale = "es-UY" }: UpdateDraftParams): Promise<TransactionRow> {
  const date = draft.occurredAt.slice(0, 10);
  // Mismo criterio que `saveDraftAsTransaction` — ver esa función para la
  // explicación completa: "pagar tarjeta" ancla el monto tipeado al
  // destino, no al origen.
  const pinnedToCounter = draft.kind === "transfer" && draft.amountPinnedTo === "counterAccount" && !!counterAccount;

  let amount: Money;
  let original: Pick<TransactionRow, "originalAmount" | "originalCurrency" | "originalRate"> = {
    originalAmount: null,
    originalCurrency: null,
    originalRate: null,
  };
  let pinnedCounterAmount: bigint | null = null;
  let pinnedCounterFxRate: bigint | null = null;

  if (pinnedToCounter) {
    const counterAmountMoney = evaluateKeypadExpression(draft.amountExpression || "0", counterAccount!.currencyCode, numberLocale);
    pinnedCounterAmount = counterAmountMoney.amount;
    if (account.currencyCode === counterAccount!.currencyCode) {
      amount = money(counterAmountMoney.amount, account.currencyCode);
    } else {
      const rate =
        draft.counterFxRateOverride ??
        (await fxRepo.resolve({ householdId: household.id, base: account.currencyCode, quote: counterAccount!.currencyCode, date })).rate;
      if (rate !== null) {
        pinnedCounterFxRate = rate;
        amount = convert(counterAmountMoney, account.currencyCode, invertRate(rate));
      } else {
        amount = money(0n, account.currencyCode);
      }
    }
  } else {
    // Misma primera conversión que saveDraftAsTransaction: amount/currencyCode
    // siempre terminan en la moneda de la cuenta, nunca en la capturada.
    const capturedCurrency = draft.currency || account.currencyCode;
    const capturedAmount = evaluateKeypadExpression(draft.amountExpression || "0", capturedCurrency, numberLocale);
    amount = capturedAmount;

    if (capturedCurrency !== account.currencyCode) {
      const captureResolution = await fxRepo.resolve({
        householdId: household.id,
        base: capturedCurrency,
        quote: account.currencyCode,
        date,
      });
      // Mismo criterio que `saveDraftAsTransaction`: una tasa tocada a mano
      // gana sobre la resuelta, y vale incluso sin cotización del día —
      // es un dato del usuario, no un 1 inventado.
      const captureRate = draft.captureFxRateOverride ?? captureResolution.rate;
      if (captureRate !== null) {
        amount = convert(capturedAmount, account.currencyCode, captureRate);
        original = {
          originalAmount: capturedAmount.amount,
          originalCurrency: capturedCurrency,
          originalRate: captureRate,
        };
      } else {
        // A3 — sin cotización para la conversión de captura: nunca se
        // reinterpreta el número tipeado como si ya estuviera en la moneda
        // de la cuenta. `amount` queda en 0 (placeholder no-corruptor, igual
        // de "no inventado" que dejar `fx_rate` en NULL en la cadena
        // needs_fx) y lo tipeado se preserva en `original_*` con
        // `originalRate: null` — `needs_capture_fx` (columna generada) lo
        // marca para resolución posterior.
        amount = money(0n, account.currencyCode);
        original = {
          originalAmount: capturedAmount.amount,
          originalCurrency: capturedCurrency,
          originalRate: null,
        };
      }
    }
  }

  const currency = account.currencyCode;

  // A4 — congelar el rate: una edición que no toca amount/cuenta/moneda no
  // vuelve a correr la cadena de resolución. Si el rate ya estaba resuelto
  // (fxRate !== null), el cambio se ignora siempre — nunca se pisa un rate
  // congelado. Solo se recalcula cuando el rate previo era `pending` y algo
  // de lo que lo determina cambió de verdad.
  const fxInputsChanged = amount.amount !== existing.amount || account.id !== existing.accountId || currency !== existing.currencyCode;
  // El par de monedas cambió (se movió a una cuenta en otra moneda): la tasa
  // congelada era de OTRA conversión y no aplica a esta. No es "descongelar"
  // un rate, es que el rate viejo dejó de tener nada que ver con este
  // movimiento.
  const currencyPairChanged = currency !== existing.currencyCode;
  const shouldRecomputeFx = fxInputsChanged && (existing.fxRate === null || currencyPairChanged);

  let fx: Partial<Pick<TransactionRow, "fxRate" | "fxSource" | "fxProvider" | "fxQuoteKind" | "fxResolvedAt" | "amountBase">> = {};

  if (shouldRecomputeFx) {
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
  } else if (fxInputsChanged && existing.fxRate !== null) {
    // El monto cambió pero el par de monedas es el mismo. La TASA se
    // respeta —`fx_rate` congelado, `CLAUDE.md`— pero `amount_base` no es
    // una tasa: es el producto `amount × fx_rate`, y si cambia el monto
    // tiene que seguirlo.
    //
    // Sin esto, editar el monto guardaba el `amount` nuevo y dejaba el
    // `amount_base` viejo: la fila del movimiento mostraba el valor nuevo y
    // TODOS los agregados —total del día, del período, patrimonio neto,
    // presupuestos, análisis— seguían sumando el viejo, sin que nada lo
    // avisara. El saldo de la cuenta sí quedaba bien (`transactionsRepo.update`
    // revierte los efectos viejos y aplica los nuevos), así que el desfase
    // era invisible salvo que alguien sumara las filas a mano.
    fx = { amountBase: convert(amount, household.baseCurrency, existing.fxRate).amount };
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
    let counterAmount: bigint;
    let counterFxRate: bigint | null;
    if (pinnedToCounter) {
      counterAmount = pinnedCounterAmount!;
      counterFxRate = pinnedCounterFxRate;
    } else {
      counterAmount = amount.amount;
      counterFxRate = null;
      if (counterAccount.currencyCode !== currency) {
        if (draft.counterFxRateOverride !== null) {
          counterAmount = convert(amount, counterAccount.currencyCode, draft.counterFxRateOverride).amount;
          counterFxRate = draft.counterFxRateOverride;
        } else {
          const resolution = await fxRepo.resolve({ householdId: household.id, base: currency, quote: counterAccount.currencyCode, date });
          if (resolution.rate !== null) {
            counterAmount = convert(amount, counterAccount.currencyCode, resolution.rate).amount;
            counterFxRate = resolution.rate;
          }
        }
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

  const tx = await transactionsRepo.update(transactionId, patch);
  await transactionTagsRepo.setForTransaction(transactionId, draft.tagIds);
  return tx;
}
