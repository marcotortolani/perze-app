"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { currenciesRepo } from "@/lib/repos/currencies-repo";
import { CURRENCIES as STATIC_CURRENCIES } from "@/lib/reference/countries-currencies";
import type { CurrencyRow } from "@/lib/db/schema";

export const currenciesKey = ["currencies"] as const;

const FALLBACK: CurrencyRow[] = STATIC_CURRENCIES.map((c) => ({ code: c.code, name: c.name, symbol: c.code, decimals: 2, kind: "fiat", isActive: true }));

/**
 * Catálogo global de monedas (`currencies`, Patrón C) — `staleTime:
 * Infinity` porque cambia rarísima vez (seed + lo que se agregue a mano
 * vía `add_currency`), invalidado explícitamente después de un `add()`
 * exitoso. Sin conexión en el primerísimo arranque (antes de que esta
 * query haya podido resolver una vez), cae a las 7 monedas estáticas de
 * siempre — mismo criterio "offline-first" que el resto de la app, para
 * que crear una cuenta nunca quede bloqueado por falta de red.
 */
export function useCurrencies() {
  return useQuery({
    queryKey: currenciesKey,
    queryFn: () => currenciesRepo.list(),
    staleTime: Infinity,
    placeholderData: FALLBACK,
  });
}

export function useInvalidateCurrencies() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: currenciesKey });
}
