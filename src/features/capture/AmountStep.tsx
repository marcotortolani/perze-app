"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { AmountScrubber, Chip, FxEditor, Icon, Keypad, KeypadKey, SegmentedControl } from "@/design-system";
import type { IconName } from "@/design-system/core/Icon";
import { evaluateKeypadExpression, firstOperand, formatKeypadExpressionPreview, hasKeypadOperator } from "@/lib/money/keypad";
import { invertRate } from "@/lib/fx/rate";
import { formatAmount } from "@/lib/money/format";
import { decimalsFor } from "@/lib/money/decimals";
import { money } from "@/lib/money/money";
import type { AccountRow, CategoryRow } from "@/lib/db/schema";
import type { CaptureDraft, CaptureKind } from "@/stores/capture-draft-store";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useSuggestedFxRate } from "@/hooks/use-fx-rate";
import { decimalSeparatorForLocale, numberLocaleForUiLocale, type Locale } from "@/i18n/formatting";

export interface AmountStepProps {
  draft: CaptureDraft;
  accounts: AccountRow[];
  /** Top de más usadas (`useFrequentCategories`, calculado una vez en `CaptureFlow`) — mismo conjunto que ve `CategoryStep`. */
  frequent: CategoryRow[];
  account: AccountRow | undefined;
  counterAccount: AccountRow | undefined;
  /** Solo para resolver el rate sugerido de `FxEditor` en una transferencia entre monedas distintas. */
  householdId: string | undefined;
  onCounterFxRateChange: (rate: bigint) => void;
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
  onPhoto: () => void;
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
  account,
  counterAccount,
  householdId,
  onCounterFxRateChange,
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
  onPhoto,
  footerButton,
}: AmountStepProps) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const numberLocale = numberLocaleForUiLocale(locale);
  const categoryLabel = useCategoryLabel();
  const KIND_OPTIONS = [
    { id: "expense", label: t("capture.kind.expense") },
    { id: "income", label: t("capture.kind.income") },
    { id: "transfer", label: t("capture.kind.transfer") },
  ];
  const currency = draft.currency || account?.currencyCode || "UYU";
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

  const isTransfer = draft.kind === "transfer";
  const hasAccounts = accounts.length > 0;
  // Dos cuentas de distinta moneda en una transferencia (p. ej. pagar una
  // tarjeta en ARS desde una cuenta en USD) necesitan el mismo rate que
  // cualquier otra conversión — mostrado y ajustable, no resuelto en
  // silencio como pasaba hasta ahora en este paso.
  const crossCurrencyTransfer = isTransfer && !!account && !!counterAccount && account.currencyCode !== counterAccount.currencyCode;
  const suggestedRate = useSuggestedFxRate(householdId, account?.currencyCode, counterAccount?.currencyCode);
  // El rate interno siempre es "unidades de destino por 1 de origen"
  // (`convert(monto_en_origen, destino, rate)`) — para un par USD/ARS eso
  // da "1 ARS = 0,00066 USD", ilegible. `docs/02-design-system.md`/
  // `/currencies` ya resolvieron esto para el resto de la app: mostrar
  // siempre "1 USD = X" cuando USD participa (moneda ancla del Cono Sur,
  // `CLAUDE.md`), invirtiendo solo para MOSTRAR/EDITAR — nunca lo que se
  // guarda, que sigue siendo el rate interno de siempre.
  const rateNumeratorIsSource = !(account && counterAccount && counterAccount.currencyCode === "USD" && account.currencyCode !== "USD");
  const toInternalRate = (displayRate: bigint) => (rateNumeratorIsSource ? displayRate : invertRate(displayRate));
  const toDisplayRate = (internalRate: bigint) => (rateNumeratorIsSource ? internalRate : invertRate(internalRate));

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
        />
      ) : null}

      {!isTransfer ? (
        <button
          type="button"
          onClick={onOpenAccountPicker}
          style={{ background: "none", border: 0, cursor: hasAccounts ? "pointer" : "default", padding: 0, textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}
        >
          {account ? `${account.name} · ${currency}` : t("capture.chooseAccount")}
        </button>
      ) : null}

      {!isTransfer ? (
        // Ítem 11: 5 chips + "Otros" tienen que entrar en 2 filas en un
        // teléfono angosto (~360px) — sin tope, nombres largos como
        // "Supermercado"/"Entretenimiento" empujaban a una 3ª fila. El
        // `title` lleva el nombre completo: el truncado es solo visual.
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          {frequent.map((c) => (
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
        <button type="button" onClick={onPhoto} aria-label={t("capture.photoLabel")} style={{ background: "none", border: 0, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <Icon name="camera" size={20} color="var(--text-secondary)" />
          <span className="t-caption" style={{ color: "var(--text-muted)" }}>
            {t("capture.photo")}
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
    </div>
  );
}
