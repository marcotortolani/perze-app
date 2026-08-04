"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { Banner, Button, EmptyState, ErrorState, Icon, Skeleton, SkeletonRow, StatusBadge, TransactionRow, usePageHeader } from "@/design-system";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useScrollOverflow } from "@/hooks/use-scroll-overflow";
import type { Locale } from "@/i18n/formatting";
import type { IconName } from "@/design-system/core/Icon";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useIsCardPayment } from "@/hooks/use-card-payment";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import { useTags } from "@/hooks/use-tags";
import { useTransactionTagsFor } from "@/hooks/use-transaction-tags";
import { useInvalidateAfterTransactionWrite, useTransactions } from "@/hooks/use-transactions";
import { useQueryErrorState } from "@/hooks/use-query-error-state";
import { transactionsRepo } from "@/lib/repos/transactions-repo";
import { add, money, subtract, zero } from "@/lib/money/money";
import { formatAmountCompact } from "@/lib/money/format";
import { usePendingMutations } from "@/lib/offline";
import { SwipeableRow } from "@/features/movements/SwipeableRow";
import { useDeleteTransactionWithUndo } from "@/features/movements/use-delete-transaction";
import { countActiveFilters, defaultMovementsFilters, MovementsFiltersSheet, type MovementsFilters } from "@/features/movements/MovementsFiltersSheet";
import type { AccountRow, TransactionRow as TransactionRecord } from "@/lib/db/schema";

type ListItem = { type: "header"; date: string; total: bigint; currency: string } | { type: "row"; tx: TransactionRecord };

function periodStartFor(preset: MovementsFilters["datePreset"], now: Date): { from?: string; to?: string } {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  switch (preset) {
    case "this-month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString() };
    case "last-month":
      return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString(), to: new Date(now.getFullYear(), now.getMonth(), 1).toISOString() };
    case "last-7":
      return { from: startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)).toISOString() };
    case "last-30":
      return { from: startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)).toISOString() };
    default:
      return {};
  }
}

/**
 * `merchant` (arriba, en `<TransactionRow>`) ya muestra el nombre de la
 * categoría cuando no hay comercio cargado — repetirla acá abajo es
 * redundante. Con etiquetas, esta línea las muestra a ELLAS en vez de la
 * categoría (que el ícono + el título ya cubren); sin etiquetas, sigue
 * mostrando la categoría como siempre.
 */
function buildMeta(tx: TransactionRecord, account: AccountRow | undefined, categoryLabel: string | undefined, transferLabel: string, tagNames: string[], reconciliationLabel: string): string {
  if (tx.kind === "transfer") return account ? `${account.name} · ${transferLabel}` : transferLabel;
  if (tx.kind === "adjustment") return account ? `${account.name} · ${reconciliationLabel}` : reconciliationLabel;
  const secondary = tagNames.length > 0 ? tagNames.join(", ") : categoryLabel;
  return [account?.name, secondary].filter(Boolean).join(" · ");
}

/** D1/D2/D6/D7 — lista de movimientos. Bloque D, Fase 7. Export nombrado, no solo default: `layout.tsx` la reusa para el hard-reload de `/transactions/[id]` (ver la nota ahí). */
export function MovementsListContent() {
  const t = useTranslations();
  usePageHeader({ title: t("nav.movements") });
  const locale = useLocale() as Locale;
  const categoryLabel = useCategoryLabel();
  const router = useRouter();
  const { ref: fadeScrollerRef, overflowing } = useScrollOverflow<HTMLDivElement>();
  const searchParams = useSearchParams();
  const { data: household } = useCurrentHousehold();
  const isCardPayment = useIsCardPayment(household?.id);
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts(household?.id);
  const { data: categories = [] } = useCategories(household?.id);
  const { data: tags = [] } = useTags(household?.id);
  const transactionsQuery = useTransactions(household?.id);
  const { data: transactions, isLoading: txLoading } = transactionsQuery;
  const { data: transactionTagLinks } = useTransactionTagsFor((transactions ?? []).map((tx) => tx.id));
  const tagById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);
  const tagIdsByTx = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const link of transactionTagLinks ?? []) {
      map.set(link.transactionId, [...(map.get(link.transactionId) ?? []), link.tagId]);
    }
    return map;
  }, [transactionTagLinks]);
  const tagNamesByTx = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [transactionId, tagIds] of tagIdsByTx) {
      const names = tagIds.map((tagId) => tagById.get(tagId)?.name).filter((name): name is string => !!name);
      if (names.length > 0) map.set(transactionId, names);
    }
    return map;
  }, [tagIdsByTx, tagById]);
  const invalidateTransactions = useInvalidateAfterTransactionWrite(household?.id);
  const deleteTransaction = useDeleteTransactionWithUndo(household?.id);
  const errorState = useQueryErrorState(transactionsQuery, { what: t("transactions.list.errorWhat") });
  const pending = usePendingMutations();

  const [filters, setFilters] = useState<MovementsFilters>(defaultMovementsFilters());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selection, setSelection] = useState<Set<string> | null>(null);

  // Resultados del buscador flotante (`?category=` / `?payee=`) aterrizan
  // acá ya filtrados en vez de en una lista sin filtrar — ver `SearchOverlay`.
  const categoryIdParam = searchParams.get("category");
  const payeeIdParam = searchParams.get("payee");
  // Home ("gastado"/"ingresado este período") linkea acá con el tipo y el
  // rango del período del household ya resueltos — `from`/`to` puentean el
  // sistema de presets (que no conoce el `periodStartDay` del household)
  // en vez de forzar un preset nuevo solo para este deep link.
  const kindParam = searchParams.get("kind");
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  // Home ("Tenés N movimientos sin tipo de cambio resuelto") linkea acá
  // con `?pending=1` — reusa `filters.onlyPending`, que ya filtra por
  // `fxRate === null` (el nombre del campo es viejo, de antes de que
  // `onlyPending` significara "needs_fx" y no "sync pendiente" — no se
  // renombra en este cambio para no tocar de más).
  const pendingFxParam = searchParams.get("pending");
  useEffect(() => {
    if (!categoryIdParam && !kindParam && !pendingFxParam) return;
    setFilters((f) => {
      const nextCategoryIds = categoryIdParam && !f.categoryIds.includes(categoryIdParam) ? [categoryIdParam] : f.categoryIds;
      const nextKind = kindParam === "expense" || kindParam === "income" || kindParam === "transfer" || kindParam === "adjustment" ? kindParam : f.kind;
      const nextOnlyPending = pendingFxParam === "1" ? true : f.onlyPending;
      if (nextCategoryIds === f.categoryIds && nextKind === f.kind && nextOnlyPending === f.onlyPending) return f;
      return { ...f, categoryIds: nextCategoryIds, kind: nextKind, onlyPending: nextOnlyPending };
    });
  }, [categoryIdParam, kindParam, pendingFxParam]);

  const accountById = useMemo(() => new Map(accounts.map((a: AccountRow) => [a.id, a])), [accounts]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const now = new Date();
  const { from, to } = fromParam ? { from: fromParam, to: toParam ?? undefined } : periodStartFor(filters.datePreset, now);

  const filtered = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter((t) => {
      if (from && t.occurredAt < from) return false;
      if (to && t.occurredAt >= to) return false;
      if (filters.kind !== "all" && t.kind !== filters.kind) return false;
      if (filters.accountIds.length > 0 && !filters.accountIds.includes(t.accountId)) return false;
      if (filters.categoryIds.length > 0 && (!t.categoryId || !filters.categoryIds.includes(t.categoryId))) return false;
      if (filters.tagIds.length > 0) {
        const txTagIds = tagIdsByTx.get(t.id) ?? [];
        if (!filters.tagIds.some((id) => txTagIds.includes(id))) return false;
      }
      if (filters.onlyPending && t.fxRate !== null) return false;
      if (payeeIdParam && t.payeeId !== payeeIdParam) return false;
      return true;
    });
  }, [transactions, from, to, filters, payeeIdParam, tagIdsByTx]);

  // Ingresos/Gastos/Balance son el resumen del PERÍODO, no de lo que se ve
  // en la lista — solo respetan el rango de fecha (mismo concepto que
  // "gastado este período" del home). Los demás filtros (tipo, cuenta,
  // categoría, pendientes) narrowean qué se MUESTRA en la lista, y no
  // tienen por qué vaciar "ingresos" a 0 cuando el filtro activo es "gasto".
  const dateFiltered = useMemo(() => {
    if (!transactions) return [];
    return transactions.filter((t) => {
      if (from && t.occurredAt < from) return false;
      if (to && t.occurredAt >= to) return false;
      return true;
    });
  }, [transactions, from, to]);

  const baseCurrency = household?.baseCurrency ?? "UYU";
  let periodIncome = zero(baseCurrency);
  let periodExpense = zero(baseCurrency);
  for (const t of dateFiltered) {
    if (t.kind === "transfer" || t.amountBase === null) continue;
    const m = money(t.amountBase, baseCurrency);
    if (t.kind === "income") periodIncome = add(periodIncome, m);
    else if (t.kind === "expense") periodExpense = add(periodExpense, m);
  }
  const periodBalance = subtract(periodIncome, periodExpense);

  const items = useMemo<ListItem[]>(() => {
    const byDay = new Map<string, TransactionRecord[]>();
    for (const t of filtered) {
      const day = t.occurredAt.slice(0, 10);
      const list = byDay.get(day) ?? [];
      list.push(t);
      byDay.set(day, list);
    }
    const days = [...byDay.keys()].sort((a, b) => (a < b ? 1 : -1));
    const result: ListItem[] = [];
    for (const day of days) {
      const dayTx = byDay.get(day)!;
      const dayTotal = dayTx.reduce((s, t) => (t.kind === "transfer" || t.amountBase === null ? s : s + (t.kind === "income" ? t.amountBase : -t.amountBase)), 0n);
      result.push({ type: "header", date: day, total: dayTotal, currency: baseCurrency });
      for (const t of dayTx) result.push({ type: "row", tx: t });
    }
    return result;
  }, [filtered, baseCurrency]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (items[i]?.type === "header" ? 40 : 68),
    overscan: 8,
  });

  const handleDelete = (tx: TransactionRecord) => deleteTransaction(tx.id);

  const toggleSelected = (id: string) => {
    setSelection((s) => {
      const next = new Set(s ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // C24 — secuencial, no `Promise.all`: cada `softDelete`/`restore` dispara
  // un `applyBalanceDelta` sobre la MISMA cuenta cuando dos movimientos
  // seleccionados comparten `accountId` (el caso común). En paralelo, dos
  // lecturas de `current_balance` pueden pisarse (read-modify-write sin
  // lock) y perder un delta. Uno por uno es más lento pero nunca corrompe
  // el saldo.
  const handleBulkDelete = async () => {
    if (!selection) return;
    const ids = [...selection];
    for (const id of ids) {
      await transactionsRepo.softDelete(id);
    }
    invalidateTransactions();
    setSelection(null);
    toast(t("transactions.list.deletedBulk", { count: ids.length }), {
      duration: 5000,
      action: {
        label: t("transactions.list.undo"),
        onClick: async () => {
          for (const id of ids) {
            await transactionsRepo.restore(id);
          }
          invalidateTransactions();
        },
      },
    });
  };

  if (!household || accountsLoading || txLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 16 }}>
        <Skeleton width={220} height={16} style={{ marginBottom: 12 }} />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }

  if (errorState) return <ErrorState {...errorState} />;

  if ((transactions ?? []).length === 0) {
    return <EmptyState message={t("transactions.list.empty")} actionLabel={t("transactions.list.emptyAction")} onAction={() => router.push("/add")} />;
  }

  const activeFilterCount = countActiveFilters(filters);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, paddingTop: 12 }}>
      {pending && pending > 0 ? (
        <Banner status="offline" pending={pending} style={{ margin: "0 calc(-1 * var(--screen-padding)) 12px", borderRadius: 0, flexShrink: 0 }} />
      ) : null}
      <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 12, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-chip)", padding: "8px 14px", cursor: "pointer" }}
        >
          <Icon name="filter" size={16} color="var(--text-secondary)" />
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{t("transactions.list.filters")}</span>
          {activeFilterCount > 0 ? <StatusBadge status="good">{activeFilterCount}</StatusBadge> : null}
        </button>
        <button
          type="button"
          // `window.location` en vez de `router.push`/`Link`:
          // `/transactions/calendar` es hermana de `[id]` bajo el mismo
          // directorio que intercepta `@detail/(.)[id]` — cualquier
          // navegación blanda hacia ahí desde dentro de `/transactions/*`
          // la agarra el interceptor (trata "calendar" como si fuera un
          // id), sin importar que exista una página estática con ese
          // nombre. Forzar una recarga completa es lo que evita esa
          // intercepción.
          onClick={() => { window.location.href = "/transactions/calendar"; }}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface-2)", border: 0, borderRadius: "var(--radius-chip)", padding: "8px 14px", cursor: "pointer" }}
        >
          <Icon name="calendar" size={16} color="var(--text-secondary)" />
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{t("transactions.list.calendar")}</span>
        </button>
        <div style={{ flex: 1 }} />
        {selection ? (
          <button type="button" onClick={() => setSelection(null)} style={{ background: "none", border: 0, color: "var(--primary-ink)", fontSize: 13, cursor: "pointer" }}>
            {t("transactions.list.cancel")}
          </button>
        ) : null}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("transactions.list.income")}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--money-positive)" }}>{formatAmountCompact(periodIncome, { showSign: false })}</div>
        </div>
        <div>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("transactions.list.expenses")}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--text-primary)" }}>{formatAmountCompact(periodExpense, { showSign: false })}</div>
        </div>
        <div>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("transactions.list.balance")}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--text-primary)" }}>{formatAmountCompact(periodBalance, { showSign: true })}</div>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState message={t("transactions.list.emptyFiltered")} actionLabel={t("transactions.list.clearFilters")} onAction={() => setFilters(defaultMovementsFilters())} />
      ) : (
        // Wrapper propio para el fade: el scroller de abajo ya usa su
        // `position:relative` para el virtualizador (anclar las filas
        // absolutas), así que `scroll-fade-bottom` no puede ir ahí — necesita
        // un contenedor no-scrolleable distinto. No puede ir en el root de la
        // página tampoco: la barra de selección múltiple y el sheet de
        // filtros son hermanos posteriores fuera de este `ternary`, y el fade
        // no debe taparlos.
        <div className="scroll-fade-bottom" data-scroll-overflow={overflowing} style={{ "--scroll-fade-inset-right": "8px", flex: 1, minHeight: 0 } as CSSProperties}>
          <div
            // Un solo nodo, dos consumidores: el virtualizador necesita
            // `parentRef` para medir el scroll; `useScrollOverflow` necesita
            // el mismo nodo para comparar `scrollHeight`/`clientHeight`. Un
            // `ref` de React solo acepta un valor, así que un callback ref
            // asigna `parentRef.current` y además reenvía el nodo al
            // callback ref que devuelve el hook.
            ref={(node) => {
              parentRef.current = node;
              fadeScrollerRef(node);
            }}
            className="pb-[calc(var(--block-gap)+18px)] lg:pb-8"
            // `paddingRight`: separa el texto/monto de la barra de scroll,
            // que si no queda pegada contra el borde del contenido en
            // desktop. `lg:pb-8` (32px, no 0): aire real al final de la
            // lista para el fade de arriba, igual que en `/accounts`.
            style={{ height: "100%", minHeight: 0, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", position: "relative", paddingRight: 8 }}
          >
            <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
              const item = items[virtualRow.index];
              if (!item) return null;
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${virtualRow.start}px)` }}
                >
                  {item.type === "header" ? (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "16px 0 6px", background: "var(--page)" }}>
                      <span className="t-label" style={{ color: "var(--text-secondary)" }}>
                        {new Date(`${item.date}T00:00:00`).toLocaleDateString(locale, { weekday: "short", day: "2-digit", month: "short" })}
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: item.total >= 0n ? "var(--money-positive)" : "var(--text-muted)" }}>
                        {formatAmountCompact(money(item.total, item.currency), { showSign: true })}
                      </span>
                    </div>
                  ) : (
                    <SwipeableRow
                      disabled={!!selection}
                      onSwipeLeftCommit={() => handleDelete(item.tx)}
                      onSwipeRightCommit={() => router.push(`/transactions/${item.tx.id}/edit`)}
                      onLongPress={() => setSelection(new Set([item.tx.id]))}
                      confirmLabel={t("transactions.list.confirmDelete")}
                      confirmActionLabel={t("transactions.list.confirmDeleteAction")}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {selection ? (
                          <input
                            type="checkbox"
                            checked={selection.has(item.tx.id)}
                            onChange={() => toggleSelected(item.tx.id)}
                            style={{ width: 20, height: 20, flexShrink: 0, accentColor: "var(--primary-fill)" }}
                          />
                        ) : null}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <TransactionRow
                            icon={(categoryById.get(item.tx.categoryId ?? "")?.icon as IconName) ?? (item.tx.kind === "adjustment" ? "target" : isCardPayment(item.tx) ? "credit-card" : item.tx.kind === "transfer" ? "refresh" : "cart")}
                            merchant={
                              (item.tx.categoryId ? categoryById.get(item.tx.categoryId) : undefined)
                                ? categoryLabel(categoryById.get(item.tx.categoryId!)!)
                                : item.tx.kind === "adjustment"
                                  ? t("transactions.list.reconciliation")
                                  : isCardPayment(item.tx)
                                    ? t("transactions.list.cardPayment")
                                    : item.tx.kind === "transfer"
                                      ? t("transactions.list.transfer")
                                      : t("transactions.list.movement")
                            }
                            meta={buildMeta(
                              item.tx,
                              accountById.get(item.tx.accountId),
                              item.tx.categoryId ? (categoryById.has(item.tx.categoryId) ? categoryLabel(categoryById.get(item.tx.categoryId)!) : undefined) : undefined,
                              isCardPayment(item.tx) ? t("transactions.list.cardPayment") : t("transactions.list.transfer"),
                              tagNamesByTx.get(item.tx.id) ?? [],
                              t("transactions.list.reconciliation")
                            )}
                            value={money(item.tx.kind === "expense" ? -item.tx.amount : item.tx.amount, item.tx.currencyCode)}
                            secondary={
                              item.tx.currencyCode !== baseCurrency && item.tx.amountBase !== null
                                ? formatAmountCompact(money(item.tx.amountBase, baseCurrency), { showSign: false })
                                : undefined
                            }
                            polarity={item.tx.kind === "income" ? "positive" : item.tx.kind === "transfer" || item.tx.kind === "adjustment" ? "neutral" : "negative"}
                            syncIssue={item.tx.syncState === "ok" ? undefined : item.tx.syncState}
                            onClick={() => (selection ? toggleSelected(item.tx.id) : router.push(`/transactions/${item.tx.id}`))}
                          />
                        </div>
                      </div>
                    </SwipeableRow>
                  )}
                </div>
              );
            })}
          </div>
          </div>
        </div>
      )}

      {selection && selection.size > 0 ? (
        <div style={{ position: "sticky", bottom: 0, display: "flex", gap: 12, padding: "12px 0", background: "var(--page)" }}>
          <Button variant="danger" fullWidth={false} onClick={handleBulkDelete} style={{ flex: 1 }}>
            {t("transactions.list.deleteCount", { count: selection.size })}
          </Button>
          <Button
            variant="secondary"
            fullWidth={false}
            onClick={() => toast(t("transactions.list.categorizeComingSoon"))}
            style={{ flex: 1 }}
          >
            {t("transactions.list.categorize")}
          </Button>
        </div>
      ) : null}

      <MovementsFiltersSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onChange={setFilters}
        accounts={accounts}
        categories={categories}
        tags={tags}
        resultCount={filtered.length}
      />
    </div>
  );
}

export default function MovementsPage() {
  return <MovementsListContent />;
}
