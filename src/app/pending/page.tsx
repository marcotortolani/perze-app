"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Icon, ZMark } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { createClient } from "@/lib/supabase/client";
import { profilesRepo, type AccessStatus } from "@/lib/repos/profiles-repo";
import { getPendingInviteCode } from "@/lib/onboarding/pending-invite";
import { signOut } from "@/lib/auth/sign-out";

/**
 * Acceso controlado (§3.2/§4) — pantalla que ve TODO usuario nuevo antes de
 * poder tocar el resto de la app: `proxy.ts` redirige acá a cualquier
 * sesión cuyo perfil no esté `approved`, y `/onboarding/verify` y
 * `/onboarding/success` hacen lo mismo del lado cliente. Full-screen, fuera
 * de `(app)/` — no tiene tab bar, es un flujo de pantalla completa como
 * `/add` o `/accounts/new` (convención de rutas de `CLAUDE.md`).
 *
 * Es también el primer lugar donde alguien nuevo ve la nota de privacidad
 * completa (§4): el momento en que más importa, porque literalmente está
 * esperando a que una persona lo revise.
 */
export default function PendingPage() {
  const t = useTranslations();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | AccessStatus>("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const running = useRef(false);

  async function load() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/onboarding");
      return;
    }
    setEmail(user.email ?? null);
    const access = await profilesRepo.getOwnAccess(user.id);
    if (!access || access.accessStatus === "approved") {
      // Respaldo del mismo chequeo que ya hacen `/onboarding` y
      // `/onboarding/verify` antes de llegar acá: si quedó un código de
      // invitación sin canjear (por ejemplo, una sesión vieja que cayó a
      // `/pending` antes de que existiera ese chequeo), termina de
      // canjearlo en vez de crear un household nuevo por default en A11.
      if (getPendingInviteCode()) {
        router.replace("/join");
        return;
      }
      router.replace("/onboarding/success");
      return;
    }
    setStatus(access.accessStatus);
  }

  useEffect(() => {
    if (running.current) return;
    running.current = true;
    void load().finally(() => {
      running.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = async () => {
    setChecking(true);
    try {
      await load();
    } finally {
      setChecking(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace("/onboarding");
  };

  if (status === "loading") {
    return (
      <ScreenShell style={{ alignItems: "center", justifyContent: "center" }}>
        <ZMark size={16} gap={5} animated variant="sweep" aria-label={t("app.name")} />
      </ScreenShell>
    );
  }

  const rejected = status === "rejected";

  return (
    <ScreenShell style={{ alignItems: "center", justifyContent: "center", padding: "var(--screen-padding)", gap: 20, textAlign: "center" }}>
      <Icon name={rejected ? "alert" : "clock"} size={48} color={rejected ? "var(--critical)" : "var(--text-secondary)"} />
      <h1 className="t-title" style={{ margin: 0 }}>
        {t(rejected ? "onboarding.pending.rejectedTitle" : "onboarding.pending.pendingTitle")}
      </h1>
      <p className="t-body" style={{ color: "var(--text-secondary)", maxWidth: "36ch" }}>
        {t(rejected ? "onboarding.pending.rejectedSubtitle" : "onboarding.pending.pendingSubtitle")}
      </p>
      {email ? (
        <p className="t-label" style={{ color: "var(--text-muted)" }}>
          {t("onboarding.pending.verifiedAs", { email })}
        </p>
      ) : null}

      <div className="t-body" style={{ color: "var(--text-secondary)", textAlign: "left", maxWidth: "36ch", marginTop: 8 }}>
        <p style={{ margin: "0 0 8px" }}>{t("privacyNotice.who")}</p>
        <p style={{ margin: "0 0 8px" }}>{t("privacyNotice.sees")}</p>
        <p style={{ margin: "0 0 8px" }}>{t("privacyNotice.neverSees")}</p>
        <p style={{ margin: 0 }}>{t("privacyNotice.noThirdParty")}</p>
      </div>

      <div style={{ width: "100%", marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {!rejected ? (
          <Button size="lg" disabled={checking} onClick={handleRefresh}>
            {checking ? t("onboarding.pending.stillPending") : t("onboarding.pending.refresh")}
          </Button>
        ) : null}
        <button
          type="button"
          onClick={handleSignOut}
          style={{ background: "none", border: 0, cursor: "pointer", color: "var(--text-muted)", fontSize: 14, padding: 8 }}
        >
          {t("onboarding.pending.signOut")}
        </button>
      </div>
    </ScreenShell>
  );
}
