"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button, usePageHeader, ZMark } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useInvalidateInvites } from "@/hooks/use-invites";
import { invitesRepo, type HouseholdInvite } from "@/lib/repos/invites-repo";

/**
 * J3 — invitar. Se genera un código que el usuario comparte a mano y se
 * canjea en `/join` — el código es el mismo camino que un QR, así que
 * agregarlo después no cambia el modelo de datos.
 *
 * El envío por mail (email opcional + `/api/emails/invite`, Resend) se
 * probó y se sacó de esta pantalla: sin el SMTP de Resend configurado
 * (`docs/mejora-auth-oauth-y-email.md` § 0, pendiente) no entrega nada,
 * y pedir un mail que después no hace nada visible es peor que no
 * pedirlo — código + link son el camino completo por su cuenta. La
 * columna `household_invites.email` y el Route Handler quedan sin
 * llamar, no se borraron: son lo que hay que retomar el día que Resend
 * esté realmente configurado, no lo que hay que reescribir.
 */
export default function InviteFamilyMemberPage() {
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const invalidateInvites = useInvalidateInvites(household?.id);
  usePageHeader({ title: t("familyPage.invite"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  const [creating, setCreating] = useState(false);
  const [invite, setInvite] = useState<HouseholdInvite | null>(null);

  if (!household) return null;

  const code = invite?.code ?? null;

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const created = await invitesRepo.create({ householdId: household.id, email: null, role: "member" });
      invalidateInvites();
      setInvite(created);
    } finally {
      setCreating(false);
    }
  };

  /** El link que se pega en un chat: `/join` lo prellena desde el param.
   *  `invite` y no `code` — `proxy.ts` se queda con cualquier `?code=`
   *  para el canje PKCE de Supabase. */
  const inviteLink = code ? `${typeof window === "undefined" ? "" : window.location.origin}/join?invite=${code}` : "";

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    toast(t("familyPage.linkCopied"));
  };

  const handleCopyCode = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    toast(t("familyPage.codeCopied"));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* `lg`+: el formulario queda a la izquierda tal cual estaba — la
          columna del grid ya da un ancho parecido a `--content-max-width` —
          y la derecha pasa a llevar el `ZMark` en vez de quedar vacía. */}
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ flex: 1, minHeight: 0, gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", paddingTop: 16, gap: 20 }}>
          {/* Con el código ya generado, copiar el link es la acción
              primaria: el que lo recibe entra a `/join` con el código
              puesto y no tipea nada. El código a mano queda como camino
              secundario, para cuando se dicta en persona o por teléfono. */}
          {code ? (
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 16 }}>
              <p className="t-body" style={{ margin: 0, color: "var(--text-secondary)" }}>{t("familyPage.shareCode")}</p>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 32, letterSpacing: "0.08em", color: "var(--text-primary)", wordBreak: "break-all" }}>{code}</div>
              <p className="t-caption" style={{ margin: 0, color: "var(--text-muted)", wordBreak: "break-all" }}>{inviteLink}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Button onClick={handleCopyLink}>{t("familyPage.copyLink")}</Button>
                <Button variant="ghost" onClick={handleCopyCode}>
                  {t("familyPage.copyCode")}
                </Button>
              </div>
              <p className="t-caption" style={{ margin: 0, color: "var(--text-muted)" }}>{t("familyPage.inviteExpires")}</p>
            </div>
          ) : (
            <Button disabled={creating} onClick={handleCreate} style={{ marginTop: "auto" }}>
              {t("familyPage.generateCode")}
            </Button>
          )}
        </div>

        <div className="hidden lg:flex" style={{ alignItems: "center", justifyContent: "center" }}>
          <ZMark variant="flip" animated size={28} gap={8} aria-label={t("app.name")} />
        </div>
      </div>
    </div>
  );
}
