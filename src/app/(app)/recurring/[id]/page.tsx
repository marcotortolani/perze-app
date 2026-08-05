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
  nextOccurrenceAfter,
  occurredAtFor,
  occurrencesBetween,
} from '@/lib/recurring/occurrences'
import { chargeRecurringNow } from '@/lib/recurring/materialize'
import { todayIso } from '@/lib/repos/ids'
import {
  formatDateShort,
  formatNumericDate,
  type Locale,
} from '@/i18n/formatting'
import { useDateFormatPreference } from '@/stores/format-preferences-store'

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
  const category = rule.categoryId
    ? categories.find((c) => c.id === rule.categoryId)
    : undefined

  const series = amountSeries(history ?? [])
  const increase = detectPriceIncrease(series, rule.frequency)
  const today = todayIso()
  const firstUpcoming = nextOccurrenceAfter(rule, today)
  const upcoming = firstUpcoming
    ? occurrencesBetween(rule, firstUpcoming, addYears(firstUpcoming, 2)).slice(
        0,
        3,
      )
    : []
  const dueOccurrences = occurrencesBetween(
    rule,
    rule.anchorDate,
    today,
  ).filter((d) => !series.some((p) => p.date === d))
  const isDue = !rule.autoPost && dueOccurrences.length > 0

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

  const handleChargeNow = async () => {
    if (charging || dueOccurrences.length === 0) return
    setCharging(true)
    try {
      await chargeRecurringNow(household, userId, rule, dueOccurrences[0]!)
      invalidateTransactions()
      toast(t('recurringPage.autoPosted', { name: rule.name }))
    } finally {
      setCharging(false)
    }
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
            value={money(rule.expectedAmount, rule.currencyCode)}
            size="hero"
            fit
            showSign={false}
            polarity="neutral"
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
                      value={money(p.amount, rule.currencyCode)}
                      size="body"
                      showSign={false}
                      polarity="neutral"
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
    </div>
  )
}

function addYears(iso: string, years: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${y! + years}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
