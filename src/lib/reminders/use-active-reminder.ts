"use client";

import { useEffect, useState } from "react";
import { useReminderBannerStore } from "@/stores/reminder-banner-store";
import { useThemePreference } from "@/lib/theme/use-theme-preference";
import { useBackdropPreference } from "@/lib/backdrop/use-backdrop-preference";
import { useFormatPreferencesStore } from "@/stores/format-preferences-store";
import { isStandalonePwa } from "@/lib/pwa/platform";
import { getEligibleReminders, pickRotatingReminder, type ReminderId } from "./definitions";
import { todayIso } from "@/lib/dates/today";
import type { EnabledModule } from "@/lib/db/schema";

export interface UseActiveReminderParams {
  hasBirthDate: boolean;
  enabledModules: EnabledModule[] | undefined;
}

/**
 * Un solo cálculo de "qué recordatorio, si alguno, corresponde mostrar
 * ahora" — usado tanto por `<ReminderBanner>` (qué dibuja) como por el
 * layout del dashboard (si reservar el `marginTop` del banner). Separar
 * la lógica de la presentación evita que ambos se desincronicen.
 */
export function useActiveReminder({ hasBirthDate, enabledModules }: UseActiveReminderParams): ReminderId | null {
  const dismissedForever = useReminderBannerStore((s) => s.dismissedForever);
  const lastDismissedOn = useReminderBannerStore((s) => s.lastDismissedOn);
  const themePref = useThemePreference();
  const backdropPref = useBackdropPreference();
  const decimalSeparator = useFormatPreferencesStore((s) => s.decimalSeparator);
  const dateFormat = useFormatPreferencesStore((s) => s.dateFormat);
  const [standalone, setStandalone] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- detección de display-mode, no derivable en SSR.
    setStandalone(isStandalonePwa());
  }, []);

  const today = todayIso();
  if (dismissedForever || lastDismissedOn === today) return null;

  const eligible = getEligibleReminders({
    hasBirthDate,
    isStandalone: standalone,
    enabledModulesCount: enabledModules?.length ?? 0,
    themeIsDefault: themePref === "system",
    formatIsDefault: decimalSeparator === "locale" && dateFormat === "locale",
    backdropIsDefault: !backdropPref.enabled,
  });
  return pickRotatingReminder(eligible, new Date());
}
