import type { DateFormatPref, DecimalSeparatorPref } from "@/stores/format-preferences-store";
import type { Locale } from "@/i18n/formatting";

/** Compartido entre `/more/settings` y `/onboarding/format` (A4b) — mismas opciones, mismos previews. */
export const DECIMAL_SEPARATOR_OPTIONS: DecimalSeparatorPref[] = ["locale", "comma", "period"];
export const DATE_FORMAT_OPTIONS: DateFormatPref[] = ["locale", "dmy", "mdy", "ymd"];

export const LANGUAGE_MESSAGE_KEY = {
  es: "morePage.languageNames.es",
  en: "morePage.languageNames.en",
  pt: "morePage.languageNames.pt",
} as const satisfies Record<Locale, string>;

/** Ejemplo en vivo del separador decimal elegido — `localeChar` es el separador real del locale activo (`numberLocaleForUiLocale`). */
export function decimalSeparatorExample(pref: DecimalSeparatorPref, localeChar: string): string {
  const sep = pref === "locale" ? localeChar : pref === "comma" ? "," : ".";
  return `1234${sep}56`;
}
