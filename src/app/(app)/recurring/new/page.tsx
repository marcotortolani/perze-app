"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import {
  Button,
  Input,
  Keypad,
  KeypadKey,
  ListRow,
  SegmentedControl,
  Sheet,
  Switch,
  usePageHeader,
  ZMark,
} from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useInvalidateRecurringRules } from "@/hooks/use-recurring-rules";
import { useTransaction } from "@/hooks/use-transactions";
import { recurringRulesRepo } from "@/lib/repos/recurring-rules-repo";
import { transactionsRepo } from "@/lib/repos/transactions-repo";
import {
  evaluateKeypadExpression,
  hasKeypadOperator,
} from "@/lib/money/keypad";
import { numberLocaleForUiLocale, type Locale } from "@/i18n/formatting";
import type { RecurringFrequency } from "@/lib/db/schema";
import { todayIso } from "@/lib/repos/ids";
import { amountToExpression } from "@/features/capture/AmountStep";

const FREQUENCIES: RecurringFrequency[] = [
  "weekly",
  "biweekly",
  "monthly",
  "yearly",
];
const EQUALS_TRANSITION = {
  duration: 0.24,
  ease: [0.24, 1.05, 0.32, 1] as const,
};

function monthName(locale: Locale, month1: number): string {
  return new Intl.DateTimeFormat(locale, { month: "long" }).format(
    new Date(2026, month1 - 1, 1),
  );
}

/** G3 — nueva regla recurrente: nombre, cuenta, frecuencia, monto esperado, auto-registro. */
export default function NewRecurringRulePage() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const numberLocale = numberLocaleForUiLocale(locale);
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromTransactionId = searchParams.get("fromTransaction") ?? undefined;
  const categoryLabel = useCategoryLabel();
  const { data: household } = useCurrentHousehold();
  const userId = useEffectiveUserId();
  const { data: accounts = [] } = useAccounts(household?.id);
  const { data: categories = [] } = useCategories(household?.id);
  const { data: origin } = useTransaction(fromTransactionId);
  const invalidateRules = useInvalidateRecurringRules(household?.id);

  const [name, setName] = useState("");
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<RecurringFrequency>("monthly");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [yearlyMonth, setYearlyMonth] = useState(() =>
    Number(todayIso().split("-")[1]),
  );
  const [expr, setExpr] = useState("");
  const [autoPost, setAutoPost] = useState(true);
  const [sheet, setSheet] = useState<"none" | "account" | "category" | "month">(
    "none",
  );
  const [saving, setSaving] = useState(false);
  const [prefilledFromOrigin, setPrefilledFromOrigin] = useState(false);
  usePageHeader({
    title: t("recurringPage.newRule"),
    onBack: () => router.back(),
    backLabel: t("ds.appHeader.back"),
  });

  // Con `cacheComponents: true` (Next 16), `router.back()` no desmonta esta
  // pantalla — la deja oculta (`Activity`, modo hidden) con su `useState`
  // intacto. Los efectos SÍ se limpian al ocultarse y se re-disparan al
  // volver a mostrarla, así que la cleanup de un efecto vacío es el único
  // gancho confiable para "se abandonó este formulario sin guardar": ahí se
  // resetea el borrador entero, para que la próxima entrada a `/recurring/new`
  // arranque vacía en vez de heredar lo que se había tipeado.
  useEffect(() => {
    return () => {
      setName("");
      setKind("expense");
      setAccountId(null);
      setCategoryId(null);
      setFrequency("monthly");
      setDayOfMonth("1");
      setExpr("");
      setAutoPost(true);
      setSheet("none");
      setPrefilledFromOrigin(false);
    };
  }, []);

  // "Desde un movimiento" (G3): comercio, monto, cuenta, categoría y kind
  // ya cargados — solo hay que confirmar. Una sola vez, con `prefilledFromOrigin`,
  // para no pisar lo que el usuario ya haya tocado a mano.
  if (origin && !prefilledFromOrigin) {
    setPrefilledFromOrigin(true);
    setKind(origin.kind === "income" ? "income" : "expense");
    setAccountId(origin.accountId);
    setCategoryId(origin.categoryId);
    setExpr(String(Math.abs(Number(origin.amount))));
  }

  if (!household || !userId) return null;

  const account = accounts.find((a) => a.id === accountId);
  const category = categories.find((c) => c.id === categoryId);
  const day = Math.min(31, Math.max(1, Number(dayOfMonth) || 1));
  const isDayBased = frequency === "monthly" || frequency === "yearly";
  const canSave = name.trim() !== "" && expr.trim() !== "" && !!accountId;
  // Igual que `AmountStep.tsx` en `/add`: `pending` marca un operador
  // tipeado ("20+20"), la tecla "=" lo aplana a un número plano.
  const pending = hasKeypadOperator(expr);

  const handleSave = async () => {
    if (!canSave || saving || !account) return;
    setSaving(true);
    try {
      const amount = evaluateKeypadExpression(
        expr,
        account.currencyCode,
        numberLocale,
      );
      const anchorSource = origin?.occurredAt.slice(0, 10) ?? todayIso();
      const [ay, am] = anchorSource.split("-");
      // Anual: el mes lo elige el usuario (una sola vez al año, no
      // necesariamente el mes de hoy); mensual sigue anclado al mes de
      // creación/origen.
      const anchorMonth =
        frequency === "yearly" ? String(yearlyMonth).padStart(2, "0") : am;
      const anchorDate = isDayBased
        ? `${ay}-${anchorMonth}-${String(day).padStart(2, "0")}`
        : anchorSource;

      const rule = await recurringRulesRepo.create({
        householdId: household.id,
        name: name.trim(),
        kind,
        categoryId,
        accountId: accountId!,
        expectedAmount: amount.amount,
        currencyCode: account.currencyCode,
        frequency,
        anchorDate,
        dayOfMonth: isDayBased ? day : null,
        autoPost,
        endDate: null,
        createdBy: userId,
      });

      // El origen ya es la primera ocurrencia real — se vincula a la
      // regla en vez de dejar que el motor cree una duplicada el mismo
      // día. También le da al historial de montos (G2) su primer punto.
      if (origin && origin.recurringId === null) {
        await transactionsRepo.update(origin.id, { recurringId: rule.id });
      }

      invalidateRules();
      toast(t("recurringPage.created"));
      // `back()`, no `replace`/`push` — mismo motivo que en `[id]/edit`:
      // la lista ya está en el historial justo debajo, y `replace` a esa
      // MISMA url duplicaba la entrada en vez de evitarla.
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col">
      {/* `lg`+: el formulario queda a la izquierda tal cual estaba — la
          columna del grid ya da un ancho parecido a `--content-max-width` —
          y la derecha pasa a llevar el `ZMark` en vez de quedar vacía.
          Sin `h-full`/`min-h-0` a propósito: la página entera scrollea
          como cualquier otra de `(app)/` (el scroller es `<main>`, no una
          región interna) — nada queda pinneado ni recortado. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="mx-auto flex w-full max-w-[var(--content-max-width)] flex-col gap-4 pt-4">
          <SegmentedControl
            options={[
              { id: "expense", label: t("capture.kind.expense") },
              { id: "income", label: t("capture.kind.income") },
            ]}
            value={kind}
            onChange={(id) => setKind(id as "expense" | "income")}
          />
          <Input
            label={t("recurringPage.name")}
            placeholder={t("recurringPage.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          {/* `xl`+: la columna izquierda del grid `lg:grid-cols-2` tiene
              hueco de sobra para que frecuencia y día (o día+mes en anual)
              queden lado a lado en vez de apilados — `items-end` para que
              el control de frecuencia y el/los input(s) del otro lado
              compartan el mismo borde inferior sin importar que el label
              de arriba de cada uno mida distinto. Mes+día van en fila
              SIEMPRE (hasta en mobile): son dos campos angostos, apilarlos
              no aporta nada y hace la pantalla más larga de lo necesario. */}
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
            <div className="xl:flex-1">
              <div className="t-caption mb-2 text-text-muted">
                {t("recurringPage.frequencyLabel")}
              </div>
              <SegmentedControl
                options={FREQUENCIES.map((f) => ({
                  id: f,
                  label: t(`recurringPage.frequency.${f}`),
                }))}
                value={frequency}
                onChange={(id) => setFrequency(id as RecurringFrequency)}
              />
            </div>
            {isDayBased ? (
              <div className="flex flex-row gap-4 xl:flex-1">
                {/* Los nombres de mes ("septiembre") pesan bastante más
                    que el día (1-2 dígitos) — 3:2 en vez de 1:1. Mismo look
                    que `Input` (label afuera, campo de 48px con
                    `--surface-3`/`--border`/`--radius-input`) en vez del
                    patrón de tarjeta de Cuenta/Categoría — al lado de "Día"
                    (un `Input` real) se ven como el mismo tipo de campo. */}
                {frequency === "yearly" ? (
                  <button
                    type="button"
                    onClick={() => setSheet("month")}
                    className="block min-w-0 flex-[3] cursor-pointer border-0 bg-transparent p-0 text-left"
                  >
                    <span className="mb-2 block font-sans text-[13px] font-medium text-text-secondary">
                      {t("recurringPage.month")}
                    </span>
                    <div className="flex min-h-[48px] items-center rounded-[var(--radius-input)] border border-border bg-surface-3 px-[14px] font-sans text-[16px] leading-[24px] text-text-primary">
                      {monthName(locale, yearlyMonth)}
                    </div>
                  </button>
                ) : null}
                <Input
                  label={t("recurringPage.dayOfMonthLabel")}
                  placeholder="1-31"
                  value={dayOfMonth}
                  onChange={(e) =>
                    setDayOfMonth(e.target.value.replace(/\D/g, ""))
                  }
                  style={{ flex: frequency === "yearly" ? 2 : 1 }}
                />
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setSheet("account")}
            className="rounded-card border-0 bg-surface-2 p-3.5 text-left cursor-pointer"
          >
            <div className="t-caption text-text-muted">
              {t("goalsPage.account")}
            </div>
            <div className="mt-0.5 text-[15px] text-text-primary">
              {account
                ? `${account.name} · ${account.currencyCode}`
                : t("goalsPage.chooseAccount")}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSheet("category")}
            className="rounded-card border-0 bg-surface-2 p-3.5 text-left cursor-pointer"
          >
            <div className="t-caption text-text-muted">
              {t("budgetsPage.category")}
            </div>
            <div className="mt-0.5 text-[15px] text-text-primary">
              {category
                ? categoryLabel(category)
                : t("recurringPage.noCategory")}
            </div>
          </button>

          <div className="flex items-center gap-4 px-1 py-3">
            <div className="flex-1">
              <div className="text-[15px] text-text-primary">
                {t("recurringPage.autoPost")}
              </div>
              <div className="text-[13px] text-text-secondary">
                {t("recurringPage.autoPostHint")}
              </div>
            </div>
            <Switch
              checked={autoPost}
              onChange={setAutoPost}
              id="new-recurring-autopost"
            />
          </div>

          <div className="text-center font-mono text-[32px]">
            {account?.currencyCode ?? household.baseCurrency} {expr || "0"}
          </div>

          <div className="flex flex-col gap-2">
            <Keypad
              onKey={(k) =>
                setExpr((s) =>
                  k === "clear"
                    ? ""
                    : k === "backspace"
                      ? s.slice(0, -1)
                      : s + k,
                )
              }
              onClear={() => setExpr("")}
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
                  ariaLabel={t("ds.keypad.equals")}
                  fullWidth
                  height="var(--primary-button-height)"
                  onPress={() => {
                    if (!pending || !expr.trim()) return;
                    try {
                      const resolved = evaluateKeypadExpression(
                        expr,
                        account?.currencyCode ?? household.baseCurrency,
                        numberLocale,
                      );
                      setExpr(
                        amountToExpression(
                          resolved.amount,
                          account?.currencyCode ?? household.baseCurrency,
                          locale,
                        ),
                      );
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
                <Button disabled={!canSave || saving} onClick={handleSave}>
                  {t("common.save")}
                </Button>
              </motion.div>
            </div>
          </div>
        </div>

        <div className="hidden items-center justify-center lg:flex">
          <ZMark
            variant="flip"
            animated
            size={28}
            gap={8}
            aria-label={t("app.name")}
          />
        </div>
      </div>

      <Sheet
        open={sheet === "account"}
        title={t("goalsPage.chooseAccount")}
        onClose={() => setSheet("none")}
      >
        <div className="flex flex-col">
          {accounts.map((a) => (
            <ListRow
              key={a.id}
              label={a.name}
              meta={a.currencyCode}
              onClick={() => {
                setAccountId(a.id);
                setSheet("none");
              }}
            />
          ))}
        </div>
      </Sheet>
      <Sheet
        open={sheet === "category"}
        title={t("budgetsPage.category")}
        onClose={() => setSheet("none")}
      >
        <div className="flex flex-col">
          {categories
            .filter((c) => c.kind === kind)
            .map((c) => (
              <ListRow
                key={c.id}
                label={categoryLabel(c)}
                onClick={() => {
                  setCategoryId(c.id);
                  setSheet("none");
                }}
              />
            ))}
        </div>
      </Sheet>
      <Sheet
        open={sheet === "month"}
        title={t("recurringPage.month")}
        onClose={() => setSheet("none")}
      >
        <div className="flex flex-col">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <ListRow
              key={m}
              label={monthName(locale, m)}
              onClick={() => {
                setYearlyMonth(m);
                setSheet("none");
              }}
            />
          ))}
        </div>
      </Sheet>
    </div>
  );
}
