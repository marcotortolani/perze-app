"use client";

import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { portfoliosRepo, type Portfolio } from "@/lib/repos/portfolios-repo";
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
  return () => householdId && queryClient.invalidateQueries({ queryKey: ["portfolios", householdId], refetchType: "all" });
}

/**
 * master-detail — resuelve QUÉ portfolio le corresponde a una pantalla por-portfolio
 * (asignación, rendimiento, ingresos futuros, instrumentos) que vive
 * fuera de `[portfolioId]/`: `?portfolio=<id>` cuando se llega desde
 * `OverviewContent` (que sí conoce el portfolio), y `portfolios?.[0]`
 * como único fallback para el acceso directo (nav lateral, deep link)
 * donde no hay portfolio en contexto. Antes estas cuatro pantallas
 * asumían siempre `portfolios?.[0]`, un bug real en cualquier household
 * con más de un portfolio — el schema y el repo ya lo soportan
 * (`PortfoliosListContent`).
 */
export function usePortfolioFromParam(portfolios: Portfolio[] | undefined): Portfolio | undefined {
  const searchParams = useSearchParams();
  const portfolioId = searchParams.get("portfolio");
  return portfolios?.find((p) => p.id === portfolioId) ?? portfolios?.[0];
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
  return () => portfolioId && queryClient.invalidateQueries({ queryKey: ["trades", portfolioId], refetchType: "all" });
}

export function useAssetClasses() {
  return useQuery({ queryKey: ["asset-classes"], queryFn: () => instrumentsRepo.listAssetClasses(), staleTime: Infinity });
}

export function useInvalidateAssetClasses() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["asset-classes"], refetchType: "all" });
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
  return () => householdId && queryClient.invalidateQueries({ queryKey: ["instruments", householdId], refetchType: "all" });
}

export function useLatestPrices(instrumentIds: string[]) {
  return useQuery({
    queryKey: ["latest-prices", [...instrumentIds].sort()],
    queryFn: () => priceSnapshotsRepo.latestFor(instrumentIds),
    enabled: instrumentIds.length > 0,
  });
}

export function useInvalidateLatestPrices(instrumentIds: string[]) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["latest-prices", [...instrumentIds].sort()], refetchType: "all" });
}
