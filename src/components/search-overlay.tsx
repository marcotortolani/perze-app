"use client";

import { useDeferredValue, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Overlay } from "@/design-system";
import { Icon, type IconName } from "@/design-system/core/Icon";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import { usePayees } from "@/hooks/use-payees";
import { useTransactions } from "@/hooks/use-transactions";
import { useRecurringRules } from "@/hooks/use-recurring-rules";
import { useTags } from "@/hooks/use-tags";
import { useTransactionTagsFor } from "@/hooks/use-transaction-tags";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useOwnAccess } from "@/hooks/use-own-access";
import { money } from "@/lib/money/money";
import { formatAmountCompact } from "@/lib/money/format";
import { normalize, scoreMatch, searchAll, type Searchable, type SearchResult } from "@/lib/search/rank";

interface QuickAction {
  id: string;
  label: string;
  route: string;
}

/**
 * Buscador flotante — reemplaza la navegación a `/search` y el ⌘K de
 * `command-palette.tsx` (borrado, unificado acá): misma superficie para
 * las dos entradas, misma lógica de ranking (`searchAll`), mismos hrefs
 * correctos a detalle (`/transactions?tx={id}`, `/accounts?account={id}`) en
 * vez de a la lista. Cablear desde `(app)/layout.tsx`.
 */
export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations();
  const router = useRouter();
  const categoryLabel = useCategoryLabel();
  const { data: household } = useCurrentHousehold();
  const { data: accounts = [] } = useAccounts(household?.id);
  const { data: categories = [] } = useCategories(household?.id);
  const { data: payees = [] } = usePayees(household?.id);
  const { data: transactions = [] } = useTransactions(household?.id);
  // Gateado por `enabled_modules` pasando `undefined` cuando el módulo está
  // apagado — el hook ya trae `enabled: !!householdId`, así que no dispara
  // ninguna query (`recurringRulesRepo.list` nunca se llama).
  const { data: recurringRules = [] } = useRecurringRules(household?.enabledModules.includes("recurring") ? household.id : undefined);
  const { data: tags = [] } = useTags(household?.id);
  const { data: transactionTagLinks = [] } = useTransactionTagsFor(transactions.map((tx) => tx.id));
  const ownAccess = useOwnAccess();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const tagById = useMemo(() => new Map(tags.map((tg) => [tg.id, tg])), [tags]);
  const recurringRuleById = useMemo(() => new Map(recurringRules.map((r) => [r.id, r])), [recurringRules]);
  const tagIdsByTx = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const link of transactionTagLinks) {
      map.set(link.transactionId, [...(map.get(link.transactionId) ?? []), link.tagId]);
    }
    return map;
  }, [transactionTagLinks]);

  /**
   * D30 — antes eran 6 atajos fijos, así que buscar "grup" (Grupo familiar)
   * o "seguridad" no encontraba nada aunque la palabra estuviera literal en
   * el nombre de la pantalla: la sección ni siquiera estaba en la lista.
   * Este es el mismo inventario de `/more` (con el mismo gating por
   * `enabled_modules`/admin), para que el buscador cubra cualquier sección
   * de la app y no solo movimientos/cuentas/categorías/comercios.
   */
  const quickActions: QuickAction[] = useMemo(() => {
    const modules = household?.enabledModules ?? [];
    const items: QuickAction[] = [
      { id: "add", label: t("search.actions.add"), route: "/add" },
      { id: "home", label: t("search.actions.home"), route: "/" },
      { id: "movements", label: t("search.actions.movements"), route: "/transactions" },
      { id: "accounts", label: t("search.actions.accounts"), route: "/accounts" },
      { id: "analytics", label: t("search.actions.analytics"), route: "/analytics" },
      { id: "more", label: t("search.actions.more"), route: "/more" },
      { id: "categories", label: t("morePage.categories"), route: "/more/categories" },
      { id: "tagsAndPayees", label: t("morePage.tagsAndPayees"), route: "/more/tags" },
      { id: "rules", label: t("morePage.rules"), route: "/more/rules" },
      { id: "currencies", label: t("settingsPage.fxSources"), route: "/currencies" },
      { id: "profile", label: t("morePage.profile"), route: "/more/profile" },
      { id: "security", label: t("morePage.security"), route: "/more/security" },
      { id: "notifications", label: t("notificationsPage.title"), route: "/more/notifications" },
      { id: "sync", label: t("syncDiagnosticsPage.title"), route: "/more/sync" },
      { id: "settings", label: t("morePage.settings"), route: "/more/settings" },
      { id: "data", label: t("morePage.dataAndBackup"), route: "/more/data" },
      { id: "about", label: t("morePage.about"), route: "/more/about" },
    ];
    if (modules.includes("budgets")) items.push({ id: "budgets", label: t("morePage.budgets"), route: "/budgets" });
    if (modules.includes("goals")) items.push({ id: "goals", label: t("morePage.goals"), route: "/goals" });
    if (modules.includes("recurring")) items.push({ id: "recurring", label: t("morePage.recurring"), route: "/recurring" });
    if (modules.includes("debts")) items.push({ id: "debts", label: t("morePage.debts"), route: "/debts" });
    if (modules.includes("investments")) items.push({ id: "investments", label: t("nav.investments"), route: "/investments" });
    if (modules.includes("family")) items.push({ id: "family", label: t("morePage.family"), route: "/family" });
    if (ownAccess?.isAppAdmin) items.push({ id: "admin", label: t("adminPage.title"), route: "/more/admin" });
    return items;
  }, [t, household?.enabledModules, ownAccess?.isAppAdmin]);

  const index = useMemo<Searchable[]>(() => {
    const items: Searchable[] = [];
    for (const a of accounts) {
      items.push({ id: a.id, group: "accounts", title: a.name, subtitle: a.currencyCode, href: `/accounts?account=${a.id}`, icon: "wallet" });
    }
    for (const c of categories) {
      const label = categoryLabel(c);
      items.push({ id: c.id, group: "categories", title: label, href: `/transactions?category=${c.id}`, icon: c.icon });
    }
    for (const p of payees) {
      items.push({ id: p.id, group: "payees", title: p.name, href: `/transactions?payee=${p.id}`, icon: "storefront" });
    }
    for (const tg of tags) {
      items.push({ id: tg.id, group: "tags", title: tg.name, href: `/transactions?tag=${tg.id}`, icon: "tag" });
    }
    for (const tx of transactions) {
      const category = tx.categoryId ? categoryById.get(tx.categoryId) : undefined;
      const title = category ? categoryLabel(category) : (tx.note ?? t("search.noNote"));
      const txTagNames = (tagIdsByTx.get(tx.id) ?? []).map((tagId) => tagById.get(tagId)?.name).filter((name): name is string => !!name);
      // El recurrente que originó este movimiento también puntúa sin
      // mostrarse en la fila, mismo criterio que los tags (D30) — "Alquiler"
      // tiene que encontrar el gasto de Housing que generó esa regla,
      // aunque la categoría no diga "Alquiler" en ningún lado.
      const recurringRuleName = tx.recurringId ? recurringRuleById.get(tx.recurringId)?.name : undefined;
      const txKeywords = [...txTagNames, ...(recurringRuleName ? [recurringRuleName] : [])];
      items.push({
        id: tx.id,
        group: "transactions",
        title,
        subtitle: tx.note && category ? tx.note : undefined,
        meta: formatAmountCompact(money(tx.amount, tx.currencyCode), { showSign: false }),
        href: `/transactions?tx=${tx.id}`,
        icon: (category?.icon as string) ?? "cart",
        sortKey: tx.occurredAt,
        keywords: txKeywords.length > 0 ? txKeywords : undefined,
      });
    }
    for (const r of recurringRules) {
      if (r.archivedAt !== null) continue;
      items.push({
        id: r.id,
        group: "recurring",
        title: r.name,
        meta: formatAmountCompact(money(r.expectedAmount, r.currencyCode), { showSign: false }),
        href: `/recurring/${r.id}`,
        icon: "refresh",
      });
    }
    return items;
  }, [accounts, categories, payees, tags, transactions, recurringRules, categoryById, categoryLabel, tagById, tagIdsByTx, recurringRuleById, t]);

  const results = useMemo(() => searchAll(deferredQuery, index), [deferredQuery, index]);
  const filteredActions = useMemo(() => {
    const needle = normalize(deferredQuery);
    if (!needle) return quickActions;
    // Mismo criterio que `searchAll` (acento-insensible, prefijo de
    // palabra) en vez de un `includes` crudo — así "seguridad" sin tilde
    // encuentra "Seguridad", igual que en movimientos/cuentas.
    return quickActions
      .map((a) => ({ action: a, score: scoreMatch(normalize(a.label), needle) }))
      .filter((x): x is { action: QuickAction; score: number } => x.score !== null)
      .sort((x, y) => y.score - x.score)
      .map((x) => x.action);
  }, [quickActions, deferredQuery]);

  const flatOptions = useMemo(
    () => [...filteredActions.map((a) => ({ kind: "action" as const, action: a })), ...results.map((r) => ({ kind: "result" as const, result: r }))],
    [filteredActions, results]
  );

  const go = (route: string) => {
    setQuery("");
    setActiveIndex(0);
    onClose();
    router.push(route);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatOptions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const chosen = flatOptions[activeIndex];
      if (!chosen) return;
      go(chosen.kind === "action" ? chosen.action.route : chosen.result.href);
    }
  };

  const groups: { key: SearchResult["group"]; label: string }[] = [
    { key: "transactions", label: t("search.transactions") },
    { key: "recurring", label: t("search.recurring") },
    { key: "accounts", label: t("search.accounts") },
    { key: "categories", label: t("search.categories") },
    { key: "payees", label: t("search.merchants") },
    { key: "tags", label: t("search.tags") },
  ];

  return (
    <Overlay open={open} onClose={onClose} labelledBy="search-overlay-title">
      <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <span id="search-overlay-title" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>
          {t("search.title")}
        </span>
        <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <Icon name="search" size={18} color="var(--text-muted)" style={{ marginLeft: 16 }} />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder={t("search.placeholder")}
            style={{ flex: 1, height: 56, padding: "0 16px", border: 0, background: "none", fontSize: 16, color: "var(--text-primary)", outline: "none" }}
          />
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 8 }}>
          {!deferredQuery.trim() ? (
            <ResultGroup label={t("search.groupActions")}>
              {filteredActions.map((action, i) => (
                <ResultRow key={action.id} label={action.label} icon="chevron" active={i === activeIndex} onClick={() => go(action.route)} />
              ))}
            </ResultGroup>
          ) : results.length === 0 && filteredActions.length === 0 ? (
            <p style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>{t("search.noResults", { query })}</p>
          ) : (
            <>
              {filteredActions.length > 0 ? (
                <ResultGroup label={t("search.groupActions")}>
                  {filteredActions.map((action, i) => (
                    <ResultRow key={action.id} label={action.label} icon="chevron" active={i === activeIndex} onClick={() => go(action.route)} />
                  ))}
                </ResultGroup>
              ) : null}
              {groups.map((group) => {
                const groupResults = results.filter((r) => r.group === group.key);
                if (groupResults.length === 0) return null;
                return (
                  <ResultGroup key={group.key} label={group.label} count={groupResults.length}>
                    {groupResults.map((r) => {
                      const flatIndex = filteredActions.length + results.indexOf(r);
                      return (
                        <ResultRow
                          key={r.id}
                          label={r.title}
                          meta={r.meta}
                          icon={r.icon as IconName}
                          active={flatIndex === activeIndex}
                          onClick={() => go(r.href)}
                        />
                      );
                    })}
                  </ResultGroup>
                );
              })}
            </>
          )}
        </div>
      </div>
    </Overlay>
  );
}

function ResultGroup({ label, count, children }: { label: string; count?: number | undefined; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ padding: "8px 12px 4px", fontSize: 11, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text-muted)" }}>
        {label}
        {count !== undefined ? ` · ${count}` : ""}
      </div>
      {children}
    </div>
  );
}

function ResultRow({ label, meta, icon, active, onClick }: { label: string; meta?: string | undefined; icon: IconName; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        padding: "10px 12px",
        borderRadius: 8,
        border: 0,
        cursor: "pointer",
        textAlign: "left",
        background: active ? "var(--surface-2)" : "transparent",
        fontSize: 15,
        color: "var(--text-primary)",
      }}
    >
      <Icon name={icon} size={18} color="var(--text-secondary)" />
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      {meta ? <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 13 }}>{meta}</span> : null}
    </button>
  );
}
