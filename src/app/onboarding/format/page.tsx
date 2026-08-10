"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button, IconButton, ListRow, ProgressSteps, Sheet } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { formatNumericDate, numberLocaleForUiLocale, type Locale } from "@/i18n/formatting";
import { useFormatPreferencesStore } from "@/stores/format-preferences-store";
import { DATE_FORMAT_OPTIONS, DECIMAL_SEPARATOR_OPTIONS, LANGUAGE_MESSAGE_KEY, decimalSeparatorExample } from "@/lib/reference/format-options";
import { setLocale } from "@/i18n/actions";
import { routing } from "@/i18n/routing";

/**
 * A4b — idioma, separador decimal y formato de fecha, con el default que
 * ya se auto-detectó (cookie `perze_locale` para el idioma, `"locale"`
 * para los otros dos) pero editable acá: es la única pantalla del
 * onboarding donde el usuario define explícitamente cómo quiere LEER los
 * números, no solo qué moneda usa. Mismos pickers que `/more/settings`
 * (`DATE_FORMAT_OPTIONS`/`DECIMAL_SEPARATOR_OPTIONS`/`LANGUAGE_MESSAGE_KEY`,
 * `src/lib/reference/format-options.ts`) — se reusan tal cual, no se
 * reinventan.
 */
export default function OnboardingFormatPage() {
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const decimalSeparatorPref = useFormatPreferencesStore((s) => s.decimalSeparator);
  const setDecimalSeparatorPref = useFormatPreferencesStore((s) => s.setDecimalSeparator);
  const dateFormatPref = useFormatPreferencesStore((s) => s.dateFormat);
  const setDateFormatPref = useFormatPreferencesStore((s) => s.setDateFormat);
  const localeDecimalSeparator = numberLocaleForUiLocale(locale) === "en-US" ? "." : ",";

  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);
  const [decimalSheetOpen, setDecimalSheetOpen] = useState(false);
  const [dateFormatSheetOpen, setDateFormatSheetOpen] = useState(false);
  const [localePending, setLocalePending] = useState(false);

  const handleSelectLocale = (next: Locale) => {
    if (next === locale) {
      setLanguageSheetOpen(false);
      return;
    }
    setLocalePending(true);
    void (async () => {
      await setLocale(next);
      setLanguageSheetOpen(false);
      // El draft de onboarding vive en `localStorage` (`perze-onboarding`),
      // no en el árbol de React — `router.refresh()` re-renderiza los
      // Server Components con el nuevo idioma sin desmontar el cliente,
      // así que el draft sobrevive al cambio.
      router.refresh();
      setLocalePending(false);
    })();
  };

  return (
    <ScreenShell style={{ padding: "16px var(--screen-padding) calc(var(--screen-padding) + env(safe-area-inset-bottom))", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <IconButton icon="chevron-left" ariaLabel={t("onboarding.format.back")} onClick={() => router.push("/onboarding/country")} style={{ margin: -11 }} />
        <ProgressSteps current={3} total={5} onSkip={() => router.push("/onboarding/usage")} skipLabel={t("ds.progressSteps.skip")} />
      </div>

      <div>
        <h1 className="t-title" style={{ margin: 0 }}>{t("onboarding.format.title")}</h1>
        <p className="t-body" style={{ color: "var(--text-secondary)", marginTop: 8 }}>
          {t("onboarding.format.subtitle")}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <ListRow
          icon="globe"
          label={t("onboarding.format.language")}
          value={t(LANGUAGE_MESSAGE_KEY[locale])}
          variant="value"
          disabled={localePending}
          onClick={() => setLanguageSheetOpen(true)}
        />
        <ListRow
          icon="globe"
          label={t("onboarding.format.decimalSeparator")}
          value={decimalSeparatorExample(decimalSeparatorPref, localeDecimalSeparator)}
          variant="value"
          onClick={() => setDecimalSheetOpen(true)}
        />
        <ListRow
          icon="calendar"
          label={t("onboarding.format.dateFormat")}
          value={formatNumericDate(locale, new Date(), dateFormatPref)}
          variant="value"
          onClick={() => setDateFormatSheetOpen(true)}
        />
      </div>

      <div style={{ marginTop: "auto" }}>
        <Button onClick={() => router.push("/onboarding/usage")}>{t("onboarding.format.continue")}</Button>
      </div>

      <Sheet open={languageSheetOpen} title={t("morePage.languageSheetTitle")} onClose={() => setLanguageSheetOpen(false)}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {routing.locales.map((candidate) => (
            <ListRow
              key={candidate}
              label={t(LANGUAGE_MESSAGE_KEY[candidate])}
              variant="value"
              value={candidate === locale ? "✓" : undefined}
              disabled={localePending}
              onClick={() => handleSelectLocale(candidate)}
            />
          ))}
        </div>
      </Sheet>

      <Sheet open={decimalSheetOpen} title={t("settingsPage.decimalSeparator")} onClose={() => setDecimalSheetOpen(false)}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <p className="t-body" style={{ margin: "0 0 8px", color: "var(--text-secondary)" }}>{t("settingsPage.decimalSeparatorHint")}</p>
          {DECIMAL_SEPARATOR_OPTIONS.map((pref) => (
            <ListRow
              key={pref}
              label={t(`settingsPage.decimalSeparatorOptions.${pref}`)}
              meta={decimalSeparatorExample(pref, localeDecimalSeparator)}
              variant="value"
              value={pref === decimalSeparatorPref ? "✓" : undefined}
              onClick={() => {
                setDecimalSeparatorPref(pref);
                setDecimalSheetOpen(false);
              }}
            />
          ))}
        </div>
      </Sheet>

      <Sheet open={dateFormatSheetOpen} title={t("settingsPage.dateFormat")} onClose={() => setDateFormatSheetOpen(false)}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <p className="t-body" style={{ margin: "0 0 8px", color: "var(--text-secondary)" }}>{t("settingsPage.dateFormatHint")}</p>
          {DATE_FORMAT_OPTIONS.map((pref) => (
            <ListRow
              key={pref}
              label={t(`settingsPage.dateFormatOptions.${pref}`)}
              meta={formatNumericDate(locale, new Date(), pref)}
              variant="value"
              value={pref === dateFormatPref ? "✓" : undefined}
              onClick={() => {
                setDateFormatPref(pref);
                setDateFormatSheetOpen(false);
              }}
            />
          ))}
        </div>
      </Sheet>
    </ScreenShell>
  );
}
