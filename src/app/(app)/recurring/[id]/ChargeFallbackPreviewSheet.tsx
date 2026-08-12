'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Amount, Button, FxEditor, Icon, Keypad, SegmentedControl, Sheet } from '@/design-system'
import { useSuggestedFxRate } from '@/hooks/use-fx-rate'
import { convert, formatRateTrimmed, invertRate, rateFromAmounts, roundRateForDisplay, type ScaledRate } from '@/lib/fx/rate'
import { appendKeypadRateDigit, parseKeypadRate } from '@/lib/fx/rate-keypad'
import { formatAmount } from '@/lib/money/format'
import { evaluateKeypadExpression } from '@/lib/money/keypad'
import { money } from '@/lib/money/money'
import { amountToExpression } from '@/features/capture/AmountStep'
import { decimalSeparatorForLocale, numberLocaleForUiLocale, type Locale } from '@/i18n/formatting'
import type { AccountRow, HouseholdRow, RecurringRuleRow } from '@/lib/db/schema'

export interface ChargeFallbackPreviewSheetProps {
  open: boolean
  household: HouseholdRow
  rule: RecurringRuleRow
  fallbackAccount: AccountRow
  locale: Locale
  saving: boolean
  onClose: () => void
  /** Siempre la tasa efectiva que se veía en pantalla al confirmar — WYSIWYG, nunca se vuelve a resolver después. */
  onConfirm: (rate: ScaledRate) => void
}

type View = 'preview' | 'rateKeypad' | 'amountKeypad'

/**
 * Preview editable de "Cargar ahora" cuando el pago va a caer en la
 * cuenta de respaldo con otra moneda que la regla (`needsFxPreview()`,
 * `src/lib/recurring/materialize.ts`). La cotización resuelta es la mejor
 * estimación del sistema, pero la realidad del pago puede ser otra (lo
 * que el banco/casa de cambio dio de verdad) — acá se puede corregir
 * ANTES de que el movimiento se guarde, en vez de ir después a
 * Movimientos a editarlo a mano (lo que además nunca corrige la
 * cotización guardada).
 *
 * El monto de la regla (`rule.expectedAmount`/`rule.currencyCode`) nunca
 * cambia acá — es un dato fijo de la regla, para eso está "Editar
 * frecuencia o monto". Lo único editable es la tasa (`FxEditor`, mismo
 * patrón que `/accounts/resolve-fx`) y el monto final convertido, enlazados
 * como en `PayCardSheet`: editar el monto final "hacia atrás" infiere la
 * tasa real con `rateFromAmounts` — nunca se guarda un monto suelto
 * desincronizado de la tasa (mismo invariante que `counterFxRateOverride`).
 *
 * `rateOverride`/`effectiveRate` viven SIEMPRE en la dirección canónica
 * (`rule.currencyCode → fallbackAccount.currencyCode`, la que espera
 * `resolveChargeAccount`/`convert`) — `inverted` es puramente de
 * presentación y solo se aplica al armar `displayRate`/`FxEditor`, nunca
 * se guarda invertido. Si USD participa, siempre es la moneda ancla
 * ("1 USD = X", `docs/02-design-system.md`) — mismo criterio que
 * `rateNumeratorIsSource` en `PayCardSheet`; con las dos exóticas (ni UYU
 * ni USD son "más natural" una que otra) se arranca sin invertir. El
 * toggle de dirección deja al usuario cambiarlo en cualquier momento,
 * igual que en `/accounts/resolve-fx`.
 */
export function ChargeFallbackPreviewSheet({ open, household, rule, fallbackAccount, locale, saving, onClose, onConfirm }: ChargeFallbackPreviewSheetProps) {
  const t = useTranslations()
  const numberLocale = numberLocaleForUiLocale(locale)
  const decimalSeparator = decimalSeparatorForLocale(locale)
  const [view, setView] = useState<View>('preview')
  const [rateOverride, setRateOverride] = useState<ScaledRate | null>(null)
  const [rateKeypadDigits, setRateKeypadDigits] = useState('')
  const [amountExpr, setAmountExpr] = useState('')
  const [inverted, setInverted] = useState(() => fallbackAccount.currencyCode === 'USD' && rule.currencyCode !== 'USD')

  const suggestedQuery = useSuggestedFxRate(household.id, rule.currencyCode, fallbackAccount.currencyCode)
  const suggestedRate = suggestedQuery.data?.rate ?? null
  const effectiveRate = rateOverride ?? suggestedRate

  const ruleMoney = money(rule.expectedAmount, rule.currencyCode)
  const convertedMoney = effectiveRate !== null ? convert(ruleMoney, fallbackAccount.currencyCode, effectiveRate) : null

  // Solo de presentación — `effectiveRate`/`rateOverride` no cambian.
  const displayFrom = inverted ? fallbackAccount.currencyCode : rule.currencyCode
  const displayTo = inverted ? rule.currencyCode : fallbackAccount.currencyCode
  const displayRate = effectiveRate !== null ? (inverted ? invertRate(effectiveRate) : effectiveRate) : null
  const displaySuggested = suggestedRate !== null ? (inverted ? invertRate(suggestedRate) : suggestedRate) : undefined

  const reset = () => {
    setView('preview')
    setRateOverride(null)
    setRateKeypadDigits('')
    setAmountExpr('')
    setInverted(fallbackAccount.currencyCode === 'USD' && rule.currencyCode !== 'USD')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleConfirm = () => {
    if (effectiveRate === null || saving) return
    onConfirm(effectiveRate)
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

  const openAmountKeypad = () => {
    setAmountExpr(convertedMoney ? amountToExpression(convertedMoney.amount, fallbackAccount.currencyCode, locale) : '')
    setView('amountKeypad')
  }

  const commitAmountKeypad = () => {
    try {
      const typed = evaluateKeypadExpression(amountExpr || '0', fallbackAccount.currencyCode, numberLocale)
      const implied = rateFromAmounts(ruleMoney, typed)
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
          <div style={{ textAlign: 'center' }}>
            <Amount
              value={money(rule.kind === 'expense' ? -rule.expectedAmount : rule.expectedAmount, rule.currencyCode)}
              size="hero"
              fit
              polarity={rule.kind === 'income' ? 'positive' : 'negative'}
              tabular
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Icon name="arrow-down" size={16} color="var(--text-muted)" />
          </div>
          <button
            type="button"
            onClick={openAmountKeypad}
            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'center' }}
          >
            <div className="t-caption" style={{ color: 'var(--text-muted)' }}>
              {t('recurringPage.chargePreviewDebited', { name: fallbackAccount.name })}
            </div>
            <div style={{ marginTop: 2, fontFamily: 'var(--font-mono)', fontSize: 26, color: 'var(--text-primary)' }}>
              {fallbackAccount.currencyCode}{' '}
              {convertedMoney ? formatAmount(convertedMoney, { showSign: false, showSymbol: false }) : '—'}
            </div>
          </button>
          <SegmentedControl
            options={[
              { id: 'normal', label: `1 ${rule.currencyCode} = ${fallbackAccount.currencyCode}` },
              { id: 'inverted', label: `1 ${fallbackAccount.currencyCode} = ${rule.currencyCode}` },
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

      {view === 'amountKeypad' ? (
        <div className="flex flex-col gap-4">
          <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 28 }}>
            {fallbackAccount.currencyCode} {amountExpr || '0'}
          </div>
          <Keypad operators={false} onKey={(k) => setAmountExpr((s) => (k === 'backspace' ? s.slice(0, -1) : s + k))} onClear={() => setAmountExpr('')} />
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="secondary" onClick={() => setView('preview')}>
              {t('currenciesPage.keypadCancel')}
            </Button>
            <Button variant="primary" onClick={commitAmountKeypad}>
              {t('currenciesPage.keypadDone')}
            </Button>
          </div>
        </div>
      ) : null}
    </Sheet>
  )
}
