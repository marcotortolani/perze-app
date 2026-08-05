"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { Amount, DataList, EmptyState, ListRow, ProgressBar, Skeleton, TransactionRow, usePageHeader } from "@/design-system";

// C15/auditoría — ver el mismo comentario en `analytics/trends/page.tsx`.
const LineChart = dynamic(() => import("@/design-system/charts/LineChart").then((m) => m.LineChart), { ssr: false });
const ChartCard = dynamic(() => import("@/design-system/charts/ChartCard").then((m) => m.ChartCard), { ssr: false });
import type { IconName } from "@/design-system/core/Icon";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { useAccount, useAccounts, useInvalidateAccount, useInvalidateAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import { useTransactions, useInvalidateAfterTransactionWrite } from "@/hooks/use-transactions";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useLatestCardStatement, useInvalidateCardStatements } from "@/hooks/use-card-statements";
import { useDebtsByAccount, useInvalidateDebts } from "@/hooks/use-debts";
import { useRecurringRules } from "@/hooks/use-recurring-rules";
import { useIsCardPayment } from "@/hooks/use-card-payment";
import { PayCardSheet } from "@/features/cards/PayCardSheet";
import { expectedDueAmount, isCreditCardAccount } from "@/lib/analytics/card-cycle";
import { computeTransactionEffects } from "@/lib/repos/balance-effects";
import { accountsRepo } from "@/lib/repos/accounts-repo";
import { money, toMajorUnitsUnsafe } from "@/lib/money/money";
import { formatAmountCompact } from "@/lib/money/format";
import { formatNumericDate, numberLocaleForUiLocale } from "@/i18n/formatting";
import { useDateFormatPreference } from "@/stores/format-preferences-store";
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
  const dateFormat = useDateFormatPreference();
  const categoryLabel = useCategoryLabel();
  const router = useRouter();
  const userId = useCurrentUserId();
  const { data: household } = useCurrentHousehold();
  const { data: account, isLoading } = useAccount(id);
  const { data: allAccounts = [] } = useAccounts(household?.id);
  const { data: categories = [] } = useCategories(household?.id);
  // Sin filtrar por `accountId` acá — ese filtro solo mira `t.accountId`
  // (el lado que descuenta), así que un pago de tarjeta (una transferencia
  // cuyo `counterAccountId` es ESTA cuenta) nunca aparecía en "Movimientos
  // de esta cuenta": la tarjeta solo veía sus consumos, nunca los pagos
  // que la bajan. Se filtra acá abajo por los dos lados.
  const { data: allTransactions = [] } = useTransactions(household?.id);
  const transactions = useMemo(() => allTransactions.filter((t) => t.accountId === id || t.counterAccountId === id), [allTransactions, id]);
  const invalidateAccounts = useInvalidateAccounts(household?.id);
  const invalidateAccount = useInvalidateAccount(id);
  const invalidateAfterWrite = useInvalidateAfterTransactionWrite(household?.id);
  const { data: latestStatement } = useLatestCardStatement(id);
  const invalidateStatements = useInvalidateCardStatements(id);
  const { data: debtsForAccount = [] } = useDebtsByAccount(id);
  const invalidateDebts = useInvalidateDebts(household?.id);
  const { data: recurringRules = [] } = useRecurringRules(household?.id);
  const accountRecurringCount = recurringRules.filter((r) => r.accountId === id).length;
  const isCardPayment = useIsCardPayment(household?.id);
  const [payCardSheetOpen, setPayCardSheetOpen] = useState(false);
  usePageHeader({ onBack: () => router.push("/accounts"), backLabel: t("accountsPage.detail.back"), ...(account ? { title: account.name } : {}) });

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
    // Tarjeta de crédito: el saldo es negativo y crece hacia abajo a
    // medida que se gasta más — matemáticamente correcto, pero al revés
    // de lo que se quiere leer acá. Una tarjeta no tiene "fondo que se
    // consume", tiene CONSUMO que se acumula: pagarla del todo lo vuelve
    // a cero, no lo "llena". Graficar `-saldo` (el consumo, siempre ≥ 0)
    // deja la línea subiendo cuando se gasta más y bajando cuando se
    // paga — la lectura intuitiva para una deuda. Las cuentas de
    // liquidez (caja de ahorro, billetera, inversión, cripto) siguen
    // graficando el saldo tal cual, sin invertir.
    const sign = isCreditCardAccount(account) ? -1 : 1;

    const points: { label: string; value: number }[] = [];
    let running = startBalance;
    for (let i = EVOLUTION_DAYS; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      running += deltaByDay.get(iso) ?? 0n;
      if (i % 7 === 0 || i === 0) {
        points.push({ label: d.toLocaleDateString(locale, { day: "2-digit", month: "short" }), value: sign * toMajorUnitsUnsafe(money(running, account.currencyCode)) });
      }
    }
    return points;
  }, [account, transactions, locale]);

  if (isLoading || !household) {
    return <Skeleton height={300} />;
  }
  if (!account) {
    return <EmptyState message={t("accountsPage.detail.notFound")} actionLabel={t("accountsPage.detail.backToList")} onAction={() => router.push("/accounts")} />;
  }

  const isCreditCard = isCreditCardAccount(account);
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
    // `await`: antes estas dos invalidaciones se disparaban sin esperar,
    // justo antes de `router.back()` desmontando el componente — una
    // carrera innecesaria. Se invalidan las DOS keys: la lista
    // (`useInvalidateAccounts`) y el detalle puntual de esta cuenta
    // (`useInvalidateAccount`, key distinta) — sin la segunda, reabrir
    // esta misma cuenta seguía mostrando "Archivar" hasta un reload.
    await Promise.all([invalidateAccounts(), invalidateAccount()]);
    // `back()`, no `replace`/`push`: esta pantalla se llegó con push desde
    // la lista, así que la lista YA está en el historial justo debajo.
    // `replace("/accounts")` reemplazaba esta entrada por una URL IDÉNTICA
    // a la que ya estaba debajo — el historial quedaba `[accounts,
    // accounts]` duplicado, y "volver" necesitaba dos toques para salir de
    // verdad. `back()` simplemente recorre el historial que ya existe, sin
    // agregar nada: nunca duplica.
    router.back();
    toast(t("accountsPage.detail.archived"));
  };

  const handleUnarchive = async () => {
    await accountsRepo.unarchive(account.id);
    await Promise.all([invalidateAccounts(), invalidateAccount()]);
    router.back();
    toast(t("accountsPage.detail.unarchived"));
  };

  // "Pagar tarjeta" en vez de "Transferir": técnicamente es la misma
  // transferencia, pero nadie dice "transferir a la tarjeta" — abre el
  // mismo `PayCardSheet` que la pantalla de ciclo (`/accounts/[id]/card`),
  // así los dos entran por `payCard()` y quedan vinculados a
  // `card_statements` de la misma forma, en vez de que este camino
  // (históricamente el más usado, porque no dependía de que existiera un
  // resumen) genere transferencias sin ningún vínculo.
  const dueAmount = expectedDueAmount(account, latestStatement ?? null);

  return (
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
        <ChartCard
          title={t("accountsPage.detail.evolutionTitle")}
          chartLabel={t("ds.chartCard.chartView")}
          tableLabel={t("ds.chartCard.tableView")}
          table={
            <DataList
              columns={[
                { key: "label", label: t("accountsPage.detail.evolutionDateColumn") },
                { key: "value", label: t("accountsPage.detail.evolutionBalanceColumn") },
              ]}
              rows={evolution.map((p, i) => ({
                label: p.label,
                value: formatAmountCompact(money(BigInt(Math.round(p.value * 100)), account.currencyCode), { showSign: false }),
                emphasis: i === evolution.length - 1,
              }))}
            />
          }
        >
          <LineChart data={evolution} formatValue={(v) => formatAmountCompact(money(BigInt(Math.round(v * 100)), account.currencyCode), { showSign: false })} />
        </ChartCard>
      ) : null}

      {isCreditCard ? (
        <button
          type="button"
          onClick={() => router.push(`/accounts/${account.id}/card`)}
          // `all: "unset"` resetea TODO, `box-sizing` incluido — sin el
          // `boxSizing: "border-box"` de acá, el navegador vuelve al
          // default (`content-box`), y con `width: 100%` + `padding: 16`
          // el botón termina 32px más ancho que su contenedor real. Mismo
          // patrón que el reset global de `globals.css`, pero `all: unset`
          // lo pisa localmente si no se lo repone.
          style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", display: "block", width: "100%", background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: 16 }}
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
        <ListRow icon="circle-half-tilt" label={t("accountsPage.detail.reconcile")} onClick={() => router.push(`/accounts/${account.id}/reconcile`)} />
        {accountRecurringCount > 0 ? (
          <ListRow icon="refresh" label={t("recurringPage.viewRecurring")} value={String(accountRecurringCount)} variant="value" onClick={() => router.push(`/recurring?accountId=${account.id}`)} />
        ) : null}
        {isCreditCard ? (
          <ListRow icon="credit-card" label={t("accountsPage.detail.payCard")} onClick={() => setPayCardSheetOpen(true)} />
        ) : (
          <ListRow icon="refresh" label={t("accountsPage.detail.transfer")} onClick={() => router.push("/add")} />
        )}
        {account.archivedAt !== null ? (
          <ListRow icon="undo" label={t("accountsPage.detail.unarchive")} onClick={handleUnarchive} />
        ) : (
          <ListRow icon="trash" label={t("accountsPage.detail.archive")} destructive onClick={handleArchive} />
        )}
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
            const cardPayment = isCardPayment(tx);
            const reconciliation = tx.kind === "adjustment";
            // Viendo esta transferencia desde el lado que la RECIBE (p. ej.
            // la tarjeta, en su propio listado de "Movimientos de esta
            // cuenta"): `tx.amount`/`tx.currencyCode` son lo que salió del
            // ORIGEN, no lo que entró acá — en un pago cross-currency ni
            // siquiera están en la moneda de esta cuenta. Lo que corresponde
            // mostrar es `counterAmount`/`counterCurrencyCode`.
            const viewingFromCounterSide = tx.accountId !== id && tx.counterAccountId === id;
            const displayValue = viewingFromCounterSide
              ? money(tx.counterAmount ?? tx.amount, tx.counterCurrencyCode ?? tx.currencyCode)
              : money(tx.kind === "expense" ? -tx.amount : tx.amount, tx.currencyCode);
            return (
              <TransactionRow
                key={tx.id}
                icon={(category?.icon as IconName) ?? (reconciliation ? "circle-half-tilt" : cardPayment ? "credit-card" : tx.kind === "transfer" ? "refresh" : "cart")}
                merchant={
                  category
                    ? categoryLabel(category)
                    : reconciliation
                      ? t("transactions.list.reconciliation")
                      : cardPayment
                        ? t("transactions.list.cardPayment")
                        : tx.kind === "transfer"
                          ? t("transactions.list.transfer")
                          : t("transactions.list.movement")
                }
                meta={formatNumericDate(locale, new Date(tx.occurredAt), dateFormat)}
                value={displayValue}
                polarity={tx.kind === "income" ? "positive" : tx.kind === "transfer" || tx.kind === "adjustment" ? "neutral" : "negative"}
                onClick={() => router.push(`/transactions/${tx.id}`)}
              />
            );
          })
        )}
      </div>

      {isCreditCard ? (
        <PayCardSheet
          open={payCardSheetOpen}
          card={account}
          accounts={allAccounts}
          expectedDue={dueAmount}
          installmentDebts={debtsForAccount}
          household={household}
          userId={userId ?? ""}
          numberLocale={numberLocaleForUiLocale(locale)}
          locale={locale}
          onClose={() => setPayCardSheetOpen(false)}
          onPaid={() => {
            invalidateAfterWrite();
            invalidateAccounts();
            invalidateStatements();
            invalidateDebts();
          }}
        />
      ) : null}
    </div>
  );
}
