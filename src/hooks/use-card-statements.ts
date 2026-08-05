"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cardStatementsRepo } from "@/lib/repos/card-statements-repo";

export function cardStatementsKey(accountId: string) {
  return ["card-statements", accountId] as const;
}

export function useCardStatements(accountId: string | undefined) {
  return useQuery({
    queryKey: cardStatementsKey(accountId ?? ""),
    queryFn: () => cardStatementsRepo.list(accountId!),
    enabled: !!accountId,
  });
}

export function useLatestCardStatement(accountId: string | undefined) {
  return useQuery({
    queryKey: [...cardStatementsKey(accountId ?? ""), "latest"],
    queryFn: () => cardStatementsRepo.latestOpen(accountId!),
    enabled: !!accountId,
  });
}

export function useInvalidateCardStatements(accountId: string | undefined) {
  const queryClient = useQueryClient();
  return () => accountId && queryClient.invalidateQueries({ queryKey: cardStatementsKey(accountId), refetchType: "all" });
}
