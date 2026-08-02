"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Amount, AppHeader, Icon, ListRow, Skeleton } from "@/design-system";
import { MonthCalendar } from "@/design-system/charts";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useRecurringRules } from "@/hooks/use-recurring-rules";
import { money } from "@/lib/money/money";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** G1 — vencimientos del mes en calendario. Cada celda marcada es un día con al menos una recurrente. */
export default function RecurringCalendarPage() {
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const { data: rules } = useRecurringRules(household?.id);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const marks = useMemo(() => {
    if (!rules) return [];
    const [yStr, mStr] = month.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    const daysInMonth = new Date(y, m, 0).getDate();
    const countByDate = new Map<string, number>();
    for (const rule of rules) {
      const day = Math.min(rule.dayOfMonth, daysInMonth);
      const iso = `${y}-${pad(m)}-${pad(day)}`;
      countByDate.set(iso, (countByDate.get(iso) ?? 0) + 1);
    }
    return [...countByDate.entries()].map(([date, count]) => ({ date, level: Math.min(7, count * 2) }));
  }, [rules, month]);

  if (!household || !rules) return <Skeleton height={360} style={{ marginTop: 16 }} />;

  const [yStr, mStr] = month.split("-");
  const daysInMonth = new Date(Number(yStr), Number(mStr), 0).getDate();
  const rulesOnSelectedDate = selectedDate ? rules.filter((r) => Math.min(r.dayOfMonth, daysInMonth) === Number(selectedDate.slice(-2))) : [];

  const shiftMonth = (delta: number) => {
    const y = Number(yStr);
    const m = Number(mStr) - 1 + delta;
    const next = new Date(y, m, 1);
    setMonth(`${next.getFullYear()}-${pad(next.getMonth() + 1)}`);
    setSelectedDate(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppHeader title={t("recurringCalendarPage.title")} showScope={false} onBack={() => router.back()} backLabel={t("ds.appHeader.back")} />
      <div style={{ paddingTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <button type="button" onClick={() => shiftMonth(-1)} aria-label={t("recurringCalendarPage.prevMonth")} style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: 0, cursor: "pointer" }}>
            <Icon name="chevron-left" size={20} />
          </button>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{month}</div>
          <button type="button" onClick={() => shiftMonth(1)} aria-label={t("recurringCalendarPage.nextMonth")} style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: 0, cursor: "pointer" }}>
            <Icon name="chevron" size={20} />
          </button>
        </div>
        <MonthCalendar month={month} marks={marks} value={selectedDate ?? undefined} onSelect={setSelectedDate} />

        {selectedDate ? (
          <div style={{ marginTop: 20 }}>
            <div className="t-caption" style={{ color: "var(--text-muted)" }}>{selectedDate}</div>
            {rulesOnSelectedDate.length === 0 ? (
              <p className="t-body" style={{ color: "var(--text-secondary)" }}>{t("recurringCalendarPage.noneThatDay")}</p>
            ) : (
              rulesOnSelectedDate.map((rule) => (
                <ListRow key={rule.id} label={rule.name} onClick={() => router.push(`/recurring/${rule.id}`)} value={<Amount value={money(rule.expectedAmount, rule.currencyCode)} size="body" showSign={false} polarity="neutral" tabular />} />
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
