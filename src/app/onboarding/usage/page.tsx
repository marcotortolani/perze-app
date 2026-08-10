"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, IconButton, OptionCard, ProgressSteps } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { useOnboardingStore, type HouseholdUsage } from "@/stores/onboarding-store";

/** A5 — decide si el módulo de grupo familiar arranca encendido. */
export default function OnboardingUsagePage() {
  const router = useRouter();
  const t = useTranslations();
  const setField = useOnboardingStore((s) => s.setField);
  const [usage, setUsage] = useState<HouseholdUsage>("solo");

  const OPTIONS: Array<{ id: HouseholdUsage; title: string; description: string }> = [
    { id: "solo", title: t("onboarding.usage.options.solo.title"), description: t("onboarding.usage.options.solo.description") },
    { id: "pareja", title: t("onboarding.usage.options.pareja.title"), description: t("onboarding.usage.options.pareja.description") },
    { id: "familia", title: t("onboarding.usage.options.familia.title"), description: t("onboarding.usage.options.familia.description") },
  ];

  const handleConfirm = () => {
    setField("usage", usage);
    router.push("/onboarding/account");
  };

  return (
    <ScreenShell style={{ padding: "16px var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <IconButton icon="chevron-left" ariaLabel={t("onboarding.usage.back")} onClick={() => router.push("/onboarding/format")} style={{ margin: -11 }} />
        <ProgressSteps current={4} total={5} onSkip={() => router.push("/onboarding/account")} skipLabel={t("ds.progressSteps.skip")} />
      </div>

      <div>
        <h1 className="t-title" style={{ margin: 0 }}>{t("onboarding.usage.title")}</h1>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {OPTIONS.map((o) => (
          <OptionCard key={o.id} title={o.title} description={o.description} selected={usage === o.id} onClick={() => setUsage(o.id)} />
        ))}
      </div>

      <div style={{ marginTop: "auto" }}>
        <Button onClick={handleConfirm}>{t("onboarding.usage.continue")}</Button>
      </div>
    </ScreenShell>
  );
}
