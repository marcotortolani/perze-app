"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Amount, Button, EmptyState, NeedsFxBanner, Sheet, Skeleton, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { useRemoteHouseholdMembers } from "@/hooks/use-remote-household-members";
import { transactionSharesRepo } from "@/lib/repos/transaction-shares-repo";
import { settlementsRepo, type SettlementMethod } from "@/lib/repos/settlements-repo";
import { computeNetBalances } from "@/lib/analytics/settle-up";
import { money } from "@/lib/money/money";

/**
 * J7 — liquidar. El agregado más delicado de la app: un share sin
 * cotización resuelta (needs_fx) se excluye del neto y se declara,
 * nunca se cuenta como si valiera 0 (`computeNetBalances`, con tests).
 */
export default function SettleUpPage() {
  const t = useTranslations();
  const router = useRouter();
  const userId = useCurrentUserId();
  const { data: household } = useCurrentHousehold();
  const { data: members } = useRemoteHouseholdMembers(household?.id);
  const [settling, setSettling] = useState<{ memberId: string; amount: bigint } | null>(null);
  const [saving, setSaving] = useState(false);
  usePageHeader({ title: t("settlePage.title"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  const sharesQuery = useQuery({
    queryKey: ["unsettled-shares", household?.id],
    queryFn: () => transactionSharesRepo.listUnsettledForHousehold(household!.id),
    enabled: !!household,
  });

  if (!household || !members || !userId || sharesQuery.isLoading) return <Skeleton height={260} style={{ marginTop: 16 }} />;

  const baseCurrency = household.baseCurrency;
  const shares = sharesQuery.data ?? [];
  const { byMember, excludedCount } = computeNetBalances(
    shares.map((s) => ({ memberId: s.memberId, shareAmountBase: s.shareAmountBase, paidBy: s.createdBy })),
    userId
  );

  const memberById = new Map(members.map((m) => [m.profileId, m]));
  const balances = [...byMember.entries()].filter(([, amount]) => amount !== 0n);

  const handleSettle = async (method: SettlementMethod) => {
    if (!settling || saving) return;
    setSaving(true);
    try {
      const owesMe = settling.amount > 0n;
      const settlement = await settlementsRepo.create({
        householdId: household.id,
        fromMember: owesMe ? settling.memberId : userId,
        toMember: owesMe ? userId : settling.memberId,
        amount: owesMe ? settling.amount : -settling.amount,
        currencyCode: baseCurrency,
        method,
        createdBy: userId,
      });
      // Mismo filtro que `computeNetBalances`: solo los shares entre VOS y
      // este miembro puntual — nunca los de un tercer par que compartan
      // el mismo `memberId`/`createdBy` por coincidencia.
      const shareIds = shares
        .filter(
          (s) =>
            s.shareAmountBase !== null &&
            ((s.memberId === settling.memberId && s.createdBy === userId) || (s.memberId === userId && s.createdBy === settling.memberId))
        )
        .map((s) => s.id);
      await transactionSharesRepo.markSettled(shareIds, settlement.id);
      sharesQuery.refetch();
      toast(t("settlePage.settled"));
      setSettling(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {excludedCount > 0 ? <NeedsFxBanner count={excludedCount} onResolve={() => router.push("/accounts/resolve-fx")} style={{ margin: "0 calc(-1 * var(--screen-padding)) 6px", borderRadius: 0 }} /> : null}
        {balances.length === 0 ? (
          <EmptyState message={t("settlePage.allSettled")} />
        ) : (
          balances.map(([memberId, amount]) => {
            const member = memberById.get(memberId);
            const owesMe = amount > 0n;
            return (
              <div key={memberId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 4px" }}>
                <div>
                  <div style={{ fontSize: 16, color: "var(--text-primary)" }}>{member?.displayName ?? t("familyPage.unnamed")}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{owesMe ? t("settlePage.owesYou") : t("settlePage.youOwe")}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Amount value={money(amount < 0n ? -amount : amount, baseCurrency)} size="body" showSign={false} polarity={owesMe ? "positive" : "negative-emphasis"} tabular />
                  <Button variant="secondary" fullWidth={false} size="sm" onClick={() => setSettling({ memberId, amount })}>
                    {t("settlePage.settle")}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Sheet open={settling !== null} title={t("settlePage.howTitle")} onClose={() => setSettling(null)} height={280}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Button onClick={() => handleSettle("cash")} disabled={saving}>{t("settlePage.methodCash")}</Button>
          <Button variant="secondary" onClick={() => handleSettle("transfer")} disabled={saving}>{t("settlePage.methodTransfer")}</Button>
          <Button variant="ghost" onClick={() => handleSettle("forgiven")} disabled={saving}>{t("settlePage.methodForgiven")}</Button>
        </div>
      </Sheet>
    </div>
  );
}
