"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AppHeader, EmptyState, Input, ListRow, ResultGroup } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import type { IconName } from "@/design-system/core/Icon";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import { usePayees } from "@/hooks/use-payees";
import { useTransactions } from "@/hooks/use-transactions";
import { money } from "@/lib/money/money";
import { formatAmountCompact } from "@/lib/money/format";
import { useCategoryLabel } from "@/hooks/use-category-label";

function matches(needle: string, ...haystack: (string | null | undefined)[]): boolean {
  return haystack.some((h) => h && h.toLowerCase().includes(needle));
}

/** Búsqueda global (B8) — resultados agrupados por tipo. Bloque B, Fase 6. */
export default function SearchPage() {
  const router = useRouter();
  const t = useTranslations();
  const categoryLabel = useCategoryLabel();
  const { data: household } = useCurrentHousehold();
  const { data: accounts = [] } = useAccounts(household?.id);
  const { data: categories = [] } = useCategories(household?.id);
  const { data: payees = [] } = usePayees(household?.id);
  const { data: transactions = [] } = useTransactions(household?.id);
  const [query, setQuery] = useState("");

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const needle = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!needle) return null;

    const matchedAccounts = accounts.filter((a) => matches(needle, a.name));
    const matchedCategories = categories.filter((c) => matches(needle, c.name));
    const matchedPayees = payees.filter((p) => matches(needle, p.name, ...p.aliases));
    const matchedTransactions = transactions
      .filter((tx) => matches(needle, tx.note, categoryById.get(tx.categoryId ?? "")?.name))
      .slice(0, 20);

    return { matchedAccounts, matchedCategories, matchedPayees, matchedTransactions };
  }, [needle, accounts, categories, payees, transactions, categoryById]);

  const totalResults = results
    ? results.matchedAccounts.length + results.matchedCategories.length + results.matchedPayees.length + results.matchedTransactions.length
    : 0;

  return (
    <ScreenShell>
      <AppHeader onBack={() => router.back()} backLabel={t("ds.appHeader.back")} showScope={false} />
      <div style={{ padding: "0 var(--screen-padding) 16px" }}>
        <Input placeholder={t("search.placeholder")} value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
      </div>
      <div style={{ flex: 1, padding: "0 var(--screen-padding)", display: "flex", flexDirection: "column", gap: 20 }}>
        {!results ? (
          <p className="t-body" style={{ color: "var(--text-muted)", textAlign: "center", marginTop: 32 }}>
            {t("search.prompt")}
          </p>
        ) : totalResults === 0 ? (
          <EmptyState icon="search" message={t("search.noResults", { query })} />
        ) : (
          <>
            {results.matchedTransactions.length > 0 ? (
              <ResultGroup label={t("search.transactions")} count={results.matchedTransactions.length}>
                <div>
                  {results.matchedTransactions.map((tx) => {
                    const category = tx.categoryId ? categoryById.get(tx.categoryId) : undefined;
                    return (
                      <ListRow
                        key={tx.id}
                        icon={(category?.icon as IconName) ?? "cart"}
                        label={category ? categoryLabel(category) : (tx.note ?? t("search.movement"))}
                        meta={tx.occurredAt.slice(0, 10)}
                        value={formatAmountCompact(money(tx.amount, tx.currencyCode), { showSign: false })}
                        variant="value"
                        onClick={() => router.push("/transactions")}
                      />
                    );
                  })}
                </div>
              </ResultGroup>
            ) : null}
            {results.matchedAccounts.length > 0 ? (
              <ResultGroup label={t("search.accounts")} count={results.matchedAccounts.length}>
                <div>
                  {results.matchedAccounts.map((a) => (
                    <ListRow key={a.id} icon="wallet" label={a.name} meta={a.currencyCode} onClick={() => router.push("/accounts")} />
                  ))}
                </div>
              </ResultGroup>
            ) : null}
            {results.matchedCategories.length > 0 ? (
              <ResultGroup label={t("search.categories")} count={results.matchedCategories.length}>
                <div>
                  {results.matchedCategories.map((c) => (
                    <ListRow key={c.id} icon={c.icon as IconName} label={categoryLabel(c)} onClick={() => router.push("/transactions")} />
                  ))}
                </div>
              </ResultGroup>
            ) : null}
            {results.matchedPayees.length > 0 ? (
              <ResultGroup label={t("search.merchants")} count={results.matchedPayees.length}>
                <div>
                  {results.matchedPayees.map((p) => (
                    <ListRow key={p.id} icon="tag" label={p.name} onClick={() => router.push("/transactions")} />
                  ))}
                </div>
              </ResultGroup>
            ) : null}
          </>
        )}
      </div>
    </ScreenShell>
  );
}
