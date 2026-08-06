"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Icon, ZMark } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { createClient } from "@/lib/supabase/client";
import { hydrateFromRemote } from "@/lib/offline/hydrate";
import { useInvalidateHousehold } from "@/hooks/use-current-household";

/**
 * AC-1 (`docs/auditoria-acceso.md`) — destino de `resolveOnboardingDestination()`
 * cuando el usuario ya tiene un household en el servidor pero este dispositivo
 * no tiene los datos locales: los baja con `hydrateFromRemote()` y entra a la
 * app. Reemplaza al freno `/onboarding/existing-household` de v0.7.1.
 */
export default function OnboardingRestorePage() {
  const t = useTranslations();
  const router = useRouter();
  const invalidateHousehold = useInvalidateHousehold();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const running = useRef(false);

  useEffect(() => {
    if (running.current) return;
    running.current = true;

    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.replace("/onboarding");
          return;
        }

        const result = await hydrateFromRemote();
        invalidateHousehold();

        if (result.households === 0) {
          // Carrera legítima: el chequeo remoto vio un household que ya no
          // existe (o quedó soft-deleted) — no hay nada que restaurar, sigue
          // el alta normal.
          router.replace("/onboarding/country");
          return;
        }

        router.replace("/");
      } catch {
        setStatus("error");
      } finally {
        running.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  if (status === "error") {
    return (
      <ScreenShell style={{ alignItems: "center", justifyContent: "center", padding: "var(--screen-padding)", gap: 20, textAlign: "center" }}>
        <Icon name="alert" size={48} color="var(--critical)" />
        <h1 className="t-title" style={{ margin: 0 }}>{t("onboarding.restore.errorTitle")}</h1>
        <p className="t-body" style={{ color: "var(--text-secondary)", maxWidth: "32ch" }}>
          {t("onboarding.restore.errorSubtitle")}
        </p>
        <div style={{ width: "100%", marginTop: 16 }}>
          <Button
            size="lg"
            onClick={() => {
              setStatus("loading");
              setAttempt((n) => n + 1);
            }}
          >
            {t("onboarding.restore.retry")}
          </Button>
        </div>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell style={{ alignItems: "center", justifyContent: "center", padding: "var(--screen-padding)", gap: 20, textAlign: "center" }}>
      <ZMark size={16} gap={5} animated variant="sweep" aria-label={t("app.name")} />
      <h1 className="t-title" style={{ margin: 0 }}>{t("onboarding.restore.title")}</h1>
      <p className="t-body" style={{ color: "var(--text-secondary)", maxWidth: "32ch" }}>
        {t("onboarding.restore.subtitle")}
      </p>
    </ScreenShell>
  );
}
