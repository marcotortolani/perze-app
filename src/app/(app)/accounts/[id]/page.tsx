"use client";

import { use, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { Amount, AppHeader, EmptyState, ListRow, ProgressBar, Skeleton, TransactionRow } from "@/design-system";

// C15/auditoría — ver el mismo comentario en `analytics/trends/page.tsx`.
const LineChart = dynamic(() => import("@/design-system/charts/LineChart").then((m) => m.LineChart), { ssr: false });
import type { IconName } from "@/design-system/core/Icon";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccount, useInvalidateAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import { useTransactions } from "@/hooks/use-transactions";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useLatestCardStatement } from "@/hooks/use-card-statements";
import { useRecurringRules } from "@/hooks/use-recurring-rules";
import { computeTransactionEffects } from "@/lib/repos/balance-effects";
import { accountsRepo } from "@/lib/repos/accounts-repo";
import { money, toMajorUnitsUnsafe } from "@/lib/money/money";
import { amountToExpression } from "@/features/capture/AmountStep";
import { formatAmountCompact } from "@/lib/money/format";
import { ACCOUNT_KIND_MESSAGE_KEY } from "@/lib/reference/account-kind-labels";
import { COUNTRY_MESSAGE_KEY } from "@/lib/reference/countries-currencies";
import type { Locale } from "@/i18n/formatting";

const EVOLUTION_DAYS = 90;

function daysAgoIso(days: number, from: Date): string {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/** E2 (detalle + evolución) y E4 (resumen de tarjeta) — Bloque E, Fase 8. */
export default function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const categoryLabel = useCategoryLabel();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: account, isLoading } = useAccount(id);
  const { data: categories = [] } = useCategories(household?.id);
  const { data: transactions = [] } = useTransactions(household?.id, { accountId: id });
  const invalidateAccounts = useInvalidateAccounts(household?.id);
  const { data: latestStatement } = useLatestCardStatement(id);
  const { data: recurringRules = [] } = useRecurringRules(household?.id);
  const accountRecurringCount = recurringRules.filter((r) => r.accountId === id).length;

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const evolution = useMemo(() => {
    if (!account) return [];
    const now = new Date();
    const windowStartIso = daysAgoIso(EVOLUTION_DAYS, now);

    // Reconstrucción hacia atrás: el saldo actual menos la suma de los
    // efectos de cada movimiento dentro de la ventana da el saldo de hace
    // 90 días — no hay tabla de snapshots todavía (`docs/01 § 2.7` la deja
    // para cuando exista sync real), así que se recalcula desde `current_balance`.
    let cursor = account.currentBalance;
    const deltaByDay = new Map<string, bigint>();
    for (const t of transactions) {
      if (t.occurredAt < windowStartIso) continue;
      const effects = computeTransactionEffects(t);
      const effect = effects.find((e) => e.accountId === account.id);
      if (!effect) continue;
      const day = t.occurredAt.slice(0, 10);
      deltaByDay.set(day, (deltaByDay.get(day) ?? 0n) + effect.delta);
      cursor -= effect.delta;
    }
    const startBalance = cursor;

    const points: { label: string; value: number }[] = [];
    let running = startBalance;
    for (let i = EVOLUTION_DAYS; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      running += deltaByDay.get(iso) ?? 0n;
      if (i % 7 === 0 || i === 0) {
        points.push({ label: d.toLocaleDateString(locale, { day: "2-digit", month: "short" }), value: toMajorUnitsUnsafe(money(running, account.currencyCode)) });
      }
    }
    return points;
  }, [account, transactions, locale]);

  // Subpágina de detalle de cuenta: header propio con "volver", el shell no dibuja el suyo acá.
  const backHeader = <AppHeader showScope={false} onBack={() => router.push("/accounts")} backLabel={t("accountsPage.detail.back")} />;

  if (isLoading || !household) {
    return (
      <>
        {backHeader}
        <Skeleton height={300} />
      </>
    );
  }
  if (!account) {
    return (
      <>
        {backHeader}
        <EmptyState message={t("accountsPage.detail.notFound")} actionLabel={t("accountsPage.detail.backToList")} onAction={() => router.push("/accounts")} />
      </>
    );
  }

  const isCreditCard = account.kind === "credit_card";
  const cycleTransactions = isCreditCard
    ? transactions.filter((t) => {
        if (!account.statementDay) return true;
        const cycleStart = new Date();
        cycleStart.setDate(account.statementDay);
        if (cycleStart > new Date()) cycleStart.setMonth(cycleStart.getMonth() - 1);
        return t.occurredAt >= cycleStart.toISOString();
      })
    : [];
  const cycleTotal = cycleTransactions.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amount, 0n);

  const handleArchive = async () => {
    await accountsRepo.archive(account.id);
    invalidateAccounts();
    router.push("/accounts");
    toast(t("accountsPage.detail.archived"));
  };

  // "Pagar tarjeta" en vez de "Transferir": técnicamente es la misma
  // transferencia, pero nadie dice "transferir a la tarjeta" — precarga el
  // módulo de `/add` con la tarjeta como destino y el monto a pagar, y deja
  // la cuenta de origen sin elegir a propósito (es la decisión real que
  // falta tomar). Si el origen termina en otra moneda, `AmountStep` ya
  // muestra el `FxEditor` ajustable para esa conversión.
  const handlePayCard = () => {
    // Query params, no el store: `CaptureFlow` resetea el draft entero en
    // cada montaje (garantiza que "+" siempre arranca en blanco) — cargar
    // el prefill ACÁ, antes de navegar, se perdía siempre porque ese reset
    // corre después. `CaptureFlow` lo aplica en un efecto propio, una vez.
    // Sin resumen cargado todavía (`card_statements` es carga manual por
    // ciclo) no hay `latestStatement` — cae al saldo real de la tarjeta,
    // que YA es la deuda acumulada, en vez de a 0.
    const dueAmount = latestStatement ? latestStatement.statementBalance - latestStatement.paidAmount : -account.currentBalance;
    const params = new URLSearchParams({
      prefillKind: "transfer",
      prefillCounterAccountId: account.id,
      prefillAmountExpression: amountToExpression(dueAmount > 0n ? dueAmount : 0n, account.currencyCode, locale),
      prefillCurrency: account.currencyCode,
      // El monto es fijo del lado de la tarjeta (destino) — se descubre
      // cuánto sale del origen recién cuando se elige, nunca al revés.
      prefillAmountPinnedTo: "counterAccount",
    });
    router.push(`/add?${params.toString()}`);
  };

  return (
    <>
      <AppHeader title={account.name} showScope={false} onBack={() => router.push("/accounts")} backLabel={t("accountsPage.detail.back")} />
      <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingTop: 16, paddingBottom: 24 }}>
      <div style={{ textAlign: "center" }}>
        <span className="t-caption" style={{ color: "var(--text-muted)" }}>
          {account.name} · {t(ACCOUNT_KIND_MESSAGE_KEY[account.kind])}
          {account.countryCode && account.countryCode in COUNTRY_MESSAGE_KEY
            ? ` · ${t(COUNTRY_MESSAGE_KEY[account.countryCode as keyof typeof COUNTRY_MESSAGE_KEY])}`
            : ""}
        </span>
        <div style={{ marginTop: 4 }}>
          <Amount value={money(account.currentBalance, account.currencyCode)} size="hero" fit showSign={false} polarity="neutral" tabular />
        </div>
      </div>

      {evolution.length > 1 ? (
        <LineChart data={evolution} formatValue={(v) => formatAmountCompact(money(BigInt(Math.round(v * 100)), account.currencyCode), { showSign: false })} />
      ) : null}

      {isCreditCard ? (
        <button
          type="button"
          onClick={() => router.push(`/accounts/${account.id}/card`)}
          style={{ all: "unset", cursor: "pointer", display: "block", width: "100%", background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: 16 }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span className="t-label" style={{ color: "var(--text-secondary)" }}>{t("accountsPage.detail.cycleSummary")}</span>
          {account.creditLimit ? (
            <>
              <ProgressBar value={Number(cycleTotal) / Number(account.creditLimit)} />
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {t("accountsPage.detail.cycleOf", {
                  spent: formatAmountCompact(money(cycleTotal, account.currencyCode), { showSign: false }),
                  limit: formatAmountCompact(money(account.creditLimit, account.currencyCode), { showSign: false }),
                })}
              </span>
            </>
          ) : (
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {t("accountsPage.detail.cycleConsumption", { amount: formatAmountCompact(money(cycleTotal, account.currencyCode), { showSign: false }) })}
            </span>
          )}
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {t("accountsPage.detail.cycleCloses", { statementDay: account.statementDay ?? "", dueDay: account.dueDay ?? "" })}
          </span>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {t("accountsPage.detail.cycleProjection", { amount: formatAmountCompact(money(cycleTotal, account.currencyCode), { showSign: false }) })}
          </span>
          </div>
        </button>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <ListRow icon="edit" label={t("accountsPage.detail.edit")} onClick={() => router.push(`/accounts/${account.id}/edit`)} />
        <ListRow icon="target" label={t("accountsPage.detail.reconcile")} onClick={() => router.push(`/accounts/${account.id}/reconcile`)} />
        {accountRecurringCount > 0 ? (
          <ListRow icon="refresh" label={t("recurringPage.viewRecurring")} value={String(accountRecurringCount)} variant="value" onClick={() => router.push(`/recurring?accountId=${account.id}`)} />
        ) : null}
        {isCreditCard ? (
          <ListRow icon="credit-card" label={t("accountsPage.detail.payCard")} onClick={handlePayCard} />
        ) : (
          <ListRow icon="refresh" label={t("accountsPage.detail.transfer")} onClick={() => router.push("/add")} />
        )}
        <ListRow icon="trash" label={t("accountsPage.detail.archive")} destructive onClick={handleArchive} />
      </div>

      <div>
        <span className="t-label" style={{ color: "var(--text-secondary)" }}>{t("accountsPage.detail.transactionsTitle")}</span>
        {transactions.length === 0 ? (
          <p className="t-body" style={{ color: "var(--text-muted)", marginTop: 8 }}>
            {t("accountsPage.detail.noTransactions")}
          </p>
        ) : (
          transactions.slice(0, 20).map((tx) => {
            const category = tx.categoryId ? categoryById.get(tx.categoryId) : undefined;
            return (
              <TransactionRow
                key={tx.id}
                icon={(category?.icon as IconName) ?? (tx.kind === "transfer" ? "refresh" : "cart")}
                merchant={category ? categoryLabel(category) : tx.kind === "transfer" ? t("transactions.list.transfer") : t("transactions.list.movement")}
                meta={tx.occurredAt.slice(0, 10)}
                value={money(tx.kind === "expense" ? -tx.amount : tx.amount, tx.currencyCode)}
                polarity={tx.kind === "income" ? "positive" : tx.kind === "transfer" ? "neutral" : "negative"}
                onClick={() => router.push(`/transactions/${tx.id}`)}
              />
            );
          })
        )}
      </div>
      </div>
    </>
  );
}
