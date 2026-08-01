"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { portfoliosRepo } from "@/lib/repos/portfolios-repo";
import { tradesRepo } from "@/lib/repos/trades-repo";
import { instrumentsRepo } from "@/lib/repos/instruments-repo";
import { priceSnapshotsRepo } from "@/lib/repos/price-snapshots-repo";

export function usePortfolios(householdId: string | undefined) {
  return useQuery({
    queryKey: ["portfolios", householdId ?? ""],
    queryFn: () => portfoliosRepo.listForHousehold(householdId!),
    enabled: !!householdId,
  });
}

export function useInvalidatePortfolios(householdId: string | undefined) {
  const queryClient = useQueryClient();
  return () => householdId && queryClient.invalidateQueries({ queryKey: ["portfolios", householdId] });
}

export function useTrades(portfolioId: string | undefined) {
  return useQuery({
    queryKey: ["trades", portfolioId ?? ""],
    queryFn: () => tradesRepo.listForPortfolio(portfolioId!),
    enabled: !!portfolioId,
  });
}

export function useInvalidateTrades(portfolioId: string | undefined) {
  const queryClient = useQueryClient();
  return () => portfolioId && queryClient.invalidateQueries({ queryKey: ["trades", portfolioId] });
}

export function useAssetClasses() {
  return useQuery({ queryKey: ["asset-classes"], queryFn: () => instrumentsRepo.listAssetClasses(), staleTime: Infinity });
}

export function useInvalidateAssetClasses() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["asset-classes"] });
}

export function useInstruments(householdId: string | undefined) {
  return useQuery({
    queryKey: ["instruments", householdId ?? ""],
    queryFn: () => instrumentsRepo.listForHousehold(householdId!),
    enabled: !!householdId,
  });
}

export function useInvalidateInstruments(householdId: string | undefined) {
  const queryClient = useQueryClient();
  return () => householdId && queryClient.invalidateQueries({ queryKey: ["instruments", householdId] });
}

export function useLatestPrices(instrumentIds: string[]) {
  return useQuery({
    queryKey: ["latest-prices", [...instrumentIds].sort()],
    queryFn: () => priceSnapshotsRepo.latestFor(instrumentIds),
    enabled: instrumentIds.length > 0,
  });
}
