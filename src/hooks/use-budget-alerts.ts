"use client";

import { useMemo } from "react";
import { useBudgets } from "./use-budgets";
import { useTransactions } from "./use-transactions";
import { useCategories } from "./use-categories";
import { useCurrentHousehold } from "./use-current-household";
import { currentPeriodBounds } from "@/lib/analytics/history";
import { identifyBudgetAlerts, type BudgetAlert } from "@/lib/analytics/budget-progress";
import type { BudgetRow } from "@/lib/db/schema";

/** F4 — presupuestos al 80%/excedidos del período en curso. Compartido entre el insight de Home y el badge de la tab. */
export function useBudgetAlerts(): BudgetAlert<BudgetRow>[] {
  const { data: household } = useCurrentHousehold();
  const { data: budgets } = useBudgets(household?.id);
  const { data: transactions } = useTransactions(household?.id);
  const { data: categories } = useCategories(household?.id);

  return useMemo(() => {
    if (!household || !budgets || !transactions || !categories || !household.enabledModules.includes("budgets")) return [];
    const active = budgets.filter((b) => !b.archivedAt);
    const { start, end } = currentPeriodBounds(household.periodStartDay || 1, new Date());
    return identifyBudgetAlerts(active, transactions, start, end, categories);
  }, [household, budgets, transactions, categories]);
}
