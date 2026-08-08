"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { transactionsRepo, type TransactionFilters } from "@/lib/repos/transactions-repo";
import { accountsKey } from "./use-accounts";

export function transactionsKey(householdId: string, filters: TransactionFilters = {}) {
  return ["transactions", householdId, filters] as const;
}

export function useTransactions(householdId: string | undefined, filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: transactionsKey(householdId ?? "", filters),
    queryFn: () => transactionsRepo.list(householdId!, filters),
    enabled: !!householdId,
  });
}

/** G1 — pares `{recurringId, occurrenceDate}` ya cargados, para filtrar "Pending to charge" (ver `listRecurringOccurrences`). */
export function useRecurringOccurrences(householdId: string | undefined) {
  return useQuery({
    queryKey: ["recurring-occurrences", householdId ?? ""],
    queryFn: () => transactionsRepo.listRecurringOccurrences(householdId!),
    enabled: !!householdId,
  });
}

export function useInvalidateTransactions(householdId: string | undefined) {
  const queryClient = useQueryClient();
  return () => {
    if (!householdId) return;
    queryClient.invalidateQueries({ queryKey: ["transactions", householdId], refetchType: "all" });
    queryClient.invalidateQueries({ queryKey: ["recurring-occurrences", householdId], refetchType: "all" });
    // Sin `recurringId` acá — se invalida sin el segundo elemento de la key
    // (`use-recurring-rule-history.ts`) a propósito: por prefijo alcanza a
    // CUALQUIER regla, no solo la que originó esta mutación. Antes, "Cargar
    // ahora" (`recurring/[id]/page.tsx`) dejaba `chargedDates`/`upcoming`
    // con el estado viejo hasta salir y volver a entrar a la pantalla —
    // mismo bug para deshacer o borrar un movimiento ligado a un recurrente.
    queryClient.invalidateQueries({ queryKey: ["recurring-rule-history"], refetchType: "all" });
  };
}

/**
 * C5/C6 — cualquier escritura de una transacción muta `current_balance` de
 * una cuenta (`bumpBalance`, dentro del mismo repo), pero antes solo se
 * invalidaba `transactions`: `accounts` quedaba con el saldo viejo hasta el
 * próximo refetch por otra causa (`CaptureFlow.tsx` era el caso más visible
 * — guardar un gasto no actualizaba el saldo en pantalla al instante).
 * `net-worth`/presupuestos/deudas no necesitan su propia invalidación acá:
 * se calculan en vivo a partir de `useTransactions`/`useAccounts`
 * (`useNetWorth` deriva su `queryKey` del `currentBalance` de cada cuenta),
 * así que invalidar estas dos alcanza para que todo lo demás se recalcule solo.
 */
export function useInvalidateAfterTransactionWrite(householdId: string | undefined) {
  const queryClient = useQueryClient();
  return () => {
    if (!householdId) return;
    queryClient.invalidateQueries({ queryKey: ["transactions", householdId], refetchType: "all" });
    queryClient.invalidateQueries({ queryKey: accountsKey(householdId), refetchType: "all" });
  };
}

export function useTransaction(id: string | undefined) {
  return useQuery({
    queryKey: ["transaction", id ?? ""],
    // `?? null`: `enabled: false` deja el queryFn sin correr, pero React
    // Query igual exige que la función tipe un resultado no-`undefined`.
    queryFn: () => transactionsRepo.get(id ?? ""),
    enabled: !!id,
  });
}
