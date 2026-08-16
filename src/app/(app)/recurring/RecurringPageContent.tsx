"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Amount, Button, Chip, EmptyState, ErrorState, ListRow, NeedsFxBanner, SkeletonRow, StatTile, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { useAccounts } from "@/hooks/use-accounts";
import { useRecurringRules } from "@/hooks/use-recurring-rules";
import { useRecurringOccurrences, useTransactions } from "@/hooks/use-transactions";
import { usePayees } from "@/hooks/use-payees";
import { useQueryErrorState } from "@/hooks/use-query-error-state";
import { useRecurringSuggestionsStore } from "@/stores/recurring-suggestions-store";
import { computeMonthlyCommitted, computeUpcomingCharges } from "@/lib/analytics/recurring-schedule";
import { detectRecurringCandidates } from "@/lib/analytics/recurring-detection";
import { occurrencesBetween } from "@/lib/recurring/occurrences";
import { relativeDayLabel } from "@/lib/recurring/format-date-label";
import { formatAmountCompact } from "@/lib/money/format";
import { money } from "@/lib/money/money";
import { todayIso } from "@/lib/repos/ids";
import type { Locale } from "@/i18n/formatting";
import { RecurringMonthCalendar } from "./RecurringMonthCalendar";

/**
 * G1 — recurrentes: comprometido por mes, próximos vencimientos y qué
 * está pendiente de cargar. Separado de `page.tsx` — ver el comentario en
 * `budgets/BudgetsPageContent.tsx`.
 *
 * Antes esta pantalla decía "todavía no se cargó este mes" por regla, un
 * texto que no existe en ningún documento de diseño y que además usaba
 * mes calendario en vez del período del household. Se reemplaza por lo
 * que G1 pide: cuándo es el próximo cobro, y — la consecuencia de que
 * ahora el auto-registro es por regla (`recurringPage.autoPost`) — qué
 * reglas con auto-registro apagado están esperando que el usuario las
 * cargue a mano.
 */
export default function RecurringPageContent() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: household } = useCurrentHousehold();
  const userId = useEffectiveUserId();
  const rulesQuery = useRecurringRules(household?.id);
  const accountsQuery = useAccounts(household?.id);
  const { data: rules } = rulesQuery;
  const { data: accounts = [] } = accountsQuery;
  const { data: recurringOccurrences = [] } = useRecurringOccurrences(household?.id);
  const transactionsQuery = useTransactions(household?.id);
  const payeesQuery = usePayees(household?.id);
  const accountFilter = searchParams.get("accountId");
  const currencyFilter = searchParams.get("currency");

  const committedQuery = useQuery({
    queryKey: ["recurring-committed", household?.id, rules?.map((r) => `${r.id}:${r.expectedAmount}:${r.frequency}:${r.currencyCode}`).join(",")],
    queryFn: () => computeMonthlyCommitted(household!, rules!),
    enabled: !!household && !!rules,
  });

  // Subpágina de `/more`: header propio con "volver", registrado vía `usePageHeader`.
  usePageHeader({ title: t("morePage.recurring"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  // Auto-detección (docs/00-producto.md § "Goteo de suscripciones") —
  // agrupa el historial por comercio y sugiere crear una regla cuando el
  // patrón de fecha+monto ya se repitió 3 veces o más. Antes de la lista
  // de reglas EXISTENTES para no competir con ella en jerarquía, pero
  // hooks primero: tiene que calcularse acá arriba, no después del
  // `if (!household...)` de más abajo.
  const dismissedKeys = useRecurringSuggestionsStore((s) => s.dismissedKeys);
  const dismissSuggestion = useRecurringSuggestionsStore((s) => s.dismiss);
  const payeeNameById = useMemo(() => new Map((payeesQuery.data ?? []).map((p) => [p.id, p.name])), [payeesQuery.data]);
  const suggestions = useMemo(() => {
    if (!transactionsQuery.data || !rules) return [];
    return detectRecurringCandidates(transactionsQuery.data, payeeNameById, rules, todayIso()).filter((c) => !dismissedKeys.includes(c.key));
  }, [transactionsQuery.data, payeeNameById, rules, dismissedKeys]);

  const errorState = useQueryErrorState(rulesQuery.isError ? rulesQuery : accountsQuery, { what: t("recurringPage.loadError") });
  if (errorState) return <ErrorState {...errorState} />;

  if (!household || !rules || !userId) {
    return (
      <div className="flex flex-col gap-2 pt-4">
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }

  // Con sugerencias detectadas, no hay "todavía no cargaste ninguna
  // recurrente" que valga — hay una acción mejor que ofrecer que el
  // `EmptyState` genérico, así que se deja pasar al render completo (las
  // secciones Auto/Manual, vacías, caen solas al `emptyFiltered` de más
  // abajo).
  if (rules.length === 0 && suggestions.length === 0) {
    return <EmptyState message={t("recurringPage.empty")} actionLabel={t("recurringPage.emptyAction")} onAction={() => router.push("/recurring/new")} />;
  }

  const today = todayIso();

  // Períodos ya cargados por regla (`recurringOccurrences`, clave
  // `recurringOccurrenceDate` — no `occurredAt`, que en una carga manual
  // tardía es la fecha real de pago, no la del período). Alimenta la
  // fecha que se muestra en la sección "Manuales" Y el "Next: ..." de
  // arriba: el primer período sin saldar, vencido o futuro — con
  // auto-registro OFF la fecha de la regla es solo aviso/organización, el
  // usuario decide cuándo pagar (y puede adelantarse a la fecha programada).
  const chargedByRule = new Map<string, Set<string>>();
  for (const o of recurringOccurrences) {
    if (!chargedByRule.has(o.recurringId)) chargedByRule.set(o.recurringId, new Set());
    chargedByRule.get(o.recurringId)!.add(o.occurrenceDate);
  }
  const nextUnchargedDate = (rule: (typeof rules)[number]) =>
    occurrencesBetween(rule, rule.anchorDate, addYears(today, 2)).find((d) => !chargedByRule.get(rule.id)?.has(d)) ?? null;

  const upcoming = computeUpcomingCharges(rules, new Date(), 30, chargedByRule);
  const next = upcoming[0];
  const nextRule = next ? rules.find((r) => r.id === next.ruleId) : undefined;
  const nextAccount = nextRule ? accounts.find((a) => a.id === nextRule.accountId) : undefined;

  const accountsWithRules = accounts.filter((a) => rules.some((r) => r.accountId === a.id));
  const currenciesWithRules = [...new Set(rules.map((r) => r.currencyCode))].sort();
  const filteredRules = rules.filter((r) => (!accountFilter || r.accountId === accountFilter) && (!currencyFilter || r.currencyCode === currencyFilter));
  // La única forma de distinguir a simple vista qué se carga solo de qué
  // hay que cargar a mano — antes era una sola lista mezclada por fecha.
  const autoRules = filteredRules.filter((r) => r.autoPost);
  const manualRules = filteredRules.filter((r) => !r.autoPost);

  const setFilter = (key: "accountId" | "currency", value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`/recurring${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const relativeDayText = (dateOnly: string) => {
    const rel = relativeDayLabel(dateOnly, today, locale);
    return rel.kind === "today" ? t("recurringPage.relativeToday") : rel.kind === "tomorrow" ? t("recurringPage.relativeTomorrow") : rel.label;
  };

  return (
    <div className="grid grid-cols-1 gap-6 pt-2 pb-6 lg:grid-cols-2">
      <div className="flex flex-col gap-1">
        <StatTile
          label={t("recurringPage.committedPerMonth")}
          value={committedQuery.data ? formatAmountCompact(money(committedQuery.data.total, household.baseCurrency), { showSign: false }) : "—"}
          style={{ marginBottom: 4 }}
        />
        {committedQuery.data ? <NeedsFxBanner count={committedQuery.data.excludedCount} onResolve={() => router.push("/accounts/resolve-fx")} style={{ marginBottom: 8 }} /> : null}

        {next && nextRule ? (
          <p className="t-body mt-1 mb-3 text-text-secondary">
            {t("recurringPage.nextUp", {
              name: nextRule.name,
              when: relativeDayText(next.nextDate.toISOString().slice(0, 10)),
              amount: formatAmountCompact(money(nextRule.expectedAmount, nextRule.currencyCode), { showSign: false }),
              account: nextAccount?.name ?? "",
            })}
          </p>
        ) : null}

        <div className="lg:hidden">
          <ListRow icon="calendar" label={t("recurringPage.viewCalendar")} onClick={() => router.push("/recurring/calendar")} />
        </div>

        {/* Sugerencias detectadas — antes de los filtros/secciones de
            reglas YA creadas, porque son la acción proactiva de la
            pantalla ("¿creamos una regla?"), no parte de lo existente. */}
        {suggestions.length > 0 ? (
          <div className="mt-3 mb-1 flex flex-col gap-2">
            <div className="t-caption text-text-muted">{t("recurringPage.suggestionsSection")}</div>
            {suggestions.map((c) => (
              <div key={c.key} className="rounded-card bg-surface-2 flex flex-col gap-3 p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] text-text-primary">
                      {t("recurringPage.suggestionDetected", { name: c.payeeName, frequency: t(`recurringPage.frequency.${c.frequency}`).toLowerCase() })}
                    </div>
                    <div className="t-caption text-text-muted">{t("recurringPage.suggestionMatchCount", { count: c.matchCount })}</div>
                  </div>
                  <Amount
                    value={money(c.kind === "expense" ? -c.expectedAmount : c.expectedAmount, c.currencyCode)}
                    size="body"
                    polarity={c.kind === "income" ? "positive" : "negative"}
                    tabular
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => dismissSuggestion(c.key)} style={{ flex: 1 }}>
                    {t("recurringPage.suggestionDismiss")}
                  </Button>
                  <Button
                    onClick={() => {
                      // `fromTransaction` reusa el prefill que ya existe en
                      // `/recurring/new` (nombre no incluido ahí — lo suma
                      // `suggestedName`); `suggestedFrequency`/`suggestedDay`
                      // son nuevos, del patrón que ya detectamos acá.
                      const params = new URLSearchParams();
                      params.set("fromTransaction", c.lastTransactionId);
                      params.set("suggestedName", c.payeeName);
                      params.set("suggestedFrequency", c.frequency);
                      if (c.dayOfMonth !== null) params.set("suggestedDay", String(c.dayOfMonth));
                      router.push(`/recurring/new?${params.toString()}`);
                    }}
                    style={{ flex: 1 }}
                  >
                    {t("recurringPage.suggestionCreateRule")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {accountsWithRules.length > 1 ? (
          <div className="flex flex-wrap gap-2 py-2">
            <Chip selected={!accountFilter} onClick={() => setFilter("accountId", null)}>
              {t("recurringPage.filterAllAccounts")}
            </Chip>
            {accountsWithRules.map((a) => (
              <Chip key={a.id} selected={accountFilter === a.id} onClick={() => setFilter("accountId", a.id)}>
                {a.name}
              </Chip>
            ))}
          </div>
        ) : null}

        {currenciesWithRules.length > 1 ? (
          <div className="flex flex-wrap gap-2 pb-2">
            <Chip selected={!currencyFilter} onClick={() => setFilter("currency", null)}>
              {t("recurringPage.filterAllCurrencies")}
            </Chip>
            {currenciesWithRules.map((code) => (
              <Chip key={code} selected={currencyFilter === code} onClick={() => setFilter("currency", code)}>
                {code}
              </Chip>
            ))}
          </div>
        ) : null}

        {filteredRules.length === 0 ? <EmptyState message={t("recurringPage.emptyFiltered")} /> : null}

        {/* Dos secciones por `autoPost`, no una lista mezclada por fecha —
            es la única forma de saber a simple vista qué se carga solo de
            qué hay que cargar a mano. */}
        {autoRules.length > 0 ? (
          <>
            <div className="t-caption mt-3 mb-1 text-text-muted">{t("recurringPage.sectionAuto")}</div>
            {autoRules.map((rule) => {
              const account = accounts.find((a) => a.id === rule.accountId);
              const ruleUpcoming = upcoming.find((u) => u.ruleId === rule.id);
              return (
                <ListRow
                  key={rule.id}
                  label={rule.name}
                  meta={ruleUpcoming ? `${relativeDayText(ruleUpcoming.nextDate.toISOString().slice(0, 10))} · ${account?.name ?? ""}` : t(`recurringPage.frequency.${rule.frequency}`)}
                  variant="value"
                  onClick={() => router.push(`/recurring/${rule.id}`)}
                  value={
                    <Amount
                      value={money(rule.kind === "expense" ? -rule.expectedAmount : rule.expectedAmount, rule.currencyCode)}
                      size="body"
                      polarity={rule.kind === "income" ? "positive" : "negative"}
                      tabular
                    />
                  }
                />
              );
            })}
          </>
        ) : null}

        {manualRules.length > 0 ? (
          <>
            <div className="t-caption mt-4 mb-1 text-text-muted">{t("recurringPage.sectionManual")}</div>
            {manualRules.map((rule) => {
              const account = accounts.find((a) => a.id === rule.accountId);
              const nextDate = nextUnchargedDate(rule);
              return (
                <ListRow
                  key={rule.id}
                  label={rule.name}
                  meta={nextDate ? `${relativeDayText(nextDate)} · ${account?.name ?? ""}` : t(`recurringPage.frequency.${rule.frequency}`)}
                  variant="value"
                  onClick={() => router.push(`/recurring/${rule.id}`)}
                  value={
                    <Amount
                      value={money(rule.kind === "expense" ? -rule.expectedAmount : rule.expectedAmount, rule.currencyCode)}
                      size="body"
                      polarity={rule.kind === "income" ? "positive" : "negative"}
                      tabular
                    />
                  }
                />
              );
            })}
          </>
        ) : null}

        {/* `pb-6 lg:pb-0`: en mobile el FAB "+" de la TabBar queda pegado
            arriba del botón primario sin este aire extra — en desktop no
            hay TabBar, así que no hace falta. */}
        <div className="pb-6 lg:pb-0">
          <Button onClick={() => router.push("/recurring/new")} style={{ marginTop: 16 }}>
            {t("recurringPage.newRule")}
          </Button>
        </div>
      </div>

      <div className="hidden lg:block">
        <RecurringMonthCalendar />
      </div>
    </div>
  );
}

function addYears(iso: string, years: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y! + years}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
