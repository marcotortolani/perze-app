import { formatDateShort, type Locale } from "@/i18n/formatting";
import { occurredAtFor } from "./occurrences";

export type RelativeDayLabel = { kind: "today" } | { kind: "tomorrow" } | { kind: "label"; label: string };

/**
 * G1 anotación 4: fechas nombradas ("mañana", "domingo 3") mientras estén
 * dentro de la semana; después, día y número. Devuelve un descriptor en
 * vez de la traducción resuelta — `hoy`/`mañana` los resuelve el caller
 * con `useTranslations()` (así esta función queda pura, sin acoplarse al
 * tipo genérico del traductor de next-intl).
 *
 * `occurredAtFor` (mediodía UTC), no medianoche: el resto de la app
 * (`tx.occurredAt`) ya asume que un `Date` de una fecha-sin-hora se
 * formatea con `Intl`/`getDate()` en la zona horaria LOCAL del navegador
 * (ver `accounts/[id]/page.tsx`). Medianoche UTC cae en el día anterior en
 * cualquier huso negativo (Uruguay, Argentina: UTC-3) — "1 de septiembre"
 * se mostraba como "31 de agosto". Mediodía UTC es el mismo margen de
 * seguridad (UTC-11..UTC+11) que ya usa el motor de materialización.
 */
export function relativeDayLabel(dateOnly: string, todayOnly: string, locale: Locale): RelativeDayLabel {
  const date = new Date(occurredAtFor(dateOnly));
  const today = new Date(occurredAtFor(todayOnly));
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86_400_000);

  if (diffDays === 0) return { kind: "today" };
  if (diffDays === 1) return { kind: "tomorrow" };
  if (diffDays > 1 && diffDays < 7) {
    // "domingo 3" — día de semana + número, sin mes.
    const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date);
    return { kind: "label", label: `${weekday} ${date.getDate()}` };
  }
  return { kind: "label", label: formatDateShort(locale, date) };
}
