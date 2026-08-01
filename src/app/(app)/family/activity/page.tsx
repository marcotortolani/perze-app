"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AppHeader, EmptyState, ListRow, Skeleton } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useRemoteHouseholdMembers } from "@/hooks/use-remote-household-members";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { visibilityGrantsRepo } from "@/lib/repos/visibility-grants-repo";

/** J9 — actividad: quién le dio o le sacó acceso a quién, y sobre qué. Audita `visibility_grants`. */
export default function ActivityPage() {
  const t = useTranslations();
  const router = useRouter();
  const categoryLabel = useCategoryLabel();
  const { data: household } = useCurrentHousehold();
  const { data: members } = useRemoteHouseholdMembers(household?.id);
  const { data: accounts } = useAccounts(household?.id);
  const { data: categories } = useCategories(household?.id);

  const historyQuery = useQuery({
    queryKey: ["visibility-grant-history", household?.id],
    queryFn: () => visibilityGrantsRepo.listHistoryForHousehold(household!.id),
    enabled: !!household,
  });

  if (!household || !members || !accounts || !categories || historyQuery.isLoading) return <Skeleton height={260} style={{ marginTop: 16 }} />;

  const history = historyQuery.data ?? [];
  const memberById = new Map(members.map((m) => [m.profileId, m]));
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const subjectLabel = (type: "account" | "category", id: string) =>
    type === "account" ? (accountById.get(id)?.name ?? id) : categoryById.get(id) ? categoryLabel(categoryById.get(id)!) : id;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={t("activityPage.title")} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
      <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 2 }}>
        {history.length === 0 ? (
          <EmptyState message={t("activityPage.empty")} />
        ) : (
          history.map((entry) => (
            <ListRow
              key={entry.id}
              icon={entry.revokedAt ? "close" : "check"}
              label={
                entry.revokedAt
                  ? t("activityPage.revoked", { granter: memberById.get(entry.grantedBy)?.displayName ?? t("familyPage.unnamed"), member: memberById.get(entry.memberId)?.displayName ?? t("familyPage.unnamed"), subject: subjectLabel(entry.subjectType, entry.subjectId) })
                  : t("activityPage.granted", { granter: memberById.get(entry.grantedBy)?.displayName ?? t("familyPage.unnamed"), member: memberById.get(entry.memberId)?.displayName ?? t("familyPage.unnamed"), subject: subjectLabel(entry.subjectType, entry.subjectId) })
              }
              meta={new Date(entry.revokedAt ?? entry.grantedAt).toLocaleDateString()}
            />
          ))
        )}
      </div>
    </div>
  );
}
