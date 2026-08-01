"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AppHeader, ComparisonBars, EmptyState, Skeleton } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { useRemoteHouseholdMembers } from "@/hooks/use-remote-household-members";
import { useCategories } from "@/hooks/use-categories";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { transactionSharesRepo } from "@/lib/repos/transaction-shares-repo";
import { useTransactions } from "@/hooks/use-transactions";
import { previousClosedPeriodBounds } from "@/lib/analytics/history";
import { formatAmountCompact } from "@/lib/money/format";
import { money } from "@/lib/money/money";

const MEMBER_COLORS = ["var(--data-1)", "var(--data-2)", "var(--data-3)", "var(--data-4)", "var(--data-5)"];

/**
 * J8 — comparativa entre miembros: cuánto le tocó a cada uno por
 * categoría, en el último período cerrado. Nota: sin el opt-in mutuo
 * explícito del diseño original — todavía no hay un mecanismo de consenso
 * dedicado, así que esta vista se apoya solo en lo que `visibility_grants`
 * ya deja ver (no amplía nada).
 */
export default function ComparePage() {
  const t = useTranslations();
  const router = useRouter();
  const userId = useCurrentUserId();
  const categoryLabel = useCategoryLabel();
  const { data: household } = useCurrentHousehold();
  const { data: members } = useRemoteHouseholdMembers(household?.id);
  const { data: categories } = useCategories(household?.id);
  const { data: transactions } = useTransactions(household?.id);

  const sharesQuery = useQuery({
    queryKey: ["unsettled-shares", household?.id],
    queryFn: () => transactionSharesRepo.listUnsettledForHousehold(household!.id),
    enabled: !!household,
  });

  const categoriesData = useMemo(() => {
    if (!household || !members || !categories || !transactions || !sharesQuery.data || !userId) return [];
    const { start, end } = previousClosedPeriodBounds(household.periodStartDay || 1, new Date());
    const txById = new Map(transactions.map((tx) => [tx.id, tx]));
    const otherMembers = members.filter((m) => m.profileId !== userId).slice(0, 2);
    if (otherMembers.length === 0) return [];

    const byCategory = new Map<string, Map<string, bigint>>();
    for (const share of sharesQuery.data) {
      if (share.shareAmountBase === null) continue;
      const tx = txById.get(share.transactionId);
      if (!tx || tx.kind !== "expense") continue;
      const occurred = new Date(tx.occurredAt);
      if (occurred < start || occurred >= end) continue;
      if (![userId, ...otherMembers.map((m) => m.profileId)].includes(share.memberId)) continue;

      const catKey = tx.categoryId ?? "__none";
      const perMember = byCategory.get(catKey) ?? new Map<string, bigint>();
      perMember.set(share.memberId, (perMember.get(share.memberId) ?? 0n) + share.shareAmountBase);
      byCategory.set(catKey, perMember);
    }

    const categoryById2 = new Map(categories.map((c) => [c.id, c]));
    return [...byCategory.entries()].map(([catId, perMember]) => ({
      label: catId === "__none" ? t("transactions.detail.noCategory") : (categoryById2.get(catId) ? categoryLabel(categoryById2.get(catId)!) : catId),
      members: [userId, ...otherMembers.map((m) => m.profileId)].map((memberId, i) => ({
        label: memberId === userId ? t("splitPage.you") : (members.find((m) => m.profileId === memberId)?.displayName ?? t("familyPage.unnamed")),
        value: Number(perMember.get(memberId) ?? 0n),
        color: MEMBER_COLORS[i % MEMBER_COLORS.length]!,
      })),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household, members, categories, transactions, sharesQuery.data, userId]);

  if (!household || !members || !categories || !transactions || !userId || sharesQuery.isLoading) return <Skeleton height={260} style={{ marginTop: 16 }} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={t("comparePage.title")} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
      <div style={{ paddingTop: 24 }}>
        {categoriesData.length === 0 ? (
          <EmptyState message={t("comparePage.empty")} />
        ) : (
          <ComparisonBars
            categories={categoriesData}
            display={(v) => formatAmountCompact(money(BigInt(Math.round(v)), household.baseCurrency), { showSign: false })}
          />
        )}
      </div>
    </div>
  );
}
