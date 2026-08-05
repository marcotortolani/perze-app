"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button, Icon, IconButton, Input } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { useEmailField } from "@/hooks/use-email-field";
import { requestPasswordReset } from "@/features/auth/password-auth";

/**
 * C7 — recuperación de contraseña. El mensaje de éxito es idéntico exista
 * o no la cuenta (Supabase mismo no distingue en `resetPasswordForEmail`)
 * — misma lógica de no enumerar usuarios que ya rige A2/A3.
 */
export default function ForgotPasswordPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = useEmailField();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (searchParams.get("error") === "link_vencido") {
      toast.error(t("forgotPassword.linkExpired"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    if (!email.valid || sending) return;
    setSending(true);
    try {
      await requestPasswordReset(email.value);
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <ScreenShell style={{ alignItems: "center", justifyContent: "center", padding: "var(--screen-padding)", gap: 20, textAlign: "center" }}>
        <Icon name="mail" size={48} color="var(--good)" />
        <h1 className="t-title" style={{ margin: 0 }}>{t("forgotPassword.sentTitle")}</h1>
        <p className="t-body" style={{ color: "var(--text-secondary)", maxWidth: "32ch" }}>
          {t("forgotPassword.sentSubtitle")}
        </p>
        <div style={{ width: "100%", marginTop: 16 }}>
          <Button size="lg" onClick={() => router.push("/login")}>
            {t("forgotPassword.backToLogin")}
          </Button>
        </div>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell style={{ padding: "48px var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))", gap: 32 }}>
      <IconButton icon="chevron-left" ariaLabel={t("forgotPassword.back")} onClick={() => router.push("/login")} style={{ alignSelf: "flex-start", margin: -11 }} />

      <div>
        <h1 className="t-title" style={{ margin: 0 }}>{t("forgotPassword.title")}</h1>
        <p className="t-body" style={{ color: "var(--text-secondary)", marginTop: 8 }}>
          {t("forgotPassword.subtitle")}
        </p>
      </div>

      <Input placeholder={t("forgotPassword.emailPlaceholder")} {...email.bind} autoFocus />

      <div style={{ marginTop: "auto" }}>
        <Button size="lg" disabled={!email.valid || sending} onClick={handleSubmit}>
          {sending ? t("forgotPassword.sending") : t("forgotPassword.submit")}
        </Button>
      </div>
    </ScreenShell>
  );
}
