"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { Button, Input, usePageHeader, ZMark } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useInvalidateInvites } from "@/hooks/use-invites";
import { invitesRepo, type HouseholdInvite } from "@/lib/repos/invites-repo";
import { useEmailField } from "@/hooks/use-email-field";
import { optionalEmailSchema } from "@/lib/validation/email";

/**
 * J3 — invitar. Se genera un código que el usuario comparte a mano y se
 * canjea en `/join` — el código es el mismo camino que un QR, así que
 * agregarlo después no cambia el modelo de datos. Con email cargado,
 * además se ofrece mandarlo por mail (`/api/emails/invite`, Route
 * Handler + Resend — decisión cerrada, no una Edge Function, ver
 * `docs/mejora-auth-oauth-y-email.md` § 6): el envío es best-effort, el
 * código sigue siendo el camino de respaldo si Resend no está
 * configurado o el mail falla.
 *
 * El email NO es decorativo aunque sea opcional: si se carga, la
 * invitación queda nominal y `accept_invite`
 * (`20260801100000_fix_invites_hardening.sql`) rechaza a cualquier otra
 * cuenta. Por eso se guarda normalizado en minúscula.
 */
export default function InviteFamilyMemberPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const invalidateInvites = useInvalidateInvites(household?.id);
  usePageHeader({ title: t("familyPage.invite"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  // El email es opcional: vacío no es un error, pero escrito a medias sí.
  const email = useEmailField();
  const [creating, setCreating] = useState(false);
  const [invite, setInvite] = useState<HouseholdInvite | null>(null);
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (!household) return null;

  const code = invite?.code ?? null;

  const handleCreate = async () => {
    if (creating) return;
    const parsed = optionalEmailSchema.safeParse(email.value);
    if (!parsed.success) {
      email.onBlur();
      return;
    }
    setCreating(true);
    try {
      const created = await invitesRepo.create({ householdId: household.id, email: parsed.data, role: "member" });
      invalidateInvites();
      setInvite(created);
      if (created.email) void handleSendEmail(created);
    } finally {
      setCreating(false);
    }
  };

  const handleSendEmail = async (target: HouseholdInvite) => {
    if (!target.email) return;
    setSendState("sending");
    try {
      const res = await fetch("/api/emails/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId: target.id, locale }),
      });
      if (!res.ok) {
        setSendState("error");
        toast.error(t("familyPage.sendError"));
        return;
      }
      setSendState("sent");
    } catch {
      setSendState("error");
      toast.error(t("familyPage.sendError"));
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
              {/* Sin email cargado, este bloque entero no se dibuja: no
                  hay a quién mandarle nada — el código/link de arriba
                  siguen siendo el camino completo por su cuenta. */}
              {invite?.email ? (
                <>
                  <p className="t-caption" style={{ margin: 0, color: sendState === "error" ? "var(--critical)" : "var(--text-muted)" }}>
                    {sendState === "sending"
                      ? t("familyPage.sending")
                      : sendState === "sent"
                        ? t("familyPage.sent", { email: invite.email })
                        : sendState === "error"
                          ? t("familyPage.sendError")
                          : null}
                  </p>
                  {sendState === "error" ? (
                    <Button variant="ghost" onClick={() => handleSendEmail(invite)}>
                      {t("familyPage.sendByEmail")}
                    </Button>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : (
            <>
              <Input label={t("familyPage.emailOptional")} placeholder={t("common.emailError.example")} {...email.bind} />
              <p className="t-body" style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>{t("familyPage.emailOptionalHint")}</p>
              <Button disabled={creating || !!email.hint} onClick={handleCreate} style={{ marginTop: "auto" }}>
                {t("familyPage.generateCode")}
              </Button>
            </>
          )}
        </div>

        <div className="hidden lg:flex" style={{ alignItems: "center", justifyContent: "center" }}>
          <ZMark variant="flip" animated size={28} gap={8} aria-label={t("app.name")} />
        </div>
      </div>
    </div>
  );
}
