import type { routing } from "./routing";
import type { NumberLocale } from "@/lib/money/parse";

export type Locale = (typeof routing.locales)[number];

const NUMBER_LOCALE_BY_UI_LOCALE: Record<Locale, NumberLocale> = {
  es: "es-UY",
  en: "en-US",
  pt: "pt-BR",
};

/** Mapea el idioma de la UI al locale numérico que usa `lib/money` para separadores y `Intl.NumberFormat`. */
export function numberLocaleForUiLocale(locale: Locale): NumberLocale {
  return NUMBER_LOCALE_BY_UI_LOCALE[locale];
}

/** Separador decimal del locale — "," en es/pt, "." en en. */
export function decimalSeparatorForLocale(locale: Locale): string {
  return numberLocaleForUiLocale(locale) === "en-US" ? "." : ",";
}

/**
 * Utilidades puras de fecha ligadas al locale explícito — para usar desde
 * Client/Server Components fuera del árbol de `next-intl` (loops, listas)
 * pásale el locale de `useLocale()`/`getLocale()`. Dentro de JSX que ya
 * tiene acceso a next-intl, preferir `useFormatter()`/`getFormatter()` de
 * `next-intl` en vez de agregar acá una envoltura redundante.
 */

export function formatWeekdayNarrow(locale: Locale, date: Date): string {
  return new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(date);
}

export function formatDateShort(locale: Locale, date: Date): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(date);
}

export function formatDateLong(locale: Locale, date: Date): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function formatMonthYear(locale: Locale, date: Date): string {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date);
}
