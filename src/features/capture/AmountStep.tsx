"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { AmountScrubber, Button, Chip, FxEditor, Icon, Keypad, KeypadKey, SegmentedControl, Sheet } from "@/design-system";
import type { IconName } from "@/design-system/core/Icon";
import { evaluateKeypadExpression, firstOperand, formatKeypadExpressionPreview, hasKeypadOperator } from "@/lib/money/keypad";
import { convert, formatRateTrimmed, invertRate, rateFromAmounts, rateFromInteger, roundRateForDisplay, shouldInvertRateForDisplay, type ScaledRate } from "@/lib/fx/rate";
import { appendKeypadRateDigit, parseKeypadRate } from "@/lib/fx/rate-keypad";
import { CURRENCY_SYMBOLS, formatAmount, formatAmountCompact } from "@/lib/money/format";
import { decimalsFor } from "@/lib/money/decimals";
import { money } from "@/lib/money/money";
import type { AccountRow, CategoryRow, TransactionRow } from "@/lib/db/schema";
import type { CaptureDraft, CaptureKind } from "@/stores/capture-draft-store";
import { computeExpenseDebitAmount, computeTransferDebitAmount, resolveAmountCurrency } from "./save-transaction";
import { LIABILITY_ACCOUNT_KINDS } from "@/lib/analytics/balances";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useSuggestedFxRate } from "@/hooks/use-fx-rate";
import { useTrackedCurrencies } from "@/hooks/use-tracked-currencies";
import { decimalSeparatorForLocale, numberLocaleForUiLocale, type Locale } from "@/i18n/formatting";

export interface AmountStepProps {
  draft: CaptureDraft;
  accounts: AccountRow[];
  /** Top de más usadas (`useFrequentCategories`, calculado una vez en `CaptureFlow`) — mismo conjunto que ve `CategoryStep`. */
  frequent: CategoryRow[];
  /**
   * Todas las categorías del `kind` actual (`CaptureFlow.sameKindCategories`)
   * — hace falta para poder mostrar la elegida cuando NO está entre las 5
   * más usadas (una elegida desde "Otras"). Sin esto, esa selección
   * quedaba invisible al volver al paso del monto.
   */
  categories: CategoryRow[];
  account: AccountRow | undefined;
  counterAccount: AccountRow | undefined;
  /** Solo para resolver el rate sugerido de `FxEditor` en una transferencia entre monedas distintas. */
  householdId: string | undefined;
  /**
   * Moneda base del household y movimientos ya cargados — solo para
   * calcular si hay más de una moneda "trackeada" (`useTrackedCurrencies`)
   * y así decidir si mostrar el chip que abre `CurrencyPickerSheet`. Antes
   * ese gate miraba solo `accounts`, así que un household con una sola
   * cuenta pero con otra moneda ya configurada en Ajustes → Monedas (sin
   * cuenta propia, p. ej. EUR para un viaje) nunca podía abrir el picker.
   */
  baseCurrency: string;
  transactions: TransactionRow[] | undefined;
  onCounterFxRateChange: (rate: bigint) => void;
  /** Override de la conversión de CAPTURA (moneda tipeada → moneda de la cuenta). */
  onCaptureFxRateChange: (rate: bigint) => void;
  onOpenCurrencyPicker: () => void;
  onKindChange: (kind: CaptureKind) => void;
  onAmountKey: (key: string) => void;
  /** Reemplaza `amountExpression` entero con un monto absoluto — lo produce el drag del `AmountScrubber`, no una tecla más. */
  onAmountChange: (expression: string) => void;
  onOpenAccountPicker: () => void;
  onOpenCounterAccountPicker: () => void;
  onInvertTransfer: () => void;
  onQuickCategory: (category: CategoryRow) => void;
  /** Chip "Otras" — no guarda directo como los demás, lleva al paso completo de categorías (top 5 + "Otro"). */
  onOpenCategoryPicker: () => void;
  onOpenDetails: () => void;
  onVoice: () => void;
  /**
   * El `MorphButton` de "Siguiente"/"Guardar" del caller — se dibuja en la
   * misma fila que "=", no debajo, para ahorrar el alto que le cuesta al
   * keypad tener una fila entera para sí solo. `AmountStep` no sabe nada
   * de guardar/confirmar, solo le arma el lugar al lado de "=".
   */
  footerButton?: ReactNode | undefined;
}

/**
 * Convierte un monto en unidades mínimas a la expresión de texto que
 * entiende el keypad. D13/auditoría: el separador decimal estaba
 * hardcodeado a "," — en un locale `en-US` (separador ".") producía una
 * expresión que el propio keypad de esa sesión no iba a saber re-parsear
 * como decimal. `locale` es opcional para no romper los call sites que
 * todavía no lo pasan (Bloque G, fuera de este fix) — sin él cae al
 * comportamiento anterior.
 */
export function amountToExpression(rawAmount: bigint, currency: string, locale: Locale = "es"): string {
  const decimals = decimalsFor(currency);
  const negative = rawAmount < 0n;
  const divisor = 10n ** BigInt(decimals);
  const abs = negative ? -rawAmount : rawAmount;
  const intPart = abs / divisor;
  // Sin ceros colgando: "25,00" quedaba tal cual en `amountExpression`, y
  // tipear otro dígito lo CONCATENABA ("25,000") en vez de extender la
  // parte entera — `parseAmountString` trunca la fracción a los decimales
  // de la moneda, así que ese dígito de más no llegaba a ningún lado y el
  // resultado parecía congelado en 25 para siempre. Sin fracción sobrante,
  // el próximo dígito extiende la parte entera como se espera ("25" + "0"
  // → "250"), igual que si se hubiera tipeado desde cero.
  const fracPartRaw = decimals > 0 ? (abs % divisor).toString().padStart(decimals, "0") : "";
  const fracPart = fracPartRaw.replace(/0+$/, "");
  const separator = decimalSeparatorForLocale(locale);
  return `${negative ? "-" : ""}${intPart}${fracPart ? `${separator}${fracPart}` : ""}`;
}

/** C1 — el paso que abre el FAB. El primer frame es interactivo: se puede escribir en el keypad al toque. */
export function AmountStep({
  draft,
  accounts,
  frequent,
  categories,
  account,
  counterAccount,
  householdId,
  baseCurrency,
  transactions,
  onCounterFxRateChange,
  onCaptureFxRateChange,
  onOpenCurrencyPicker,
  onKindChange,
  onAmountKey,
  onAmountChange,
  onOpenAccountPicker,
  onOpenCounterAccountPicker,
  onInvertTransfer,
  onQuickCategory,
  onOpenCategoryPicker,
  onOpenDetails,
  onVoice,
  footerButton,
}: AmountStepProps) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const numberLocale = numberLocaleForUiLocale(locale);
  const decimalSeparator = decimalSeparatorForLocale(locale);
  const categoryLabel = useCategoryLabel();
  // Edición del tipo de cambio por teclado — el ícono de lápiz de `FxEditor`
  // no hacía nada acá (a diferencia de `/currencies`, que sí tiene este
  // mismo patrón completo). `null` = cerrado.
  const [rateKeypadDigits, setRateKeypadDigits] = useState<string | null>(null);
  /**
   * Cuál de las dos conversiones está editando el teclado de tasa: la de la
   * transferencia (`counter`) o la de captura (`capture`). Son dos tasas
   * distintas que pueden convivir, así que el teclado necesita saber a cuál
   * le está escribiendo.
   */
  const [rateKeypadTarget, setRateKeypadTarget] = useState<"counter" | "capture">("counter");
  /**
   * Teclado del MONTO convertido (lo que sale de la cuenta). Editarlo ajusta
   * la tasa, nunca el monto original: el original es lo que dice el ticket y
   * solo cambia si se edita el héroe. Es la contracara de editar la tasa —
   * los dos caminos llegan al mismo par (monto, tasa) desde puntas opuestas.
   */
  const [debitKeypadDigits, setDebitKeypadDigits] = useState<string | null>(null);
  const KIND_OPTIONS = [
    { id: "expense", label: t("capture.kind.expense") },
    { id: "income", label: t("capture.kind.income") },
    { id: "transfer", label: t("capture.kind.transfer") },
  ];
  const isTransfer = draft.kind === "transfer";
  // "Pagar tarjeta" y flujos parecidos: el monto tipeado es un dato fijo
  // del lado del DESTINO (lo que hay que cubrir), no del origen — que
  // puede todavía no estar elegido. Sin esto, mientras no hay origen el
  // monto se mostraba en la moneda de una cuenta arbitraria (el fallback
  // de `CaptureFlow`), nunca en la de la tarjeta.
  const pinnedToCounter = isTransfer && draft.amountPinnedTo === "counterAccount";
  const currency = resolveAmountCurrency(draft, account, counterAccount);
  const expression = draft.amountExpression || "0";
  // Mientras haya un operador tipeado, el héroe se queda congelado en el
  // monto ANTES de ese operador — antes se reevaluaba en cada tecla y
  // "12+8" pasaba visiblemente por 12 apenas se tipeaba el "+", sin que el
  // usuario viera la cuenta que estaba armando. La expresión cruda se
  // muestra aparte (`pendingPreview`, más abajo) y el resultado recién
  // reemplaza al héroe cuando se toca "=".
  const pending = hasKeypadOperator(expression);
  const hero = useMemo(() => {
    try {
      return pending ? firstOperand(expression, currency, numberLocale) : evaluateKeypadExpression(expression, currency, numberLocale);
    } catch {
      return money(0n, currency);
    }
  }, [expression, pending, currency, numberLocale]);
  const evaluated = useMemo(() => {
    try {
      return evaluateKeypadExpression(expression, currency, numberLocale);
    } catch {
      return money(0n, currency);
    }
  }, [expression, currency, numberLocale]);
  const pendingPreview = pending ? formatKeypadExpressionPreview(expression) : null;

  const hasAccounts = accounts.length > 0;
  // Dos cuentas de distinta moneda en una transferencia (p. ej. pagar una
  // tarjeta en ARS desde una cuenta en USD) necesitan el mismo rate que
  // cualquier otra conversión — mostrado y ajustable, no resuelto en
  // silencio como pasaba hasta ahora en este paso.
  const crossCurrencyTransfer = isTransfer && !!account && !!counterAccount && account.currencyCode !== counterAccount.currencyCode;
  const suggestedRate = useSuggestedFxRate(householdId, account?.currencyCode, counterAccount?.currencyCode);
  // El rate interno siempre es "unidades de destino por 1 de origen"
  // (`convert(monto_en_origen, destino, rate)`) — para un par USD/ARS eso
  // da "1 ARS = 0,00066 USD", ilegible. Se ancla en la moneda que vale más
  // (`shouldInvertRateForDisplay`, `lib/fx/rate.ts`), invirtiendo solo para
  // MOSTRAR/EDITAR — nunca lo que se guarda, que sigue siendo el rate
  // interno de siempre. Antes esto hardcodeaba "ancla en USD si USD
  // participa": acierta para fiat contra USD (que suele valer más), pero
  // con una cuenta en EUR o BTC mostraba "1 USD = 0,86 EUR" al revés de
  // como se lee — el criterio real no depende de qué código es, depende de
  // cuál vale más. Mientras el rate no resolvió, arranca sin invertir (no
  // hay nada todavía que decida lo contrario).
  const rateNumeratorIsSource = !(suggestedRate.data?.rate != null && shouldInvertRateForDisplay(suggestedRate.data.rate));
  const toInternalRate = (displayRate: bigint) => (rateNumeratorIsSource ? displayRate : invertRate(displayRate));
  const toDisplayRate = (internalRate: bigint) => (rateNumeratorIsSource ? internalRate : invertRate(internalRate));
  // Cuánto sale REALMENTE de la cuenta de origen — mismo cálculo que usa
  // `CaptureFlow` para el gate de saldo insuficiente (`computeTransferDebitAmount`,
  // en `save-transaction.ts`), para que la vista previa y la validación
  // nunca diverjan. Vista previa de solo lectura: lo que se guarda se
  // recalcula igual al confirmar.
  const transferDebit = computeTransferDebitAmount(draft, account, counterAccount, suggestedRate.data?.rate ?? null, numberLocale);
  const pinnedSourcePreview = pinnedToCounter && crossCurrencyTransfer && transferDebit !== null ? money(transferDebit, account!.currencyCode) : null;
  const insufficientFunds = isTransfer && !!account && transferDebit !== null && transferDebit > account.currentBalance;
  // Mismo criterio que `CaptureFlow.expenseInsufficientFunds()` — vista
  // previa de solo lectura, la validación real vuelve a calcularse ahí al
  // confirmar. Nunca para cuentas de tipo pasivo (tarjeta/préstamo): esas
  // pueden ir en negativo por diseño.
  // La conversión de CAPTURA (moneda tipeada → moneda de la cuenta), que es
  // otra distinta de la de la transferencia. Solo existe cuando se tipeó en
  // una moneda que no es la de la cuenta.
  const capturedCrossCurrency = !isTransfer && !!account && currency !== account.currencyCode;
  const captureRate = useSuggestedFxRate(householdId, capturedCrossCurrency ? currency : undefined, capturedCrossCurrency ? account.currencyCode : undefined);
  // El rate efectivo: lo que el usuario tocó gana sobre lo resuelto.
  const effectiveCaptureRate = draft.captureFxRateOverride ?? captureRate.data?.rate ?? null;
  // Cuánto se debita de la cuenta. Es lo que hoy el usuario tiene que ir a
  // averiguar afuera de la app antes de poder cargar el gasto.
  const capturedDebit = capturedCrossCurrency && effectiveCaptureRate !== null ? convert(evaluated, account.currencyCode, effectiveCaptureRate) : null;
  // Mismo criterio que `rateNumeratorIsSource` de arriba: ancla en la
  // moneda que vale más, no en USD a ciegas. El rate interno sigue siendo
  // siempre "moneda de cuenta por 1 de la capturada".
  const captureNumeratorIsCaptured = !(captureRate.data?.rate != null && shouldInvertRateForDisplay(captureRate.data.rate));
  // `roundRateForDisplay` acá y no solo al editar: invertir una tasa
  // arrastra ruido de la división (1/41,5 invertido vuelve como
  // 41,500000000291), y eso terminaba impreso tal cual debajo del monto.
  const toCaptureDisplay = (internal: ScaledRate) => roundRateForDisplay(captureNumeratorIsCaptured ? internal : invertRate(internal));
  const toCaptureInternal = (display: ScaledRate) => (captureNumeratorIsCaptured ? display : invertRate(display));
  // El chip de moneda solo si el household trackea más de una: "cantidad de
  // monedas en uso" es uno de los flags de progresividad de `CLAUDE.md`, y
  // en un hogar mono-moneda esto no debe sumar un elemento al presupuesto
  // de ruido del keypad. Antes esto miraba solo `accounts`, así que un
  // household con una sola cuenta pero con otra moneda ya trackeada en
  // Ajustes → Monedas (override o preferencia, sin cuenta propia) no podía
  // abrir el picker — exactamente el caso de un viaje pagado con la única
  // cuenta que hay, en una moneda que esa cuenta no tiene.
  const { currencies: trackedCurrencies } = useTrackedCurrencies(householdId, baseCurrency, accounts, transactions);
  const multiCurrency = trackedCurrencies.length > 1;
  const expenseDebit = draft.kind === "expense" ? computeExpenseDebitAmount(draft, account, captureRate.data?.rate ?? null, numberLocale) : null;
  const expenseInsufficientFunds =
    draft.kind === "expense" && !!account && !LIABILITY_ACCOUNT_KINDS.has(account.kind) && expenseDebit !== null && expenseDebit > account.currentBalance;

  // Una categoría elegida desde "Otras" que no está entre las 5 más usadas
  // no se veía en ningún lado al volver acá — reemplaza al último chip de
  // `frequent`, marcada, en vez de sumar una 3ª fila o sacar "Otras" (el
  // presupuesto de ruido de la pantalla no se mueve). Si ya está entre las
  // 5, la lista no cambia.
  const selectedCategory = categories.find((c) => c.id === draft.categoryId);
  const shownCategories = selectedCategory && !frequent.some((c) => c.id === selectedCategory.id) ? [...frequent.slice(0, 4), selectedCategory] : frequent;

  // Mismo patrón que `/currencies`: arranca el teclado desde el rate que
  // ya se está mostrando (no el interno), sin ceros finales.
  const seedRateKeypad = (rate: ScaledRate) => {
    const [wholePart, decPart] = formatRateTrimmed(rate).split(".");
    setRateKeypadDigits(decPart ? `${wholePart}${decimalSeparator}${decPart}` : wholePart!);
  };
  const openRateKeypad = () => {
    setRateKeypadTarget("counter");
    seedRateKeypad(toDisplayRate(draft.counterFxRateOverride ?? suggestedRate.data?.rate ?? rateFromInteger(1)));
  };
  const openCaptureRateKeypad = () => {
    setRateKeypadTarget("capture");
    seedRateKeypad(toCaptureDisplay(effectiveCaptureRate ?? rateFromInteger(1)));
  };
  const commitRateKeypad = () => {
    if (rateKeypadDigits !== null) {
      const parsed = parseKeypadRate(rateKeypadDigits, decimalSeparator);
      if (parsed !== null) {
        const rounded = roundRateForDisplay(parsed);
        if (rateKeypadTarget === "capture") onCaptureFxRateChange(toCaptureInternal(rounded));
        else onCounterFxRateChange(toInternalRate(rounded));
      }
    }
    setRateKeypadDigits(null);
  };

  const openDebitKeypad = () => {
    if (!capturedDebit) return;
    setDebitKeypadDigits(amountToExpression(capturedDebit.amount, capturedDebit.currency, locale));
  };
  /**
   * Editar el monto convertido ajusta la TASA, no el monto original: el
   * original es el dato duro del ticket. `rateFromAmounts` deriva la tasa
   * que hace que ese par cierre, así que las dos puntas quedan consistentes
   * sin que ninguna pise a la otra.
   */
  const commitDebitKeypad = () => {
    if (debitKeypadDigits !== null && account) {
      try {
        const target = evaluateKeypadExpression(debitKeypadDigits || "0", account.currencyCode, numberLocale);
        const derived = rateFromAmounts(evaluated, target);
        if (derived !== null) onCaptureFxRateChange(derived);
      } catch {
        // Expresión inválida: se cierra sin tocar nada, igual que el keypad
        // de tasa. Nunca se guarda un rate a medio tipear.
      }
    }
    setDebitKeypadDigits(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>
      <SegmentedControl options={KIND_OPTIONS} value={draft.kind} onChange={(id) => onKindChange(id as CaptureKind)} />

      <div style={{ textAlign: "center", display: "flex", justifyContent: "center" }}>
        {/* La cifra en captura es una entrada, no todavía un movimiento con
            polaridad: neutra y sin signo mientras se tipea (el +/− aqua es
            para la lista, no para el keypad). Arrastrable (C1, AmountScrubber):
            un tap corto le pasa la posta al keypad (ya visible abajo, así que
            es un no-op acá), el drag ajusta el monto con aceleración. */}
        <AmountScrubber value={hero} onChange={(next) => onAmountChange(amountToExpression(next, currency, locale))} onOpenKeypad={() => {}} />
      </div>

      {pendingPreview ? (
        <p className="t-caption" style={{ textAlign: "center", color: "var(--text-muted)", margin: 0 }}>
          {pendingPreview}
        </p>
      ) : null}

      {isTransfer ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={onOpenAccountPicker}
            style={{ flex: 1, textAlign: "left", background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-card)", padding: 14, cursor: "pointer" }}
          >
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>
              {t("capture.from")}
            </div>
            <div style={{ marginTop: 2, color: "var(--text-primary)", fontSize: 15 }}>{account ? account.name : t("capture.chooseAccount")}</div>
          </button>
          <button type="button" onClick={onInvertTransfer} aria-label={t("capture.invert")} style={{ background: "none", border: 0, cursor: "pointer", padding: 8 }}>
            <Icon name="refresh" size={20} color="var(--text-secondary)" />
          </button>
          <button
            type="button"
            onClick={onOpenCounterAccountPicker}
            style={{ flex: 1, textAlign: "left", background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-card)", padding: 14, cursor: "pointer" }}
          >
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>
              {t("capture.to")}
            </div>
            <div style={{ marginTop: 2, color: "var(--text-primary)", fontSize: 15 }}>{counterAccount ? counterAccount.name : t("capture.chooseAccount")}</div>
          </button>
        </div>
      ) : null}

      {crossCurrencyTransfer && suggestedRate.data?.rate !== undefined && suggestedRate.data.rate !== null ? (
        <FxEditor
          from={rateNumeratorIsSource ? account!.currencyCode : counterAccount!.currencyCode}
          to={rateNumeratorIsSource ? counterAccount!.currencyCode : account!.currencyCode}
          rate={toDisplayRate(draft.counterFxRateOverride ?? suggestedRate.data.rate)}
          suggested={toDisplayRate(suggestedRate.data.rate)}
          onChange={(displayRate) => onCounterFxRateChange(toInternalRate(displayRate))}
          onOpenKeypad={openRateKeypad}
        />
      ) : null}

      {pinnedSourcePreview ? (
        <p className="t-caption" style={{ textAlign: "center", color: "var(--text-muted)", margin: 0 }}>
          {t("capture.transferPinnedPreview", { amount: formatAmountCompact(pinnedSourcePreview, { showSign: false }), account: account!.name })}
        </p>
      ) : null}

      {insufficientFunds || expenseInsufficientFunds ? (
        <p className="t-caption" style={{ textAlign: "center", color: "var(--critical)", margin: 0 }}>
          {t("capture.insufficientFunds", { account: account!.name })}
        </p>
      ) : null}

      {!isTransfer ? (
        // Dos zonas tocables, y el ORDEN importa: primero la moneda del
        // MONTO (califica a la cifra que está justo arriba), después la
        // cuenta con SU propia moneda.
        //
        // Antes el chip reemplazaba al código de la cuenta, así que con las
        // dos monedas distintas la línea decía solo "Itaú  UYU": no se sabía
        // que Itaú era una cuenta en dólares ni que UYU era la moneda en la
        // que te cobraron. Son dos hechos distintos —en qué moneda es el
        // gasto y en qué moneda es la cuenta que lo paga— y los dos tienen
        // que estar visibles justo cuando se elige.
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {account && multiCurrency ? (
            <button
              type="button"
              onClick={onOpenCurrencyPicker}
              aria-label={t("capture.changeCurrency")}
              style={{
                border: 0,
                cursor: "pointer",
                padding: "0 10px",
                minHeight: 44,
                borderRadius: "var(--radius-chip)",
                background: capturedCrossCurrency ? "var(--selection-surface)" : "transparent",
                boxShadow: capturedCrossCurrency ? "inset 0 0 0 1px var(--selection-ring)" : "none",
                color: capturedCrossCurrency ? "var(--text-primary)" : "var(--text-secondary)",
                fontSize: 13,
              }}
            >
              {currency}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onOpenAccountPicker}
            // El nombre accesible repite la moneda de la cuenta — es lo que
            // anuncia el lector de pantalla y lo que usan los e2e para
            // ubicar este botón sin depender de cuál sea la cuenta por
            // defecto.
            aria-label={account ? `${account.name} · ${account.currencyCode}` : t("capture.chooseAccount")}
            style={{ background: "none", border: 0, cursor: hasAccounts ? "pointer" : "default", padding: 0, textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}
          >
            {account ? `${account.name} · ${account.currencyCode}` : t("capture.chooseAccount")}
          </button>
        </div>
      ) : null}

      {capturedCrossCurrency ? (
        // Solo el dato, sin slider (el ajuste fino aparece al tocarlo). Dos
        // zonas: el monto convertido y la tasa, cada una con su teclado.
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
          {capturedDebit ? (
            <>
              <button type="button" onClick={openDebitKeypad} className="t-caption" style={{ background: "none", border: 0, cursor: "pointer", padding: 4, color: "var(--text-secondary)" }}>
                {formatAmountCompact(capturedDebit, { showSign: false })}
              </button>
              <span className="t-caption" style={{ color: "var(--text-muted)" }}>·</span>
              <button type="button" onClick={openCaptureRateKeypad} className="t-caption" style={{ background: "none", border: 0, cursor: "pointer", padding: 4, color: "var(--text-muted)" }}>
                {captureNumeratorIsCaptured
                  ? `1 ${currency} = ${formatRateTrimmed(toCaptureDisplay(effectiveCaptureRate!))} ${account!.currencyCode}`
                  : `1 ${account!.currencyCode} = ${formatRateTrimmed(toCaptureDisplay(effectiveCaptureRate!))} ${currency}`}
              </button>
            </>
          ) : (
            // Sin cotización no se bloquea nada: se guarda igual y queda
            // pendiente de resolver (`needs_capture_fx`) — pero antes esto
            // era un `<span>` muerto sin forma de cargarla en el momento, y
            // no hay ninguna pantalla en la app que resuelva
            // `needs_capture_fx` después (a diferencia de `needs_fx`
            // cuenta→base, que sí tiene `/accounts/resolve-fx`). Tocarlo
            // abre el mismo teclado de tasa que la rama de arriba, arrancando
            // en 1 — la persona que ya sabe el tipo de cambio del día
            // (viaje, ticket con la conversión impresa) puede cargarlo sin
            // salir de la captura.
            <button type="button" onClick={openCaptureRateKeypad} className="t-caption" style={{ background: "none", border: 0, cursor: "pointer", padding: 4, color: "var(--text-muted)" }}>
              {t("capture.captureRateSetManually")}
            </button>
          )}
        </div>
      ) : null}

      {!isTransfer ? (
        // Ítem 11: 5 chips + "Otros" tienen que entrar en 2 filas en un
        // teléfono angosto (~360px) — sin tope, nombres largos como
        // "Supermercado"/"Entretenimiento" empujaban a una 3ª fila. El
        // `title` lleva el nombre completo: el truncado es solo visual.
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          {shownCategories.map((c) => (
            <Chip key={c.id} icon={c.icon as IconName} maxWidth={104} title={categoryLabel(c)} selected={c.id === draft.categoryId} onClick={() => onQuickCategory(c)}>
              {categoryLabel(c)}
            </Chip>
          ))}
          <Chip icon="more" maxWidth={104} onClick={onOpenCategoryPicker}>
            {t("capture.category.other")}
          </Chip>
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "center", gap: 24 }}>
        <button type="button" onClick={onVoice} aria-label={t("capture.voiceLabel")} style={{ background: "none", border: 0, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <Icon name="mic" size={20} color="var(--text-secondary)" />
          <span className="t-caption" style={{ color: "var(--text-muted)" }}>
            {t("capture.voice")}
          </span>
        </button>
        <button
          type="button"
          onClick={onOpenDetails}
          aria-label={t("capture.details")}
          style={{ background: "none", border: 0, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
        >
          <Icon name="filter" size={20} color="var(--text-secondary)" />
          <span className="t-caption" style={{ color: "var(--text-muted)" }}>
            {t("capture.details")}
          </span>
        </button>
      </div>

      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        <Keypad onKey={onAmountKey} onClear={() => onAmountKey("clear")} announceValue={formatAmount(hero, { showSign: false })} />
        {/* "=" + el botón de Siguiente/Guardar comparten fila para ahorrar
            el alto de una fila entera de keypad. 1:3 en reposo, 2:2
            mientras hay una cuenta pendiente (más lugar para confirmarla) —
            `flex` anima solo, sin tocar el ancho real de "=" o del botón,
            que ya son `width: 100%` de su celda. */}
        <div style={{ display: "flex", gap: 8 }}>
          <motion.div animate={{ flex: pending ? 2 : 1 }} transition={{ duration: 0.24, ease: [0.24, 1.05, 0.32, 1] }} style={{ minWidth: 0 }}>
            <KeypadKey
              label="="
              ariaLabel={t("ds.keypad.equals")}
              fullWidth
              height="var(--primary-button-height)"
              onPress={() => {
                // Resuelve la cuenta armada y reemplaza la expresión entera
                // por el resultado plano — de ahí en más se sigue editando
                // desde un número simple, no desde "12+8". Sin operador
                // pendiente no hace nada: no hay nada que confirmar todavía.
                if (pending) onAmountChange(amountToExpression(evaluated.amount, currency, locale));
              }}
            />
          </motion.div>
          <motion.div animate={{ flex: pending ? 2 : 3 }} transition={{ duration: 0.24, ease: [0.24, 1.05, 0.32, 1] }} style={{ minWidth: 0 }}>
            {footerButton}
          </motion.div>
        </div>
      </div>

      <Sheet open={rateKeypadDigits !== null} title={t("capture.editRate")} onClose={() => setRateKeypadDigits(null)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-hero-size)", lineHeight: "var(--text-hero-line)", fontWeight: 600, marginTop: 4 }}>
              {/* La moneda del DENOMINADOR de lo que se está tipeando: en
                  "1 USD = X UYU", lo que se tipea son UYU. Cambia según cuál
                  de las dos conversiones se esté editando. */}
              {CURRENCY_SYMBOLS[
                (rateKeypadTarget === "capture"
                  ? captureNumeratorIsCaptured
                    ? account?.currencyCode
                    : currency
                  : rateNumeratorIsSource
                    ? counterAccount?.currencyCode
                    : account?.currencyCode) ?? ""
              ] ?? ""}{" "}
              {rateKeypadDigits === "" ? "0" : rateKeypadDigits}
            </div>
          </div>
          <Keypad operators={false} onKey={(key) => setRateKeypadDigits((d) => appendKeypadRateDigit(d ?? "", key, decimalSeparator))} onClear={() => setRateKeypadDigits("")} />
          <div style={{ display: "flex", gap: 12 }}>
            <Button variant="secondary" onClick={() => setRateKeypadDigits(null)}>
              {t("currenciesPage.keypadCancel")}
            </Button>
            <Button variant="primary" onClick={commitRateKeypad} disabled={rateKeypadDigits === null || parseKeypadRate(rateKeypadDigits, decimalSeparator) === null}>
              {t("currenciesPage.keypadDone")}
            </Button>
          </div>
        </div>
      </Sheet>

      {/* Editar cuánto sale de la cuenta. Ajusta la tasa, nunca el monto
          original — ver `commitDebitKeypad`. */}
      <Sheet open={debitKeypadDigits !== null} title={t("capture.editDebit")} onClose={() => setDebitKeypadDigits(null)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-hero-size)", lineHeight: "var(--text-hero-line)", fontWeight: 600, marginTop: 4 }}>
              {CURRENCY_SYMBOLS[account?.currencyCode ?? ""] ?? ""} {debitKeypadDigits === "" ? "0" : debitKeypadDigits}
            </div>
          </div>
          <Keypad operators={false} onKey={(key) => setDebitKeypadDigits((d) => appendKeypadRateDigit(d ?? "", key, decimalSeparator))} onClear={() => setDebitKeypadDigits("")} />
          <div style={{ display: "flex", gap: 12 }}>
            <Button variant="secondary" onClick={() => setDebitKeypadDigits(null)}>
              {t("currenciesPage.keypadCancel")}
            </Button>
            <Button variant="primary" onClick={commitDebitKeypad} disabled={!debitKeypadDigits}>
              {t("currenciesPage.keypadDone")}
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
