import type { AccountRow, HouseholdRow, TransactionRow } from "@/lib/db/schema";
import { evaluateKeypadExpression } from "@/lib/money/keypad";
import { money, type Money } from "@/lib/money/money";
import type { NumberLocale } from "@/lib/money/parse";
import { convert, invertRate, rateFromInteger } from "@/lib/fx/rate";
import { fxRepo } from "@/lib/repos/fx-repo";
import { todayIso } from "@/lib/repos/ids";
import { transactionsRepo, type NewTransactionInput } from "@/lib/repos/transactions-repo";
import { transactionTagsRepo } from "@/lib/repos/transaction-tags-repo";
import { categorizationRulesRepo } from "@/lib/repos/categorization-rules-repo";
import { evaluateCategorizationRules } from "@/lib/analytics/categorization-rules";
import type { CaptureDraft } from "@/stores/capture-draft-store";

export interface ResolvedFx {
  fxRate: bigint | null;
  fxSource: NewTransactionInput["fxSource"];
  fxProvider: string | null;
  fxQuoteKind: string | null;
  fxResolvedAt: string | null;
  amountBase: bigint | null;
}

/**
 * Resuelve `fxRate`/`fxSource`/`amountBase` para un monto ya en
 * `currency` (la moneda de la cuenta) contra la moneda base del household
 * — misma cadena que usa cualquier captura normal (override → cotización
 * del día → última conocida → `pending`, nunca `rate = 1` inventado).
 *
 * Antes de esto, `/accounts/[id]/reconcile` y el ajuste de reconciliación
 * de `payCard()` decidían esto a mano con un ternario binario
 * (`currency === baseCurrency ? "identity" : "pending"`) — nunca
 * intentaban resolver de verdad, así que un ajuste en una moneda con
 * cotización perfectamente disponible (override cargado, tasa del día)
 * quedaba `pending` igual, obligando a resolverlo a mano después aunque
 * el dato ya estuviera ahí. Se extrae acá para que las dos pantallas usen
 * la misma resolución real que ya usa `saveDraftAsTransaction`.
 */
export async function resolveFxForAccountCurrency(household: HouseholdRow, currency: string, amount: Money, date: string): Promise<ResolvedFx> {
  if (currency === household.baseCurrency) {
    // Identidad de moneda no es lo mismo que "sin resolver" — acá va 1
    // explícito, igual que hace `resolveFxRate` para `base === quote`.
    return {
      fxRate: rateFromInteger(1),
      fxSource: "identity",
      fxProvider: null,
      fxQuoteKind: null,
      fxResolvedAt: todayIso(),
      amountBase: amount.amount,
    };
  }

  const resolution = await fxRepo.resolve({ householdId: household.id, base: currency, quote: household.baseCurrency, date });
  return {
    fxRate: resolution.rate,
    fxSource: resolution.source,
    fxProvider: resolution.provider,
    fxQuoteKind: resolution.quoteKind,
    fxResolvedAt: resolution.rate !== null ? new Date().toISOString() : null,
    amountBase: resolution.rate !== null ? convert(amount, household.baseCurrency, resolution.rate).amount : null,
  };
}

export interface SaveDraftParams {
  draft: CaptureDraft;
  household: HouseholdRow;
  userId: string;
  account: AccountRow;
  counterAccount?: AccountRow | undefined;
  /**
   * D13/auditoría: el separador decimal que tipeó el usuario depende del
   * locale de la UI en el momento de capturar (`Keypad` ya lo deriva) — acá
   * hay que parsearlo con el mismo locale, o un "." en un locale en-US se
   * lee como separador de miles en vez de decimal (corrompe el monto 10x).
   */
  numberLocale?: NumberLocale | undefined;
}

/**
 * Elegir la categoría (o cuenta) antes de tipear el monto no debería poder
 * guardar un movimiento en $0 — antes `canSave()` solo miraba que
 * `amountExpression` no estuviera vacío, así que "0" (o una expresión que
 * evalúa a cero) pasaba igual. Se usa tanto para habilitar el botón como
 * para decidir si un chip de categoría rápida guarda directo o solo
 * precarga la categoría (`CaptureFlow`).
 */
export function hasNonZeroAmount(expression: string, currency: string, numberLocale: NumberLocale = "es-UY"): boolean {
  if (expression.trim() === "") return false;
  try {
    return evaluateKeypadExpression(expression, currency, numberLocale).amount !== 0n;
  } catch {
    return false;
  }
}

/**
 * Qué moneda interpreta el monto tipeado — normalmente la de `account`
 * (origen), salvo `amountPinnedTo === "counterAccount"` (p. ej. "pagar
 * tarjeta"): ahí el monto es un dato fijo del lado del destino. Un solo
 * lugar para esta regla: `AmountStep` y `CaptureFlow` (`canSave`,
 * `onQuickCategory`) la necesitan por separado y no puede quedar
 * triplicada — divergerían apenas alguien tocara una sin la otra.
 */
export function resolveAmountCurrency(
  draft: Pick<CaptureDraft, "currency" | "kind" | "amountPinnedTo">,
  account: Pick<AccountRow, "currencyCode"> | undefined,
  counterAccount: Pick<AccountRow, "currencyCode"> | undefined,
  fallback = "UYU"
): string {
  const pinnedToCounter = draft.kind === "transfer" && draft.amountPinnedTo === "counterAccount";
  return draft.currency || (pinnedToCounter ? counterAccount?.currencyCode : account?.currencyCode) || fallback;
}

/**
 * Cuánto sale REALMENTE de `account` para una transferencia — en su propia
 * moneda, listo para comparar contra `account.currentBalance` (saldo
 * insuficiente) o mostrar como vista previa. Replica, sin tocar el
 * servidor, la misma cuenta que hace `saveDraftAsTransaction` para
 * `amount`: sin pin, el monto tipeado YA está en la moneda de origen; con
 * pin al destino, hay que invertir el rate (sugerido o el override) para
 * volver del monto de destino al de origen. `null` cuando falta un dato
 * imprescindible (cuentas sin elegir, o cross-currency sin rate resuelto
 * todavía) — nunca se inventa un número para no bloquear ni aprobar guardar
 * por error.
 */
export function computeTransferDebitAmount(
  draft: Pick<CaptureDraft, "kind" | "amountExpression" | "amountPinnedTo" | "currency" | "counterFxRateOverride">,
  account: AccountRow | undefined,
  counterAccount: AccountRow | undefined,
  suggestedRate: bigint | null,
  numberLocale: NumberLocale
): bigint | null {
  if (draft.kind !== "transfer" || !account) return null;
  const pinnedToCounter = draft.amountPinnedTo === "counterAccount" && !!counterAccount;

  if (!pinnedToCounter) {
    try {
      return evaluateKeypadExpression(draft.amountExpression || "0", resolveAmountCurrency(draft, account, counterAccount), numberLocale).amount;
    } catch {
      return null;
    }
  }

  if (!counterAccount) return null;
  try {
    const counterAmountMoney = evaluateKeypadExpression(draft.amountExpression || "0", counterAccount.currencyCode, numberLocale);
    if (account.currencyCode === counterAccount.currencyCode) return counterAmountMoney.amount;
    const rate = draft.counterFxRateOverride ?? suggestedRate;
    if (rate === null) return null;
    return convert(counterAmountMoney, account.currencyCode, invertRate(rate)).amount;
  } catch {
    return null;
  }
}

/**
 * Cuánto sale de `account` para un gasto — en su propia moneda, listo para
 * comparar contra `account.currentBalance` (saldo insuficiente). Mismo
 * criterio que la rama no-pineada de `computeTransferDebitAmount`: el
 * monto tipeado ya está en la moneda de captura, sin FX entre cuentas
 * (un gasto no tiene cuenta de destino). `null` si la expresión no
 * evalúa — nunca se inventa un número para no bloquear ni aprobar por error.
 */
export function computeExpenseDebitAmount(
  draft: Pick<CaptureDraft, "kind" | "amountExpression" | "currency" | "amountPinnedTo">,
  account: AccountRow | undefined,
  numberLocale: NumberLocale
): bigint | null {
  if (draft.kind !== "expense" || !account) return null;
  try {
    return evaluateKeypadExpression(draft.amountExpression || "0", resolveAmountCurrency(draft, account, undefined), numberLocale).amount;
  } catch {
    return null;
  }
}

/**
 * Traduce el borrador de captura a un movimiento real: resuelve el monto
 * (keypad), la conversión a la moneda base del household (`lib/fx`), y —
 * para transferencias — el lado de entrada. Guardar no puede fallar: si
 * no hay tipo de cambio, el movimiento se guarda igual, sin conversión
 * (`needs_fx`), nunca se bloquea.
 */
export async function saveDraftAsTransaction({ draft, household, userId, account, counterAccount, numberLocale = "es-UY" }: SaveDraftParams): Promise<TransactionRow> {
  const date = draft.occurredAt.slice(0, 10);
  // "Pagar tarjeta" y flujos parecidos: el monto tipeado es un dato fijo
  // del lado del DESTINO (`counterAccount`), no del origen — se resuelve
  // aparte, más abajo, y nunca pasa por la conversión de "moneda
  // capturada" de acá (esa es para el caso normal, monto anclado al origen).
  const pinnedToCounter = draft.kind === "transfer" && draft.amountPinnedTo === "counterAccount" && !!counterAccount;

  let amount: Money;
  let original: Pick<NewTransactionInput, "originalAmount" | "originalCurrency" | "originalRate"> = {
    originalAmount: null,
    originalCurrency: null,
    originalRate: null,
  };
  // Cuando el monto está anclado al destino, esta pareja ya queda resuelta
  // acá — la rama de transferencia más abajo la usa tal cual en vez de
  // derivarla de `amount` (que es al revés de lo normal en este caso).
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
        // Mismo criterio que el A3 de abajo: sin rate, nunca se inventa un
        // 1 — el lado de origen queda en 0 hasta que haya cotización.
        amount = money(0n, account.currencyCode);
      }
    }
  } else {
    // Primera conversión (CLAUDE.md § dinero, "SON DOS CONVERSIONES, NO UNA"):
    // lo que el usuario tipeó puede estar en otra moneda que la de la cuenta
    // — `amount`/`currencyCode` SIEMPRE terminan en la moneda de la cuenta,
    // nunca en la capturada. Esa conversión ocurre acá, en la captura.
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

  const fx = await resolveFxForAccountCurrency(household, currency, amount, date);

  if (draft.kind === "transfer") {
    if (!counterAccount) throw new Error("Una transferencia necesita cuenta de destino");

    let counterAmount: bigint;
    let counterFxRate: bigint | null;
    if (pinnedToCounter) {
      // Ya se resolvió arriba, junto con `amount` — acá no hay nada que derivar.
      counterAmount = pinnedCounterAmount!;
      counterFxRate = pinnedCounterFxRate;
    } else {
      counterAmount = amount.amount;
      counterFxRate = null;
      if (counterAccount.currencyCode !== currency) {
        if (draft.counterFxRateOverride !== null) {
          // El usuario ajustó el rate a mano (`FxEditor`, slider ±5% sobre la
          // sugerencia) — se usa tal cual, sin volver a resolver contra `fxRepo`.
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

    const tx = await transactionsRepo.create({
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
    if (draft.tagIds.length > 0) await transactionTagsRepo.setForTransaction(tx.id, draft.tagIds);
    return tx;
  }

  const tx = await transactionsRepo.create({
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
  if (draft.tagIds.length > 0) await transactionTagsRepo.setForTransaction(tx.id, draft.tagIds);
  return tx;
}
