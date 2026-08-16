"use client";

import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { portfoliosRepo, type Portfolio } from "@/lib/repos/portfolios-repo";
import { tradesRepo, type Trade } from "@/lib/repos/trades-repo";
import { tradeLotAllocationsRepo } from "@/lib/repos/trade-lot-allocations-repo";
import { instrumentsRepo } from "@/lib/repos/instruments-repo";
import { priceSnapshotsRepo } from "@/lib/repos/price-snapshots-repo";
import { targetAllocationsRepo, type TargetAllocationDimension } from "@/lib/repos/target-allocations-repo";

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

/** Un trade suelto por id — para la transacción de settlement (`kind: 'investing'`), que solo conoce `tradeId` y necesita `portfolioId` para armar el link de "editar" hacia `trades/[tradeId]/edit`. */
export function useTrade(tradeId: string | null | undefined) {
  return useQuery({
    queryKey: ["trade", tradeId ?? ""],
    queryFn: () => tradesRepo.get(tradeId!),
    enabled: !!tradeId,
  });
}

/**
 * Fase 2 — allocations explícitas (qué lote se vendió) para las ventas de
 * `trades`. Se pasa a `computeLots`/`computePositions` junto con los
 * trades para que el agregado (posiciones, P&L, peso en el portfolio)
 * quede consistente con lo que el detalle de instrumento muestra cuando el
 * usuario eligió un lote — sin esto, cada pantalla que llama a
 * `computePositions` caería a FIFO puro por su cuenta y podría mostrar un
 * número distinto al del detalle.
 */
export function useTradeLotAllocations(trades: Trade[] | undefined) {
  const sellTradeIds = (trades ?? []).filter((tr) => tr.kind === "sell" || tr.kind === "transfer_out").map((tr) => tr.id);
  return useQuery({
    queryKey: ["trade-lot-allocations", sellTradeIds],
    queryFn: () => tradeLotAllocationsRepo.listForPortfolio(sellTradeIds),
    enabled: sellTradeIds.length > 0,
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

/** Tabla de posiciones estilo Google Finance — columna "Change" del día. */
export function usePreviousClose(instrumentIds: string[]) {
  return useQuery({
    queryKey: ["previous-close", [...instrumentIds].sort()],
    queryFn: () => priceSnapshotsRepo.previousCloseFor(instrumentIds),
    enabled: instrumentIds.length > 0,
  });
}

export function useInvalidateLatestPrices(instrumentIds: string[]) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["latest-prices", [...instrumentIds].sort()], refetchType: "all" });
}

/** Bloque I (rebalanceo) — objetivos de cartera de UNA dimensión ('asset_class', 'currency', 'risk', ...). Cada dimensión es una vista independiente que suma 100% por su cuenta. */
export function useTargetAllocations(portfolioId: string | undefined, dimension: TargetAllocationDimension) {
  return useQuery({
    queryKey: ["target-allocations", portfolioId ?? "", dimension],
    queryFn: () => targetAllocationsRepo.list(portfolioId!, dimension),
    enabled: !!portfolioId,
  });
}

export function useInvalidateTargetAllocations(portfolioId: string | undefined, dimension: TargetAllocationDimension) {
  const queryClient = useQueryClient();
  return () => portfolioId && queryClient.invalidateQueries({ queryKey: ["target-allocations", portfolioId, dimension], refetchType: "all" });
}
