"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { Amount, Button, DataList, EmptyState, ListRow, ProgressBar, Sheet, Skeleton, TransactionRow } from "@/design-system";

// C15/auditoría — ver el mismo comentario en `analytics/trends/page.tsx`.
const LineChart = dynamic(() => import("@/design-system/charts/LineChart").then((m) => m.LineChart), { ssr: false });
const ChartCard = dynamic(() => import("@/design-system/charts/ChartCard").then((m) => m.ChartCard), { ssr: false });
import type { IconName } from "@/design-system/core/Icon";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { useAccount, useAccounts, useInvalidateAccount, useInvalidateAccounts } from "@/hooks/use-accounts";
import { useAccountGroups } from "@/hooks/use-account-groups";
import { useCategories } from "@/hooks/use-categories";
import { useTransactions, useInvalidateAfterTransactionWrite } from "@/hooks/use-transactions";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useLatestCardStatement, useInvalidateCardStatements } from "@/hooks/use-card-statements";
import { useDebtsByAccount, useInvalidateDebts } from "@/hooks/use-debts";
import { useRecurringRules } from "@/hooks/use-recurring-rules";
import { useIsCardPayment } from "@/hooks/use-card-payment";
import { PayCardSheet } from "@/features/cards/PayCardSheet";
import { effectiveCardCycleConfig, expectedDueAmount, isCreditCardAccount } from "@/lib/analytics/card-cycle";
import { accountsRepo } from "@/lib/repos/accounts-repo";
import { computeAccountEvolution } from "@/lib/analytics/account-evolution";
import { fromMajorUnitsUnsafe, money } from "@/lib/money/money";
import { formatAmountCompact } from "@/lib/money/format";
import { formatNumericDate, numberLocaleForUiLocale } from "@/i18n/formatting";
import { useDateFormatPreference } from "@/stores/format-preferences-store";
import { ACCOUNT_KIND_MESSAGE_KEY } from "@/lib/reference/account-kind-labels";
import { COUNTRY_MESSAGE_KEY } from "@/lib/reference/countries-currencies";
import type { Locale } from "@/i18n/formatting";
import { useHouseholdsList } from "@/hooks/use-households-list";
import { moveAccountsRepo, type MovePreflight } from "@/lib/repos/move-accounts-repo";

// 90 días con muestreo diario (`account-evolution.ts`) daba 91 puntos —
// una lista larga sin mucho más para decir que "30 días" no diga ya:
// dentro de un mes es donde un movimiento puntual se lee bien contra el
// resto, y coincide con cómo se piensa "el mes" en el resto de la app.
const EVOLUTION_DAYS = 30;

/**
 * E2 (detalle + evolución) y E4 (resumen de tarjeta) — Bloque E, Fase 8.
 *
 * Recibe el `id` como prop, no como `params` de ruta: el detalle de cuenta
 * dejó de ser una ruta propia (`/accounts/[id]`) y pasó a ser una selección
 * dentro de `/accounts?account=<id>` — ver la nota larga en `page.tsx`. En
 * desktop se dibuja en la columna derecha al lado de la lista; en mobile
 * reemplaza a la lista en la misma pantalla.
 *
 * NO llama a `usePageHeader`: lo hace el contenedor (`page.tsx`). En
 * desktop la lista y el detalle están montados a la vez, y como
 * `usePageHeader` sobrescribe el config en cada render sin cleanup
 * (ver `design-system/nav/page-header-context.tsx`), los dos se pisaban el
 * header. El contenedor es el único que sabe cuál de los dos manda.
 */
export function AccountDetailContent({ id }: { id: string }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const dateFormat = useDateFormatPreference();
  const categoryLabel = useCategoryLabel();
  const router = useRouter();
  const userId = useEffectiveUserId();
  const { data: household } = useCurrentHousehold();
  const { data: account, isLoading } = useAccount(id);
  const { data: allAccounts = [] } = useAccounts(household?.id);
  const { data: accountGroups = [] } = useAccountGroups(household?.id);
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
  const queryClient = useQueryClient();
  const { data: households } = useHouseholdsList();
  const otherHouseholds = (households ?? []).filter((h) => h.id !== household?.id);
  const [moveSheetOpen, setMoveSheetOpen] = useState(false);
  const [movePreflighting, setMovePreflighting] = useState(false);
  const [moveConfirm, setMoveConfirm] = useState<{ targetHouseholdId: string; targetName: string; preflight: MovePreflight } | null>(null);
  const [moveApplying, setMoveApplying] = useState(false);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const evolution = useMemo(() => {
    if (!account) return [];
    const points = computeAccountEvolution({ account, transactions, windowDays: EVOLUTION_DAYS, now: new Date() });
    return points.map((p) => ({
      label: new Date(`${p.isoDate}T12:00:00Z`).toLocaleDateString(locale, { day: "2-digit", month: "short", timeZone: "UTC" }),
      value: p.value,
    }));
  }, [account, transactions, locale]);

  if (isLoading || !household) {
    return <Skeleton height={300} />;
  }
  if (!account) {
    return <EmptyState message={t("accountsPage.detail.notFound")} actionLabel={t("accountsPage.detail.backToList")} onAction={() => router.push("/accounts")} />;
  }

  const isCreditCard = isCreditCardAccount(account);
  const cardGroup = account.accountGroupId ? (accountGroups.find((g) => g.id === account.accountGroupId) ?? null) : null;
  // Tanda 4 — límite/ciclo pueden venir del grupo (multi-moneda) o de la
  // propia cuenta; `effectiveCardCycleConfig` decide cuál, una sola vez.
  const cardCycleConfig = isCreditCard ? effectiveCardCycleConfig(account, cardGroup) : null;
  const cycleTransactions = isCreditCard
    ? transactions.filter((t) => {
        if (!cardCycleConfig?.statementDay) return true;
        const cycleStart = new Date();
        cycleStart.setDate(cardCycleConfig.statementDay);
        if (cycleStart > new Date()) cycleStart.setMonth(cycleStart.getMonth() - 1);
        return t.occurredAt >= cycleStart.toISOString();
      })
    : [];
  const cycleTotal = cycleTransactions.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amount, 0n);

  const handleArchive = async () => {
    await accountsRepo.archive(account.id);
    // `await`: antes estas dos invalidaciones se disparaban sin esperar,
    // justo antes de cerrar el detalle — una carrera innecesaria. Se
    // invalidan las DOS keys: la lista (`useInvalidateAccounts`) y el
    // detalle puntual de esta cuenta (`useInvalidateAccount`, key
    // distinta) — sin la segunda, reabrir esta misma cuenta seguía
    // mostrando "Archivar" hasta un reload.
    await Promise.all([invalidateAccounts(), invalidateAccount()]);
    // `back()`, simétrico al `push` con el que se abrió el detalle desde
    // la lista (ver `page.tsx`): saca el `?account=` del historial en vez
    // de agregar otra entrada encima.
    router.back();
    toast(t("accountsPage.detail.archived"));
  };

  const handleUnarchive = async () => {
    await accountsRepo.unarchive(account.id);
    await Promise.all([invalidateAccounts(), invalidateAccount()]);
    router.back();
    toast(t("accountsPage.detail.unarchived"));
  };

  /**
   * "Sumar cuenta al grupo" (PR 5 del plan de multi-household) — mueve
   * ESTA cuenta con todo su historial a otro household del usuario. Un
   * preflight primero: si la cuenta tiene una transferencia sin cerrar, es
   * de inversión, o el household destino la rechaza por permiso, la RPC
   * tira una excepción con el motivo exacto (nunca "algo salió mal") y acá
   * se muestra tal cual — son mensajes ya pensados para la persona, no
   * para debug ("Hay transferencias con Banco — sumalas juntas").
   */
  const handlePickHousehold = async (targetHouseholdId: string, targetName: string) => {
    if (movePreflighting) return;
    setMovePreflighting(true);
    try {
      const preflight = await moveAccountsRepo.preflight([account.id], targetHouseholdId);
      setMoveSheetOpen(false);
      setMoveConfirm({ targetHouseholdId, targetName, preflight });
    } catch (err) {
      toast(err instanceof Error ? err.message : t("accountsPage.detail.moveError"));
    } finally {
      setMovePreflighting(false);
    }
  };

  const confirmMove = async () => {
    if (!moveConfirm || moveApplying) return;
    setMoveApplying(true);
    try {
      await moveAccountsRepo.apply([account.id], household.id, moveConfirm.targetHouseholdId);
      // Mueve la cuenta a OTRO household: prácticamente todos los
      // agregados de los dos hogares cambiaron (saldos, patrimonio,
      // presupuestos, categorías nuevas). Mismo criterio que el household
      // switcher y el cambio de moneda base — se limpia todo el cache en
      // vez de intentar invalidar cada key una por una.
      queryClient.clear();
      toast(t("accountsPage.detail.moved", { household: moveConfirm.targetName }));
      setMoveConfirm(null);
      router.back();
    } catch (err) {
      toast(err instanceof Error ? err.message : t("accountsPage.detail.moveError"));
    } finally {
      setMoveApplying(false);
    }
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
            // Muestreo diario (antes semanal, ver `account-evolution.ts`):
            // hasta 91 filas en una ventana de 90 días en vez de ~14 —
            // `DataList` no trae scroll propio, así que sin este tope la
            // tabla empujaba el resto de la pantalla hacia abajo.
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              <DataList
                columns={[
                  { key: "label", label: t("accountsPage.detail.evolutionDateColumn") },
                  { key: "value", label: t("accountsPage.detail.evolutionBalanceColumn") },
                ]}
                rows={evolution.map((p, i) => ({
                  label: p.label,
                  value: formatAmountCompact(money(fromMajorUnitsUnsafe(p.value, account.currencyCode), account.currencyCode), { showSign: false }),
                  emphasis: i === evolution.length - 1,
                }))}
              />
            </div>
          }
        >
          {/* Tarjeta de crédito: `computeAccountEvolution` (D66) YA invierte
              el signo — `evolution` trae el consumo positivo y creciendo
              (cero abajo, la deuda sube), para que tanto la tabla como este
              gráfico lean bien "cero, después cuánto se gastó". Un segundo
              `*-1` acá volvía a pasarlo a negativo-decreciente y dejaba la
              línea de base arriba con la deuda dibujándose hacia abajo —
              exactamente al revés de lo que se quiere leer. */}
          <LineChart
            data={evolution}
            formatValue={(v) => formatAmountCompact(money(fromMajorUnitsUnsafe(v, account.currencyCode), account.currencyCode), { showSign: false })}
          />
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
          {cardCycleConfig?.creditLimit && cardCycleConfig.limitCurrency === account.currencyCode ? (
            <>
              <ProgressBar value={Number(cycleTotal) / Number(cardCycleConfig.creditLimit)} />
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {t("accountsPage.detail.cycleOf", {
                  spent: formatAmountCompact(money(cycleTotal, account.currencyCode), { showSign: false }),
                  limit: formatAmountCompact(money(cardCycleConfig.creditLimit, account.currencyCode), { showSign: false }),
                })}
              </span>
            </>
          ) : (
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {t("accountsPage.detail.cycleConsumption", { amount: formatAmountCompact(money(cycleTotal, account.currencyCode), { showSign: false }) })}
            </span>
          )}
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {/* Tarjeta agrupada (`accountGroupId` no nulo): `account.statementDay`/
                `dueDay` son siempre `null` a propósito — el dato vive en el
                grupo, es el mismo plástico y el mismo corte para todas las
                monedas (ver CLAUDE.md § tarjetas agrupadas). `cardCycleConfig`
                ya resuelve el valor efectivo (grupo si hay, cuenta si no) —
                leer la columna cruda de la cuenta acá dejaba este texto vacío
                para cualquier tarjeta agrupada. */}
            {t("accountsPage.detail.cycleCloses", { statementDay: cardCycleConfig?.statementDay ?? "", dueDay: cardCycleConfig?.dueDay ?? "" })}
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
        {household.enabledModules.includes("family") && otherHouseholds.length > 0 && account.archivedAt === null ? (
          <ListRow icon="users" label={t("accountsPage.detail.moveToHousehold")} disabled={movePreflighting} onClick={() => setMoveSheetOpen(true)} />
        ) : null}
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
                icon={(category?.icon as IconName) ?? (tx.kind === "investing" ? "trend" : reconciliation ? "circle-half-tilt" : cardPayment ? "credit-card" : tx.kind === "transfer" ? "refresh" : "cart")}
                merchant={
                  category
                    ? categoryLabel(category)
                    : tx.kind === "investing"
                      ? (tx.note ?? t("transactions.list.investing"))
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
                polarity={tx.kind === "income" ? "positive" : tx.kind === "transfer" || tx.kind === "adjustment" || tx.kind === "investing" ? "neutral" : "negative"}
                onClick={() => router.push(`/transactions?tx=${tx.id}`)}
              />
            );
          })
        )}
      </div>

      {isCreditCard ? (
        <PayCardSheet
          open={payCardSheetOpen}
          card={account}
          cardGroup={cardGroup}
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

      <Sheet open={moveSheetOpen} title={t("accountsPage.detail.moveToHouseholdSheetTitle")} onClose={() => (movePreflighting ? null : setMoveSheetOpen(false))}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {otherHouseholds.map((h) => (
            <ListRow key={h.id} icon="users" label={h.name} disabled={movePreflighting} onClick={() => handlePickHousehold(h.id, h.name)} />
          ))}
        </div>
      </Sheet>

      {/* Excepción a "reversible, no confirmable" (CLAUDE.md) — mover una
          cuenta es confirmable e irreversible, igual que sacar a un
          miembro o cambiar la moneda base. Confirma con los números
          reales del preflight. */}
      <Sheet
        open={!!moveConfirm}
        title={moveConfirm ? t("accountsPage.detail.moveConfirmTitle", { household: moveConfirm.targetName }) : undefined}
        onClose={() => (moveApplying ? null : setMoveConfirm(null))}
      >
        {moveConfirm ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <p className="t-body" style={{ margin: 0, color: "var(--text-secondary)" }}>
              {t("accountsPage.detail.moveConfirmBody", { count: moveConfirm.preflight.transactionCount })}
            </p>
            {moveConfirm.preflight.newCategories + moveConfirm.preflight.newPayees + moveConfirm.preflight.newTags > 0 ? (
              <p className="t-caption" style={{ margin: 0, color: "var(--text-muted)" }}>
                {t("accountsPage.detail.moveConfirmNewEntities", {
                  total: moveConfirm.preflight.newCategories + moveConfirm.preflight.newPayees + moveConfirm.preflight.newTags,
                })}
              </p>
            ) : null}
            {moveConfirm.preflight.baseCurrencyMismatch ? (
              <p className="t-caption" style={{ margin: 0, color: "var(--text-muted)" }}>
                {t("accountsPage.detail.moveConfirmFxWarning", { from: moveConfirm.preflight.sourceBaseCurrency, to: moveConfirm.preflight.targetBaseCurrency })}
              </p>
            ) : null}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Button variant="primary" disabled={moveApplying} onClick={confirmMove}>
                {t("accountsPage.detail.moveConfirmAction")}
              </Button>
              <Button variant="ghost" disabled={moveApplying} onClick={() => setMoveConfirm(null)}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
