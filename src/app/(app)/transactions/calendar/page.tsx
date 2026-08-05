"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Icon, IconButton, Skeleton, TransactionRow } from "@/design-system";
import type { IconName } from "@/design-system/core/Icon";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useAccounts } from "@/hooks/use-accounts";
import { useIsCardPayment } from "@/hooks/use-card-payment";
import { useCategories } from "@/hooks/use-categories";
import { useTransactions } from "@/hooks/use-transactions";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { money } from "@/lib/money/money";
import { formatAmountCompact } from "@/lib/money/format";
import { formatMonthYearHeading, formatWeekdayNarrow, type Locale } from "@/i18n/formatting";

function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = first.getDay();
  const cells: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return cells;
}

/** D5 — vista de calendario, mes en grilla con heatmap de intensidad por día. Bloque D, Fase 7. */
export default function MovementsCalendarPage() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const categoryLabel = useCategoryLabel();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const isCardPayment = useIsCardPayment(household?.id);
  const { data: accounts = [] } = useAccounts(household?.id);
  const { data: categories = [] } = useCategories(household?.id);
  const { data: transactions, isLoading } = useTransactions(household?.id);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const baseCurrency = household?.baseCurrency ?? "UYU";

  const totalsByDay = useMemo(() => {
    const totals = new Map<string, bigint>();
    for (const tx of transactions ?? []) {
      if (tx.kind !== "expense" || tx.amountBase === null) continue;
      const day = tx.occurredAt.slice(0, 10);
      totals.set(day, (totals.get(day) ?? 0n) + tx.amountBase);
    }
    return totals;
  }, [transactions]);

  const maxTotal = Math.max(1, ...[...totalsByDay.values()].map((v) => Number(v)));
  const cells = monthGrid(year, month);
  const todayIso = now.toISOString().slice(0, 10);
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay());
  const dowLabels = Array.from({ length: 7 }, (_, i) =>
    formatWeekdayNarrow(locale, new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i))
  );

  const dayTransactions = (transactions ?? []).filter((t) => t.occurredAt.slice(0, 10) === selectedDay).sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));

  if (isLoading || !household) return <Skeleton height={320} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingTop: 16, paddingBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <IconButton icon="chevron-left" ariaLabel={t("transactions.calendar.back")} onClick={() => router.push("/transactions")} style={{ margin: -11 }} />
        <span className="t-body" style={{ fontWeight: 600 }}>
          {formatMonthYearHeading(locale, new Date(year, month, 1))}
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            type="button"
            onClick={() => {
              const d = new Date(year, month - 1, 1);
              setYear(d.getFullYear());
              setMonth(d.getMonth());
              setSelectedDay(null);
            }}
            style={{ background: "none", border: 0, padding: 8, cursor: "pointer" }}
            aria-label={t("transactions.calendar.prevMonth")}
          >
            <Icon name="chevron-left" size={18} color="var(--text-secondary)" />
          </button>
          <button
            type="button"
            onClick={() => {
              const d = new Date(year, month + 1, 1);
              setYear(d.getFullYear());
              setMonth(d.getMonth());
              setSelectedDay(null);
            }}
            style={{ background: "none", border: 0, padding: 8, cursor: "pointer" }}
            aria-label={t("transactions.calendar.nextMonth")}
          >
            <Icon name="chevron" size={18} color="var(--text-secondary)" />
          </button>
        </div>
      </div>

      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
          {dowLabels.map((d, i) => (
            <div key={`${d}-${i}`} style={{ textAlign: "center", fontSize: 11, color: "var(--text-muted)" }}>
              {d}
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {cells.map((iso, i) => {
            if (!iso) return <div key={`empty-${i}`} />;
            const total = totalsByDay.get(iso) ?? 0n;
            const intensity = total > 0n ? Math.max(0.12, Number(total) / maxTotal) : 0;
            const day = Number(iso.slice(-2));
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelectedDay(iso === selectedDay ? null : iso)}
                style={{
                  aspectRatio: "1",
                  borderRadius: 10,
                  border: iso === todayIso ? "1px solid var(--primary-ink)" : selectedDay === iso ? "1px solid var(--text-secondary)" : "1px solid transparent",
                  background: intensity > 0 ? `color-mix(in srgb, var(--data-1) ${Math.round(intensity * 70)}%, var(--surface-1))` : "var(--surface-1)",
                  color: "var(--text-primary)",
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDay ? (
        <div>
          <p className="t-label" style={{ color: "var(--text-secondary)", marginBottom: 8 }}>
            {new Date(`${selectedDay}T00:00:00`).toLocaleDateString(locale, { weekday: "long", day: "2-digit", month: "long" })}
          </p>
          {dayTransactions.length === 0 ? (
            <p className="t-body" style={{ color: "var(--text-muted)" }}>
              {t("transactions.calendar.empty")}
            </p>
          ) : (
            dayTransactions.map((tx) => {
              const category = tx.categoryId ? categoryById.get(tx.categoryId) : undefined;
              return (
                <TransactionRow
                  key={tx.id}
                  icon={(category?.icon as IconName) ?? (tx.kind === "adjustment" ? "circle-half-tilt" : isCardPayment(tx) ? "credit-card" : tx.kind === "transfer" ? "refresh" : "cart")}
                  merchant={
                    category
                      ? categoryLabel(category)
                      : tx.kind === "adjustment"
                        ? t("transactions.list.reconciliation")
                        : isCardPayment(tx)
                          ? t("transactions.list.cardPayment")
                          : tx.kind === "transfer"
                            ? t("transactions.list.transfer")
                            : t("transactions.list.movement")
                  }
                  meta={accountById.get(tx.accountId)?.name}
                  value={money(tx.kind === "expense" ? -tx.amount : tx.amount, tx.currencyCode)}
                  secondary={tx.currencyCode !== baseCurrency && tx.amountBase !== null ? formatAmountCompact(money(tx.amountBase, baseCurrency), { showSign: false }) : undefined}
                  polarity={tx.kind === "income" ? "positive" : tx.kind === "transfer" || tx.kind === "adjustment" ? "neutral" : "negative"}
                  onClick={() => router.push(`/transactions/${tx.id}`)}
                />
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
