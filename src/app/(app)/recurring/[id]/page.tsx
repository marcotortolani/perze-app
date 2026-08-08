'use client'

import { use, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useLocale, useTranslations } from 'next-intl'
import {
  Amount,
  Button,
  Chip,
  EmptyState,
  ListRow,
  Skeleton,
  StatusBadge,
  Switch,
  usePageHeader,
  ZMark,
} from '@/design-system'
import { useCurrentHousehold } from '@/hooks/use-current-household'
import { useEffectiveUserId } from '@/hooks/use-current-user'
import { useAccounts } from '@/hooks/use-accounts'
import { useCategories } from '@/hooks/use-categories'
import { useCategoryLabel } from '@/hooks/use-category-label'
import {
  useInvalidateRecurringRules,
  useRecurringRules,
} from '@/hooks/use-recurring-rules'
import { useInvalidateTransactions } from '@/hooks/use-transactions'
import { useRecurringRuleHistory } from '@/hooks/use-recurring-rule-history'
import { recurringRulesRepo } from '@/lib/repos/recurring-rules-repo'
import { money } from '@/lib/money/money'
import { formatAmountCompact } from '@/lib/money/format'
import {
  amountSeries,
  detectPriceIncrease,
  RECURRING_HISTORY_MIN_POINTS,
} from '@/lib/analytics/recurring-history'
import {
  isChargeDue,
  nextOccurrenceAfter,
  occurredAtFor,
  occurrencesBetween,
} from '@/lib/recurring/occurrences'
import { chargeRecurringNow, needsFxPreview } from '@/lib/recurring/materialize'
import type { ScaledRate } from '@/lib/fx/rate'
import { todayIso } from '@/lib/repos/ids'
import {
  formatDateShort,
  formatNumericDate,
  type Locale,
} from '@/i18n/formatting'
import { useDateFormatPreference } from '@/stores/format-preferences-store'
import { ChargeFallbackPreviewSheet } from './ChargeFallbackPreviewSheet'

// C15/auditoría: importar `BarChart` directo de su archivo, no del barrel.
const BarChart = dynamic(
  () => import('@/design-system/charts/BarChart').then((m) => m.BarChart),
  { ssr: false },
)

/** G2 — detalle de una regla recurrente: próximas ocurrencias, historial de montos, auto-registro. La edición vive en `[id]/edit`. */
export default function RecurringRuleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const t = useTranslations()
  const locale = useLocale() as Locale
  const dateFormat = useDateFormatPreference()
  const router = useRouter()
  const categoryLabel = useCategoryLabel()
  const { data: household } = useCurrentHousehold()
  const userId = useEffectiveUserId()
  const { data: rules } = useRecurringRules(household?.id)
  const { data: accounts = [] } = useAccounts(household?.id)
  const { data: categories = [] } = useCategories(household?.id)
  const { data: history } = useRecurringRuleHistory(id)
  const invalidateRules = useInvalidateRecurringRules(household?.id)
  const invalidateTransactions = useInvalidateTransactions(household?.id)

  const [showTable, setShowTable] = useState(false)
  const [charging, setCharging] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const rule = rules?.find((r) => r.id === id)
  usePageHeader({
    ...(rule ? { title: rule.name } : {}),
    onBack: () => router.back(),
    backLabel: t('ds.appHeader.back'),
  })

  if (!household || !rules || !userId)
    return <Skeleton height={260} style={{ marginTop: 16 }} />
  if (!rule)
    return (
      <EmptyState
        message={t('recurringPage.notFound')}
        actionLabel={t('recurringPage.back')}
        onAction={() => router.push('/recurring')}
      />
    )

  const account = accounts.find((a) => a.id === rule.accountId)
  const fallbackAccount = rule.fallbackAccountId
    ? accounts.find((a) => a.id === rule.fallbackAccountId)
    : undefined
  const category = rule.categoryId
    ? categories.find((c) => c.id === rule.categoryId)
    : undefined

  const series = amountSeries(history ?? [])
  const increase = detectPriceIncrease(series, rule.frequency)
  const today = todayIso()
  // Clave de idempotencia real: `recurringOccurrenceDate`, no `occurredAt`
  // (que en `series`/el gráfico es la fecha real de pago — puede ser
  // posterior al período que salda si se cargó tarde a mano).
  const chargedDates = new Set(
    (history ?? [])
      .filter((tx) => tx.deletedAt === null)
      .map((tx) => tx.recurringOccurrenceDate ?? tx.occurredAt.slice(0, 10)),
  )
  // Con auto-registro OFF la fecha de la regla es solo aviso/organización
  // — el usuario decide cuándo pagar, así que se busca el primer período
  // no cargado hacia adelante (vencido o futuro), con el mismo horizonte
  // de 2 años que ya usa `upcoming` más abajo. `nextChargeableDate` puede
  // caer en el futuro (nada vencido todavía); el gate de "Cargar ahora"
  // vive en `isDue`, no acá.
  const nextChargeableDate =
    occurrencesBetween(rule, rule.anchorDate, addYears(today, 2)).find(
      (d) => !chargedDates.has(d),
    ) ?? null
  const isDue = isChargeDue(rule.autoPost, nextChargeableDate, today)
  // "Próximas ocurrencias" tiene que reflejar lo que TODAVÍA falta saldar,
  // no la grilla cruda del calendario — si no, un período ya cargado a
  // mano (con "Cargar ahora", antes de que venza) seguía apareciendo acá
  // como si el recordatorio siguiera vigente. Arranca en
  // `nextChargeableDate` (mismo criterio que el botón: incluye atrasos) y
  // filtra por las mismas `chargedDates`, no solo por fecha.
  const firstUpcoming = nextChargeableDate ?? nextOccurrenceAfter(rule, today)
  const upcoming = firstUpcoming
    ? occurrencesBetween(rule, firstUpcoming, addYears(firstUpcoming, 2))
        .filter((d) => !chargedDates.has(d))
        .slice(0, 3)
    : []

  // Ajustes → Formato: toda fecha se muestra con `dateFormat`, nunca ISO
  // crudo — si el usuario lo cambia después, esta pantalla se ajusta sola.
  const displayDate = (dateOnly: string) =>
    formatNumericDate(locale, new Date(occurredAtFor(dateOnly)), dateFormat)

  const summary =
    rule.frequency === 'monthly' || rule.frequency === 'yearly'
      ? t(`recurringPage.frequency.${rule.frequency}`) +
        (rule.dayOfMonth
          ? ` · ${t('recurringPage.dayOfMonth', { day: rule.dayOfMonth })}`
          : '')
      : t(`recurringPage.frequency.${rule.frequency}`)

  const toggleAutoPost = async (checked: boolean) => {
    await recurringRulesRepo.update(rule.id, { autoPost: checked })
    invalidateRules()
  }

  // Preview editable de tasa/monto (`ChargeFallbackPreviewSheet`) solo
  // cuando el pago va a caer en el respaldo con otra moneda — ahí la
  // cotización resuelta es una estimación que puede no coincidir con lo
  // que el banco/casa de cambio dio de verdad. Para cualquier otro caso
  // (cuenta principal, o respaldo en la misma moneda) sigue siendo un
  // solo tap, sin fricción extra.
  const confirmCharge = async (rateOverride?: ScaledRate) => {
    if (charging || !isDue || nextChargeableDate === null) return
    setCharging(true)
    try {
      const result = await chargeRecurringNow(
        household,
        userId,
        rule,
        nextChargeableDate,
        today,
        rateOverride,
      )
      invalidateTransactions()
      if (result.usedFallback) {
        toast(t('recurringPage.chargedToFallback', { name: rule.name }))
      } else if (result.fallbackSkippedNoRate) {
        toast(t('recurringPage.fallbackSkippedNoRate', { name: rule.name }))
      } else {
        toast(t('recurringPage.charged', { name: rule.name }))
      }
      setPreviewOpen(false)
    } finally {
      setCharging(false)
    }
  }

  const handleChargeNow = () => {
    if (charging || !isDue) return
    if (account && fallbackAccount && needsFxPreview(rule, account, fallbackAccount)) {
      setPreviewOpen(true)
      return
    }
    void confirmCharge()
  }

  const handleArchive = async () => {
    await recurringRulesRepo.archive(rule.id)
    invalidateRules()
    toast(t('recurringPage.archived'))
    router.push('/recurring')
  }

  return (
    // `lg`+: dos columnas, igual que `new/page.tsx` y `RecurringPageContent.tsx`
    // — el ancho del shell es único en toda la app (`--content-max-width-wide`),
    // así que sin este grid el formulario/botones se estiran a 1200px.
    <div
      className="grid grid-cols-1 lg:grid-cols-6"
      style={{ gap: 24, height: '100%' }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          paddingTop: 16,
          gap: 16,
        }}
        className="lg:col-span-4 xl:col-span-3"
      >
        <div
          className="t-caption"
          style={{ color: 'var(--text-muted)', textAlign: 'center' }}
        >
          {summary}
        </div>
        <div style={{ textAlign: 'center' }}>
          <Amount
            value={money(rule.kind === 'expense' ? -rule.expectedAmount : rule.expectedAmount, rule.currencyCode)}
            size="hero"
            fit
            polarity={rule.kind === 'income' ? 'positive' : 'negative'}
            tabular
          />
        </div>

        {increase ? (
          <StatusBadge status="serious" icon="trend">
            {t('recurringPage.priceIncrease', { pct: increase.pct })} ·{' '}
            {t('recurringPage.priceIncreaseDetail', {
              amount: formatAmountCompact(
                money(increase.from, rule.currencyCode),
                { showSign: false },
              ),
            })}
          </StatusBadge>
        ) : null}

        {series.length >= RECURRING_HISTORY_MIN_POINTS ? (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <div className="t-caption" style={{ color: 'var(--text-muted)' }}>
                {t('recurringPage.amountHistory')}
              </div>
              <Chip
                selected={showTable}
                onClick={() => setShowTable((s) => !s)}
              >
                {t('recurringPage.amountHistoryTable')}
              </Chip>
            </div>
            {showTable ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {series.map((p) => (
                  <div
                    key={p.date}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <span>{displayDate(p.date)}</span>
                    <Amount
                      value={money(rule.kind === 'expense' ? -p.amount : p.amount, rule.currencyCode)}
                      size="body"
                      polarity={rule.kind === 'income' ? 'positive' : 'negative'}
                      tabular
                    />
                  </div>
                ))}
              </div>
            ) : (
              <BarChart
                data={series.slice(-6).map((p) => ({
                  label: formatDateShort(
                    locale,
                    new Date(occurredAtFor(p.date)),
                  ),
                  value: Number(p.amount),
                  display: formatAmountCompact(
                    money(p.amount, rule.currencyCode),
                    { showSign: false },
                  ),
                }))}
                color={
                  rule.kind === 'expense'
                    ? 'var(--warning-ink, var(--data-4))'
                    : 'var(--data-1)'
                }
              />
            )}
          </div>
        ) : (
          <p
            className="t-body"
            style={{ color: 'var(--text-secondary)', textAlign: 'center' }}
          >
            {t('recurringPage.amountHistoryEmpty')}
          </p>
        )}

        {upcoming.length > 0 ? (
          <ListRow
            label={t('recurringPage.nextOccurrences')}
            meta={upcoming.map(displayDate).join(', ')}
            variant="value"
          />
        ) : null}

        <button
          type="button"
          onClick={() => router.push(`/accounts?account=${account?.id}`)}
          style={{
            background: 'var(--surface-2)',
            border: 0,
            borderRadius: 'var(--radius-card)',
            padding: 14,
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <div className="t-caption" style={{ color: 'var(--text-muted)' }}>
            {t('goalsPage.account')}
          </div>
          <div
            style={{ marginTop: 2, color: 'var(--text-primary)', fontSize: 15 }}
          >
            {account ? `${account.name} · ${account.currencyCode}` : '—'}
            {category ? ` · ${categoryLabel(category)}` : ''}
          </div>
          {fallbackAccount ? (
            <div
              style={{ marginTop: 2, color: 'var(--text-secondary)', fontSize: 13 }}
            >
              {t('recurringPage.fallbackAccount')}
              {': '}
              {fallbackAccount.name} · {fallbackAccount.currencyCode}
            </div>
          ) : null}
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '12px 4px',
          }}
        >
          <div style={{ flex: '1 1 auto' }}>
            <div style={{ fontSize: 15, color: 'var(--text-primary)' }}>
              {t('recurringPage.autoPost')}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {t('recurringPage.autoPostHint')}
            </div>
          </div>
          <Switch
            checked={rule.autoPost}
            onChange={toggleAutoPost}
            id={`recurring-${rule.id}-autopost`}
          />
        </div>

        {isDue ? (
          <Button disabled={charging} onClick={handleChargeNow}>
            {t('recurringPage.chargeNow')}
          </Button>
        ) : null}

        {/* Fila en `md` (angosto pero de a una columna) y en `xl` (la
            columna izquierda del grid `lg:grid-cols-2` ya tiene ancho de
            sobra); columna en mobile y en `lg` (esa misma columna angosta
            todavía, apretada contra la segunda columna del grid). */}
        <div
          className=" flex flex-col md:flex-row lg:flex-col xl:flex-row"
          style={{ marginTop: 'auto', paddingBottom: 24, gap: 8 }}
        >
          <Button
            variant="secondary"
            fullWidth={false}
            onClick={() => router.push(`/recurring/${rule.id}/edit`)}
            style={{ flex: '1 1 auto' }}
          >
            {t('recurringPage.editFrequencyOrAmount')}
          </Button>
          <Button
            variant="danger"
            fullWidth={false}
            onClick={handleArchive}
            style={{ flex: '1 1 auto' }}
          >
            {t('recurringPage.archive')}
          </Button>
        </div>
      </div>

      <div
        className="hidden xl:flex lg:col-span-2 xl:col-span-3"
        style={{ alignItems: 'center', justifyContent: 'center' }}
      >
        <ZMark
          variant="flip"
          animated
          size={28}
          gap={8}
          aria-label={t('app.name')}
        />
      </div>

      {fallbackAccount ? (
        <ChargeFallbackPreviewSheet
          open={previewOpen}
          household={household}
          rule={rule}
          fallbackAccount={fallbackAccount}
          locale={locale}
          saving={charging}
          onClose={() => setPreviewOpen(false)}
          onConfirm={(rate) => void confirmCharge(rate)}
        />
      ) : null}
    </div>
  )
}

function addYears(iso: string, years: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${y! + years}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
