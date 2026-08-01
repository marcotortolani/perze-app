"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Amount, EmptyState, ListRow, MirrorBanner, Skeleton, TransactionRow } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useRemoteHouseholdMembers } from "@/hooks/use-remote-household-members";
import { mirrorRepo } from "@/lib/repos/mirror-repo";
import { money } from "@/lib/money/money";

/**
 * J4b — modo espejo: "ver la app como {miembro}". `mirror_accounts`/
 * `mirror_transactions` (SECURITY DEFINER) ya filtran server-side con
 * `can_see_as()` — este componente solo dibuja lo que la función devolvió,
 * nunca amplía nada del lado del cliente.
 */
export default function MirrorModePage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = use(params);
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: members } = useRemoteHouseholdMembers(household?.id);

  const accountsQuery = useQuery({
    queryKey: ["mirror-accounts", household?.id, memberId],
    queryFn: () => mirrorRepo.accounts(household!.id, memberId),
    enabled: !!household,
  });
  const transactionsQuery = useQuery({
    queryKey: ["mirror-transactions", household?.id, memberId],
    queryFn: () => mirrorRepo.transactions(household!.id, memberId),
    enabled: !!household,
  });

  if (!household || !members || accountsQuery.isLoading || transactionsQuery.isLoading) {
    return <Skeleton height={300} style={{ marginTop: 16 }} />;
  }

  const target = members.find((m) => m.profileId === memberId);
  const accounts = accountsQuery.data ?? [];
  const transactions = transactionsQuery.data ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <MirrorBanner
        message={t("familyPage.mirrorBanner", { name: target?.displayName ?? t("familyPage.unnamed") })}
        exitLabel={t("familyPage.exitMirror")}
        onExit={() => router.push("/family")}
      />
      <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("morePage.accounts")}</div>
          {accounts.length === 0 ? (
            <p className="t-body" style={{ color: "var(--text-muted)", marginTop: 8 }}>{t("familyPage.mirrorNoAccounts")}</p>
          ) : (
            accounts.map((a) => (
              <ListRow key={a.id} label={a.name} variant="value" value={<Amount value={money(BigInt(a.currentBalance), a.currencyCode)} size="body" showSign={false} polarity="neutral" tabular />} />
            ))
          )}
        </div>
        <div>
          <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("transactions.list.filters")}</div>
          {transactions.length === 0 ? (
            <EmptyState message={t("familyPage.mirrorNoTransactions")} />
          ) : (
            transactions.slice(0, 30).map((tx) => (
              <TransactionRow
                key={tx.id}
                merchant={tx.note ?? t("transactions.list.movement")}
                value={money(tx.kind === "expense" ? -BigInt(tx.amount) : BigInt(tx.amount), tx.currencyCode)}
                polarity={tx.kind === "income" ? "positive" : tx.kind === "transfer" ? "neutral" : "negative"}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
