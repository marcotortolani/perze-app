"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Amount, Icon, ListRow, Skeleton } from "@/design-system";
import { MonthCalendar } from "@/design-system/charts";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useRecurringRules } from "@/hooks/use-recurring-rules";
import { occurredAtFor, occurrencesBetween } from "@/lib/recurring/occurrences";
import { money } from "@/lib/money/money";
import { formatMonthYearHeading, formatNumericDate, type Locale } from "@/i18n/formatting";
import { useDateFormatPreference } from "@/stores/format-preferences-store";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * G1 — calendario de vencimientos, extraído de `calendar/page.tsx` para
 * poder embeberlo también en la columna derecha de `/recurring` en
 * desktop (`RecurringPageContent.tsx`) sin duplicar la lógica del mes.
 * No trae `usePageHeader` — eso queda en cada caller (la ruta `/calendar`
 * para mobile, ninguno para la columna embebida).
 *
 * Multi-frecuencia (v3): las marcas salen de `occurrencesBetween` sobre el
 * mes visible, no de `dayOfMonth` — una regla semanal antes mostraba una
 * sola marca al mes, ahora muestra las cuatro o cinco que corresponden.
 */
export function RecurringMonthCalendar() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const dateFormat = useDateFormatPreference();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: rules } = useRecurringRules(household?.id);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const occurrencesByDate = useMemo(() => {
    const map = new Map<string, string[]>(); // date -> ruleIds
    if (!rules) return map;
    const [yStr, mStr] = month.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    const monthStart = `${y}-${pad(m)}-01`;
    const monthEnd = `${y}-${pad(m)}-${new Date(y, m, 0).getDate()}`;
    for (const rule of rules) {
      if (rule.archivedAt !== null) continue;
      for (const date of occurrencesBetween(rule, monthStart, monthEnd)) {
        map.set(date, [...(map.get(date) ?? []), rule.id]);
      }
    }
    return map;
  }, [rules, month]);

  const marks = useMemo(() => [...occurrencesByDate.entries()].map(([date, ruleIds]) => ({ date, level: Math.min(7, ruleIds.length * 2) })), [occurrencesByDate]);

  if (!household || !rules) return <Skeleton height={360} style={{ marginTop: 16 }} />;

  const rulesOnSelectedDate = selectedDate ? (occurrencesByDate.get(selectedDate) ?? []).map((id) => rules.find((r) => r.id === id)).filter((r) => r !== undefined) : [];

  const shiftMonth = (delta: number) => {
    const [yStr, mStr] = month.split("-");
    const y = Number(yStr);
    const m = Number(mStr) - 1 + delta;
    const next = new Date(y, m, 1);
    setMonth(`${next.getFullYear()}-${pad(next.getMonth() + 1)}`);
    setSelectedDate(null);
  };

  const [monthY, monthM] = month.split("-").map(Number);
  const monthHeading = formatMonthYearHeading(locale, new Date(monthY!, monthM! - 1, 1));

  return (
    <div className="pt-4">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => shiftMonth(-1)} aria-label={t("recurringCalendarPage.prevMonth")} className="flex h-11 w-11 items-center justify-center border-0 bg-transparent cursor-pointer">
          <Icon name="chevron-left" size={20} />
        </button>
        <div className="text-[16px] font-semibold">{monthHeading}</div>
        <button type="button" onClick={() => shiftMonth(1)} aria-label={t("recurringCalendarPage.nextMonth")} className="flex h-11 w-11 items-center justify-center border-0 bg-transparent cursor-pointer">
          <Icon name="chevron" size={20} />
        </button>
      </div>
      <MonthCalendar month={month} marks={marks} value={selectedDate ?? undefined} onSelect={setSelectedDate} />

      {selectedDate ? (
        <div className="mt-5">
          <div className="t-caption text-text-muted">{formatNumericDate(locale, new Date(occurredAtFor(selectedDate)), dateFormat)}</div>
          {rulesOnSelectedDate.length === 0 ? (
            <p className="t-body text-text-secondary">{t("recurringCalendarPage.noneThatDay")}</p>
          ) : (
            rulesOnSelectedDate.map((rule) => (
              <ListRow
                key={rule!.id}
                label={rule!.name}
                onClick={() => router.push(`/recurring/${rule!.id}`)}
                value={
                  <Amount
                    value={money(rule!.kind === "expense" ? -rule!.expectedAmount : rule!.expectedAmount, rule!.currencyCode)}
                    size="body"
                    polarity={rule!.kind === "income" ? "positive" : "negative"}
                    tabular
                  />
                }
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
