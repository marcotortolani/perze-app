"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { AccountRow as AccountRowUi, Button, EmptyState, Icon, Keypad, Sheet } from "@/design-system";
import { usePinUnlocked } from "@/components/pin-gate";
import { evaluateKeypadExpression } from "@/lib/money/keypad";
import { formatAmount, formatAmountCompact } from "@/lib/money/format";
import { money, type Money } from "@/lib/money/money";
import type { NumberLocale } from "@/lib/money/parse";
import { convert, formatRateTrimmed, invertRate, rateFromAmounts, roundRateForDisplay, type ScaledRate } from "@/lib/fx/rate";
import { useSuggestedFxRate } from "@/hooks/use-fx-rate";
import { fxRepo } from "@/lib/repos/fx-repo";
import { todayIso } from "@/lib/repos/ids";
import { cardPaymentSources } from "@/lib/analytics/card-cycle";
import { payCard, isValidPayAmount, type PayCardResult } from "@/features/cards/pay-card";
import { amountToExpression } from "@/features/capture/AmountStep";
import { ACCOUNT_KIND_ICON } from "@/lib/reference/account-kind-labels";
import { accountColorVar } from "@/lib/reference/account-colors";
import type { AccountGroupRow, AccountRow, HouseholdRow } from "@/lib/db/schema";
import type { Debt } from "@/lib/repos/debts-repo";
import type { Locale } from "@/i18n/formatting";

export interface PayCardSheetProps {
  open: boolean;
  card: AccountRow;
  /** Tanda 4 — `null` si `card` no está agrupada. */
  cardGroup: AccountGroupRow | null;
  accounts: readonly AccountRow[];
  expectedDue: bigint;
  installmentDebts: readonly Debt[];
  household: HouseholdRow;
  userId: string;
  numberLocale: NumberLocale;
  /** Solo para precargar el teclado con `expectedDue` ya escrito (`amountToExpression` toma el locale de UI, no el de parseo de números). */
  locale: Locale;
  onClose: () => void;
  onPaid: (result: PayCardResult) => void;
}

type Step = "source" | "amount" | "reconcile";

/**
 * Único componente de UI para pagar una tarjeta — montado desde
 * `/accounts/[id]/card` y desde el `ListRow` "Pagar tarjeta" de
 * `/accounts/[id]`, así los dos entran por el mismo camino (`payCard()`)
 * en vez de tener cada uno su propia lógica divergente.
 */
export function PayCardSheet({ open, card, cardGroup, accounts, expectedDue, installmentDebts, household, userId, numberLocale, locale, onClose, onPaid }: PayCardSheetProps) {
  const t = useTranslations();
  const router = useRouter();
  const [step, setStep] = useState<Step>("source");
  const [source, setSource] = useState<AccountRow | null>(null);
  const [expr, setExpr] = useState("");
  const [saving, setSaving] = useState(false);
  // Origen ≠ moneda de la tarjeta: dos campos editables enlazados por una
  // tasa. `activeField` dice cuál de los dos está tipeando el teclado en
  // este momento; `sourceExpr` es el monto de origen SOLO mientras se lo
  // está editando (fuera de eso se deriva de `expr` + `rateOverride`, no
  // se guarda un valor separado que podría desincronizarse). `rateOverride`
  // es la tasa efectiva una vez que el usuario ajustó algo — `null` = usar
  // la sugerida (`useSuggestedFxRate`) tal cual.
  const [activeField, setActiveField] = useState<"card" | "source">("card");
  const [sourceExpr, setSourceExpr] = useState("");
  const [rateOverride, setRateOverride] = useState<ScaledRate | null>(null);
  const pinUnlocked = usePinUnlocked();
  // Estimación de fondos insuficientes para las cuentas de origen en OTRA
  // moneda que la tarjeta — sin esto, el picker solo podía avisar con
  // certeza en la misma moneda (comparación directa) o si el saldo ya
  // estaba en negativo (cierto en cualquier moneda). Con la tasa resuelta,
  // sí se puede estimar acá también, antes de que el usuario elija y
  // recién ahí se entere. Es una estimación con la tasa sugerida del
  // momento — el chequeo real, con la tasa que termine efectivamente
  // usándose (posiblemente ajustada a mano), se repite siempre en el paso
  // del monto.
  const [crossCurrencyShort, setCrossCurrencyShort] = useState<Record<string, boolean>>({});

  const sources = cardPaymentSources(accounts, card);
  const crossCurrency = source !== null && source.currencyCode !== card.currencyCode;
  const suggestedRate = useSuggestedFxRate(household.id, source?.currencyCode, card.currencyCode);
  // `rate` = unidades de `card.currencyCode` por 1 unidad de
  // `source.currencyCode` — misma dirección que `useSuggestedFxRate(source, card)`
  // y que `counterFxRateOverride` en el resto de la captura.
  const currentRate: ScaledRate | null = rateOverride ?? suggestedRate.data?.rate ?? null;

  const cardMoney: Money = safeEvaluate(expr, card.currencyCode, numberLocale);
  // Monto de origen a mostrar/usar: si se está editando ESE campo, el
  // valor tipeado tal cual (crudo, puede estar a mitad de escribir); si
  // no, se DERIVA del monto de la tarjeta con la tasa vigente — nunca dos
  // fuentes de verdad para el mismo número.
  const sourceMoney: Money | null =
    activeField === "source"
      ? safeEvaluate(sourceExpr, source?.currencyCode ?? card.currencyCode, numberLocale)
      : crossCurrency && currentRate !== null
        ? convert(cardMoney, source!.currencyCode, invertRate(currentRate))
        : null;
  // Cuánto sale REALMENTE de la cuenta de origen, en su propia moneda —
  // en cross-currency es `sourceMoney`; en la misma moneda no hay
  // conversión, el monto de la tarjeta ES el débito. Sirve para el gate de
  // saldo insuficiente, sin importar cuál de los dos campos se esté
  // editando en este momento.
  const debitAmount = crossCurrency ? (sourceMoney?.amount ?? null) : cardMoney.amount;
  const insufficientFunds = source !== null && debitAmount !== null && debitAmount > source.currentBalance;
  // El rate interno (`currentRate`) es "unidades de card por 1 de origen".
  // Para mostrar/leer, `docs/02-design-system.md` fija que si USD
  // participa, SIEMPRE es la moneda ancla ("1 USD = X"), sin importar de
  // qué lado quedó al guardar — mismo criterio que ya usa `AmountStep`
  // para la captura normal. "1 ARS = 0,00065 USD" es matemáticamente
  // correcto pero ilegible; nadie piensa el dólar así.
  const rateNumeratorIsSource = !(card.currencyCode === "USD" && source !== null && source.currencyCode !== "USD");
  const displayFrom = rateNumeratorIsSource ? (source?.currencyCode ?? card.currencyCode) : card.currencyCode;
  const displayTo = rateNumeratorIsSource ? card.currencyCode : (source?.currencyCode ?? card.currencyCode);
  const displayRate = currentRate !== null ? roundRateForDisplay(rateNumeratorIsSource ? currentRate : invertRate(currentRate)) : null;

  // Corre solo mientras el picker de origen está abierto — `accounts`/
  // `card` como dependencias (no `sources`, que es un array nuevo en cada
  // render) para no re-disparar esto en cada tecla que se tipee más
  // adelante en el flujo.
  useEffect(() => {
    if (!open || step !== "source") return;
    let cancelled = false;
    const crossCurrencySources = cardPaymentSources(accounts, card).filter((a) => a.currencyCode !== card.currencyCode);
    if (crossCurrencySources.length === 0) return;
    void (async () => {
      const entries = await Promise.all(
        crossCurrencySources.map(async (a) => {
          const resolution = await fxRepo.resolve({ householdId: household.id, base: a.currencyCode, quote: card.currencyCode, date: todayIso() });
          // Sin cotización resuelta no se puede estimar nada — no se
          // marca "insuficiente" sin dato, eso sería inventar un número.
          if (resolution.rate === null) return [a.id, false] as const;
          const requiredInSourceCurrency = convert(money(expectedDue, card.currencyCode), a.currencyCode, invertRate(resolution.rate)).amount;
          return [a.id, requiredInSourceCurrency > a.currentBalance] as const;
        })
      );
      if (!cancelled) setCrossCurrencyShort(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, step, accounts, card, household.id, expectedDue]);

  const reset = () => {
    setStep("source");
    setSource(null);
    setExpr("");
    setActiveField("card");
    setSourceExpr("");
    setRateOverride(null);
  };

  const selectSource = (a: AccountRow) => {
    setSource(a);
    // Precarga el monto sugerido — pagar el total es lo más común; si el
    // usuario quiere otra cosa, edita desde acá en vez de arrancar de cero
    // (antes obligaba a tipear el monto entero siempre, incluso cuando
    // coincidía con lo que ya se le mostraba arriba como "A pagar").
    setExpr(amountToExpression(expectedDue > 0n ? expectedDue : 0n, card.currencyCode, locale));
    setStep("amount");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const runSave = async (declareSettled: boolean, delta: bigint) => {
    if (!source || saving) return;
    setSaving(true);
    try {
      const result = await payCard({
        household,
        userId,
        card,
        cardGroup,
        source,
        amountExpression: expr || "0",
        numberLocale,
        installmentDebts,
        declareSettled,
        reconciliationDelta: delta,
        adjustmentNote: t("cardCyclePage.settlementAdjustmentNote"),
        rateOverride: crossCurrency ? currentRate : null,
      });
      toast(t("cardCyclePage.settled"));
      handleClose();
      onPaid(result);
    } catch {
      toast(t("cardCyclePage.settleError"));
    } finally {
      setSaving(false);
    }
  };

  // Pasar a editar el monto de la tarjeta: si se estaba editando el de
  // origen, esa edición "congela" la tasa implícita (`rateFromAmounts`)
  // ANTES de dejarla — es lo que hace que, al volver a tocar el monto de
  // la tarjeta y cambiarlo, el monto de origen se recalcule con la MISMA
  // tasa que el usuario recién ajustó, no con la sugerida original.
  const focusCardField = () => {
    if (activeField === "source" && source) {
      const typedSource = safeEvaluate(sourceExpr, source.currencyCode, numberLocale);
      const impliedRate = typedSource.amount > 0n ? rateFromAmounts(typedSource, cardMoney) : null;
      if (impliedRate !== null) setRateOverride(impliedRate);
    }
    setActiveField("card");
  };

  // Pasar a editar el monto de origen: precarga con lo que ya se estaba
  // mostrando ahí (derivado), para editar desde un número con sentido en
  // vez de arrancar de cero.
  const focusSourceField = () => {
    if (activeField !== "source" && sourceMoney) {
      setSourceExpr(amountToExpression(sourceMoney.amount, sourceMoney.currency, locale));
    }
    setActiveField("source");
  };

  const handleConfirmAmount = () => {
    let applied: bigint;
    try {
      applied = evaluateAmount(expr, card.currencyCode, numberLocale);
    } catch {
      return;
    }
    const delta = expectedDue - applied;
    if (delta === 0n) {
      void runSave(false, 0n);
    } else {
      setStep("reconcile");
    }
  };

  return (
    <>
      {/* 560 = 8 filas de 56px sin scroll, mismo criterio que `AccountPickerSheet`. */}
      <Sheet open={open && step === "source" && sources.length > 0} title={t("cardCyclePage.settlePickAccount")} onClose={handleClose} height={560}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {sources.map((a) => {
            // Tres casos: saldo YA negativo (cualquier moneda, sin FX);
            // misma moneda que la tarjeta (comparación directa); otra
            // moneda con saldo positivo (estimado con la tasa sugerida,
            // resuelta aparte en el `useEffect` de arriba — `undefined`
            // mientras esa resolución todavía no volvió, tratado como "no
            // marcar" en vez de un falso "alcanza"). El chequeo preciso,
            // con la tasa que termine usándose de verdad, se repite
            // siempre en el paso del monto.
            const short = a.currentBalance <= 0n || (a.currencyCode === card.currencyCode ? a.currentBalance < expectedDue : (crossCurrencyShort[a.id] ?? false));
            return (
              <div key={a.id}>
                <AccountRowUi
                  name={a.name}
                  meta={a.currencyCode}
                  balance={money(a.currentBalance, a.currencyCode)}
                  icon={ACCOUNT_KIND_ICON[a.kind]}
                  iconBackground={accountColorVar(a.color)}
                  privacy={!pinUnlocked}
                  onClick={() => selectSource(a)}
                />
                {short ? (
                  <p className="t-caption" style={{ color: "var(--critical)", margin: "-4px 0 8px 56px" }}>
                    {t("capture.insufficientFunds", { account: a.name })}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </Sheet>

      {open && step === "source" && sources.length === 0 ? (
        <Sheet open title={t("cardCyclePage.settlePickAccount")} onClose={handleClose} height={280}>
          <EmptyState
            message={t("cardCyclePage.noPaymentSource")}
            actionLabel={t("cardCyclePage.createAccount")}
            onAction={() => {
              handleClose();
              router.push("/accounts/new");
            }}
          />
        </Sheet>
      ) : null}

      <Sheet open={open && step === "amount" && source !== null} title={t("cardCyclePage.settleAmountTitle", { name: source?.name ?? "" })} onClose={handleClose}>
        {source ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {crossCurrency ? (
              // Dos montos enlazados, sin scroll: tocar cualquiera de los
              // dos lo vuelve el campo activo del teclado; el otro se
              // recalcula solo. Sin editor de tasa aparte — la tasa nunca
              // se toca directo, se AJUSTA editando el monto de origen
              // (pedido explícito: "modifico el valor en pesos... y se
              // ajusta la tasa, manteniendo el valor en dólares").
              <>
                <button
                  type="button"
                  onClick={focusSourceField}
                  style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "center" }}
                >
                  <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("cardCyclePage.sourceAmount")}</div>
                  <div style={{ marginTop: 2, fontFamily: "var(--font-mono)", fontSize: 26, color: activeField === "source" ? "var(--primary-ink)" : "var(--text-primary)" }}>
                    {source.currencyCode} {activeField === "source" ? sourceExpr || "0" : sourceMoney ? formatAmount(sourceMoney, { showSign: false, showSymbol: false }) : "—"}
                  </div>
                </button>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <Icon name="arrow-down" size={16} color="var(--text-muted)" />
                </div>
                <button
                  type="button"
                  onClick={focusCardField}
                  style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textAlign: "center" }}
                >
                  <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("cardCyclePage.cardAmount")}</div>
                  <div style={{ marginTop: 2, fontFamily: "var(--font-mono)", fontSize: 26, color: activeField === "card" ? "var(--primary-ink)" : "var(--text-primary)" }}>
                    {card.currencyCode} {activeField === "card" ? expr || "0" : formatAmount(cardMoney, { showSign: false, showSymbol: false })}
                  </div>
                </button>
                {displayRate !== null ? (
                  <p className="t-caption" style={{ textAlign: "center", color: "var(--text-muted)", margin: 0 }}>
                    {t("cardCyclePage.suggestedRate", { rate: `1 ${displayFrom} = ${formatRateTrimmed(displayRate)} ${displayTo}` })}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <p className="t-caption" style={{ color: "var(--text-muted)", margin: 0 }}>
                  {t("cardCyclePage.settleDueHint", { amount: formatAmountCompact(money(expectedDue > 0n ? expectedDue : 0n, card.currencyCode), { showSign: false }) })}
                </p>
                <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 28 }}>
                  {card.currencyCode} {expr || "0"}
                </div>
              </>
            )}
            {/* `operators={false}`: acá se edita un monto único ya precargado,
                no se arma una expresión — sumar/restar/multiplicar/dividir
                no tienen ningún efecto que el usuario pueda predecir en
                este contexto (mismo criterio que el teclado de tipo de
                cambio en `/currencies`). */}
            <Keypad
              operators={false}
              onKey={(k) => {
                const setActive = activeField === "source" ? setSourceExpr : setExpr;
                setActive((s) => (k === "backspace" ? s.slice(0, -1) : s + k));
              }}
              onClear={() => (activeField === "source" ? setSourceExpr("") : setExpr(""))}
            />
            {insufficientFunds ? (
              <p className="t-caption" style={{ textAlign: "center", color: "var(--critical)", margin: 0 }}>
                {t("capture.insufficientFunds", { account: source.name })}
              </p>
            ) : null}
            <Button disabled={saving || insufficientFunds || !isValidPayAmount(expr, card.currencyCode, numberLocale)} onClick={handleConfirmAmount}>
              {t("cardCyclePage.confirmSettle")}
            </Button>
          </div>
        ) : null}
      </Sheet>

      <Sheet open={open && step === "reconcile"} title={t("cardCyclePage.settleExpectedTitle")} onClose={handleClose} height={320}>
        {source
          ? (() => {
              let applied: bigint;
              try {
                applied = evaluateAmount(expr, card.currencyCode, numberLocale);
              } catch {
                applied = 0n;
              }
              const delta = expectedDue - applied;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <p className="t-body" style={{ margin: 0, color: "var(--text-secondary)" }}>
                    {t("cardCyclePage.settleExpected", { expected: formatAmountCompact(money(expectedDue, card.currencyCode), { showSign: false }) })}
                  </p>
                  <Button onClick={() => void runSave(false, delta)} disabled={saving}>
                    {t("cardCyclePage.settlePartial")}
                  </Button>
                  <Button onClick={() => void runSave(true, delta)} disabled={saving} style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>
                    {t("cardCyclePage.settleSettled")}
                  </Button>
                </div>
              );
            })()
          : null}
      </Sheet>
    </>
  );
}

function evaluateAmount(expr: string, currency: string, numberLocale: NumberLocale): bigint {
  return evaluateKeypadExpression(expr || "0", currency, numberLocale).amount;
}

/** Nunca tira mientras se está tipeando a mitad de un número — cae a 0 en vez de reventar el render. */
function safeEvaluate(expr: string, currency: string, numberLocale: NumberLocale): Money {
  try {
    return evaluateKeypadExpression(expr || "0", currency, numberLocale);
  } catch {
    return money(0n, currency);
  }
}
