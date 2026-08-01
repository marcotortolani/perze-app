"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button, Icon, Input } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { invitesRepo } from "@/lib/repos/invites-repo";
import { householdsRepo } from "@/lib/repos/households-repo";
import { useInvalidateHousehold } from "@/hooks/use-current-household";

/**
 * Aceptar una invitación (J3, el otro lado) — ruta hermana fuera de
 * `(app)/`: quien llega acá puede no tener household todavía, así que el
 * shell con tab bar no aplica (misma convención que `/add`, `/accounts/new`).
 */
export default function JoinHouseholdPage() {
  const t = useTranslations();
  const router = useRouter();
  const invalidateHousehold = useInvalidateHousehold();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  const handleJoin = async () => {
    if (!code.trim() || submitting) return;
    setSubmitting(true);
    setError(false);
    try {
      const householdId = await invitesRepo.accept(code.trim().toUpperCase());
      await householdsRepo.setCurrentHouseholdId(householdId);
      invalidateHousehold();
      toast(t("familyPage.joined"));
      router.push("/");
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenShell style={{ alignItems: "center", justifyContent: "center", padding: "var(--screen-padding)", gap: 20, textAlign: "center" }}>
      <Icon name="users" size={32} color="var(--text-secondary)" />
      <h1 className="t-title" style={{ margin: 0 }}>{t("familyPage.joinTitle")}</h1>
      <div style={{ width: "100%", maxWidth: 280 }}>
        <Input
          label={t("familyPage.enterCode")}
          placeholder="AB2CD3EF"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          invalid={error}
          hint={error ? t("familyPage.invalidCode") : undefined}
        />
      </div>
      <Button disabled={!code.trim() || submitting} onClick={handleJoin} style={{ maxWidth: 280 }}>
        {t("familyPage.join")}
      </Button>
    </ScreenShell>
  );
}
