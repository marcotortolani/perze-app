import { classifyCashFlow } from "./cash-flow";

/**
 * H11 — resumen semanal: tres datos y una comparación, todo excluyendo
 * `needs_fx`. `total` es toda la salida de liquidez de la semana — consumo
 * más compras de instrumentos, una venta no la reduce (`cash-flow.ts`).
 */

export interface WeeklyTransactionInput {
  kind: "expense" | "income" | "transfer" | "adjustment" | "investing";
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
    return occurred >= weekStart && occurred < weekEnd;
  });
  const inPrevWeek = transactions.filter((tx) => {
    const occurred = new Date(tx.occurredAt);
    return occurred >= prevWeekStart && occurred < prevWeekEnd;
  });

  let total = 0n;
  let excludedCount = 0;
  const byDay = new Map<string, DaySpend>();
  const byPayee = new Map<string, PayeeVisits>();
  const byCategoryThisWeek = new Map<string, bigint>();

  for (const tx of inWeek) {
    const { bucket, magnitude } = classifyCashFlow(tx);
    if (bucket === "needsFx") {
      excludedCount += 1;
      continue;
    }
    if (bucket !== "outflow") continue;
    total += magnitude;

    const key = dateKey(tx.occurredAt);
    const day = byDay.get(key) ?? { dateIso: new Date(tx.occurredAt).toISOString(), total: 0n, count: 0 };
    day.total += magnitude;
    day.count += 1;
    byDay.set(key, day);

    if (tx.payeeId) {
      const payee = byPayee.get(tx.payeeId) ?? { payeeId: tx.payeeId, visits: 0, total: 0n };
      payee.visits += 1;
      payee.total += magnitude;
      byPayee.set(tx.payeeId, payee);
    }

    const categoryKey = tx.categoryId ?? "__none";
    byCategoryThisWeek.set(categoryKey, (byCategoryThisWeek.get(categoryKey) ?? 0n) + magnitude);
  }

  const byCategoryPrevWeek = new Map<string, bigint>();
  for (const tx of inPrevWeek) {
    const { bucket, magnitude } = classifyCashFlow(tx);
    if (bucket !== "outflow") continue;
    const categoryKey = tx.categoryId ?? "__none";
    byCategoryPrevWeek.set(categoryKey, (byCategoryPrevWeek.get(categoryKey) ?? 0n) + magnitude);
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
