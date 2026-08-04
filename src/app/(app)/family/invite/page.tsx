"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button, Input, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useInvalidateInvites } from "@/hooks/use-invites";
import { invitesRepo } from "@/lib/repos/invites-repo";

/**
 * J3 — invitar. Sin envío de email real todavía (necesitaría una Edge
 * Function + proveedor de correo, ninguno de los dos existe): se genera
 * un código de 8 caracteres que el usuario comparte a mano. El código es
 * el mismo camino que un QR — un QR es solo ese código codificado en una
 * imagen, así que agregarlo después no cambia el modelo de datos.
 */
export default function InviteFamilyMemberPage() {
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const invalidateInvites = useInvalidateInvites(household?.id);
  usePageHeader({ title: t("familyPage.invite"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  if (!household) return null;

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const invite = await invitesRepo.create({ householdId: household.id, email: email.trim() || null, role: "member" });
      invalidateInvites();
      setCode(invite.code);
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    toast(t("familyPage.codeCopied"));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 16, gap: 20 }}>
        {code ? (
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 16 }}>
            <p className="t-body" style={{ margin: 0, color: "var(--text-secondary)" }}>{t("familyPage.shareCode")}</p>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 40, letterSpacing: "0.08em", color: "var(--text-primary)" }}>{code}</div>
            <Button variant="secondary" fullWidth={false} onClick={handleCopy} style={{ alignSelf: "center" }}>
              {t("familyPage.copyCode")}
            </Button>
          </div>
        ) : (
          <>
            <Input label={t("familyPage.emailOptional")} placeholder="ana@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <p className="t-body" style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>{t("familyPage.emailOptionalHint")}</p>
            <Button disabled={creating} onClick={handleCreate} style={{ marginTop: "auto" }}>
              {t("familyPage.generateCode")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
