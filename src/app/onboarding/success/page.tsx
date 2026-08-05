"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Icon, ZMark } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useInvalidateHousehold } from "@/hooks/use-current-household";
import { completeOnboarding } from "@/lib/onboarding/complete-onboarding";
import { householdsRepo } from "@/lib/repos/households-repo";
import { accountsRepo } from "@/lib/repos/accounts-repo";
import { profilesRepo } from "@/lib/repos/profiles-repo";
import { createClient } from "@/lib/supabase/client";
import type { AccountKind } from "@/lib/db/schema";

const PRESET_KIND: Record<string, AccountKind> = { Efectivo: "cash" };

/**
 * A11 — éxito + CTA gigante al keypad. Acá se crea el household real:
 * cuenta + plantilla Básica en silencio.
 *
 * B7 — la única guarda antes era `started.current`, que no sobrevive a un
 * remount real (volver a esta pantalla, no solo el doble-invoke de
 * StrictMode): un usuario que entra de nuevo a `/onboarding/success` con
 * el household ya creado terminaba con un segundo household "Mi hogar"
 * huérfano. Ahora primero se consulta `getCurrentHouseholdId()` — si ya
 * hay uno activo, se asume que este flujo ya corrió y se salta la
 * creación entera. También se suma estado de error con reintento: antes
 * un fallo de red a mitad de camino dejaba la pantalla colgada en el
 * loader para siempre.
 */
export default function OnboardingSuccessPage() {
  const t = useTranslations();
  const router = useRouter();
  const draft = useOnboardingStore((s) => s.draft);
  const setField = useOnboardingStore((s) => s.setField);
  const invalidateHousehold = useInvalidateHousehold();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const running = useRef(false);

  async function run() {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        // Sin sesión (llegó a A11 sin pasar por A2/A3 real) — vuelve al
        // inicio del login en vez de crear un household que después no
        // podría sincronizar nunca (created_by no coincidiría con ningún
        // auth.uid()).
        router.replace("/onboarding");
        return;
      }

      // Acceso controlado (§3.2) — `/onboarding/*` está exento de sesión en
      // `proxy.ts` (así puede pedir el email a alguien sin cuenta todavía),
      // así que esta pantalla es la única barrera server-aware antes de
      // `completeOnboarding()`, el punto real de escritura. Un usuario que
      // navega acá a mano con sesión pero sin aprobación no debe poder
      // crear un household.
      const access = await profilesRepo.getOwnAccess(user.id);
      if (access && access.accessStatus !== "approved") {
        router.replace("/pending");
        return;
      }

      const existingHouseholdId = await householdsRepo.getCurrentHouseholdId();
      if (existingHouseholdId) {
        const [existingAccount] = await accountsRepo.list(existingHouseholdId);
        setField("pendingBalanceAccountId", existingAccount?.id ?? null);
        invalidateHousehold();
        setStatus("ready");
        return;
      }

      const accountName = draft.accountPreset ?? "Efectivo";
      const accountKind = PRESET_KIND[accountName] ?? (accountName === "Otro" ? "other" : "wallet");
      // El nombre real del registro (A2b) — es el que van a ver los otros
      // miembros del hogar en J1.
      const profile = await profilesRepo.getOwn(user.id).catch(() => null);
      const { householdId, accountId } = await completeOnboarding({
        userId: user.id,
        displayName: profile?.displayName ?? null,
        countryCode: draft.countryCode,
        currencyCode: draft.currencyCode,
        usage: draft.usage ?? "solo",
        accountName,
        accountKind,
      });
      // AC-3 — publica el household activo en el perfil para que un
      // dispositivo nuevo sepa cuál restaurar. Best-effort: si falla, la
      // hidratación cae al household más viejo, que para un usuario con
      // uno solo es el mismo.
      void profilesRepo.setDefaultHousehold(user.id, householdId).catch(() => {});
      setField("pendingBalanceAccountId", accountId);
      invalidateHousehold();
      setStatus("ready");
    } catch {
      setStatus("error");
    } finally {
      running.current = false;
    }
  }

  useEffect(() => {
    if (running.current) return;
    running.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  if (status === "error") {
    return (
      <ScreenShell style={{ alignItems: "center", justifyContent: "center", padding: "var(--screen-padding)", gap: 20, textAlign: "center" }}>
        <Icon name="alert" size={48} color="var(--critical)" />
        <h1 className="t-title" style={{ margin: 0 }}>{t("onboarding.success.errorTitle")}</h1>
        <p className="t-body" style={{ color: "var(--text-secondary)", maxWidth: "32ch" }}>
          {t("onboarding.success.errorSubtitle")}
        </p>
        <div style={{ width: "100%", marginTop: 16 }}>
          <Button
            size="lg"
            onClick={() => {
              setStatus("loading");
              setAttempt((n) => n + 1);
            }}
          >
            {t("onboarding.success.retry")}
          </Button>
        </div>
      </ScreenShell>
    );
  }

  if (status === "loading") {
    return (
      <ScreenShell style={{ alignItems: "center", justifyContent: "center" }}>
        <ZMark size={16} gap={5} animated variant="sweep" aria-label={t("app.name")} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell style={{ alignItems: "center", justifyContent: "center", padding: "var(--screen-padding)", gap: 20, textAlign: "center" }}>
      <Icon name="check" size={48} color="var(--good)" />
      <h1 className="t-title" style={{ margin: 0 }}>{t("onboarding.success.title")}</h1>
      <p className="t-body" style={{ color: "var(--text-secondary)", maxWidth: "32ch" }}>
        {t("onboarding.success.subtitle")}
      </p>
      <div style={{ width: "100%", marginTop: 16 }}>
        <Button size="lg" onClick={() => router.push("/add")}>
          {t("onboarding.success.cta")}
        </Button>
      </div>
    </ScreenShell>
  );
}
