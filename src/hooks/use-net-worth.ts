"use client";

import { useQuery } from "@tanstack/react-query";
import { computeNetWorth, LIABILITY_ACCOUNT_KINDS, type NetWorthAccountInput } from "@/lib/analytics/balances";
import { computeInvestmentsValue } from "@/lib/investments/net-worth-value";
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
 *
 * `investmentsEnabled` (`household.enabledModules.includes("investments")`,
 * chequeo obligatorio de CLAUDE.md antes de tocar cualquier cosa del
 * módulo): sin el módulo prendido, el patrimonio neto no suma posiciones —
 * ni siquiera las consulta, para no pagar el costo de fetchearlas en un
 * household que nunca las usó.
 */
export function useNetWorth(householdId: string | undefined, baseCurrency: string | undefined, accounts: AccountRow[], investmentsEnabled = false) {
  const currencies = [...new Set(accounts.map((a) => a.currencyCode))].filter((c) => c !== baseCurrency).sort();

  return useQuery({
    queryKey: ["net-worth", householdId, baseCurrency, currencies, accounts.map((a) => `${a.id}:${a.currentBalance}`), investmentsEnabled],
    // Fase 3 del plan de fluidez — la key incluye el saldo de cada cuenta,
    // así que cada cambio de saldo arma una entrada de cache nueva; con el
    // `gcTime` largo del resto de la app (24h) esas entradas viejas nunca
    // se vuelven a pedir y solo se acumulan. `gcTime` corto acá, propio de
    // esta query, en vez de tocar el default global.
    gcTime: 5 * 60 * 1000,
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
        isLiability: LIABILITY_ACCOUNT_KINDS.has(a.kind),
      }));

      const investments = investmentsEnabled ? await computeInvestmentsValue(householdId!, baseCurrency!) : null;

      return computeNetWorth({ accounts: inputs, baseCurrency: baseCurrency!, convert: convertToBase, ...(investments ? { investmentsValue: investments.value } : {}) });
    },
    enabled: !!householdId && !!baseCurrency && accounts.length > 0,
  });
}
