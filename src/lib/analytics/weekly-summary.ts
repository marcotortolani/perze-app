/** H11 — resumen semanal: tres datos y una comparación, todo excluyendo `needs_fx`. */

export interface WeeklyTransactionInput {
  kind: "expense" | "income" | "transfer" | "adjustment";
  occurredAt: string;
  amountBase: bigint | null;
  payeeId: string | null;
  categoryId: string | null;
}

export interface DaySpend {
  dateIso: string;
  total: bigint;
  count: number;
}

export interface PayeeVisits {
  payeeId: string;
  visits: number;
  total: bigint;
}

export interface CategoryDelta {
  categoryId: string;
  delta: bigint;
}

export interface WeeklySummary {
  total: bigint;
  excludedCount: number;
  mostExpensiveDay: DaySpend | null;
  topPayee: PayeeVisits | null;
  biggestCategoryChange: CategoryDelta | null;
}

function dateKey(iso: string): string {
  return new Date(iso).toDateString();
}

export function computeWeeklySummary(
  transactions: readonly WeeklyTransactionInput[],
  weekStart: Date,
  weekEnd: Date,
  prevWeekStart: Date,
  prevWeekEnd: Date
): WeeklySummary {
  const inWeek = transactions.filter((tx) => {
    const occurred = new Date(tx.occurredAt);
    return tx.kind === "expense" && occurred >= weekStart && occurred < weekEnd;
  });
  const inPrevWeek = transactions.filter((tx) => {
    const occurred = new Date(tx.occurredAt);
    return tx.kind === "expense" && occurred >= prevWeekStart && occurred < prevWeekEnd;
  });

  let total = 0n;
  let excludedCount = 0;
  const byDay = new Map<string, DaySpend>();
  const byPayee = new Map<string, PayeeVisits>();
  const byCategoryThisWeek = new Map<string, bigint>();

  for (const tx of inWeek) {
    if (tx.amountBase === null) {
      excludedCount += 1;
      continue;
    }
    total += tx.amountBase;

    const key = dateKey(tx.occurredAt);
    const day = byDay.get(key) ?? { dateIso: new Date(tx.occurredAt).toISOString(), total: 0n, count: 0 };
    day.total += tx.amountBase;
    day.count += 1;
    byDay.set(key, day);

    if (tx.payeeId) {
      const payee = byPayee.get(tx.payeeId) ?? { payeeId: tx.payeeId, visits: 0, total: 0n };
      payee.visits += 1;
      payee.total += tx.amountBase;
      byPayee.set(tx.payeeId, payee);
    }

    const categoryKey = tx.categoryId ?? "__none";
    byCategoryThisWeek.set(categoryKey, (byCategoryThisWeek.get(categoryKey) ?? 0n) + tx.amountBase);
  }

  const byCategoryPrevWeek = new Map<string, bigint>();
  for (const tx of inPrevWeek) {
    if (tx.amountBase === null) continue;
    const categoryKey = tx.categoryId ?? "__none";
    byCategoryPrevWeek.set(categoryKey, (byCategoryPrevWeek.get(categoryKey) ?? 0n) + tx.amountBase);
  }

  const allCategories = new Set([...byCategoryThisWeek.keys(), ...byCategoryPrevWeek.keys()]);
  let biggestCategoryChange: CategoryDelta | null = null;
  for (const categoryId of allCategories) {
    if (categoryId === "__none") continue;
    const delta = (byCategoryThisWeek.get(categoryId) ?? 0n) - (byCategoryPrevWeek.get(categoryId) ?? 0n);
    if (delta === 0n) continue;
    if (biggestCategoryChange === null || (delta > 0n ? delta : -delta) > (biggestCategoryChange.delta > 0n ? biggestCategoryChange.delta : -biggestCategoryChange.delta)) {
      biggestCategoryChange = { categoryId, delta };
    }
  }

  const mostExpensiveDay = [...byDay.values()].sort((a, b) => (b.total > a.total ? 1 : -1))[0] ?? null;
  const topPayee = [...byPayee.values()].sort((a, b) => b.visits - a.visits)[0] ?? null;

  return { total, excludedCount, mostExpensiveDay, topPayee, biggestCategoryChange };
}
