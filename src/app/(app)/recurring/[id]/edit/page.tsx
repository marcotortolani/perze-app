'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { motion } from 'motion/react'
import { useLocale, useTranslations } from 'next-intl'
import {
  Amount,
  Button,
  EmptyState,
  Input,
  Keypad,
  KeypadKey,
  ListRow,
  SegmentedControl,
  Sheet,
  Skeleton,
  Switch,
  usePageHeader,
  ZMark,
} from '@/design-system'
import { useCurrentHousehold } from '@/hooks/use-current-household'
import { useAccounts } from '@/hooks/use-accounts'
import { useCategories } from '@/hooks/use-categories'
import { useCategoryLabel } from '@/hooks/use-category-label'
import {
  useInvalidateRecurringRules,
  useRecurringRules,
} from '@/hooks/use-recurring-rules'
import { recurringRulesRepo } from '@/lib/repos/recurring-rules-repo'
import { evaluateKeypadExpression, firstOperand, hasKeypadOperator } from '@/lib/money/keypad'
import { money } from '@/lib/money/money'
import { numberLocaleForUiLocale, type Locale } from '@/i18n/formatting'
import { todayIso } from '@/lib/repos/ids'
import type { RecurringFrequency } from '@/lib/db/schema'
import { amountToExpression } from '@/features/capture/AmountStep'

const FREQUENCIES: RecurringFrequency[] = [
  'weekly',
  'biweekly',
  'monthly',
  'yearly',
]

const EQUALS_TRANSITION = { duration: 0.24, ease: [0.24, 1.05, 0.32, 1] as const }

function monthName(locale: Locale, month1: number): string {
  return new Intl.DateTimeFormat(locale, { month: 'long' }).format(
    new Date(2026, month1 - 1, 1),
  )
}

/**
 * Edición de una regla recurrente existente — separado del detalle (G2,
 * `[id]/page.tsx`) igual que crear (G3, `new/page.tsx`) está separado de
 * la lista. Cambiar la frecuencia o el día reancla la regla a HOY (nunca
 * hacia atrás): las ocurrencias ya materializadas no se tocan, y las
 * futuras arrancan de la nueva configuración desde el próximo vencimiento.
 */
export default function EditRecurringRulePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const t = useTranslations()
  const locale = useLocale() as Locale
  const numberLocale = numberLocaleForUiLocale(locale)
  const router = useRouter()
  const categoryLabel = useCategoryLabel()
  const { data: household } = useCurrentHousehold()
  const { data: rules } = useRecurringRules(household?.id)
  const { data: accounts = [] } = useAccounts(household?.id)
  const { data: categories = [] } = useCategories(household?.id)
  const invalidateRules = useInvalidateRecurringRules(household?.id)

  const [name, setName] = useState<string | null>(null)
  const [frequencyOverride, setFrequencyOverride] =
    useState<RecurringFrequency | null>(null)
  const [dayOfMonth, setDayOfMonth] = useState<string | null>(null)
  const [yearlyMonthOverride, setYearlyMonthOverride] = useState<number | null>(
    null,
  )
  const [expr, setExpr] = useState<string | null>(null)
  const [accountIdOverride, setAccountIdOverride] = useState<string | null>(
    null,
  )
  const [categoryIdOverride, setCategoryIdOverride] = useState<
    string | null | undefined
  >(undefined)
  const [autoPostOverride, setAutoPostOverride] = useState<boolean | null>(null)
  const [sheet, setSheet] = useState<
    'none' | 'account' | 'category' | 'amount' | 'month'
  >('none')
  const [saving, setSaving] = useState(false)
  const rule = rules?.find((r) => r.id === id)
  usePageHeader({
    ...(rule ? { title: rule.name } : {}),
    onBack: () => router.back(),
    backLabel: t('ds.appHeader.back'),
  })

  // Con `cacheComponents: true` (Next 16), `router.back()` no desmonta esta
  // pantalla — la deja oculta (`Activity`, modo hidden) con su `useState`
  // intacto. Los efectos SÍ se limpian al ocultarse y se re-disparan al
  // volver a mostrarla, así que la cleanup de un efecto vacío es el único
  // gancho confiable para "se abandonó esta pantalla sin guardar": ahí se
  // resetean los borradores, para que la próxima entrada a esta misma ruta
  // no herede un monto/nombre/frecuencia sin confirmar.
  useEffect(() => {
    return () => {
      setName(null)
      setFrequencyOverride(null)
      setDayOfMonth(null)
      setYearlyMonthOverride(null)
      setExpr(null)
      setAccountIdOverride(null)
      setCategoryIdOverride(undefined)
      setAutoPostOverride(null)
      setSheet('none')
    }
  }, [])

  if (!household || !rules)
    return <Skeleton height={260} style={{ marginTop: 16 }} />
  if (!rule)
    return (
      <EmptyState
        message={t('recurringPage.notFound')}
        actionLabel={t('recurringPage.back')}
        onAction={() => router.push('/recurring')}
      />
    )

  const frequency = frequencyOverride ?? rule.frequency
  const isDayBased = frequency === 'monthly' || frequency === 'yearly'
  const displayName = name ?? rule.name
  const displayDay = dayOfMonth ?? String(rule.dayOfMonth ?? 1)
  const accountId = accountIdOverride ?? rule.accountId
  const categoryId =
    categoryIdOverride === undefined ? rule.categoryId : categoryIdOverride
  const autoPost = autoPostOverride ?? rule.autoPost
  const account = accounts.find((a) => a.id === accountId)
  const category = categoryId
    ? categories.find((c) => c.id === categoryId)
    : undefined
  const day = Math.min(31, Math.max(1, Number(displayDay) || 1))
  const yearlyMonth =
    yearlyMonthOverride ?? Number(rule.anchorDate.split('-')[1])

  // `pending`: hay un operador tipeado ("20+20") — mismo criterio que
  // `AmountStep.tsx`. Mientras está pendiente, el héroe se congela en el
  // primer operando (no en el resultado a medio armar) hasta que se toca
  // "=" — ahí `amount-step` también lo hace así.
  const pending = expr !== null && hasKeypadOperator(expr)
  // Igual que `PayCardSheet`/`reconcile`: el teclado siempre arranca vacío
  // y muestra "0" hasta que el usuario tipea — nunca precarga el monto
  // guardado como si fuera texto editable (eso mostraba el bigint crudo
  // sin punto ni coma, "USD 150000" en vez de "USD 1.500,00"). El monto
  // vigente se ve arriba, ya formateado por `<Amount>`, hasta que se
  // confirma uno nuevo.
  const currentAmount = (() => {
    if (expr === null || expr === '') return rule.expectedAmount
    try {
      return pending
        ? firstOperand(expr, rule.currencyCode, numberLocale).amount
        : evaluateKeypadExpression(expr, rule.currencyCode, numberLocale).amount
    } catch {
      return rule.expectedAmount
    }
  })()

  const handleSave = async () => {
    if (!displayName.trim() || saving || !account) return
    setSaving(true)
    try {
      const amount = expr
        ? evaluateKeypadExpression(expr, account.currencyCode, numberLocale)
            .amount
        : rule.expectedAmount

      // La frecuencia o el día cambiaron: el ancla vieja ya no describe la
      // regla, se reancla a hoy. Nunca hacia atrás — las ocurrencias
      // pasadas quedan intactas, esto solo cambia de dónde arrancan las
      // futuras.
      const frequencyChanged = frequency !== rule.frequency
      const dayChanged = isDayBased && day !== rule.dayOfMonth
      const monthChanged =
        frequency === 'yearly' &&
        yearlyMonth !== Number(rule.anchorDate.split('-')[1])
      let anchorDate = rule.anchorDate
      if (frequencyChanged || dayChanged || monthChanged) {
        const [ty, tm] = todayIso().split('-')
        const anchorMonth =
          frequency === 'yearly' ? String(yearlyMonth).padStart(2, '0') : tm
        anchorDate = isDayBased
          ? `${ty}-${anchorMonth}-${String(day).padStart(2, '0')}`
          : todayIso()
      }

      await recurringRulesRepo.update(rule.id, {
        name: displayName.trim(),
        frequency,
        anchorDate,
        dayOfMonth: isDayBased ? day : null,
        accountId,
        categoryId: categoryId ?? null,
        expectedAmount: amount,
        autoPost,
      })
      invalidateRules()
      toast(t('recurringPage.updated'))
      // `replace`, no `push`: esta pantalla ya está en el historial arriba
      // del detalle original (venimos de tocar "Editar" ahí). Un `push`
      // acá agrega una entrada más — el historial queda [lista, detalle,
      // editar, detalle] y "volver" desde el detalle post-guardado cae en
      // "editar" en vez de en la lista. `replace` reemplaza la entrada de
      // "editar" por la del detalle, así que "volver" salta directo al
      // detalle original y de ahí a la lista, como corresponde.
      router.replace(`/recurring/${rule.id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    // `lg`+: dos columnas, mismo criterio que `new/page.tsx` — el ancho del
    // shell es único en toda la app, sin este grid el form se estira a 1200px.
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      <div className="flex flex-1 flex-col gap-4 pt-4">
        <button
          type="button"
          onClick={() => setSheet('amount')}
          className="bg-transparent border-0 cursor-pointer text-center"
        >
          <Amount
            value={money(currentAmount, rule.currencyCode)}
            size="hero"
            fit
            showSign={false}
            polarity="neutral"
            tabular
          />
        </button>
        <p className="t-caption text-center text-text-muted">
          {t('recurringPage.amountEditsFutureOnly')}
        </p>

        <Input
          label={t('recurringPage.name')}
          value={displayName}
          onChange={(e) => setName(e.target.value)}
        />

        {/* `2xl`+: la columna izquierda del grid `lg:grid-cols-2` tiene hueco
            de sobra para que frecuencia y día (o día+mes en anual) queden
            lado a lado en vez de apilados — `items-end` para que el
            control de frecuencia y el/los input(s) del otro lado compartan
            el mismo borde inferior sin importar que el label de arriba de
            cada uno mida distinto. Mes+día van en fila SIEMPRE (hasta en
            mobile): son dos campos angostos, apilarlos no aporta nada. */}
        <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-end">
          <div className="xl:flex-1">
            <div className="t-caption mb-2 text-text-muted">
              {t('recurringPage.frequencyLabel')}
            </div>
            <SegmentedControl
              options={FREQUENCIES.map((f) => ({
                id: f,
                label: t(`recurringPage.frequency.${f}`),
              }))}
              value={frequency}
              onChange={(f) => setFrequencyOverride(f as RecurringFrequency)}
            />
          </div>
          {isDayBased ? (
            <div className="flex flex-row gap-4 xl:flex-1">
              {/* Mismo look que `Input` (label afuera, campo de 48px con
                  `--surface-3`/`--border`/`--radius-input`) en vez del
                  patrón de tarjeta de Cuenta/Categoría — al lado de "Día"
                  (un `Input` real) se ven como el mismo tipo de campo. Los
                  nombres de mes ("septiembre") pesan bastante más que el
                  día (1-2 dígitos), de ahí que el día quede angosto. */}
              {frequency === 'yearly' ? (
                <button
                  type="button"
                  onClick={() => setSheet('month')}
                  className="block w-full min-w-34 text-left cursor-pointer bg-transparent border-0 p-0"
                >
                  <span className="mb-2 block font-sans text-[13px] font-medium text-text-secondary">
                    {t('recurringPage.month')}
                  </span>
                  <div className="flex min-h-[48px] w-full items-center rounded-[var(--radius-input)] border border-border bg-surface-3 px-[14px] font-sans text-[16px] leading-[24px] text-text-primary">
                    {monthName(locale, yearlyMonth)}
                  </div>
                </button>
              ) : null}
              <Input
                label={t('recurringPage.dayOfMonthLabel')}
                placeholder="1-31"
                value={displayDay}
                onChange={(e) =>
                  setDayOfMonth(e.target.value.replace(/\D/g, ''))
                }
                style={{ flex: frequency === 'yearly' ? 0 : 1 }}
              />
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setSheet('account')}
          className="rounded-card border-0 bg-surface-2 p-3.5 text-left cursor-pointer"
        >
          <div className="t-caption text-text-muted">
            {t('goalsPage.account')}
          </div>
          <div className="mt-0.5 text-[15px] text-text-primary">
            {account
              ? `${account.name} · ${account.currencyCode}`
              : t('goalsPage.chooseAccount')}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSheet('category')}
          className="rounded-card border-0 bg-surface-2 p-3.5 text-left cursor-pointer"
        >
          <div className="t-caption text-text-muted">
            {t('budgetsPage.category')}
          </div>
          <div className="mt-0.5 text-[15px] text-text-primary">
            {category ? categoryLabel(category) : t('recurringPage.noCategory')}
          </div>
        </button>

        <div className="flex items-center gap-4 px-1 py-3">
          <div className="flex-1">
            <div className="text-[15px] text-text-primary">
              {t('recurringPage.autoPost')}
            </div>
            <div className="text-[13px] text-text-secondary">
              {t('recurringPage.autoPostHint')}
            </div>
          </div>
          <Switch
            checked={autoPost}
            onChange={setAutoPostOverride}
            id={`edit-recurring-${rule.id}-autopost`}
          />
        </div>

        <div className="mt-auto pb-6">
          <Button disabled={!displayName.trim() || saving} onClick={handleSave}>
            {t('common.save')}
          </Button>
        </div>
      </div>

      <div className="hidden items-center justify-center lg:flex">
        <ZMark
          variant="flip"
          animated
          size={28}
          gap={8}
          aria-label={t('app.name')}
        />
      </div>

      <Sheet
        open={sheet === 'amount'}
        title={t('recurringPage.amountEditsFutureOnly')}
        onClose={() => setSheet('none')}
        // `--content-max-width` (560px) — mismo techo que `ScreenShell` usa
        // para capar `/add`. Va en el `Sheet` entero (el panel, no solo su
        // contenido): `Overlay` deja el panel en 90% del ancho en desktop
        // por default, y capar solo el contenido de adentro dejaba el
        // panel oscuro de fondo igual de ancho, con el teclado angosto
        // flotando sin centrar de verdad dentro de él.
        style={{ maxWidth: 'var(--content-max-width)' }}
      >
        <div className="flex w-full flex-col gap-4">
          <div className="text-center font-mono text-[28px]">
            {rule.currencyCode} {expr || '0'}
          </div>
          <Keypad
            onKey={(k) =>
              setExpr((s) =>
                k === 'clear'
                  ? ''
                  : k === 'backspace'
                    ? (s ?? '').slice(0, -1)
                    : (s ?? '') + k,
              )
            }
            onClear={() => setExpr('')}
          />
          {/* "=" + "Guardar" comparten fila, igual que `AmountStep.tsx` en
              `/add`: 1:3 en reposo, 2:2 mientras hay un operador pendiente. */}
          <div className="flex gap-2">
            <motion.div
              animate={{ flex: pending ? 2 : 1 }}
              transition={EQUALS_TRANSITION}
              style={{ minWidth: 0 }}
            >
              <KeypadKey
                label="="
                ariaLabel={t('ds.keypad.equals')}
                fullWidth
                height="var(--primary-button-height)"
                onPress={() => {
                  if (!pending || !expr) return
                  try {
                    const resolved = evaluateKeypadExpression(
                      expr,
                      rule.currencyCode,
                      numberLocale,
                    )
                    setExpr(
                      amountToExpression(resolved.amount, rule.currencyCode, locale),
                    )
                  } catch {
                    // Expresión sin resolver todavía (p. ej. "20+") — no hay nada que aplanar.
                  }
                }}
              />
            </motion.div>
            <motion.div
              animate={{ flex: pending ? 2 : 3 }}
              transition={EQUALS_TRANSITION}
              style={{ minWidth: 0 }}
            >
              <Button onClick={() => setSheet('none')}>{t('common.save')}</Button>
            </motion.div>
          </div>
        </div>
      </Sheet>
      <Sheet
        open={sheet === 'account'}
        title={t('goalsPage.chooseAccount')}
        onClose={() => setSheet('none')}
      >
        <div className="flex flex-col">
          {accounts.map((a) => (
            <ListRow
              key={a.id}
              label={a.name}
              meta={a.currencyCode}
              onClick={() => {
                setAccountIdOverride(a.id)
                setSheet('none')
              }}
            />
          ))}
        </div>
      </Sheet>
      <Sheet
        open={sheet === 'category'}
        title={t('budgetsPage.category')}
        onClose={() => setSheet('none')}
      >
        <div className="flex flex-col">
          {categories
            .filter((c) => c.kind === rule.kind)
            .map((c) => (
              <ListRow
                key={c.id}
                label={categoryLabel(c)}
                onClick={() => {
                  setCategoryIdOverride(c.id)
                  setSheet('none')
                }}
              />
            ))}
        </div>
      </Sheet>
      <Sheet
        open={sheet === 'month'}
        title={t('recurringPage.month')}
        onClose={() => setSheet('none')}
      >
        <div className="flex flex-col">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <ListRow
              key={m}
              label={monthName(locale, m)}
              onClick={() => {
                setYearlyMonthOverride(m)
                setSheet('none')
              }}
            />
          ))}
        </div>
      </Sheet>
    </div>
  )
}
