"use client";

import { useQuery } from "@tanstack/react-query";
import { computeNetWorth, type NetWorthAccountInput } from "@/lib/analytics/balances";
import { convert } from "@/lib/fx/rate";
import { fxRepo } from "@/lib/repos/fx-repo";
import type { Money } from "@/lib/money/money";
import { todayIso } from "@/lib/repos/ids";
import type { AccountRow } from "@/lib/db/schema";

/**
 * Patrimonio neto reactivo: junta las cotizaciones que hagan falta (una por
 * moneda distinta a la base) y arma un `convert` síncrono para
 * `computeNetWorth` — `fxRepo.resolve` es async, así que se resuelve todo
 * antes, no dentro del loop puro de `lib/analytics/balances`.
 */
export function useNetWorth(householdId: string | undefined, baseCurrency: string | undefined, accounts: AccountRow[]) {
  const currencies = [...new Set(accounts.map((a) => a.currencyCode))].filter((c) => c !== baseCurrency).sort();

  return useQuery({
    queryKey: ["net-worth", householdId, baseCurrency, currencies, accounts.map((a) => `${a.id}:${a.currentBalance}`)],
    queryFn: async () => {
      const date = todayIso();
      const rates = new Map<string, bigint | null>();
      await Promise.all(
        currencies.map(async (currency) => {
          const resolution = await fxRepo.resolve({ householdId: householdId!, base: currency, quote: baseCurrency!, date });
          rates.set(currency, resolution.rate);
        })
      );

      const convertToBase = (amount: Money, toCurrency: string): Money | null => {
        const rate = rates.get(amount.currency);
        if (!rate) return null;
        return convert(amount, toCurrency, rate);
      };

      const inputs: NetWorthAccountInput[] = accounts.map((a) => ({
        id: a.id,
        currentBalance: a.currentBalance,
        currencyCode: a.currencyCode,
        includeInNetWorth: a.includeInNetWorth,
      }));

      return computeNetWorth({ accounts: inputs, baseCurrency: baseCurrency!, convert: convertToBase });
    },
    enabled: !!householdId && !!baseCurrency && accounts.length > 0,
  });
}
