"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { profilesRepo } from "@/lib/repos/profiles-repo";
import { ageFromBirthDate, isBirthdayToday } from "@/lib/analytics/age";
import { cashFlowNetBase, classifyCashFlow } from "@/lib/analytics/cash-flow";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import { useTags } from "@/hooks/use-tags";
import { useTransactionTagsFor } from "@/hooks/use-transaction-tags";
import { useTransactions, useRecurringOccurrences } from "@/hooks/use-transactions";
import { useRecurringRules } from "@/hooks/use-recurring-rules";
import { occurrencesBetween, isChargeDue } from "@/lib/recurring/occurrences";
import { todayIso } from "@/lib/dates/today";
import { useNetWorth } from "@/hooks/use-net-worth";
import { useInvestmentsTrend } from "@/hooks/use-investments-trend";
import { useNetWorthInCurrency } from "@/hooks/use-net-worth-in-currency";
import { useBudgetAlerts } from "@/hooks/use-budget-alerts";
import { useConflicts } from "@/hooks/use-conflicts";
import { usePendingMutations } from "@/lib/offline";
import { useQueryErrorState } from "@/hooks/use-query-error-state";
import type { ErrorStateProps } from "@/design-system/feedback/ErrorState";
import { useScopeStore } from "@/stores/scope-store";
import { useNetWorthCurrencyStore } from "@/stores/net-worth-currency-store";
import { accountMatchesScope } from "@/lib/scope/match-scope";
import { useIsCardPayment } from "@/hooks/use-card-payment";
import { useScrollOverflow } from "@/hooks/use-scroll-overflow";
import { useActiveReminder } from "@/lib/reminders/use-active-reminder";
import { useBirthdayBannerStore } from "@/stores/birthday-banner-store";
import { useDeleteTransactionWithUndo } from "@/features/movements/use-delete-transaction";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { add, compare, money, subtract, toMajorUnitsUnsafe, zero } from "@/lib/money/money";
import type { Money } from "@/lib/money/money";
import { ACCOUNT_KIND_MESSAGE_KEY } from "@/lib/reference/account-kind-labels";
import { compareAccountsForDisplay } from "@/lib/reference/account-order";
import type { AccountSummary } from "@/design-system/finance/AccountCarousel";
import type { AccountRow as AccountRowData, TransactionRow as TransactionRecord, CategoryRow, HouseholdRow } from "@/lib/db/schema";
import type { BudgetAlert } from "@/lib/analytics/budget-progress";
import type { BudgetRow } from "@/lib/db/schema";
import type { ReminderId } from "@/lib/reminders/definitions";

function startOfPeriod(now: Date, startDay: number): Date {
  const start = new Date(now.getFullYear(), now.getMonth(), startDay);
  if (now.getDate() < startDay) start.setMonth(start.getMonth() - 1);
  return start;
}

function dayBounds(now: Date, daysAgo: number): [Date, Date] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  return [start, end];
}

/** Mismo helper duplicado en `RecurringPageContent.tsx` y `recurring/[id]/page.tsx` — techo del horizonte de búsqueda de la próxima ocurrencia sin saldar. */
function addYears(iso: string, years: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y! + years}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Todo lo que un bloque del home puede necesitar, ya resuelto — el cuerpo
 * de cálculo que antes vivía inline en `HomePage()` (hooks de React Query,
 * los loops sobre transacciones, las derivaciones cruzadas entre bloques).
 * Deliberadamente NO incluye `privacy`, `router` ni `t`: esos son baratos
 * de leer donde hagan falta (store de Zustand, hook de Next, `next-intl`)
 * y cada bloque los pide directo — no hace falta que crucen por acá.
 */
export interface HomeDataReady {
  // Chrome de la página (banners, scroller) — lo consume `page.tsx`, no los bloques.
  scrollerRef: (el: HTMLDivElement | null) => void;
  overflowing: boolean;
  showBirthdayBanner: boolean;
  birthdayAge: number;
  dismissBirthdayBanner: (year: number) => void;
  now: Date;
  pending: number | undefined;
  conflicts: ReturnType<typeof useConflicts>["conflicts"];
  showReminderBanner: boolean;
  activeReminder: ReminderId | null;
  showRecurringDueBanner: boolean;
  dueManualRecurringCount: number;
  /** Solo cuando hay exactamente una regla vencida — a dónde navega el banner. `null` con 0 o ≥2 (ahí va a `/recurring`). */
  dueManualRecurringRuleId: string | null;

  // Datos de negocio — los consumen los bloques vía `useHomeData()`.
  household: HouseholdRow;
  baseCurrency: string;
  netWorth: ReturnType<typeof useNetWorth>;
  heroMoney: Money | null;
  heroFxPending: boolean;
  heroTrend: number[];
  last7Net: Money;
  prev7Net: Money;
  deltaPolarity: "positive" | "negative";
  deltaArrow: string;
  investmentsEnabled: boolean;
  investmentsTrend: ReturnType<typeof useInvestmentsTrend>;
  accountSummaries: AccountSummary[];
  creditCardAccounts: AccountRowData[];
  periodStart: string;
  expenseThisPeriod: Money;
  incomeThisPeriod: Money;
  wantsUsd: boolean;
  expenseThisPeriodUsd: ReturnType<typeof useNetWorthInCurrency>;
  incomeThisPeriodUsd: ReturnType<typeof useNetWorthInCurrency>;
  periodSurplus: Money;
  periodSurplusCmp: number;
  budgetAlerts: BudgetAlert<BudgetRow>[];
  categoryById: Map<string, CategoryRow>;
  accountById: Map<string, AccountRowData>;
  needsFxCount: number;
  topCategory: CategoryRow | undefined;
  recentTransactions: TransactionRecord[];
  tagNamesByTx: Map<string, string[]>;
  isCardPayment: (tx: TransactionRecord) => boolean;
  deleteTransaction: (id: string) => void;
}

type HomeDataState =
  | { status: "loading" }
  | { status: "error"; error: ErrorStateProps }
  | { status: "empty"; message: string; actionLabel?: string; onAction?: () => void }
  | { status: "ready"; data: HomeDataReady };

/**
 * Un solo hook con TODOS los datos y cálculos del home — antes vivía
 * inline en `HomePage()` (L124-332 de la versión pre-refactor). Se llama
 * una sola vez, en `page.tsx`, así que las reglas de hooks quedan intactas
 * sin importar qué bloques termine mostrando el layout resuelto.
 */
export function useHomeDataState(): HomeDataState {
  const t = useTranslations();
  const router = useRouter();
  const { ref: scrollerRef, overflowing } = useScrollOverflow<HTMLDivElement>();
  const { data: household } = useCurrentHousehold();
  const deleteTransaction = useDeleteTransactionWithUndo(household?.id);
  const userId = useEffectiveUserId();
  const { data: profile } = useQuery({ queryKey: ["profile", userId], queryFn: () => profilesRepo.getOwn(userId!), enabled: !!userId });
  const dismissedYear = useBirthdayBannerStore((s) => s.dismissedYear);
  const dismissBirthdayBanner = useBirthdayBannerStore((s) => s.dismiss);
  const accountsQuery = useAccounts(household?.id);
  const { data: accounts, isLoading: accountsLoading } = accountsQuery;
  const { data: categories = [] } = useCategories(household?.id);
  const { data: tags = [] } = useTags(household?.id);
  const transactionsQuery = useTransactions(household?.id);
  const { data: transactions, isLoading: txLoading } = transactionsQuery;
  const { data: transactionTagLinks } = useTransactionTagsFor((transactions ?? []).map((tx) => tx.id));
  const tagById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);
  const tagNamesByTx = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const link of transactionTagLinks ?? []) {
      const name = tagById.get(link.tagId)?.name;
      if (!name) continue;
      map.set(link.transactionId, [...(map.get(link.transactionId) ?? []), name]);
    }
    return map;
  }, [transactionTagLinks, tagById]);
  // El switch Personal/Compartido/Todo del header (`AppHeader`, montado en
  // `(app)/layout.tsx`) filtraba nada hasta acá — se pintaba, cambiaba el
  // store, pero ningún cálculo del dashboard lo leía. `scopedAccounts`
  // filtra por `visibility` (`match-scope.ts`) y `scopedTransactions` sigue
  // pertenece por `accountId`/`counterAccountId` — todo lo que se muestra
  // más abajo (patrimonio, gastado/ingresado, movimientos recientes, tarjetas)
  // sale de estos dos, no de los arrays crudos del fetch.
  const scope = useScopeStore((s) => s.scope);
  const scopedAccounts = useMemo(() => (accounts ?? []).filter((a) => accountMatchesScope(a.visibility, scope)), [accounts, scope]);
  const scopedAccountIds = useMemo(() => new Set(scopedAccounts.map((a) => a.id)), [scopedAccounts]);
  const scopedTransactions = useMemo(
    () => (transactions ?? []).filter((tx) => scopedAccountIds.has(tx.accountId) || (tx.counterAccountId && scopedAccountIds.has(tx.counterAccountId))),
    [transactions, scopedAccountIds]
  );
  const investmentsEnabled = household?.enabledModules.includes("investments") ?? false;
  const netWorth = useNetWorth(household?.id, household?.baseCurrency, scopedAccounts, investmentsEnabled);
  const investmentsTrend = useInvestmentsTrend(household?.id, household?.baseCurrency, investmentsEnabled);
  // El toggle "ver en USD" (`SegmentedControl` en `NetWorthBlock`) decide
  // acá, no en el bloque, porque condiciona qué queries de conversión
  // corren (`netWorthUsd`/`expenseThisPeriodUsd`/`incomeThisPeriodUsd`) y
  // esas tres alimentan además a `PeriodTotalsBlock` — no es un dato
  // local de un solo bloque.
  const netWorthDisplayCurrency = useNetWorthCurrencyStore((s) => s.displayCurrency);
  const wantsUsd = netWorthDisplayCurrency === "usd" && household?.baseCurrency !== "USD";
  const netWorthUsd = useNetWorthInCurrency(household?.id, netWorth.data?.netWorth, wantsUsd ? "USD" : null);

  // Gastado/ingresado del período, en moneda base — se calcula acá arriba
  // (antes del `return` de loading) para poder pedir la conversión a USD
  // con el mismo hook y el mismo toggle que el patrimonio, sin romper las
  // reglas de hooks. `amountBase` (ya convertido al guardar): los
  // movimientos `needs_fx` (amountBase null) quedan afuera, nunca se
  // cuentan como si valieran 0.
  const baseCurrencyForPeriod = household?.baseCurrency ?? "UYU";
  const periodStart = startOfPeriod(new Date(), household?.periodStartDay || 1).toISOString();
  const spendByCategory = new Map<string, bigint>();
  let expenseThisPeriod = zero(baseCurrencyForPeriod);
  let incomeThisPeriod = zero(baseCurrencyForPeriod);
  for (const tx of scopedTransactions) {
    if (tx.occurredAt < periodStart) continue;
    const { bucket, magnitude } = classifyCashFlow(tx);
    if (bucket === "outflow") {
      expenseThisPeriod = add(expenseThisPeriod, money(magnitude, baseCurrencyForPeriod));
      // El desglose por categoría es solo consumo — un trade no tiene categoría.
      if (tx.kind === "expense" && tx.categoryId) spendByCategory.set(tx.categoryId, (spendByCategory.get(tx.categoryId) ?? 0n) + magnitude);
    } else if (bucket === "inflow") {
      incomeThisPeriod = add(incomeThisPeriod, money(magnitude, baseCurrencyForPeriod));
    }
  }
  const expenseThisPeriodUsd = useNetWorthInCurrency(household?.id, expenseThisPeriod, wantsUsd ? "USD" : null);
  const incomeThisPeriodUsd = useNetWorthInCurrency(household?.id, incomeThisPeriod, wantsUsd ? "USD" : null);

  const budgetAlerts = useBudgetAlerts();
  const errorState = useQueryErrorState(accountsQuery.isError ? accountsQuery : transactionsQuery, { what: t("home.errorWhat") });
  const isCardPayment = useIsCardPayment(household?.id);
  const pending = usePendingMutations();
  const { conflicts } = useConflicts(household?.id);
  const activeReminder = useActiveReminder({ hasExactBirthDate: !!profile?.birthDate && profile.birthDatePrecision === "exact", enabledModules: household?.enabledModules });
  const { data: recurringRules } = useRecurringRules(household?.id);
  const { data: recurringOccurrences } = useRecurringOccurrences(household?.id);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accountById = useMemo(() => new Map((accounts ?? []).map((a: AccountRowData) => [a.id, a])), [accounts]);

  if (!household || accountsLoading || txLoading) return { status: "loading" };
  if (errorState) return { status: "error", error: errorState };

  const allAccounts = scopedAccounts;
  const allTransactions = scopedTransactions;

  // Sin datos de verdad (recién onboardeado) vs. sin datos EN ESTE SCOPE
  // (p. ej. "Personal" sin ninguna cuenta privada, con el hogar lleno de
  // movimientos) son dos estados distintos — el primero pide cargar el
  // primer gasto, el segundo solo necesita cambiar el switch del header.
  if ((accounts ?? []).length === 0 || (transactions ?? []).length === 0) {
    return { status: "empty", message: t("home.empty"), actionLabel: t("home.emptyAction"), onAction: () => router.push("/add") };
  }
  if (allAccounts.length === 0 || allTransactions.length === 0) {
    return { status: "empty", message: t("home.emptyScope") };
  }

  const baseCurrency = household.baseCurrency;
  const now = new Date();

  // Sparkline del héroe: flujo neto (ingreso − gasto) acumulado de los
  // últimos 14 días, en base a movimientos reales — no un historial de
  // patrimonio snapshot a snapshot (esa tabla todavía no existe), pero sí
  // una tendencia genuina, no inventada. Todo el cálculo es bigint vía
  // lib/money; `toMajorUnitsUnsafe` solo se usa al final, para el pixel del
  // Sparkline — nunca para el delta que se muestra como plata.
  let runningNet = zero(baseCurrency);
  const heroTrendMoney: Money[] = [];
  for (let i = 13; i >= 0; i--) {
    const [start, end] = dayBounds(now, i);
    // Movió liquidez: expense/income y también investing (compra/venta de
    // instrumento) — nunca transfer/adjustment ni needs_fx
    // (`src/lib/analytics/cash-flow.ts`).
    const dayTransactions = allTransactions.filter((tx) => tx.occurredAt >= start.toISOString() && tx.occurredAt < end.toISOString());
    const dayNetBase = dayTransactions.reduce((s, tx) => s + cashFlowNetBase(tx), 0n);
    const dayNet = money(dayNetBase, baseCurrency);
    runningNet = add(runningNet, dayNet);
    heroTrendMoney.push(runningNet);
  }
  const heroTrend = heroTrendMoney.map((m) => toMajorUnitsUnsafe(m));

  // Toggle "ver en USD" — solo la cifra grande (CON-28-adjacent: el delta y
  // el sparkline de arriba son tendencia diaria en base, convertirlos
  // pediría cotización histórica por día). Si no hay rate hoy (needs_fx),
  // nunca se inventa un valor: se cae a la cifra en base y se avisa.
  const heroMoney = wantsUsd && netWorthUsd.data ? netWorthUsd.data : null;
  const heroFxPending = wantsUsd && netWorthUsd.isSuccess && netWorthUsd.data === null;
  const last7Net = subtract(heroTrendMoney[13]!, heroTrendMoney[6]!);
  const prev7Net = heroTrendMoney[6]!;
  const deltaPolarity = compare(last7Net, prev7Net) >= 0 ? "positive" : "negative";
  const deltaArrow = compare(last7Net, prev7Net) >= 0 ? "↑" : "↓";

  // Saldo del período: superávit o déficit entre lo que entró y lo que
  // salió esta vez — no una tendencia vs. otro período, así que no lleva
  // "vs. semana pasada" como el patrimonio neto/investing de arriba.
  // Convierte a USD solo si las DOS conversiones ya llegaron: mezclar una
  // en USD con la otra en base rompe `subtract` (CurrencyMismatchError)
  // antes de que el usuario vea nada.
  const periodSurplusReady = wantsUsd && expenseThisPeriodUsd.data && incomeThisPeriodUsd.data;
  const periodSurplus = subtract(
    periodSurplusReady ? incomeThisPeriodUsd.data! : incomeThisPeriod,
    periodSurplusReady ? expenseThisPeriodUsd.data! : expenseThisPeriod,
  );
  const periodSurplusCmp = compare(periodSurplus, zero(periodSurplus.currency));

  // `adjustment` (conciliación) queda afuera de este conteo: su
  // `amount_base` no alimenta ningún agregado (el patrimonio neto se
  // calcula del saldo de la cuenta con su propia conversión de moneda,
  // independiente de esto — ver `useNetWorth`; los totales de período lo
  // excluyen igual que a las transferencias). Resolverlo no cambia ningún
  // número que el usuario vea, así que pedírselo acá es ruido sin motivo.
  const needsFxCount = allTransactions.filter((tx) => tx.fxRate === null && tx.kind !== "adjustment").length;
  const topCategoryEntry = [...spendByCategory.entries()].sort((a, b) => (b[1] > a[1] ? 1 : -1))[0];
  const topCategory = topCategoryEntry ? categoryById.get(topCategoryEntry[0]) : undefined;

  // Las tarjetas de crédito no son liquidez: no tenés esa plata disponible,
  // vas acumulando un gasto pendiente de pagar. Van a su propia sección más
  // abajo, no al carrusel de cuentas — mezclarlas ahí las hacía leerse como
  // si fueran saldo disponible.
  // `compareAccountsForDisplay`: agrupa por moneda (base primero, mismo
  // criterio que `/accounts`) y dentro de cada grupo por `sortOrder` — el
  // orden que el usuario define ahí con drag&drop. Antes esto ordenaba
  // solo por código de moneda y nunca leía `sortOrder`, así que en mobile
  // (donde no hay bento que reordene por tamaño, ver más abajo) el
  // carrusel de cuentas salía en un orden que el usuario nunca eligió.
  const liquidityAccounts = allAccounts.filter((a) => a.kind !== "credit_card").sort(compareAccountsForDisplay(baseCurrency));
  const creditCardAccounts = allAccounts.filter((a) => a.kind === "credit_card");

  // Bento en desktop (`AccountCarousel gridOnDesktop`): sin card de total —
  // "Total convertido" mostraba el mismo número que el patrimonio neto del
  // héroe, arriba de esto, y repetir la misma cifra dos veces en la
  // pantalla es ruido, no información. Cuál card queda destacada la
  // decide el layout del bento (`bentoLayout()` en `AccountCarousel`), que
  // solo se aplica en desktop — en mobile se muestra tal cual, en el orden
  // de `liquidityAccounts` de arriba.
  const accountSummaries: AccountSummary[] = liquidityAccounts.map((a) => ({
    id: a.id,
    institution: a.name,
    name: t(ACCOUNT_KIND_MESSAGE_KEY[a.kind]),
    balance: money(a.currentBalance, a.currencyCode),
    country: a.countryCode ?? undefined,
  }));

  const recentTransactions = allTransactions.slice(0, 5);

  const showBirthdayBanner = !!profile?.birthDate && isBirthdayToday(profile.birthDate, profile.birthDatePrecision ?? null, now) && dismissedYear !== now.getFullYear();
  const birthdayAge = profile?.birthDate ? ageFromBirthDate(profile.birthDate, now) : 0;

  // Recurrentes manuales (auto_post = false) vencidos o que vencen hoy —
  // mismo cálculo que `recurring/[id]/page.tsx` (`occurrencesBetween` +
  // `isChargeDue`), pero de una sola pasada sobre todas las reglas en vez
  // de una query por regla. `recurringOccurrenceDate`, no `occurredAt`: una
  // carga manual tardía no debe seguir contando como "pendiente" solo
  // porque se pagó después de la fecha del período.
  const today = todayIso();
  const chargedByRule = new Map<string, Set<string>>();
  for (const o of recurringOccurrences ?? []) {
    if (!chargedByRule.has(o.recurringId)) chargedByRule.set(o.recurringId, new Set());
    chargedByRule.get(o.recurringId)!.add(o.occurrenceDate);
  }
  const dueManualRules = (recurringRules ?? [])
    .filter((r) => !r.autoPost && r.archivedAt === null)
    .map((r) => ({
      rule: r,
      nextChargeableDate: occurrencesBetween(r, r.anchorDate, addYears(today, 2)).find((d) => !chargedByRule.get(r.id)?.has(d)) ?? null,
    }))
    .filter(({ nextChargeableDate }) => isChargeDue(false, nextChargeableDate, today));
  const dueManualRecurringCount = dueManualRules.length;
  const dueManualRecurringRuleId = dueManualRecurringCount === 1 ? dueManualRules[0]!.rule.id : null;

  // Más urgente gana: offline/conflicto/cumpleaños se muestran arriba de
  // cualquier otro aviso, nunca apilados. El de recurrentes vencidos pisa
  // al recordatorio informativo genérico (mismo motivo: es información
  // accionable de plata, no un tip de producto) pero nunca al revés.
  const showRecurringDueBanner = !showBirthdayBanner && !(pending && pending > 0) && conflicts.length === 0 && dueManualRecurringCount > 0;
  const showReminderBanner = !showBirthdayBanner && !(pending && pending > 0) && conflicts.length === 0 && !showRecurringDueBanner && !!activeReminder;

  return {
    status: "ready",
    data: {
      scrollerRef,
      overflowing,
      showBirthdayBanner,
      birthdayAge,
      dismissBirthdayBanner,
      now,
      pending,
      conflicts,
      showReminderBanner,
      activeReminder,
      showRecurringDueBanner,
      dueManualRecurringCount,
      dueManualRecurringRuleId,
      household,
      baseCurrency,
      netWorth,
      heroMoney,
      heroFxPending,
      heroTrend,
      last7Net,
      prev7Net,
      deltaPolarity,
      deltaArrow,
      investmentsEnabled,
      investmentsTrend,
      accountSummaries,
      creditCardAccounts,
      periodStart,
      expenseThisPeriod,
      incomeThisPeriod,
      wantsUsd,
      expenseThisPeriodUsd,
      incomeThisPeriodUsd,
      periodSurplus,
      periodSurplusCmp,
      budgetAlerts,
      categoryById,
      accountById,
      needsFxCount,
      topCategory,
      recentTransactions,
      tagNamesByTx,
      isCardPayment,
      deleteTransaction,
    },
  };
}

const HomeDataContext = createContext<HomeDataReady | null>(null);

export function HomeDataProvider({ data, children }: { data: HomeDataReady; children: ReactNode }) {
  return <HomeDataContext.Provider value={data}>{children}</HomeDataContext.Provider>;
}

/** Lo consumen los bloques del home — nunca `page.tsx`, que ya tiene `data` de `useHomeDataState()`. */
export function useHomeData(): HomeDataReady {
  const ctx = useContext(HomeDataContext);
  if (!ctx) throw new Error("useHomeData debe usarse dentro de <HomeDataProvider>");
  return ctx;
}
