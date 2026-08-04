"use client";

import { useQuery } from "@tanstack/react-query";
import { transactionsRepo } from "@/lib/repos/transactions-repo";

export function useRecurringRuleHistory(recurringId: string | undefined) {
  return useQuery({
    queryKey: ["recurring-rule-history", recurringId ?? ""],
    queryFn: () => transactionsRepo.listByRecurringId(recurringId ?? ""),
    enabled: !!recurringId,
  });
}
