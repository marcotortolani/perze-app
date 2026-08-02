"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { AppHeader, Button, Input, ListRow, Sheet, Skeleton } from "@/design-system";
import { useCurrentUserId, useCurrentUserEmail } from "@/hooks/use-current-user";
import { profilesRepo } from "@/lib/repos/profiles-repo";
import { COUNTRIES, COUNTRY_MESSAGE_KEY } from "@/lib/reference/countries-currencies";
import { setLocale } from "@/i18n/actions";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/i18n/formatting";
import { applyThemePreference } from "@/lib/theme/apply-theme";
import { useThemePreference } from "@/lib/theme/use-theme-preference";
import type { ThemePreference } from "@/lib/theme/constants";

const LANGUAGE_MESSAGE_KEY = {
  es: "morePage.languageNames.es",
  en: "morePage.languageNames.en",
  pt: "morePage.languageNames.pt",
} as const;

const THEME_OPTIONS: ThemePreference[] = ["system", "light", "dark"];

/**
 * K2 — perfil. Además del nombre, agrupa acá lo que antes vivía suelto en
 * el índice de Más: idioma y tema (B7/K3 del diseño los separaba; decisión
 * de producto explícita de reagruparlos en Perfil). El email es de solo
 * lectura — es el dato de identificación de `auth.users`, cambiarlo
 * requiere confirmación y queda fuera de alcance de esta versión. País y
 * tema aplican al tocar la opción, igual que el resto de los selectores de
 * Ajustes (K3); nombre y fecha de nacimiento comparten un botón Guardar
 * porque son texto libre, no una elección de una lista.
 */
export default function ProfilePage() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale() as Locale;
  const userId = useCurrentUserId();
  const email = useCurrentUserEmail();
  const profileQuery = useQuery({ queryKey: ["profile", userId], queryFn: () => profilesRepo.getOwn(userId!), enabled: !!userId });
  const storedThemePreference = useThemePreference();

  const [name, setName] = useState<string | null>(null);
  const [themeOverride, setThemeOverride] = useState<ThemePreference | null>(null);
  const themePreference = themeOverride ?? storedThemePreference;
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [countrySheetOpen, setCountrySheetOpen] = useState(false);
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const [localePending, setLocalePending] = useState(false);
  const [countryPending, setCountryPending] = useState(false);

  if (profileQuery.isLoading || !userId) return <Skeleton height={400} style={{ marginTop: 16 }} />;

  const displayName = name ?? profileQuery.data?.displayName ?? "";
  const currentBirthDate = birthDate ?? profileQuery.data?.birthDate ?? "";
  const country = COUNTRIES.find((c) => c.code === profileQuery.data?.country);

  const dirty = displayName.trim() !== (profileQuery.data?.displayName ?? "") || currentBirthDate !== (profileQuery.data?.birthDate ?? "");

  const handleSave = async () => {
    if (!displayName.trim() || saving || !dirty) return;
    setSaving(true);
    try {
      await Promise.all([
        profilesRepo.updateDisplayName(userId, displayName.trim()),
        profilesRepo.updateBirthDate(userId, currentBirthDate || null),
      ]);
      toast(t("profilePage.saved"));
      profileQuery.refetch();
    } finally {
      setSaving(false);
    }
  };

  const handleSelectCountry = async (code: string) => {
    if (countryPending || code === profileQuery.data?.country) {
      setCountrySheetOpen(false);
      return;
    }
    setCountryPending(true);
    try {
      await profilesRepo.updateCountry(userId, code);
      await profileQuery.refetch();
      setCountrySheetOpen(false);
    } finally {
      setCountryPending(false);
    }
  };

  const handleSelectLocale = (next: Locale) => {
    if (next === locale) {
      setLanguageSheetOpen(false);
      return;
    }
    setLocalePending(true);
    void (async () => {
      await setLocale(next);
      setLanguageSheetOpen(false);
      router.refresh();
      setLocalePending(false);
    })();
  };

  const handleSelectTheme = (pref: ThemePreference) => {
    applyThemePreference(pref);
    setThemeOverride(pref);
    setThemeSheetOpen(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={t("profilePage.title")} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
      <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 16, paddingBottom: 24 }}>
        <Input label={t("profilePage.displayName")} value={displayName} onChange={(e) => setName(e.target.value)} />
        <Input label={t("profilePage.email")} value={email ?? ""} readOnly hint={t("profilePage.emailHint")} />
        <Input
          label={t("profilePage.birthDate")}
          type="date"
          value={currentBirthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          hint={t("profilePage.birthDateHint")}
        />
        <Button disabled={!displayName.trim() || saving || !dirty} onClick={handleSave}>
          {t("common.save")}
        </Button>

        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          <ListRow
            icon="flag"
            label={t("profilePage.country")}
            value={country ? t(COUNTRY_MESSAGE_KEY[country.code as keyof typeof COUNTRY_MESSAGE_KEY]) : t("profilePage.countryUnset")}
            variant="value"
            disabled={countryPending}
            onClick={() => setCountrySheetOpen(true)}
          />
          <ListRow
            icon="globe"
            label={t("morePage.language")}
            value={t(LANGUAGE_MESSAGE_KEY[locale])}
            variant="value"
            disabled={localePending}
            onClick={() => setLanguageSheetOpen(true)}
          />
          <ListRow
            icon="eye"
            label={t("profilePage.theme")}
            value={t(`profilePage.themeOptions.${themePreference}`)}
            variant="value"
            onClick={() => setThemeSheetOpen(true)}
          />
        </div>
      </div>

      <Sheet open={countrySheetOpen} title={t("profilePage.countrySheetTitle")} onClose={() => setCountrySheetOpen(false)} height={420}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {COUNTRIES.map((c) => (
            <ListRow
              key={c.code}
              label={t(COUNTRY_MESSAGE_KEY[c.code as keyof typeof COUNTRY_MESSAGE_KEY])}
              variant="value"
              value={c.code === profileQuery.data?.country ? "✓" : undefined}
              disabled={countryPending}
              onClick={() => handleSelectCountry(c.code)}
            />
          ))}
        </div>
      </Sheet>

      <Sheet open={languageSheetOpen} title={t("morePage.languageSheetTitle")} onClose={() => setLanguageSheetOpen(false)} height={280}>
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

      <Sheet open={themeSheetOpen} title={t("profilePage.themeSheetTitle")} onClose={() => setThemeSheetOpen(false)} height={280}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {THEME_OPTIONS.map((option) => (
            <ListRow
              key={option}
              label={t(`profilePage.themeOptions.${option}`)}
              variant="value"
              value={option === themePreference ? "✓" : undefined}
              onClick={() => handleSelectTheme(option)}
            />
          ))}
        </div>
      </Sheet>
    </div>
  );
}
