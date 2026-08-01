"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { AppHeader, ListRow, Sheet, Skeleton, Switch } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { useAccounts, useInvalidateAccounts } from "@/hooks/use-accounts";
import { useCategories, useInvalidateCategories } from "@/hooks/use-categories";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useRemoteHouseholdMembers } from "@/hooks/use-remote-household-members";
import { accountsRepo } from "@/lib/repos/accounts-repo";
import { categoriesRepo } from "@/lib/repos/categories-repo";
import { visibilityGrantsRepo, type VisibilityGrant } from "@/lib/repos/visibility-grants-repo";
import type { Visibility } from "@/lib/db/schema";

type Subject = { type: "account" | "category"; id: string; label: string; visibility: Visibility | "custom" };

const VISIBILITY_MESSAGE_KEY = {
  private: "permissionsPage.visibility.private",
  household: "permissionsPage.visibility.household",
  custom: "permissionsPage.visibility.custom",
} as const;

/** J4 — permisos y visibilidad: quién ve cada cuenta/categoría. */
export default function PermissionsPage() {
  const t = useTranslations();
  const router = useRouter();
  const userId = useCurrentUserId();
  const categoryLabel = useCategoryLabel();
  const { data: household } = useCurrentHousehold();
  const { data: accounts } = useAccounts(household?.id);
  const { data: categories } = useCategories(household?.id);
  const { data: members } = useRemoteHouseholdMembers(household?.id);
  const invalidateAccounts = useInvalidateAccounts(household?.id);
  const invalidateCategories = useInvalidateCategories(household?.id);

  const [editing, setEditing] = useState<Subject | null>(null);
  const [grants, setGrants] = useState<VisibilityGrant[]>([]);
  const [loadingGrants, setLoadingGrants] = useState(false);

  if (!household || !accounts || !categories || !members || !userId) return <Skeleton height={300} style={{ marginTop: 16 }} />;

  const otherMembers = members.filter((m) => m.profileId !== userId);
  if (otherMembers.length === 0) {
    return (
      <div style={{ paddingTop: 40, textAlign: "center", color: "var(--text-secondary)" }}>
        <p className="t-body">{t("permissionsPage.needsMembers")}</p>
      </div>
    );
  }

  const openEditor = async (subject: Subject) => {
    setEditing(subject);
    if (subject.visibility === "custom") {
      setLoadingGrants(true);
      try {
        setGrants(await visibilityGrantsRepo.listActiveFor(subject.type, subject.id));
      } finally {
        setLoadingGrants(false);
      }
    } else {
      setGrants([]);
    }
  };

  const setVisibility = async (visibility: Visibility | "custom") => {
    if (!editing) return;
    const repo = editing.type === "account" ? accountsRepo : categoriesRepo;
    await repo.update(editing.id, { visibility });
    if (editing.type === "account") invalidateAccounts();
    else invalidateCategories();
    setEditing({ ...editing, visibility });
    if (visibility === "custom" && grants.length === 0) {
      setLoadingGrants(true);
      try {
        setGrants(await visibilityGrantsRepo.listActiveFor(editing.type, editing.id));
      } finally {
        setLoadingGrants(false);
      }
    }
  };

  const toggleMember = async (memberId: string, canSee: boolean) => {
    if (!editing || !household) return;
    if (canSee) {
      await visibilityGrantsRepo.grant(household.id, editing.type, editing.id, memberId, userId);
      setGrants((g) => [...g, { id: crypto.randomUUID(), subjectType: editing.type, subjectId: editing.id, memberId, grantedBy: userId, grantedAt: new Date().toISOString() }]);
    } else {
      await visibilityGrantsRepo.revoke(editing.type, editing.id, memberId);
      setGrants((g) => g.filter((x) => x.memberId !== memberId));
    }
    toast(t("permissionsPage.updated"));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={t("permissionsPage.title")} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
      <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 4 }}>
        <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("permissionsPage.accounts")}</div>
        {accounts.filter((a) => a.archivedAt === null).map((a) => (
          <ListRow
            key={a.id}
            label={a.name}
            variant="value"
            value={t(VISIBILITY_MESSAGE_KEY[a.visibility])}
            onClick={() => openEditor({ type: "account", id: a.id, label: a.name, visibility: a.visibility })}
          />
        ))}
        <div className="t-caption" style={{ color: "var(--text-muted)", marginTop: 16 }}>{t("permissionsPage.categories")}</div>
        {categories.map((c) => (
          <ListRow
            key={c.id}
            label={categoryLabel(c)}
            variant="value"
            value={t(VISIBILITY_MESSAGE_KEY[c.visibility])}
            onClick={() => openEditor({ type: "category", id: c.id, label: categoryLabel(c), visibility: c.visibility })}
          />
        ))}
      </div>

      <Sheet open={editing !== null} title={editing?.label ?? ""} onClose={() => setEditing(null)} height={editing?.visibility === "custom" ? 480 : 320}>
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <ListRow label={t("permissionsPage.visibility.private")} meta={t("permissionsPage.privateHint")} value={editing.visibility === "private" ? "✓" : undefined} variant="value" onClick={() => setVisibility("private")} />
            <ListRow label={t("permissionsPage.visibility.household")} meta={t("permissionsPage.householdHint")} value={editing.visibility === "household" ? "✓" : undefined} variant="value" onClick={() => setVisibility("household")} />
            {editing.type === "account" ? (
              <ListRow label={t("permissionsPage.visibility.custom")} meta={t("permissionsPage.customHint")} value={editing.visibility === "custom" ? "✓" : undefined} variant="value" onClick={() => setVisibility("custom")} />
            ) : null}
            {editing.visibility === "custom" && !loadingGrants ? (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                <div className="t-caption" style={{ color: "var(--text-muted)" }}>{t("permissionsPage.whoCanSee")}</div>
                {otherMembers.map((m) => {
                  const canSee = grants.some((g) => g.memberId === m.profileId);
                  return (
                    <div key={m.profileId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 4px" }}>
                      <span style={{ fontSize: 15, color: "var(--text-primary)" }}>{m.displayName ?? t("familyPage.unnamed")}</span>
                      <Switch checked={canSee} onChange={(on) => toggleMember(m.profileId, on)} id={`grant-${m.profileId}`} />
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
