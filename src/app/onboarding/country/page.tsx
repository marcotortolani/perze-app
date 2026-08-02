"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, IconButton, OptionCard, ProgressSteps } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { COUNTRIES, COUNTRY_MESSAGE_KEY } from "@/lib/reference/countries-currencies";
import { createClient } from "@/lib/supabase/client";
import { profilesRepo } from "@/lib/repos/profiles-repo";

function guessCountry(): string {
  if (typeof navigator === "undefined") return "UY";
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    return COUNTRIES.some((c) => c.code === region) ? region! : "UY";
  } catch {
    return "UY";
  }
}

/** A4 — país y moneda, pre-detectado, un solo tap para confirmar. Se llama "tu moneda", no "moneda base". */
export default function OnboardingCountryPage() {
  const router = useRouter();
  const t = useTranslations();
  const setField = useOnboardingStore((s) => s.setField);
  const [countryCode, setCountryCode] = useState("UY");

  // Detección post-mount, no en el initializer de `useState`: `navigator` no
  // existe en el render de servidor, así que hacerlo ahí arriesga un mismatch
  // de hidratación. Es una sincronización genuina con una API del browser que
  // no se puede conocer en SSR — no hay forma de derivarlo durante el render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCountryCode(guessCountry());
  }, []);

  const country = COUNTRIES.find((c) => c.code === countryCode)!;

  const handleConfirm = () => {
    setField("countryCode", country.code);
    setField("currencyCode", country.defaultCurrency);

    // `profiles.country` — documentado desde `20260801180000_access_control.sql`
    // como completado acá, pero nunca se escribía (la métrica `byCountry` del
    // panel de operador leía siempre "desconocido"). Best-effort: nunca
    // bloquea el avance del onboarding si falla.
    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) await profilesRepo.updateCountry(user.id, country.code).catch(() => {});
    })();

    router.push("/onboarding/usage");
  };

  return (
    <ScreenShell style={{ padding: "16px var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <IconButton icon="chevron-left" ariaLabel={t("onboarding.country.back")} onClick={() => router.push("/onboarding")} style={{ margin: -11 }} />
        <ProgressSteps current={1} total={3} onSkip={() => router.push("/onboarding/usage")} skipLabel={t("ds.progressSteps.skip")} />
      </div>

      <div>
        <h1 className="t-title" style={{ margin: 0 }}>{t("onboarding.country.title")}</h1>
        <p className="t-body" style={{ color: "var(--text-secondary)", marginTop: 8 }}>
          {t("onboarding.country.subtitle")}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
        {COUNTRIES.map((c) => (
          <OptionCard
            key={c.code}
            title={t(COUNTRY_MESSAGE_KEY[c.code as keyof typeof COUNTRY_MESSAGE_KEY])}
            description={t("onboarding.country.yourCurrency", { currency: c.defaultCurrency })}
            selected={countryCode === c.code}
            onClick={() => setCountryCode(c.code)}
          />
        ))}
      </div>

      <div style={{ marginTop: "auto" }}>
        <Button onClick={handleConfirm}>{t("onboarding.country.continue")}</Button>
      </div>
    </ScreenShell>
  );
}
