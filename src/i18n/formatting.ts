import type { routing } from "./routing";
import type { NumberLocale } from "@/lib/money/parse";
import { useFormatPreferencesStore, type DateFormatPref } from "@/stores/format-preferences-store";

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

/**
 * Separador decimal — por default deriva del locale ("," en es/pt, "." en
 * en), pero Ajustes → Formato deja fijarlo sin importar el idioma. Lee el
 * store con `getState()` (no un hook): esta función la llaman ~20 lugares
 * fuera de componentes (helpers de parseo/keypad), así que hacerla
 * reactiva pediría convertir todos esos call sites en hooks para un ajuste
 * que se toca una vez y no cambia mientras se mira la misma pantalla.
 * Nunca toca cómo se guarda un monto — solo el carácter que se muestra/
 * que el keypad entiende como decimal.
 */
export function decimalSeparatorForLocale(locale: Locale): string {
  const pref = useFormatPreferencesStore.getState().decimalSeparator;
  if (pref === "comma") return ",";
  if (pref === "period") return ".";
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

/**
 * Mes + año para encabezados de navegación ("Septiembre 2026"), sin el
 * conector narrativo de `formatMonthYear` ("septiembre de 2026" — correcto
 * en una oración, pero no en un título). `text-transform: capitalize` de
 * CSS capitaliza cada palabra del string, incluida la preposición "de" —
 * por eso la mayúscula de la primera letra se hace acá, a mano, sobre el
 * nombre del mes solo.
 */
export function formatMonthYearHeading(locale: Locale, date: Date): string {
  const month = new Intl.DateTimeFormat(locale, { month: "long" }).format(date);
  const capitalized = month.charAt(0).toUpperCase() + month.slice(1);
  return `${capitalized} ${date.getFullYear()}`;
}

/**
 * Fecha puramente numérica (día/mes/año), para las pocas pantallas que
 * hoy muestran una — el resto de la app usa fechas "narrativas" (nombre
 * de mes/día, `formatDateShort`/`formatDateLong` arriba) a propósito, y
 * esa elección de diseño no cambia con este ajuste. `pref === "locale"`
 * es el default de `Intl.DateTimeFormat` sin opciones (comportamiento
 * previo a que existiera el ajuste); las otras tres son formatos fijos,
 * sin importar el idioma de la UI — es lo que pide "elegir el formato",
 * no que dependa del idioma.
 */
export function formatNumericDate(locale: Locale, date: Date, pref: DateFormatPref = "locale"): string {
  if (pref === "locale") return new Intl.DateTimeFormat(locale).format(date);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  if (pref === "mdy") return `${mm}/${dd}/${yyyy}`;
  if (pref === "ymd") return `${yyyy}-${mm}-${dd}`;
  return `${dd}/${mm}/${yyyy}`;
}
