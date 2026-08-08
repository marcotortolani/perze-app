'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
  Amount,
  EmptyState,
  ListRow,
  NeedsFxBanner,
  Sheet,
  Skeleton,
  usePageHeader,
} from '@/design-system'
import { useCurrentHousehold } from '@/hooks/use-current-household'
import { useAccounts } from '@/hooks/use-accounts'
import {
  useTransactions,
  useTransactionYearRange,
} from '@/hooks/use-transactions'
import { useScopeStore } from '@/stores/scope-store'
import { accountMatchesScope } from '@/lib/scope/match-scope'
import {
  dayKeyOf,
  localMidnightIso,
  monthOfDay,
  monthRange,
} from '@/features/movements/calendar-scope'
import { add, money, subtract, zero } from '@/lib/money/money'
import type { Locale } from '@/i18n/formatting'

function monthName(locale: Locale, month1: number): string {
  return new Intl.DateTimeFormat(locale, { month: 'long' }).format(
    new Date(2026, month1 - 1, 1),
  )
}

/**
 * Navegador año → mes de TODO el historial — a diferencia de `/transactions`
 * (que abre acotado a "este mes", ver `defaultMovementsFilters`), acá se
 * pide expresamente ver más. No reimplementa la lista: elegir un mes
 * navega a `/transactions?from=&to=`, el mismo mecanismo que ya usa el
 * deep link de "período" del home — la lista real, con toda su
 * funcionalidad (swipe, detalle, filtros), se queda haciendo lo que ya
 * hace, solo que acotada a un rango arbitrario en vez de al mes en curso.
 */
export default function TransactionsHistoryPage() {
  const t = useTranslations()
  const locale = useLocale() as Locale
  const router = useRouter()
  usePageHeader({
    title: t('transactions.history.title'),
    onBack: () => router.back(),
    backLabel: t('transactions.detail.back'),
  })

  const { data: household } = useCurrentHousehold()
  const { data: accountsRaw = [] } = useAccounts(household?.id)
  const scope = useScopeStore((s) => s.scope)
  const accounts = useMemo(
    () => accountsRaw.filter((a) => accountMatchesScope(a.visibility, scope)),
    [accountsRaw, scope],
  )
  const scopedAccountIds = useMemo(
    () => new Set(accounts.map((a) => a.id)),
    [accounts],
  )

  const { data: yearRange, isLoading: yearsLoading } = useTransactionYearRange(
    household?.id,
  )
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [yearSheetOpen, setYearSheetOpen] = useState(false)
  const year = selectedYear ?? yearRange?.maxYear ?? new Date().getFullYear()
  const years = yearRange
    ? Array.from(
        { length: yearRange.maxYear - yearRange.minYear + 1 },
        (_, i) => yearRange.maxYear - i,
      )
    : []

  const yearBounds = useMemo(
    () => ({ from: localMidnightIso(year, 0, 1), to: localMidnightIso(year + 1, 0, 1) }),
    [year],
  )
  const { data: yearTransactionsRaw, isLoading: txLoading } = useTransactions(
    household?.id,
    yearBounds,
  )
  const yearTransactions = useMemo(
    () =>
      (yearTransactionsRaw ?? []).filter(
        (tx) =>
          scopedAccountIds.has(tx.accountId) ||
          (tx.counterAccountId && scopedAccountIds.has(tx.counterAccountId)),
      ),
    [yearTransactionsRaw, scopedAccountIds],
  )

  const baseCurrency = household?.baseCurrency ?? 'UYU'

  // Un bucket por mes — cantidad de movimientos y neto en moneda base,
  // mismo criterio que el resumen de período de `TransactionsListContent`:
  // las transferencias no suman ni restan (no son gasto ni ingreso), y un
  // movimiento sin cotización resuelta se EXCLUYE del neto (nunca se suma
  // como si valiera cero) pero sí cuenta para el conteo del mes.
  const { months, excludedCount } = useMemo(() => {
    const byMonth = new Map<
      number,
      { count: number; net: ReturnType<typeof money> }
    >()
    for (let m = 1; m <= 12; m++) byMonth.set(m, { count: 0, net: zero(baseCurrency) })
    let excluded = 0
    for (const tx of yearTransactions) {
      if (tx.deletedAt !== null) continue
      const monthKey = monthOfDay(dayKeyOf(tx.occurredAt))
      const monthIndex = Number(monthKey.slice(5, 7))
      const bucket = byMonth.get(monthIndex)
      if (!bucket) continue
      bucket.count += 1
      if (tx.kind === 'transfer') continue
      if (tx.amountBase === null) {
        excluded += 1
        continue
      }
      const amt = money(tx.amountBase, baseCurrency)
      if (tx.kind === 'income') bucket.net = add(bucket.net, amt)
      else if (tx.kind === 'expense') bucket.net = subtract(bucket.net, amt)
    }
    return { months: byMonth, excludedCount: excluded }
  }, [yearTransactions, baseCurrency])

  const openMonth = (monthIndex: number) => {
    const range = monthRange(
      `${year}-${String(monthIndex).padStart(2, '0')}`,
    )
    router.push(`/transactions?from=${range.from}&to=${range.to}`)
  }

  if (!household || yearsLoading) {
    return <Skeleton height={260} style={{ marginTop: 16 }} />
  }

  if (!yearRange) {
    return (
      <EmptyState
        message={t('transactions.history.empty')}
        actionLabel={t('transactions.history.back')}
        onAction={() => router.push('/transactions')}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4 pt-4 pb-8">
      <button
        type="button"
        onClick={() => setYearSheetOpen(true)}
        className="rounded-card border-0 bg-surface-2 p-3.5 text-left cursor-pointer"
      >
        <div className="t-caption text-text-muted">
          {t('transactions.history.year')}
        </div>
        <div className="mt-0.5 text-[15px] text-text-primary">{year}</div>
      </button>

      {excludedCount > 0 ? (
        <NeedsFxBanner
          count={excludedCount}
          onResolve={() => router.push('/accounts/resolve-fx')}
        />
      ) : null}

      <div className="flex flex-col">
        {!txLoading
          ? Array.from({ length: 12 }, (_, i) => i + 1).map((monthIndex) => {
              const bucket = months.get(monthIndex)!
              const hasData = bucket.count > 0
              return (
                <ListRow
                  key={monthIndex}
                  icon="calendar"
                  label={monthName(locale, monthIndex)}
                  meta={t('transactions.list.dayCount', { count: bucket.count })}
                  variant="value"
                  disabled={!hasData}
                  onClick={hasData ? () => openMonth(monthIndex) : undefined}
                  value={
                    hasData ? (
                      <Amount
                        value={bucket.net}
                        size="body"
                        polarity={bucket.net.amount >= 0n ? 'positive' : 'negative'}
                        tabular
                      />
                    ) : undefined
                  }
                />
              )
            })
          : Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} height={56} style={{ marginBottom: 4 }} />
            ))}
      </div>

      <Sheet
        open={yearSheetOpen}
        title={t('transactions.history.chooseYear')}
        onClose={() => setYearSheetOpen(false)}
      >
        <div className="flex flex-col">
          {years.map((y) => (
            <ListRow
              key={y}
              label={String(y)}
              onClick={() => {
                setSelectedYear(y)
                setYearSheetOpen(false)
              }}
            />
          ))}
        </div>
      </Sheet>
    </div>
  )
}
