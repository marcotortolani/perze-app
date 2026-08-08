"use client";

import { useQuery } from "@tanstack/react-query";
import { computeInvestmentsTrend } from "@/lib/investments/investments-trend";

/** Sección "Investing" del home — gateado por `enabled_modules` en el caller, igual que `useNetWorth`. */
export function useInvestmentsTrend(householdId: string | undefined, baseCurrency: string | undefined, enabled: boolean, days = 14) {
  return useQuery({
    queryKey: ["investments-trend", householdId, baseCurrency, days],
    queryFn: () => computeInvestmentsTrend(householdId!, baseCurrency!, days),
    enabled: enabled && !!householdId && !!baseCurrency,
    gcTime: 5 * 60 * 1000,
  });
}
