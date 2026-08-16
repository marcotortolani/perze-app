'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Amount, Button, Chip, FxEditor, Icon, Keypad, SegmentedControl, Sheet } from '@/design-system'
import { useSuggestedFxRate } from '@/hooks/use-fx-rate'
import { convert, formatRateTrimmed, invertRate, rateFromAmounts, roundRateForDisplay, type ScaledRate } from '@/lib/fx/rate'
import { appendKeypadRateDigit, parseKeypadRate } from '@/lib/fx/rate-keypad'
import { formatAmount } from '@/lib/money/format'
import { evaluateKeypadExpression } from '@/lib/money/keypad'
import { money } from '@/lib/money/money'
import { amountToExpression } from '@/features/capture/AmountStep'
import { decimalSeparatorForLocale, numberLocaleForUiLocale, type Locale } from '@/i18n/formatting'
import type { AccountRow, HouseholdRow, RecurringRuleRow } from '@/lib/db/schema'
import { formatAmountCompact } from '@/lib/money/format'

export interface ChargeRecurringPreviewSheetProps {
  open: boolean
  household: HouseholdRow
  rule: RecurringRuleRow
  /** La cuenta donde va a caer el cargo — principal o de respaldo, la que haya decidido `chargeTargetAccount()`. */
  targetAccount: AccountRow
  locale: Locale
  saving: boolean
  /**
   * Promedio de los últimos 3 cargos reales de la regla
   * (`suggestedNextAmount`, `src/lib/analytics/recurring-history.ts`) —
   * `null` sin historial suficiente. Para servicios de monto variable
   * (agua, luz, gas) suele estar más cerca del próximo cargo que
   * `rule.expectedAmount`, que solo cambia cuando el usuario confirma un
   * monto distinto. Se ofrece como atajo en el teclado de "monto de
   * origen", nunca se aplica solo.
   */
  suggestedAmount?: bigint | null
  onClose: () => void
  /** Siempre lo que se veía en pantalla al confirmar — WYSIWYG, nunca se vuelve a resolver después. `originAmount` es el monto pactado, tal cual quedó (el de la regla o el corregido). */
  onConfirm: (rate: ScaledRate, originAmount: bigint) => void
}

type View = 'preview' | 'rateKeypad' | 'originKeypad' | 'debitedKeypad'

/**
 * Preview editable de "Cargar ahora" cuando la moneda de la regla difiere
 * de la de `targetAccount` — sea porque el recurrente está pactado en otra
 * moneda que la cuenta (alquiler en UYU pagado desde una cuenta en USD) o
 * porque el pago cayó en la cuenta de respaldo (`needsChargePreview()`,
 * `src/lib/recurring/materialize.ts`). La cotización resuelta es la mejor
 * estimación del sistema, pero la realidad del pago puede ser otra (lo
 * que el banco/casa de cambio dio de verdad, o —con servicios de consumo
 * variable— un monto de origen distinto al esperado) — acá se corrige
 * ANTES de que el movimiento se guarde, en vez de ir después a
 * Movimientos a editarlo a mano (lo que además nunca corrige la
 * cotización guardada).
 *
 * Tres valores enlazados, mismo mecanismo que `PayCardSheet`:
 * - Editar el **monto de origen** (el hero, "lo que vale de verdad" —
 *   servicios variables) recalcula el debitado con la tasa vigente. Es la
 *   única de las tres ediciones que además tiene un efecto fuera de este
 *   movimiento: si termina siendo distinto de `rule.expectedAmount`, el
 *   caller (`recurring/[id]/page.tsx`) actualiza la regla al confirmar —
 *   decisión de producto, no de este componente.
 * - Editar la **tasa** (`FxEditor` o su keypad) recalcula el debitado.
 * - Editar el **monto debitado** infiere la tasa real con
 *   `rateFromAmounts` — nunca se guarda un monto suelto desincronizado de
 *   la tasa (mismo invariante que `counterFxRateOverride`).
 *
 * `rateOverride`/`effectiveRate` viven SIEMPRE en la dirección canónica
 * (`rule.currencyCode → targetAccount.currencyCode`, la que espera
 * `resolveChargeAccount`/`convert`) — `inverted` es puramente de
 * presentación y solo se aplica al armar `displayRate`/`FxEditor`, nunca
 * se guarda invertido. Si USD participa, siempre es la moneda ancla
 * ("1 USD = X", `docs/02-design-system.md`) — mismo criterio que
 * `rateNumeratorIsSource` en `PayCardSheet`; con las dos exóticas (ni UYU
 * ni USD son "más natural" una que otra) se arranca sin invertir. El
 * toggle de dirección deja al usuario cambiarlo en cualquier momento,
 * igual que en `/accounts/resolve-fx`.
 */
export function ChargeRecurringPreviewSheet({ open, household, rule, targetAccount, locale, saving, suggestedAmount = null, onClose, onConfirm }: ChargeRecurringPreviewSheetProps) {
  const t = useTranslations()
  const numberLocale = numberLocaleForUiLocale(locale)
  const decimalSeparator = decimalSeparatorForLocale(locale)
  const [view, setView] = useState<View>('preview')
  const [rateOverride, setRateOverride] = useState<ScaledRate | null>(null)
  const [originAmountOverride, setOriginAmountOverride] = useState<bigint | null>(null)
  const [rateKeypadDigits, setRateKeypadDigits] = useState('')
  const [originExpr, setOriginExpr] = useState('')
  const [debitedExpr, setDebitedExpr] = useState('')
  const [inverted, setInverted] = useState(() => targetAccount.currencyCode === 'USD' && rule.currencyCode !== 'USD')

  const suggestedQuery = useSuggestedFxRate(household.id, rule.currencyCode, targetAccount.currencyCode)
  const suggestedRate = suggestedQuery.data?.rate ?? null
  const effectiveRate = rateOverride ?? suggestedRate

  const originMoney = money(originAmountOverride ?? rule.expectedAmount, rule.currencyCode)
  const convertedMoney = effectiveRate !== null ? convert(originMoney, targetAccount.currencyCode, effectiveRate) : null

  // Solo de presentación — `effectiveRate`/`rateOverride` no cambian.
  const displayFrom = inverted ? targetAccount.currencyCode : rule.currencyCode
  const displayTo = inverted ? rule.currencyCode : targetAccount.currencyCode
  const displayRate = effectiveRate !== null ? (inverted ? invertRate(effectiveRate) : effectiveRate) : null
  const displaySuggested = suggestedRate !== null ? (inverted ? invertRate(suggestedRate) : suggestedRate) : undefined

  const reset = () => {
    setView('preview')
    setRateOverride(null)
    setOriginAmountOverride(null)
    setRateKeypadDigits('')
    setOriginExpr('')
    setDebitedExpr('')
    setInverted(targetAccount.currencyCode === 'USD' && rule.currencyCode !== 'USD')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleConfirm = () => {
    if (effectiveRate === null || saving) return
    onConfirm(effectiveRate, originMoney.amount)
  }

  const openRateKeypad = () => {
    const seed = displayRate !== null ? formatRateTrimmed(roundRateForDisplay(displayRate)) : ''
    const [wholePart, decPart] = seed.split('.')
    setRateKeypadDigits(decPart ? `${wholePart}${decimalSeparator}${decPart}` : (wholePart ?? ''))
    setView('rateKeypad')
  }

  const commitRateKeypad = () => {
    const parsed = parseKeypadRate(rateKeypadDigits, decimalSeparator)
    // El teclado tipea en la dirección MOSTRADA — vuelve a la canónica
    // antes de guardar, `rateOverride` nunca vive invertido.
    if (parsed !== null) setRateOverride(inverted ? invertRate(parsed) : parsed)
    setView('preview')
  }

  const openOriginKeypad = () => {
    setOriginExpr(amountToExpression(originMoney.amount, rule.currencyCode, locale))
    setView('originKeypad')
  }

  const commitOriginKeypad = () => {
    try {
      const typed = evaluateKeypadExpression(originExpr || '0', rule.currencyCode, numberLocale)
      setOriginAmountOverride(typed.amount)
    } catch {
      // Expresión sin resolver todavía — no hay nada que aplicar.
    }
    setView('preview')
  }

  const openDebitedKeypad = () => {
    setDebitedExpr(convertedMoney ? amountToExpression(convertedMoney.amount, targetAccount.currencyCode, locale) : '')
    setView('debitedKeypad')
  }

  const commitDebitedKeypad = () => {
    try {
      const typed = evaluateKeypadExpression(debitedExpr || '0', targetAccount.currencyCode, numberLocale)
      const implied = rateFromAmounts(originMoney, typed)
      if (implied !== null) setRateOverride(implied)
    } catch {
      // Expresión sin resolver todavía — no hay nada que aplicar.
    }
    setView('preview')
  }

  return (
    <Sheet open={open} title={t('recurringPage.chargePreviewTitle')} onClose={handleClose}>
      {view === 'preview' ? (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={openOriginKeypad}
            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'center' }}
          >
            <Amount
              value={money(rule.kind === 'expense' ? -originMoney.amount : originMoney.amount, rule.currencyCode)}
              size="hero"
              fit
              polarity={rule.kind === 'income' ? 'positive' : 'negative'}
              tabular
            />
          </button>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Icon name="arrow-down" size={16} color="var(--text-muted)" />
          </div>
          <button
            type="button"
            onClick={openDebitedKeypad}
            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'center' }}
          >
            <div className="t-caption" style={{ color: 'var(--text-muted)' }}>
              {t('recurringPage.chargePreviewDebited', { name: targetAccount.name })}
            </div>
            <div style={{ marginTop: 2, fontFamily: 'var(--font-mono)', fontSize: 26, color: 'var(--text-primary)' }}>
              {targetAccount.currencyCode}{' '}
              {convertedMoney ? formatAmount(convertedMoney, { showSign: false, showSymbol: false }) : '—'}
            </div>
          </button>
          <SegmentedControl
            options={[
              { id: 'normal', label: `1 ${rule.currencyCode} = ${targetAccount.currencyCode}` },
              { id: 'inverted', label: `1 ${targetAccount.currencyCode} = ${rule.currencyCode}` },
            ]}
            value={inverted ? 'inverted' : 'normal'}
            onChange={(id) => setInverted(id === 'inverted')}
            size="sm"
          />
          <FxEditor
            from={displayFrom}
            to={displayTo}
            rate={displayRate ?? roundRateForDisplay(displaySuggested ?? 0n)}
            suggested={displaySuggested}
            source={suggestedQuery.data?.source === 'manual' ? t('currenciesPage.manualOverride') : (suggestedQuery.data?.provider ?? t('currenciesPage.noProvider'))}
            stale={suggestedQuery.data?.isStale ?? false}
            onChange={(r) => setRateOverride(inverted ? invertRate(r) : r)}
            onOpenKeypad={openRateKeypad}
          />
          <Button disabled={effectiveRate === null || saving} onClick={handleConfirm}>
            {t('recurringPage.chargeNow')}
          </Button>
        </div>
      ) : null}

      {view === 'rateKeypad' ? (
        <div className="flex flex-col gap-5">
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-hero-size)', lineHeight: 'var(--text-hero-line)', fontWeight: 600, marginTop: 4 }}>
              {rateKeypadDigits === '' ? '0' : rateKeypadDigits}
            </div>
          </div>
          <Keypad operators={false} onKey={(key) => setRateKeypadDigits((d) => appendKeypadRateDigit(d, key, decimalSeparator))} onClear={() => setRateKeypadDigits('')} />
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="secondary" onClick={() => setView('preview')}>
              {t('currenciesPage.keypadCancel')}
            </Button>
            <Button variant="primary" onClick={commitRateKeypad} disabled={parseKeypadRate(rateKeypadDigits, decimalSeparator) === null}>
              {t('currenciesPage.keypadDone')}
            </Button>
          </div>
        </div>
      ) : null}

      {view === 'originKeypad' ? (
        <div className="flex flex-col gap-4">
          <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 28 }}>
            {rule.currencyCode} {originExpr || '0'}
          </div>
          {/* Atajo con el promedio de los últimos 3 cargos — en vez de
              forzar a tipear desde cero un servicio que cambia cada ciclo
              (agua, luz, gas). Solo un prellenado: el usuario lo toca y
              sigue pudiendo corregir con el teclado, nunca se aplica solo. */}
          {suggestedAmount !== null ? (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Chip icon="trend" onClick={() => setOriginExpr(amountToExpression(suggestedAmount, rule.currencyCode, locale))}>
                {t('recurringPage.chargePreviewSuggestedAmount', {
                  amount: formatAmountCompact(money(suggestedAmount, rule.currencyCode), { showSign: false }),
                })}
              </Chip>
            </div>
          ) : null}
          <Keypad operators={false} onKey={(k) => setOriginExpr((s) => (k === 'backspace' ? s.slice(0, -1) : s + k))} onClear={() => setOriginExpr('')} />
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="secondary" onClick={() => setView('preview')}>
              {t('currenciesPage.keypadCancel')}
            </Button>
            <Button variant="primary" onClick={commitOriginKeypad}>
              {t('currenciesPage.keypadDone')}
            </Button>
          </div>
        </div>
      ) : null}

      {view === 'debitedKeypad' ? (
        <div className="flex flex-col gap-4">
          <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 28 }}>
            {targetAccount.currencyCode} {debitedExpr || '0'}
          </div>
          <Keypad operators={false} onKey={(k) => setDebitedExpr((s) => (k === 'backspace' ? s.slice(0, -1) : s + k))} onClear={() => setDebitedExpr('')} />
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="secondary" onClick={() => setView('preview')}>
              {t('currenciesPage.keypadCancel')}
            </Button>
            <Button variant="primary" onClick={commitDebitedKeypad}>
              {t('currenciesPage.keypadDone')}
            </Button>
          </div>
        </div>
      ) : null}
    </Sheet>
  )
}
