"use client";

import { useMemo } from "react";
import { useBudgets } from "./use-budgets";
import { useTransactions } from "./use-transactions";
import { useCategories } from "./use-categories";
import { useCurrentHousehold } from "./use-current-household";
import { identifyBudgetAlertsWithRollover } from "@/lib/analytics/budget-rollover";
import type { BudgetAlert } from "@/lib/analytics/budget-progress";
import type { BudgetRow } from "@/lib/db/schema";

/** F4 — presupuestos al 80%/excedidos del período en curso, con el límite efectivo del rollover. Compartido entre el insight de Home y el badge de la tab. */
export function useBudgetAlerts(): BudgetAlert<BudgetRow>[] {
  const { data: household } = useCurrentHousehold();
  const { data: budgets } = useBudgets(household?.id);
  const { data: transactions } = useTransactions(household?.id);
  const { data: categories } = useCategories(household?.id);

  return useMemo(() => {
    if (!household || !budgets || !transactions || !categories || !household.enabledModules.includes("budgets")) return [];
    const active = budgets.filter((b) => !b.archivedAt);
    return identifyBudgetAlertsWithRollover(active, transactions, household.periodStartDay || 1, new Date(), categories);
  }, [household, budgets, transactions, categories]);
}
