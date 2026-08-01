"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { AppHeader, Button, Input, Skeleton } from "@/design-system";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { profilesRepo } from "@/lib/repos/profiles-repo";

/** K2 — perfil: nombre visible. */
export default function ProfilePage() {
  const t = useTranslations();
  const router = useRouter();
  const userId = useCurrentUserId();
  const profileQuery = useQuery({ queryKey: ["profile", userId], queryFn: () => profilesRepo.getOwn(userId!), enabled: !!userId });
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (profileQuery.isLoading || !userId) return <Skeleton height={200} style={{ marginTop: 16 }} />;

  const displayName = name ?? profileQuery.data?.displayName ?? "";

  const handleSave = async () => {
    if (!displayName.trim() || saving) return;
    setSaving(true);
    try {
      await profilesRepo.updateDisplayName(userId, displayName.trim());
      toast(t("profilePage.saved"));
      profileQuery.refetch();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={t("profilePage.title")} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
      <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        <Input label={t("profilePage.displayName")} value={displayName} onChange={(e) => setName(e.target.value)} />
        <Button disabled={!displayName.trim() || saving} onClick={handleSave}>
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
}
