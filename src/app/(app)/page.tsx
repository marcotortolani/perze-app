"use client";

import type { CSSProperties } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AccountCarousel,
  AccountRow,
  Banner,
  EmptyState,
  ErrorState,
  Icon,
  InsightCard,
  PrivacyBlur,
  SectionGroup,
  SegmentedControl,
  Skeleton,
  StatTile,
  TransactionRow,
  fitScale,
  usePageHeader,
} from "@/design-system";
import { useQuery } from "@tanstack/react-query";
import { Sparkline } from "@/design-system/charts";
import { ContextualTooltip } from "@/design-system/systems";
import type { IconName } from "@/design-system/core/Icon";
import { CountUp } from "@/components/motion";
import { useScrollOverflow } from "@/hooks/use-scroll-overflow";
import { HomeSkeleton } from "@/components/home-skeleton";
import { BirthdayBanner } from "@/components/birthday-banner";
import { useContextualTooltipStore } from "@/stores/contextual-tooltip-store";
import { useBirthdayBannerStore } from "@/stores/birthday-banner-store";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { profilesRepo } from "@/lib/repos/profiles-repo";
import { ageFromBirthDate, isBirthdayToday } from "@/lib/analytics/age";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import { useTags } from "@/hooks/use-tags";
import { useTransactionTagsFor } from "@/hooks/use-transaction-tags";
import { useTransactions } from "@/hooks/use-transactions";
import { useNetWorth } from "@/hooks/use-net-worth";
import { useNetWorthInCurrency } from "@/hooks/use-net-worth-in-currency";
import { useBudgetAlerts } from "@/hooks/use-budget-alerts";
import { useConflicts } from "@/hooks/use-conflicts";
import { usePendingMutations } from "@/lib/offline";
import { useQueryErrorState } from "@/hooks/use-query-error-state";
import { usePrivacyStore } from "@/stores/privacy-store";
import { useIsCardPayment } from "@/hooks/use-card-payment";
import { useNetWorthCurrencyStore } from "@/stores/net-worth-currency-store";
import { abs, add, compare, money, sum, subtract, toMajorUnitsUnsafe, zero } from "@/lib/money/money";
import type { Money } from "@/lib/money/money";
import { formatAmountCompact } from "@/lib/money/format";
import { ACCOUNT_KIND_MESSAGE_KEY } from "@/lib/reference/account-kind-labels";
import { accountColorVar } from "@/lib/reference/account-colors";
import { useCategoryLabel } from "@/hooks/use-category-label";
import type { AccountRow as AccountRowData, TransactionRow as TransactionRecord } from "@/lib/db/schema";

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

/**
 * Mismo clamp que `Amount`'s `fit` (`ResizeObserver` + `fitScale`, mismo
 * piso de legibilidad), pero para las cifras compactas de los `StatTile`
 * de "gastado"/"ingresado este período" — pasan por `formatAmountCompact`
 * (ya abrevia, "$ 1,2 M"), no por `<Amount>`, así que `fit` no aplica
 * directo: acá el tamaño nominal es el mismo 30px que ya usa `StatTile`
 * tamaño `md`, no uno de los tokens de `size` de `Amount`.
 */
function FitStatValue({ text }: { text: string }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const measure = () => {
      const naturalWidth = inner.scrollWidth / scale;
      setScale((prev) => fitScale(outer.clientWidth, naturalWidth, prev));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    return () => observer.disconnect();
  }, [scale, text]);

  return (
    <div ref={outerRef} style={{ width: "100%", overflow: "hidden" }}>
      <span
        ref={innerRef}
        style={{ display: "inline-block", whiteSpace: "nowrap", fontFamily: "var(--font-mono)", fontSize: `calc(30px * ${scale})`, lineHeight: `calc(36px * ${scale})` }}
      >
        {text}
      </span>
    </div>
  );
}

/** Home real — Bloque B, Fase 6: hero de patrimonio, cuentas, estado del mes, insight, últimos movimientos. */
export default function HomePage() {
  const router = useRouter();
  const { ref: scrollerRef, overflowing } = useScrollOverflow<HTMLDivElement>();
  const t = useTranslations();
  usePageHeader({ title: t("nav.home") });
  const categoryLabel = useCategoryLabel();
  const { data: household } = useCurrentHousehold();
  const userId = useCurrentUserId();
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
  const netWorth = useNetWorth(household?.id, household?.baseCurrency, accounts ?? []);
  const netWorthDisplayCurrency = useNetWorthCurrencyStore((s) => s.displayCurrency);
  const setNetWorthDisplayCurrency = useNetWorthCurrencyStore((s) => s.setDisplayCurrency);
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
  for (const tx of transactions ?? []) {
    if (tx.occurredAt < periodStart || tx.kind === "transfer" || tx.amountBase === null) continue;
    const m = money(tx.amountBase, baseCurrencyForPeriod);
    if (tx.kind === "expense") {
      expenseThisPeriod = add(expenseThisPeriod, m);
      if (tx.categoryId) spendByCategory.set(tx.categoryId, (spendByCategory.get(tx.categoryId) ?? 0n) + tx.amountBase);
    } else if (tx.kind === "income") {
      incomeThisPeriod = add(incomeThisPeriod, m);
    }
  }
  const expenseThisPeriodUsd = useNetWorthInCurrency(household?.id, expenseThisPeriod, wantsUsd ? "USD" : null);
  const incomeThisPeriodUsd = useNetWorthInCurrency(household?.id, incomeThisPeriod, wantsUsd ? "USD" : null);

  const budgetAlerts = useBudgetAlerts();
  const errorState = useQueryErrorState(accountsQuery.isError ? accountsQuery : transactionsQuery, { what: t("home.errorWhat") });
  const privacy = usePrivacyStore((s) => s.privacyMode);
  const togglePrivacy = usePrivacyStore((s) => s.toggle);
  const isCardPayment = useIsCardPayment(household?.id);
  const pending = usePendingMutations();
  const { conflicts } = useConflicts(household?.id);
  const seenPrivacyTooltip = useContextualTooltipStore((s) => s.hasSeen("home-privacy-toggle"));
  const markPrivacyTooltipSeen = useContextualTooltipStore((s) => s.markSeen);
  const [insightDismissed, setInsightDismissed] = useState(false);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accountById = useMemo(() => new Map((accounts ?? []).map((a: AccountRowData) => [a.id, a])), [accounts]);

  if (!household || accountsLoading || txLoading) return <HomeSkeleton />;

  if (errorState) return <ErrorState {...errorState} />;

  const allAccounts = accounts ?? [];
  const allTransactions = transactions ?? [];

  if (allAccounts.length === 0 || allTransactions.length === 0) {
    return (
      <EmptyState
        message={t("home.empty")}
        actionLabel={t("home.emptyAction")}
        onAction={() => router.push("/add")}
      />
    );
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
    const dayTransactions = allTransactions.filter(
      (t) => t.kind !== "transfer" && t.amountBase !== null && t.occurredAt >= start.toISOString() && t.occurredAt < end.toISOString(),
    );
    const dayNet = sum(
      baseCurrency,
      dayTransactions.map((t) => money(t.kind === "income" ? t.amountBase! : -t.amountBase!, baseCurrency)),
    );
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

  // `adjustment` (conciliación) queda afuera de este conteo: su
  // `amount_base` no alimenta ningún agregado (el patrimonio neto se
  // calcula del saldo de la cuenta con su propia conversión de moneda,
  // independiente de esto — ver `useNetWorth`; los totales de período lo
  // excluyen igual que a las transferencias). Resolverlo no cambia ningún
  // número que el usuario vea, así que pedírselo acá es ruido sin motivo.
  const needsFxCount = allTransactions.filter((t) => t.fxRate === null && t.kind !== "adjustment").length;
  const topCategoryEntry = [...spendByCategory.entries()].sort((a, b) => (b[1] > a[1] ? 1 : -1))[0];
  const topCategory = topCategoryEntry ? categoryById.get(topCategoryEntry[0]) : undefined;

  // Las tarjetas de crédito no son liquidez: no tenés esa plata disponible,
  // vas acumulando un gasto pendiente de pagar. Van a su propia sección más
  // abajo, no al carrusel de cuentas — mezclarlas ahí las hacía leerse como
  // si fueran saldo disponible.
  const liquidityAccounts = allAccounts.filter((a) => a.kind !== "credit_card");
  const creditCardAccounts = allAccounts.filter((a) => a.kind === "credit_card");

  const liquiditySummaries = liquidityAccounts.map((a) => ({
    id: a.id,
    institution: a.name,
    name: t(ACCOUNT_KIND_MESSAGE_KEY[a.kind]),
    balance: money(a.currentBalance, a.currencyCode),
    country: a.countryCode ?? undefined,
  }));
  // Bento en desktop (`AccountCarousel gridOnDesktop`): sin card de total —
  // "Total convertido" mostraba el mismo número que el patrimonio neto del
  // héroe, arriba de esto, y repetir la misma cifra dos veces en la
  // pantalla es ruido, no información. El resto se ordena por moneda:
  // cifras en la misma moneda (comparables entre sí) quedan agrupadas, en
  // vez de un orden arbitrario que las mezcla al azar. Cuál card queda
  // destacada lo decide el layout del bento (`bentoLayout()` en
  // `AccountCarousel`), no esta página.
  const accountSummaries = [...liquiditySummaries].sort((a, b) => a.balance.currency.localeCompare(b.balance.currency));

  const recentTransactions = allTransactions.slice(0, 5);

  const showBirthdayBanner = !!profile?.birthDate && isBirthdayToday(profile.birthDate, now) && dismissedYear !== now.getFullYear();
  const birthdayAge = profile?.birthDate ? ageFromBirthDate(profile.birthDate, now) : 0;

  return (
    // `scroll-fade-bottom`: mismo tratamiento que `/accounts` — home maneja
    // su propio scroll (sumada a `OWN_SCROLLER_ROUTES` en `(app)/layout.tsx`)
    // para tener el mismo fade y aire real al final de "Movimientos recientes".
    <div className="scroll-fade-bottom" data-scroll-overflow={overflowing} style={{ "--scroll-fade-inset-right": "8px", height: "100%", minHeight: 0 } as CSSProperties}>
      <div
        ref={scrollerRef}
        className="pb-[calc(var(--block-gap)+18px)] lg:pb-8"
        style={{ height: "100%", minHeight: 0, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", paddingTop: 8, paddingRight: 8 }}
      >
      {showBirthdayBanner ? <BirthdayBanner age={birthdayAge} onDismiss={() => dismissBirthdayBanner(now.getFullYear())} /> : null}
      {pending && pending > 0 ? <Banner status="offline" pending={pending} style={{ margin: "0 calc(-1 * var(--screen-padding))", borderRadius: 0 }} /> : null}
      {conflicts.length > 0 ? (
        <Banner
          status="error"
          message={t("conflictsPage.homeBanner", { count: conflicts.length })}
          action={{ label: t("conflictsPage.homeBannerAction"), onClick: () => router.push("/more/sync") }}
          style={{ margin: "0 calc(-1 * var(--screen-padding))", borderRadius: 0 }}
        />
      ) : null}

      {/* Desktop ancho (`xl`, 1280px — `SPLIT_BREAKPOINT`, la misma que ya
          usan `/accounts` y `/transactions` para su split de lista+detalle
          por el mismo motivo): dos columnas para aprovechar el ancho de
          `--content-max-width-wide` (el ancho único de toda la app — ver
          `(app)/layout.tsx`) en vez de una sola columna de lectura angosta.
          NO `lg` (1024px): ahí el sidebar ya ocupa su espacio, y partir en
          2 columnas AL MISMO TIEMPO dejaba el bento de cuentas apretado en
          media página real (~350-400px) — muy poco para que sus cards no
          desborden. Entre 1024 y 1279px el home queda en 1 sola columna con
          todo el ancho de contenido disponible; recién a 1280px se parte.
          En mobile (`grid-cols-1`) es el mismo orden vertical de siempre: el
          grid de una sola columna ignora los `gridColumn` de más abajo. */}
      <div className="grid grid-cols-1 xl:grid-cols-2" style={{ gap: 28, marginTop: showBirthdayBanner || (pending && pending > 0) || conflicts.length > 0 ? 28 : 0 }}>
      {/* Columna izquierda: patrimonio, cuentas, tarjetas, gastado/ingresado — el resumen financiero. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 28, minWidth: 0 }}>
      <section style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="t-caption" style={{ color: "var(--text-muted)", letterSpacing: ".08em", textTransform: "uppercase" }}>
            {t("home.netWorth")}
          </span>
          {seenPrivacyTooltip ? (
            <button type="button" onClick={togglePrivacy} aria-label={privacy ? t("home.showAmounts") : t("home.hideAmounts")} style={{ background: "none", border: 0, padding: 4, cursor: "pointer" }}>
              <Icon name={privacy ? "eye-off" : "eye"} size={15} color="var(--text-muted)" />
            </button>
          ) : (
            <ContextualTooltip message={t("home.privacyTooltip")} onDismiss={() => markPrivacyTooltipSeen("home-privacy-toggle")}>
              <button type="button" onClick={togglePrivacy} aria-label={privacy ? t("home.showAmounts") : t("home.hideAmounts")} style={{ background: "none", border: 0, padding: 4, cursor: "pointer" }}>
                <Icon name={privacy ? "eye-off" : "eye"} size={15} color="var(--text-muted)" />
              </button>
            </ContextualTooltip>
          )}
          {baseCurrency !== "USD" ? (
            <SegmentedControl
              options={[baseCurrency, "USD"]}
              value={netWorthDisplayCurrency === "usd" ? "USD" : baseCurrency}
              onChange={(id) => setNetWorthDisplayCurrency(id === "USD" ? "usd" : "base")}
              size="sm"
            />
          ) : null}
        </div>
        {netWorth.data ? (
          heroMoney ? (
            <CountUp value={heroMoney.amount} currency={heroMoney.currency} size="hero" fit showSign={false} polarity="neutral" privacy={privacy} />
          ) : (
            <CountUp value={netWorth.data.netWorth.amount} currency={baseCurrency} size="hero" fit showSign={false} polarity="neutral" privacy={privacy} />
          )
        ) : (
          <Skeleton width={180} height={44} />
        )}
        {heroFxPending ? (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("home.netWorthUsdPending", { currency: baseCurrency })}</span>
        ) : null}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <PrivacyBlur active={privacy}>
            <span style={{ fontSize: 13, fontWeight: 500, color: deltaPolarity === "positive" ? "var(--money-positive)" : "var(--money-negative-emphasis)" }}>
              {deltaArrow} {formatAmountCompact(abs(subtract(last7Net, prev7Net)), { showSign: false })}
            </span>
          </PrivacyBlur>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("home.vsLastWeek")}</span>
        </div>
        <Sparkline values={heroTrend} width={140} height={32} color={deltaPolarity === "positive" ? "var(--data-1)" : "var(--money-negative-emphasis)"} />
        {netWorth.data && netWorth.data.excludedAccountIds.length > 0 ? (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {t("home.excludedAccounts", { count: netWorth.data.excludedAccountIds.length })}
          </span>
        ) : null}
      </section>

      {/* `flexShrink: 0`: sin esto colapsaba a 0px de alto. `overflowX: "auto"`
          en el propio carrusel hace que el navegador coaccione
          `overflow-y` a `auto` también (misma regla CSSOM que ya rompía
          scroll horizontal en `accounts/layout.tsx`/`transactions/layout.tsx`,
          acá al revés) — como hijo de este flex-column con `height:100%`,
          eso le da un `min-height` automático de 0 (la regla de flexbox
          para ítems que son su propio contenedor de scroll), así que
          absorbía solo TODA la presión de achique cuando el contenido no
          entra entero, mientras sus hermanos (sin overflow propio, min-height
          content-based) no cedían nada. */}
      <AccountCarousel
        accounts={accountSummaries}
        privacy={privacy}
        onSelect={(id) => router.push(`/accounts/${id}`)}
        gridOnDesktop
        style={{ flexShrink: 0 }}
      />

      {creditCardAccounts.length > 0 ? (
        <section>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("home.creditCards")}</div>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {creditCardAccounts.map((a) => (
              <AccountRow
                key={a.id}
                name={a.name}
                meta={t("home.creditCardCycleMeta")}
                balance={money(-a.currentBalance, a.currencyCode)}
                icon="credit-card"
                iconBackground={accountColorVar(a.color)}
                privacy={privacy}
                onClick={() => router.push(`/accounts/${a.id}`)}
              />
            ))}
          </div>
        </section>
      ) : null}

      </div>

      {/* Columna derecha: gastado/ingresado, el insight del período y la
          actividad reciente. Gastado/ingresado se movió acá (no queda en la
          izquierda, junto al grid de cuentas) porque ahí competía por ancho
          con el grid en vez de tener su propia fila cómoda. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 28, minWidth: 0 }}>
      <section style={{ display: "flex", gap: 24 }}>
        <button
          type="button"
          onClick={() => router.push(`/transactions?kind=expense&from=${encodeURIComponent(periodStart)}`)}
          style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: 0, padding: 0, cursor: "pointer" }}
        >
          <StatTile
            label={t("home.spentThisPeriod")}
            value={
              <PrivacyBlur active={privacy} style={{ display: "block", width: "100%" }}>
                <FitStatValue text={formatAmountCompact(wantsUsd && expenseThisPeriodUsd.data ? expenseThisPeriodUsd.data : expenseThisPeriod, { showSign: false })} />
              </PrivacyBlur>
            }
          />
        </button>
        <button
          type="button"
          onClick={() => router.push(`/transactions?kind=income&from=${encodeURIComponent(periodStart)}`)}
          style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: 0, padding: 0, cursor: "pointer" }}
        >
          <StatTile
            label={t("home.incomeThisPeriod")}
            value={
              <PrivacyBlur active={privacy} style={{ display: "block", width: "100%" }}>
                <FitStatValue text={formatAmountCompact(wantsUsd && incomeThisPeriodUsd.data ? incomeThisPeriodUsd.data : incomeThisPeriod, { showSign: false })} />
              </PrivacyBlur>
            }
          />
        </button>
      </section>

      {!insightDismissed ? (
        budgetAlerts.length > 0 ? (
          <InsightCard
            status={budgetAlerts[0]!.level === "exceeded" ? "critical" : "warning"}
            icon="alert"
            text={t(budgetAlerts[0]!.level === "exceeded" ? "home.budgetExceededInsight" : "home.budgetWarningInsight", {
              category: budgetAlerts[0]!.budget.categoryId ? categoryLabel(categoryById.get(budgetAlerts[0]!.budget.categoryId!) ?? { name: budgetAlerts[0]!.budget.name, i18nKey: null }) : budgetAlerts[0]!.budget.name,
              percent: Math.round(budgetAlerts[0]!.progress * 100),
            })}
            actionLabel={t("home.seeBudgets")}
            onAction={() => router.push("/budgets")}
            onDismiss={() => setInsightDismissed(true)}
            dismissLabel={t("ds.insightCard.dismiss")}
          />
        ) : needsFxCount > 0 ? (
          <InsightCard
            status="warning"
            icon="alert"
            text={t("home.needsFxInsight", { count: needsFxCount })}
            actionLabel={t("home.seeTransactions")}
            onAction={() => router.push("/transactions?pending=1")}
            onDismiss={() => setInsightDismissed(true)}
            dismissLabel={t("ds.insightCard.dismiss")}
          />
        ) : topCategory ? (
          <InsightCard
            status="neutral"
            icon={topCategory.icon as IconName}
            text={t.rich("home.topCategoryInsight", { category: categoryLabel(topCategory), b: (chunks) => <strong>{chunks}</strong> })}
            sparkline={<Sparkline values={heroTrend.map((v) => Math.max(v, 0))} width={96} height={24} />}
            onDismiss={() => setInsightDismissed(true)}
            dismissLabel={t("ds.insightCard.dismiss")}
          />
        ) : null
      ) : null}

      <SectionGroup label={t("home.recentTransactions")} onSeeAll={() => router.push("/transactions")} seeAllLabel={t("common.seeAll")}>
        <div>
          {recentTransactions.map((tx: TransactionRecord) => {
            const account = accountById.get(tx.accountId);
            const category = tx.categoryId ? categoryById.get(tx.categoryId) : undefined;
            const cardPayment = isCardPayment(tx);
            const reconciliation = tx.kind === "adjustment";
            // Mismo criterio que `/transactions`: el ícono + el título ya
            // muestran la categoría, repetirla acá es redundante — si el
            // movimiento tiene etiquetas, se muestran ELLAS en su lugar.
            const tagNames = tagNamesByTx.get(tx.id) ?? [];
            const categoryOrTransfer = category
              ? categoryLabel(category)
              : reconciliation
                ? t("home.reconciliation")
                : cardPayment
                  ? t("home.cardPayment")
                  : tx.kind === "transfer"
                    ? t("home.transfer")
                    : undefined;
            const meta = [account?.name, tagNames.length > 0 ? tagNames.join(", ") : categoryOrTransfer].filter(Boolean).join(" · ");
            const polarity = tx.kind === "income" ? "positive" : tx.kind === "transfer" || reconciliation ? "neutral" : "negative";
            const secondary = tx.currencyCode !== baseCurrency && tx.amountBase !== null ? formatAmountCompact(money(tx.amountBase, baseCurrency), { showSign: false }) : undefined;
            return (
              <TransactionRow
                key={tx.id}
                icon={(category?.icon as IconName) ?? (reconciliation ? "target" : cardPayment ? "credit-card" : tx.kind === "transfer" ? "refresh" : "cart")}
                merchant={
                  category
                    ? categoryLabel(category)
                    : reconciliation
                      ? t("home.reconciliation")
                      : cardPayment
                        ? t("home.cardPayment")
                        : tx.kind === "transfer"
                          ? t("home.transfer")
                          : t("home.movement")
                }
                meta={meta || undefined}
                value={money(tx.kind === "expense" ? -tx.amount : tx.amount, tx.currencyCode)}
                secondary={secondary}
                polarity={polarity}
                privacy={privacy}
                syncIssue={tx.syncState === "ok" ? undefined : tx.syncState}
                onClick={() => router.push(`/transactions/${tx.id}`)}
              />
            );
          })}
        </div>
      </SectionGroup>
      </div>
      </div>
      </div>
    </div>
  );
}
