"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fxRepo } from "@/lib/repos/fx-repo";
import type { AccountRow, TransactionRow } from "@/lib/db/schema";

export function trackedOverrideCurrenciesKey(householdId: string | undefined, baseCurrency: string) {
  return ["fx-override-currencies", householdId, baseCurrency] as const;
}

export function trackedPreferenceCurrenciesKey(householdId: string | undefined, baseCurrency: string) {
  return ["fx-preference-currencies", householdId, baseCurrency] as const;
}

/**
 * Monedas "trackeadas" de un household: las de cuentas activas, las vistas
 * en movimientos (`currencyCode` + `originalCurrency`), las que tienen un
 * override manual o una preferencia de proveedor/quoteKind en
 * `/currencies` (D32 — pueden existir sin ninguna cuenta, p. ej. alguien
 * que solo quiere trackear una cotización), y la moneda base del household.
 *
 * Extraído de `/currencies` (E6) para que el picker de moneda de `/add`
 * (C4) use la misma fuente — antes ese picker solo miraba cuentas y
 * movimientos, así que agregar EUR en Ajustes → Monedas (sin tener una
 * cuenta en euros) no lo hacía aparecer en la captura: exactamente el caso
 * de un viaje donde todo se paga con una cuenta en otra moneda.
 */
export function useTrackedCurrencies(householdId: string | undefined, baseCurrency: string, accounts: AccountRow[], transactions: TransactionRow[] | undefined) {
  const overridesQuery = useQuery({
    queryKey: trackedOverrideCurrenciesKey(householdId, baseCurrency),
    queryFn: () => fxRepo.listOverrideCurrencies(householdId!, baseCurrency),
    enabled: !!householdId,
  });
  const preferencesQuery = useQuery({
    queryKey: trackedPreferenceCurrenciesKey(householdId, baseCurrency),
    queryFn: () => fxRepo.listPreferenceCurrencies(householdId!, baseCurrency),
    enabled: !!householdId,
  });

  const currencies = useMemo(() => {
    const set = new Set<string>();
    for (const a of accounts) if (a.archivedAt === null) set.add(a.currencyCode);
    for (const tx of transactions ?? []) {
      set.add(tx.currencyCode);
      if (tx.originalCurrency) set.add(tx.originalCurrency);
    }
    for (const code of overridesQuery.data ?? []) set.add(code);
    for (const code of preferencesQuery.data ?? []) set.add(code);
    set.add(baseCurrency);
    return [...set].sort();
  }, [accounts, transactions, overridesQuery.data, preferencesQuery.data, baseCurrency]);

  return { currencies, isLoading: overridesQuery.isLoading || preferencesQuery.isLoading };
}
