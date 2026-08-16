"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Amount, Card, DragRow, EmptyState, ErrorState, Icon, ListRow, Skeleton, SkeletonRow, StatusBadge, usePageHeader } from "@/design-system";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { useScrollOverflow } from "@/hooks/use-scroll-overflow";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccounts, useInvalidateAccounts } from "@/hooks/use-accounts";
import { useNetWorth } from "@/hooks/use-net-worth";
import { useQueryErrorState } from "@/hooks/use-query-error-state";
import { useTransactions } from "@/hooks/use-transactions";
import { useScopeStore } from "@/stores/scope-store";
import { accountMatchesScope } from "@/lib/scope/match-scope";
import { accountsRepo } from "@/lib/repos/accounts-repo";
import { money, zero } from "@/lib/money/money";
import { ACCOUNT_KIND_ICON, ACCOUNT_KIND_MESSAGE_KEY } from "@/lib/reference/account-kind-labels";
import { accountColorVar } from "@/lib/reference/account-colors";
import { COUNTRY_MESSAGE_KEY } from "@/lib/reference/countries-currencies";
import type { AccountRow } from "@/lib/db/schema";

/** CON-E01/LIB-13: reordena `group` y persiste `sortOrder` para las cuentas que cambiaron de posición. */
async function reorderAccounts(group: AccountRow[], fromIndex: number, toIndex: number, invalidate: () => void): Promise<void> {
  const next = [...group];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return;
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, moved);
  await Promise.all(next.map((a, i) => (a.sortOrder === i ? Promise.resolve() : accountsRepo.update(a.id, { sortOrder: i }))));
  invalidate();
}

export interface AccountsListContentProps {
  /** Cuenta cuyo detalle se está viendo (`?account=` en la URL) — la resalta
   *  en la lista. Lo pasa siempre `page.tsx`, que es el que lee el param. */
  activeId?: string | undefined;
}

/** E1 — lista de cuentas agrupada por moneda con subtotales. Bloque E, Fase 8. */
export function AccountsListContent({ activeId }: AccountsListContentProps) {
  const t = useTranslations();
  usePageHeader({ title: t("nav.accounts") });
  const router = useRouter();
  const { ref: scrollerRef, overflowing } = useScrollOverflow<HTMLDivElement>();
  const isDesktop = useIsDesktop();
  const { data: household } = useCurrentHousehold();
  const accountsQuery = useAccounts(household?.id);
  const { data: accounts, isLoading } = accountsQuery;
  const { data: transactions = [] } = useTransactions(household?.id);
  const errorState = useQueryErrorState(accountsQuery, { what: t("accountsPage.list.errorWhat") });
  const scope = useScopeStore((s) => s.scope);
  const scopedAccounts = useMemo(() => (accounts ?? []).filter((a) => accountMatchesScope(a.visibility, scope)), [accounts, scope]);
  const scopedAccountIds = useMemo(() => new Set(scopedAccounts.map((a) => a.id)), [scopedAccounts]);
  const netWorth = useNetWorth(household?.id, household?.baseCurrency, scopedAccounts, household?.enabledModules.includes("investments"));
  const invalidateAccounts = useInvalidateAccounts(household?.id);
  const pendingFxCount = transactions.filter((t) => t.fxRate === null && scopedAccountIds.has(t.accountId)).length;

  const baseCurrency = household?.baseCurrency ?? "UYU";
  const bySortOrder = (a: AccountRow, b: AccountRow) => a.sortOrder - b.sortOrder;
  const active = scopedAccounts.filter((a) => a.archivedAt === null).sort(bySortOrder);
  const archived = scopedAccounts.filter((a) => a.archivedAt !== null);
  const currencies = [...new Set(active.map((a) => a.currencyCode))];
  const simple = currencies.length <= 1;

  const byCurrency = new Map<string, AccountRow[]>();
  for (const a of active) {
    const list = byCurrency.get(a.currencyCode) ?? [];
    list.push(a);
    byCurrency.set(a.currencyCode, list);
  }
  const grouped = [...byCurrency.entries()].sort(([a], [b]) => (a === baseCurrency ? -1 : b === baseCurrency ? 1 : a.localeCompare(b)));

  // `netWorth.data.assets`/`.liabilities` — NUNCA un `reduce` a mano acá:
  // eso sumaba `currentBalance` de cuentas de monedas distintas tal cual,
  // sin convertir (una tarjeta en ARS se sumaba 1:1 como si fueran
  // dólares). `computeNetWorth` ya resuelve la MISMA tasa por cuenta que
  // usa el total de patrimonio — los subtotales tienen que salir de ahí.
  const assetsTotal = netWorth.data?.assets ?? zero(baseCurrency);
  const liabilitiesTotal = netWorth.data?.liabilities ?? zero(baseCurrency);

  if (!household || isLoading) {
    return (
      <div className="flex flex-col gap-1 pt-4">
        <Skeleton width={160} height={40} style={{ marginBottom: 16 }} />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }

  if (errorState) return <ErrorState {...errorState} />;

  if (active.length === 0) {
    return <EmptyState message={t("accountsPage.list.empty")} actionLabel={t("accountsPage.list.emptyAction")} onAction={() => router.push("/accounts/new")} />;
  }

  const renderGroup = (group: AccountRow[], trailing?: ReactNode) =>
    isDesktop ? (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {group.map((a, i) => (
          <DesktopAccountCard
            key={a.id}
            account={a}
            active={a.id === activeId}
            onClick={() => router.push(`/accounts?account=${a.id}`, { scroll: false })}
            onMoveUp={i > 0 ? () => reorderAccounts(group, i, i - 1, invalidateAccounts) : undefined}
            onMoveDown={i < group.length - 1 ? () => reorderAccounts(group, i, i + 1, invalidateAccounts) : undefined}
          />
        ))}
        {trailing}
      </div>
    ) : (
      <div>
        {group.map((a, i) => (
          <DragRow key={a.id} id={a.id} index={i} rowHeight={64} dragLabel={t("accountsPage.list.reorder", { name: a.name })} onReorder={(from, to) => reorderAccounts(group, from, to, invalidateAccounts)}>
            <AccountCard account={a} active={a.id === activeId} onClick={() => router.push(`/accounts?account=${a.id}`, { scroll: false })} />
          </DragRow>
        ))}
        {trailing}
      </div>
    );

  const newAccountCard = <NewAccountCard compact={!isDesktop} onClick={() => router.push("/accounts/new")} />;

  return (
    <div
      className="scroll-fade-bottom flex flex-col h-full"
      data-scroll-overflow={overflowing}
      style={{ "--scroll-fade-inset-right": "8px", minHeight: 0 } as CSSProperties}
    >
      <div style={{ flexShrink: 0, textAlign: "center", paddingTop: 16 }}>
        <span className="t-caption text-text-muted">{t("accountsPage.list.netWorth")}</span>
        {netWorth.data ? (
          <div className="mt-1">
            <Amount value={netWorth.data.netWorth} size="hero" fit showSign={false} polarity="neutral" />
          </div>
        ) : (
          <Skeleton width={140} height={32} style={{ margin: "4px auto 0" }} />
        )}
        <div className="flex justify-center gap-5 mt-2 text-text-secondary" style={{ fontSize: 13 }}>
          <span>
            {t("accountsPage.list.assets")} <Amount value={assetsTotal} size="label" showSign={false} polarity="neutral" tabular />
          </span>
          <span>
            {t("accountsPage.list.liabilities")} <Amount value={liabilitiesTotal} size="label" showSign={false} polarity="neutral" tabular />
          </span>
        </div>
      </div>

      <div
        ref={scrollerRef}
        // `scroll-gutter-right`: separa las tarjetas de la barra de scroll
        // nativa sin empujarla hacia adentro del borde real del viewport
        // (`globals.css`, D24). `lg:pb-8` (32px, no 0): aire real al final
        // de la lista, consumido por el fade de `scroll-fade-bottom` de
        // arriba en vez de que el fade tape directamente el último ítem.
        className="pb-[calc(var(--block-gap)_+_18px)] lg:pb-8 scroll-gutter-right"
        style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", display: "flex", flexDirection: "column", gap: 24, paddingTop: 24 }}
      >
        {!simple ? <ListRow icon="bank" label={t("accountsPage.list.currenciesAndRates")} onClick={() => router.push("/currencies")} /> : null}
        {pendingFxCount > 0 ? (
          <ListRow
            icon="alert"
            label={t("accountsPage.list.resolvePendingFx")}
            meta={t("accountsPage.list.pendingFxCount", { count: pendingFxCount })}
            onClick={() => router.push("/accounts/resolve-fx")}
          />
        ) : null}

        {simple ? (
          renderGroup(active, newAccountCard)
        ) : (
          grouped.map(([currency, group], i) => {
            const subtotal = group.reduce((s, a) => s + a.currentBalance, 0n);
            return (
              <div key={currency}>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="t-label text-text-secondary">{currency}</span>
                  <Amount value={money(subtotal, currency)} size="label" showSign={false} polarity="neutral" tabular />
                </div>
                {renderGroup(group, i === grouped.length - 1 ? newAccountCard : undefined)}
              </div>
            );
          })
        )}

        {archived.length > 0 ? (
          <div>
            <span className="t-label text-text-muted">{t("accountsPage.list.archived")}</span>
            {archived.map((a) => (
              <AccountCard key={a.id} account={a} onClick={() => router.push(`/accounts?account=${a.id}`, { scroll: false })} muted />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Tarjeta de cuenta para la grilla de escritorio (≥1024px) — `/dev/components`
 * la registra como pantalla-patrón nueva. Sin arrastre: en la grilla el
 * reorden es por menú (subir/bajar), porque `DragRow` asume índices 1-D y
 * una grilla es 2-D — ver la nota de la Fase 4 en el plan de auditoría
 * responsive. En móvil/tablet (`<1024px`) se sigue usando `DragRow`.
 */
function DesktopAccountCard({
  account,
  active = false,
  onClick,
  onMoveUp,
  onMoveDown,
}: {
  account: AccountRow;
  active?: boolean;
  onClick: () => void;
  onMoveUp?: (() => void) | undefined;
  onMoveDown?: (() => void) | undefined;
}) {
  const t = useTranslations();
  const usage = account.kind === "credit_card" && account.creditLimit ? Number(-account.currentBalance) / Number(account.creditLimit) : null;
  const iconBackground = accountColorVar(account.color);
  return (
    <Card
      bordered
      padding={16}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        cursor: "pointer",
        // Selección por superficie, mismo criterio que `AccountCarousel` —
        // el detalle abierto se resalta acá cuando esta lista se arma a
        // mano para el hard-reload de `/accounts/[id]` (ver `layout.tsx`).
        // Sin spread de `undefined`: pisaría el `background` default de
        // `Card` con `undefined` en vez de dejarlo sin tocar.
        ...(active ? { background: "var(--selection-surface)", boxShadow: "inset 0 0 0 1px var(--selection-ring)" } : null),
      }}
      onClick={onClick}
    >
      <div className="flex justify-between items-start">
        {iconBackground ? (
          <span style={{ width: 36, height: 36, borderRadius: 10, background: iconBackground, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name={ACCOUNT_KIND_ICON[account.kind]} size={18} color="#ffffff" />
          </span>
        ) : (
          <Icon name={ACCOUNT_KIND_ICON[account.kind]} size={22} color="var(--text-secondary)" />
        )}
        <div className="flex gap-0.5">
          <button
            type="button"
            aria-label={t("accountsPage.moveUp")}
            disabled={!onMoveUp}
            onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }}
            style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: 0, cursor: onMoveUp ? "pointer" : "default", opacity: onMoveUp ? 1 : 0.3 }}
          >
            <Icon name="chevron" size={16} color="var(--text-secondary)" style={{ transform: "rotate(-90deg)" }} />
          </button>
          <button
            type="button"
            aria-label={t("accountsPage.moveDown")}
            disabled={!onMoveDown}
            onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
            style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: 0, cursor: onMoveDown ? "pointer" : "default", opacity: onMoveDown ? 1 : 0.3 }}
          >
            <Icon name="chevron" size={16} color="var(--text-secondary)" style={{ transform: "rotate(90deg)" }} />
          </button>
        </div>
      </div>
      <div>
        <div className="t-body" style={{ fontWeight: 600, color: "var(--text-primary)" }}>{account.name}</div>
        <div className="t-caption text-text-muted">
          {t(ACCOUNT_KIND_MESSAGE_KEY[account.kind])}
          {account.countryCode && account.countryCode in COUNTRY_MESSAGE_KEY ? ` · ${t(COUNTRY_MESSAGE_KEY[account.countryCode as keyof typeof COUNTRY_MESSAGE_KEY])}` : ""}
        </div>
      </div>
      <Amount value={money(account.currentBalance, account.currencyCode)} size="body" showSign={false} polarity="neutral" tabular />
      {usage !== null ? (
        <StatusBadge status={usage >= 1 ? "critical" : usage >= 0.8 ? "warning" : "neutral"}>
          {t("accountsPage.list.creditLimitUsage", { percent: Math.round(usage * 100) })}
        </StatusBadge>
      ) : null}
    </Card>
  );
}

/**
 * Única acción primaria de la pantalla (presupuesto de ruido, `CLAUDE.md`)
 * — trazo violeta, fondo transparente (no relleno sólido: acá el violeta
 * marca la acción, no compite visualmente con el resto de las cards). Un
 * ítem más de la grilla/lista, mismo ancho que las cards vecinas. En
 * mobile, separado de la última cuenta con `marginTop` — sin eso quedaba
 * pegado, se leía como si fuera parte de la cuenta anterior.
 */
function NewAccountCard({ compact, onClick }: { compact: boolean; onClick: () => void }) {
  const t = useTranslations();
  // `border-style: dashed` no permite elegir el largo del trazo — el patrón
  // se dibuja a mano con un `<rect>` de SVG en el background, única forma de
  // controlar largo de guion / espacio junto con las esquinas redondeadas.
  // `#6d55f0` es `--violet-fill`, igual en claro y oscuro (globals.css).
  const radius = compact ? 16 : 20;
  const dashedBorder = `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%'><rect x='0' y='0' width='100%' height='100%' rx='${radius}' fill='none' stroke='#6d55f0' stroke-width='2.5' stroke-dasharray='14 9'/></svg>`,
  )}")`;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: compact ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: compact ? 12 : 8,
        border: "none",
        borderRadius: compact ? "var(--radius-button)" : "var(--radius-card)",
        backgroundColor: "transparent",
        backgroundImage: dashedBorder,
        cursor: "pointer",
        padding: compact ? 14 : 24,
        minHeight: compact ? "var(--primary-button-height)" : 140,
        width: "100%",
        marginTop: compact ? 40 : 0,
        color: "var(--primary-ink)",
      }}
    >
      <Icon name="plus" size={20} color="var(--primary-ink)" />
      <span style={{ fontSize: 15, fontWeight: 600, color: "var(--primary-ink)" }}>{t("accountsPage.list.newAccount")}</span>
    </button>
  );
}

function AccountCard({ account, active = false, onClick, muted = false }: { account: AccountRow; active?: boolean; onClick: () => void; muted?: boolean }) {
  const t = useTranslations();
  const usage = account.kind === "credit_card" && account.creditLimit ? Number(-account.currentBalance) / Number(account.creditLimit) : null;
  return (
    // El anillo faltaba acá y sí estaba en `DesktopAccountCard`: la superficie
    // sola da 1,24:1 contra surface-2 en modo claro (defecto 2 de
    // `docs/auditoria-visual.md`), o sea que la selección quedaba casi
    // invisible justo en la variante compacta. Mismo par de tokens que el
    // resto del sistema.
    <div
      style={{
        opacity: muted ? 0.55 : 1,
        borderRadius: "var(--radius-card)",
        ...(active ? { background: "var(--selection-surface)", boxShadow: "inset 0 0 0 1px var(--selection-ring)" } : null),
      }}
      {...(active ? { "aria-current": true as const } : {})}
    >
      <ListRow
        icon={ACCOUNT_KIND_ICON[account.kind]}
        iconBackground={accountColorVar(account.color)}
        label={account.name}
        meta={`${t(ACCOUNT_KIND_MESSAGE_KEY[account.kind])}${
          account.countryCode && account.countryCode in COUNTRY_MESSAGE_KEY
            ? ` · ${t(COUNTRY_MESSAGE_KEY[account.countryCode as keyof typeof COUNTRY_MESSAGE_KEY])}`
            : ""
        }`}
        value={
          <div style={{ textAlign: "right" }}>
            <Amount value={money(account.currentBalance, account.currencyCode)} size="body" showSign={false} polarity="neutral" tabular />
            {usage !== null ? (
              <div className="mt-0.5">
                <StatusBadge status={usage >= 1 ? "critical" : usage >= 0.8 ? "warning" : "neutral"}>
                  {t("accountsPage.list.creditLimitUsage", { percent: Math.round(usage * 100) })}
                </StatusBadge>
              </div>
            ) : null}
          </div>
        }
        onClick={onClick}
      />
    </div>
  );
}
