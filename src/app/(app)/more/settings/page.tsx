"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useScrollOverflow } from "@/hooks/use-scroll-overflow";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { Button, ListRow, Sheet, Skeleton, Switch, usePageHeader } from "@/design-system";
import { useAccounts } from "@/hooks/use-accounts";
import { useCurrentHousehold, useInvalidateHousehold } from "@/hooks/use-current-household";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { useHouseholdMembers } from "@/hooks/use-household-members";
import { useTransactions } from "@/hooks/use-transactions";
import { householdsRepo } from "@/lib/repos/households-repo";
import { changeBaseCurrencyRepo, type BaseCurrencyPreflight } from "@/lib/repos/change-base-currency-repo";
import { CURRENCIES } from "@/lib/reference/countries-currencies";
import { useNavStore, type FourthTab } from "@/stores/nav-store";
import { formatNumericDate, numberLocaleForUiLocale, type Locale } from "@/i18n/formatting";
import { useFormatPreferencesStore, type WeekStartPref } from "@/stores/format-preferences-store";
import { setLocale } from "@/i18n/actions";
import { routing } from "@/i18n/routing";
import { applyThemePreference } from "@/lib/theme/apply-theme";
import { useThemePreference } from "@/lib/theme/use-theme-preference";
import type { ThemePreference } from "@/lib/theme/constants";
import { applyBackdropPreference } from "@/lib/backdrop/apply-backdrop";
import { useBackdropPreference } from "@/lib/backdrop/use-backdrop-preference";
import { BACKDROP_DENSITIES, BACKDROP_INTENSITIES } from "@/lib/backdrop/constants";
import { DATE_FORMAT_OPTIONS, DECIMAL_SEPARATOR_OPTIONS, LANGUAGE_MESSAGE_KEY, decimalSeparatorExample } from "@/lib/reference/format-options";

const WEEK_START_OPTIONS: WeekStartPref[] = ["monday", "sunday"];
const WEEK_START_PREVIEW: Record<WeekStartPref, string> = {
  monday: "settingsPage.weekStartOptions.mondayPreview",
  sunday: "settingsPage.weekStartOptions.sundayPreview",
};
const THEME_OPTIONS: ThemePreference[] = ["system", "light", "dark"];

const FOURTH_TAB_MESSAGE_KEY = {
  analytics: "nav.analysis",
  accounts: "morePage.accounts",
  investments: "nav.investments",
  budgets: "morePage.budgets",
} as const satisfies Record<FourthTab, string>;

const CLOSE_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

/** K3 — preferencias: cuarto slot del tab bar, día de cierre por household, moneda del hogar. */
export default function SettingsPage() {
  const t = useTranslations();
  const { ref: scrollerRef, overflowing } = useScrollOverflow<HTMLDivElement>();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const userId = useEffectiveUserId();
  const decimalSeparatorPref = useFormatPreferencesStore((s) => s.decimalSeparator);
  const setDecimalSeparatorPref = useFormatPreferencesStore((s) => s.setDecimalSeparator);
  const dateFormatPref = useFormatPreferencesStore((s) => s.dateFormat);
  const setDateFormatPref = useFormatPreferencesStore((s) => s.setDateFormat);
  const weekStartPref = useFormatPreferencesStore((s) => s.weekStart);
  const setWeekStartPref = useFormatPreferencesStore((s) => s.setWeekStart);
  const [decimalSheetOpen, setDecimalSheetOpen] = useState(false);
  const [dateFormatSheetOpen, setDateFormatSheetOpen] = useState(false);
  const [weekStartSheetOpen, setWeekStartSheetOpen] = useState(false);
  const localeDecimalSeparator = numberLocaleForUiLocale(locale) === "en-US" ? "." : ",";
  const storedThemePreference = useThemePreference();
  const [themeOverride, setThemeOverride] = useState<ThemePreference | null>(null);
  const themePreference = themeOverride ?? storedThemePreference;
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const storedBackdropPreference = useBackdropPreference();
  const [backdropOverride, setBackdropOverride] = useState<typeof storedBackdropPreference | null>(null);
  const backdropPreference = backdropOverride ?? storedBackdropPreference;
  const [backdropDensitySheetOpen, setBackdropDensitySheetOpen] = useState(false);
  const [backdropIntensitySheetOpen, setBackdropIntensitySheetOpen] = useState(false);
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);
  const [localePending, setLocalePending] = useState(false);
  const { data: household } = useCurrentHousehold();
  const invalidateHousehold = useInvalidateHousehold();
  const { data: members } = useHouseholdMembers(household?.id);
  const { data: accounts } = useAccounts(household?.id);
  const { data: transactions } = useTransactions(household?.id);
  const fourthTab = useNavStore((s) => s.fourthTab);
  const setFourthTab = useNavStore((s) => s.setFourthTab);
  const [tabSheetOpen, setTabSheetOpen] = useState(false);
  const [closeDaySheetOpen, setCloseDaySheetOpen] = useState(false);
  const [baseCurrencySheetOpen, setBaseCurrencySheetOpen] = useState(false);
  const [baseCurrencyConfirm, setBaseCurrencyConfirm] = useState<{ currency: string; preflight: BaseCurrencyPreflight } | null>(null);
  const [applyingBaseCurrency, setApplyingBaseCurrency] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  usePageHeader({ title: t("morePage.settings"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  const isMultiCurrency = useMemo(() => new Set((accounts ?? []).map((a) => a.currencyCode)).size > 1, [accounts]);
  const hasTransactions = (transactions?.length ?? 0) > 0;

  const tabOptions = useMemo<FourthTab[]>(() => {
    const modules = household?.enabledModules ?? [];
    const options: FourthTab[] = ["analytics", "accounts"];
    if (modules.includes("budgets")) options.push("budgets");
    if (modules.includes("investments")) options.push("investments");
    return options;
  }, [household]);

  if (!household) return <Skeleton height={200} style={{ marginTop: 16 }} />;

  const isOwnerOrAdmin = (members ?? []).some((m) => m.profileId === userId && (m.role === "owner" || m.role === "admin"));

  const handleCloseDay = async (day: number) => {
    setSaving(true);
    try {
      await householdsRepo.update(household.id, { periodStartDay: day });
      invalidateHousehold();
      setCloseDaySheetOpen(false);
    } finally {
      setSaving(false);
    }
  };

  /**
   * PR 4 del plan de multi-household — ya no es un `householdsRepo.update()`
   * directo (eso reescribía `base_currency` sin tocar un solo `amount_base`,
   * dejando todo el histórico congelado contra la base vieja pero rotulado
   * con la nueva). Siempre pasa por la RPC de re-resolución
   * (`change-base-currency-repo.ts`), aunque no haya nada que resolver —
   * un solo camino, sin duplicar la lógica de permiso/auditoría en dos
   * lugares. Con preflight: solo se confirma con una hoja aparte cuando de
   * verdad hay algo que va a cambiar (movimientos que se resuelven o que
   * quedan pendientes) — es la excepción a "reversible, no confirmable",
   * igual que sacar a un miembro del hogar.
   */
  const handleBaseCurrency = async (currency: string) => {
    setBaseCurrencySheetOpen(false);
    if (currency === household.baseCurrency) return;
    setSaving(true);
    try {
      const preflight = await changeBaseCurrencyRepo.preflight(household.id, currency);
      const hasImpact = preflight.identityCount + preflight.resetCount + preflight.settlementsIdentityCount + preflight.settlementsResetCount > 0;
      if (!hasImpact) {
        await changeBaseCurrencyRepo.apply(household.id, currency);
        invalidateHousehold();
        queryClient.clear();
        toast(t("settingsPage.baseCurrencyChanged", { currency }));
        return;
      }
      setBaseCurrencyConfirm({ currency, preflight });
    } catch {
      toast(t("settingsPage.baseCurrencyError"));
    } finally {
      setSaving(false);
    }
  };

  const confirmBaseCurrencyChange = async () => {
    if (!baseCurrencyConfirm || applyingBaseCurrency) return;
    setApplyingBaseCurrency(true);
    try {
      await changeBaseCurrencyRepo.apply(household.id, baseCurrencyConfirm.currency);
      invalidateHousehold();
      queryClient.clear();
      toast(t("settingsPage.baseCurrencyChanged", { currency: baseCurrencyConfirm.currency }));
      setBaseCurrencyConfirm(null);
    } catch {
      toast(t("settingsPage.baseCurrencyError"));
    } finally {
      setApplyingBaseCurrency(false);
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

  const handleToggleBackdrop = (enabled: boolean) => {
    const next = { ...backdropPreference, enabled };
    applyBackdropPreference(next);
    setBackdropOverride(next);
  };

  const handleSelectBackdropDensity = (density: (typeof BACKDROP_DENSITIES)[number]) => {
    const next = { ...backdropPreference, density };
    applyBackdropPreference(next);
    setBackdropOverride(next);
    setBackdropDensitySheetOpen(false);
  };

  const handleSelectBackdropIntensity = (intensity: (typeof BACKDROP_INTENSITIES)[number]) => {
    const next = { ...backdropPreference, intensity };
    applyBackdropPreference(next);
    setBackdropOverride(next);
    setBackdropIntensitySheetOpen(false);
  };

  return (
    // `scroll-fade-bottom`: esta pantalla ahora maneja su propio scroll
    // (antes dependía del `<main>` compartido del shell) para poder tener
    // el mismo fade de `/accounts` — hay que sumarla a `OWN_SCROLLER_ROUTES`
    // en `(app)/layout.tsx`.
    <div className="scroll-fade-bottom" data-scroll-overflow={overflowing} style={{ "--scroll-fade-inset-right": "8px", display: "flex", flexDirection: "column", height: "100%" } as CSSProperties}>
      <div
        ref={scrollerRef}
        className="pb-[calc(var(--block-gap)_+_18px)] lg:pb-8 scroll-gutter-right"
        style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain", paddingTop: 12 }}
      >
        {/* `lg`+: se agrupa por afinidad real en vez de una sola lista
            plana de 12 filas — Datos a la izquierda (todo lo que cambia CÓMO
            se leen/calculan los números y fechas de esta instancia), Visual
            a la derecha (idioma, tema, el resto de apariencia — nada de eso
            toca un cálculo). Cada fila se queda con su nota/caption
            condicional pegada abajo, como ya estaba. */}
        <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 24 }}>
          <section>
            <div className="t-caption" style={{ color: "var(--text-muted)", padding: "0 4px 8px" }}>{t("settingsPage.dataSection")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <ListRow
                icon="wallet"
                label={t(isMultiCurrency ? "settingsPage.baseCurrency" : "settingsPage.yourCurrency")}
                value={household.baseCurrency}
                variant="value"
                disabled={!isOwnerOrAdmin}
                onClick={() => isOwnerOrAdmin && setBaseCurrencySheetOpen(true)}
              />
              {!isOwnerOrAdmin ? (
                <p className="t-caption" style={{ color: "var(--text-muted)", padding: "0 4px" }}>{t("settingsPage.baseCurrencyRestricted")}</p>
              ) : hasTransactions ? (
                <p className="t-caption" style={{ color: "var(--text-muted)", padding: "0 4px" }}>{t("settingsPage.baseCurrencyNote")}</p>
              ) : null}
              <ListRow
                icon="globe"
                label={t("settingsPage.decimalSeparator")}
                value={decimalSeparatorExample(decimalSeparatorPref, localeDecimalSeparator)}
                variant="value"
                onClick={() => setDecimalSheetOpen(true)}
              />
              <ListRow
                icon="calendar"
                label={t("settingsPage.dateFormat")}
                value={formatNumericDate(locale, new Date(), dateFormatPref)}
                variant="value"
                onClick={() => setDateFormatSheetOpen(true)}
              />
              <ListRow
                icon="calendar"
                label={t("settingsPage.weekStart")}
                value={t(`settingsPage.weekStartOptions.${weekStartPref}`)}
                variant="value"
                onClick={() => setWeekStartSheetOpen(true)}
              />
              <ListRow
                icon="calendar"
                label={t("settingsPage.closeDay")}
                value={String(household.periodStartDay)}
                variant="value"
                disabled={!isOwnerOrAdmin}
                onClick={() => isOwnerOrAdmin && setCloseDaySheetOpen(true)}
              />
              {!isOwnerOrAdmin ? (
                <p className="t-caption" style={{ color: "var(--text-muted)", padding: "0 4px" }}>{t("settingsPage.closeDayRestricted")}</p>
              ) : null}
            </div>
          </section>

          <section>
            <div className="t-caption" style={{ color: "var(--text-muted)", padding: "0 4px 8px" }}>{t("settingsPage.visualSection")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
            <ListRow
              icon="chart"
              label={t("settingsPage.fourthTab")}
              value={t(FOURTH_TAB_MESSAGE_KEY[fourthTab])}
              variant="value"
              onClick={() => setTabSheetOpen(true)}
            />
            <ListRow
              icon="list"
              label={t("settingsPage.backdrop")}
              right={<Switch id="backdrop-switch" checked={backdropPreference.enabled} onChange={handleToggleBackdrop} />}
            />
            <p className="t-caption" style={{ color: "var(--text-muted)", padding: "0 4px" }}>{t("settingsPage.backdropHint")}</p>
            {backdropPreference.enabled ? (
              <>
                <ListRow
                  label={t("settingsPage.backdropDensity")}
                  value={t(`settingsPage.backdropDensityOptions.${backdropPreference.density}`)}
                  variant="value"
                  onClick={() => setBackdropDensitySheetOpen(true)}
                />
                <ListRow
                  label={t("settingsPage.backdropIntensity")}
                  value={t(`settingsPage.backdropIntensityOptions.${backdropPreference.intensity}`)}
                  variant="value"
                  onClick={() => setBackdropIntensitySheetOpen(true)}
                />
              </>
            ) : null}
            </div>
          </section>
        </div>
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

      <Sheet open={themeSheetOpen} title={t("profilePage.themeSheetTitle")} onClose={() => setThemeSheetOpen(false)}>
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

      <Sheet open={backdropDensitySheetOpen} title={t("settingsPage.backdropDensity")} onClose={() => setBackdropDensitySheetOpen(false)}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {BACKDROP_DENSITIES.map((option) => (
            <ListRow
              key={option}
              label={t(`settingsPage.backdropDensityOptions.${option}`)}
              variant="value"
              value={option === backdropPreference.density ? "✓" : undefined}
              onClick={() => handleSelectBackdropDensity(option)}
            />
          ))}
        </div>
      </Sheet>

      <Sheet open={backdropIntensitySheetOpen} title={t("settingsPage.backdropIntensity")} onClose={() => setBackdropIntensitySheetOpen(false)}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {BACKDROP_INTENSITIES.map((option) => (
            <ListRow
              key={option}
              label={t(`settingsPage.backdropIntensityOptions.${option}`)}
              variant="value"
              value={option === backdropPreference.intensity ? "✓" : undefined}
              onClick={() => handleSelectBackdropIntensity(option)}
            />
          ))}
        </div>
      </Sheet>

      {/* Excepción a "reversible, no confirmable" (CLAUDE.md) — cambiar la
          moneda base es confirmable e irreversible: descarta la resolución
          de cotización de movimientos pasados. Confirma con los números
          reales del preflight, no con una advertencia genérica. */}
      <Sheet
        open={!!baseCurrencyConfirm}
        title={baseCurrencyConfirm ? t("settingsPage.baseCurrencyConfirmTitle", { currency: baseCurrencyConfirm.currency }) : undefined}
        onClose={() => (applyingBaseCurrency ? null : setBaseCurrencyConfirm(null))}
      >
        {baseCurrencyConfirm ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <p className="t-body" style={{ margin: 0, color: "var(--text-secondary)" }}>
              {t("settingsPage.baseCurrencyConfirmBody", {
                resolvedCount: baseCurrencyConfirm.preflight.identityCount + baseCurrencyConfirm.preflight.settlementsIdentityCount,
                pendingCount: baseCurrencyConfirm.preflight.resetCount + baseCurrencyConfirm.preflight.settlementsResetCount,
              })}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Button variant="primary" disabled={applyingBaseCurrency} onClick={confirmBaseCurrencyChange}>
                {t("settingsPage.baseCurrencyConfirmAction")}
              </Button>
              <Button variant="ghost" disabled={applyingBaseCurrency} onClick={() => setBaseCurrencyConfirm(null)}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        ) : null}
      </Sheet>

      <Sheet open={tabSheetOpen} title={t("settingsPage.fourthTab")} onClose={() => setTabSheetOpen(false)}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {tabOptions.map((option) => (
            <ListRow
              key={option}
              label={t(FOURTH_TAB_MESSAGE_KEY[option])}
              variant="value"
              value={option === fourthTab ? "✓" : undefined}
              onClick={() => {
                setFourthTab(option);
                setTabSheetOpen(false);
              }}
            />
          ))}
        </div>
      </Sheet>

      <Sheet open={baseCurrencySheetOpen} title={t(isMultiCurrency ? "settingsPage.baseCurrency" : "settingsPage.yourCurrency")} onClose={() => setBaseCurrencySheetOpen(false)} height={420}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <p className="t-body" style={{ margin: "0 0 8px", color: "var(--text-secondary)" }}>{t("settingsPage.baseCurrencyHint")}</p>
          {CURRENCIES.map((c) => (
            <ListRow
              key={c.code}
              label={c.name}
              meta={c.code}
              variant="value"
              value={c.code === household.baseCurrency ? "✓" : undefined}
              disabled={saving}
              onClick={() => handleBaseCurrency(c.code)}
            />
          ))}
        </div>
      </Sheet>

      <Sheet open={closeDaySheetOpen} title={t("settingsPage.closeDay")} onClose={() => setCloseDaySheetOpen(false)} height={420}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <p className="t-body" style={{ margin: "0 0 8px", color: "var(--text-secondary)" }}>{t("settingsPage.closeDayHint")}</p>
          {CLOSE_DAYS.map((day) => (
            <ListRow
              key={day}
              label={t("settingsPage.dayOfMonth", { day })}
              variant="value"
              value={day === household.periodStartDay ? "✓" : undefined}
              disabled={saving}
              onClick={() => handleCloseDay(day)}
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

      <Sheet open={weekStartSheetOpen} title={t("settingsPage.weekStart")} onClose={() => setWeekStartSheetOpen(false)}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {WEEK_START_OPTIONS.map((pref) => (
            <ListRow
              key={pref}
              label={t(`settingsPage.weekStartOptions.${pref}`)}
              meta={t(WEEK_START_PREVIEW[pref] as Parameters<typeof t>[0])}
              variant="value"
              value={pref === weekStartPref ? "✓" : undefined}
              onClick={() => {
                setWeekStartPref(pref);
                setWeekStartSheetOpen(false);
              }}
            />
          ))}
        </div>
      </Sheet>
    </div>
  );
}
