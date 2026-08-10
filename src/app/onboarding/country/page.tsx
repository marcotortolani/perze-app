"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, IconButton, ListRow, OptionCard, ProgressSteps, Sheet } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { useOnboardingHydrated, useOnboardingStore } from "@/stores/onboarding-store";
import { COUNTRIES, COUNTRY_MESSAGE_KEY } from "@/lib/reference/countries-currencies";
import { useCurrencies } from "@/hooks/use-currencies";
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

/**
 * A4 — país, pre-detectado, un solo tap para confirmar. La moneda arranca
 * derivada del país (`country.defaultCurrency`) pero es editable aparte
 * (`currencyTouched`): elegir un país no debe pisar una moneda que el
 * usuario ya cambió a mano, pero sí debe seguir sugiriendo mientras no la
 * haya tocado — quien vive en Uruguay pero cobra en dólares puede
 * quedarse con USD sin tener que "deshacer" nada.
 *
 * `draft.countryConfirmed` es lo que evita que volver acá (desde A4b, con
 * el botón atrás) re-dispare la auto-detección y pise una elección real:
 * sin ese flag, un país ya elegido no se puede distinguir del default
 * "UY" sin tocar (coinciden), así que cada montaje volvía a auto-detectar.
 * Con el flag, un país ya confirmado se restaura tal cual quedó y la
 * moneda se trata como "tocada" — restaurar no debe re-derivar la moneda
 * del país si el usuario ya la había elegido aparte.
 */
export default function OnboardingCountryPage() {
  const router = useRouter();
  const t = useTranslations();
  const hydrated = useOnboardingHydrated();
  const draft = useOnboardingStore((s) => s.draft);
  const setField = useOnboardingStore((s) => s.setField);
  const [countryCode, setCountryCode] = useState("UY");
  const [currencyCode, setCurrencyCode] = useState("UYU");
  const [currencyTouched, setCurrencyTouched] = useState(false);
  const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
  const { data: currencies = [] } = useCurrencies();

  // Post-hidratación del store, no en el initializer de `useState`: hasta
  // que `persist` termine de leer `localStorage`, `draft.countryConfirmed`
  // todavía puede estar en su default `false` aunque el valor real
  // guardado sea `true` — resolver esto antes de tiempo pisaría una
  // elección real con la auto-detección. `guessCountry()` tampoco es
  // derivable en SSR (usa `navigator`), así que de cualquier forma esto
  // tiene que vivir en un efecto.
  useEffect(() => {
    if (!hydrated) return;
    if (draft.countryConfirmed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCountryCode(draft.countryCode);
      setCurrencyCode(draft.currencyCode);
      setCurrencyTouched(true);
      return;
    }
    const detected = guessCountry();
    setCountryCode(detected);
    setCurrencyCode(COUNTRIES.find((c) => c.code === detected)?.defaultCurrency ?? "UYU");
  }, [hydrated, draft.countryConfirmed, draft.countryCode, draft.currencyCode]);

  const country = COUNTRIES.find((c) => c.code === countryCode)!;
  const currency = currencies.find((c) => c.code === currencyCode);

  const handleSelectCountry = (code: string) => {
    setCountryCode(code);
    if (!currencyTouched) {
      const nextCountry = COUNTRIES.find((c) => c.code === code)!;
      setCurrencyCode(nextCountry.defaultCurrency);
    }
  };

  const handleSelectCurrency = (code: string) => {
    setCurrencyCode(code);
    setCurrencyTouched(true);
    setCurrencySheetOpen(false);
  };

  const handleConfirm = () => {
    setField("countryCode", country.code);
    setField("currencyCode", currencyCode);
    setField("countryConfirmed", true);

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

    router.push("/onboarding/format");
  };

  return (
    <ScreenShell style={{ padding: "16px var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <IconButton icon="chevron-left" ariaLabel={t("onboarding.country.back")} onClick={() => router.push("/onboarding/profile")} style={{ margin: -11 }} />
        <ProgressSteps current={2} total={5} onSkip={() => router.push("/onboarding/format")} skipLabel={t("ds.progressSteps.skip")} />
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
            onClick={() => handleSelectCountry(c.code)}
          />
        ))}
      </div>

      <ListRow
        icon="wallet"
        label={t("onboarding.country.currency")}
        value={currency?.code ?? currencyCode}
        variant="value"
        onClick={() => setCurrencySheetOpen(true)}
      />

      <div style={{ marginTop: "auto" }}>
        <Button onClick={handleConfirm}>{t("onboarding.country.continue")}</Button>
      </div>

      <Sheet open={currencySheetOpen} title={t("onboarding.country.currencySheetTitle")} onClose={() => setCurrencySheetOpen(false)} height={420}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <p className="t-body" style={{ margin: "0 0 8px", color: "var(--text-secondary)" }}>{t("onboarding.country.currencyHint")}</p>
          {currencies.map((c) => (
            <ListRow
              key={c.code}
              label={c.name}
              meta={c.code}
              variant="value"
              value={c.code === currencyCode ? "✓" : undefined}
              onClick={() => handleSelectCurrency(c.code)}
            />
          ))}
        </div>
      </Sheet>
    </ScreenShell>
  );
}
