"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Icon, Skeleton } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useInvalidateHousehold } from "@/hooks/use-current-household";
import { completeOnboarding } from "@/lib/onboarding/complete-onboarding";
import { createClient } from "@/lib/supabase/client";
import type { AccountKind } from "@/lib/db/schema";

const PRESET_KIND: Record<string, AccountKind> = { Efectivo: "cash" };

/** A11 — éxito + CTA gigante al keypad. Acá se crea el household real: cuenta + plantilla Básica en silencio. */
export default function OnboardingSuccessPage() {
  const t = useTranslations();
  const router = useRouter();
  const draft = useOnboardingStore((s) => s.draft);
  const setField = useOnboardingStore((s) => s.setField);
  const invalidateHousehold = useInvalidateHousehold();
  const [ready, setReady] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
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

      const accountName = draft.accountPreset ?? "Efectivo";
      const accountKind = PRESET_KIND[accountName] ?? (accountName === "Otro" ? "other" : "wallet");
      const { accountId } = await completeOnboarding({
        userId: user.id,
        countryCode: draft.countryCode,
        currencyCode: draft.currencyCode,
        usage: draft.usage ?? "solo",
        accountName,
        accountKind,
      });
      setField("pendingBalanceAccountId", accountId);
      invalidateHousehold();
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <ScreenShell style={{ alignItems: "center", justifyContent: "center" }}>
        <Skeleton width={160} height={16} />
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
