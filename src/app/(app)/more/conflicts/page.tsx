"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { AppHeader, Button, EmptyState, Skeleton } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useConflicts } from "@/hooks/use-conflicts";
import { useCategories } from "@/hooks/use-categories";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useInvalidateTransactions } from "@/hooks/use-transactions";
import { conflictsRepo } from "@/lib/repos/conflicts-repo";
import type { ConflictRecordRow } from "@/lib/db/schema";
import { formatAmountCompact } from "@/lib/money/format";
import { money } from "@/lib/money/money";

function summarize(payload: Record<string, unknown>, categoryLabel: (id: string | null) => string): { amount: string; category: string; note: string } {
  const amount = payload.amount !== undefined ? (typeof payload.amount === "bigint" ? payload.amount : BigInt(payload.amount as string)) : 0n;
  const currency = (payload.currencyCode ?? payload.currency_code ?? "UYU") as string;
  const categoryId = (payload.categoryId ?? payload.category_id ?? null) as string | null;
  const note = (payload.note ?? "") as string;
  return { amount: formatAmountCompact(money(amount, currency), { showSign: false }), category: categoryLabel(categoryId), note };
}

/** CQ — resolución de conflictos: dos ediciones offline de la misma transacción, ninguna se pisa en silencio. */
export default function ConflictsPage() {
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { conflicts, refresh } = useConflicts(household?.id);
  const { data: categories = [] } = useCategories(household?.id);
  const categoryLabel = useCategoryLabel();
  const invalidateTransactions = useInvalidateTransactions(household?.id);
  const [resolving, setResolving] = useState<string | null>(null);

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const labelFor = (id: string | null) => (id && categoryById.has(id) ? categoryLabel(categoryById.get(id)!) : t("conflictsPage.noCategory"));

  if (!household) return <Skeleton height={280} style={{ marginTop: 16 }} />;

  const handleResolve = async (conflict: ConflictRecordRow, keep: "local" | "server") => {
    if (resolving) return;
    setResolving(conflict.id);
    try {
      if (keep === "local") await conflictsRepo.keepLocal(conflict);
      else await conflictsRepo.keepServer(conflict);
      invalidateTransactions();
      await refresh();
      toast(t("conflictsPage.resolved"));
    } finally {
      setResolving(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={t("conflictsPage.title")} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
      <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 20, paddingBottom: 24 }}>
        {conflicts.length === 0 ? (
          <EmptyState message={t("conflictsPage.empty")} />
        ) : (
          conflicts.map((conflict) => {
            const mine = summarize(conflict.localPayload, labelFor);
            const theirs = summarize(conflict.serverPayload, labelFor);
            return (
              <div key={conflict.id} style={{ background: "var(--surface-1)", borderRadius: "var(--radius-card)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <p className="t-body" style={{ margin: 0, color: "var(--text-primary)" }}>{t("conflictsPage.explainer")}</p>

                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1, background: "var(--surface-2)", borderRadius: "var(--radius-input)", padding: 12 }}>
                    <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("conflictsPage.yours")}</div>
                    <div style={{ marginTop: 4, fontSize: 15, color: "var(--text-primary)" }}>{mine.amount}</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{mine.category}</div>
                    {mine.note ? <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{mine.note}</div> : null}
                  </div>
                  <div style={{ flex: 1, background: "var(--surface-2)", borderRadius: "var(--radius-input)", padding: 12 }}>
                    <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("conflictsPage.theirs")}</div>
                    <div style={{ marginTop: 4, fontSize: 15, color: "var(--text-primary)" }}>{theirs.amount}</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{theirs.category}</div>
                    {theirs.note ? <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{theirs.note}</div> : null}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="secondary" disabled={resolving === conflict.id} onClick={() => handleResolve(conflict, "local")} style={{ flex: 1 }}>
                    {t("conflictsPage.keepMine")}
                  </Button>
                  <Button variant="secondary" disabled={resolving === conflict.id} onClick={() => handleResolve(conflict, "server")} style={{ flex: 1 }}>
                    {t("conflictsPage.keepTheirs")}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
