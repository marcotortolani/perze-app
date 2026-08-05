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
import { useCategoryLabel } from "@/hooks/use-category-label";
import { money } from "@/lib/money/money";
import { formatAmountCompact } from "@/lib/money/format";
import { searchAll, type Searchable, type SearchResult } from "@/lib/search/rank";

interface QuickAction {
  id: string;
  label: string;
  route: string;
}

/**
 * Buscador flotante — reemplaza la navegación a `/search` y el ⌘K de
 * `command-palette.tsx` (borrado, unificado acá): misma superficie para
 * las dos entradas, misma lógica de ranking (`searchAll`), mismos hrefs
 * correctos a detalle (`/transactions/{id}`, `/accounts/{id}`) en vez de
 * a la lista. Cablear desde `(app)/layout.tsx`.
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
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const quickActions: QuickAction[] = useMemo(
    () => [
      { id: "add", label: t("search.actions.add"), route: "/add" },
      { id: "home", label: t("search.actions.home"), route: "/" },
      { id: "movements", label: t("search.actions.movements"), route: "/transactions" },
      { id: "accounts", label: t("search.actions.accounts"), route: "/accounts" },
      { id: "analytics", label: t("search.actions.analytics"), route: "/analytics" },
      { id: "more", label: t("search.actions.more"), route: "/more" },
    ],
    [t]
  );

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
      items.push({ id: p.id, group: "payees", title: p.name, href: `/transactions?payee=${p.id}`, icon: "tag" });
    }
    for (const tx of transactions) {
      const category = tx.categoryId ? categoryById.get(tx.categoryId) : undefined;
      const title = category ? categoryLabel(category) : (tx.note ?? t("search.noNote"));
      items.push({
        id: tx.id,
        group: "transactions",
        title,
        subtitle: tx.note && category ? tx.note : undefined,
        meta: formatAmountCompact(money(tx.amount, tx.currencyCode), { showSign: false }),
        href: `/transactions/${tx.id}`,
        icon: (category?.icon as string) ?? "cart",
        sortKey: tx.occurredAt,
      });
    }
    return items;
  }, [accounts, categories, payees, transactions, categoryById, categoryLabel, t]);

  const results = useMemo(() => searchAll(deferredQuery, index), [deferredQuery, index]);
  const filteredActions = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    return needle ? quickActions.filter((a) => a.label.toLowerCase().includes(needle)) : quickActions;
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
    { key: "accounts", label: t("search.accounts") },
    { key: "categories", label: t("search.categories") },
    { key: "payees", label: t("search.merchants") },
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
