"use client";

import { useQuery } from "@tanstack/react-query";
import { convert } from "@/lib/fx/rate";
import { fxRepo } from "@/lib/repos/fx-repo";
import { todayIso } from "@/lib/repos/ids";
import type { Money } from "@/lib/money/money";

/**
 * Convierte un monto ya resuelto (el patrimonio neto, en moneda base) a
 * `targetCurrency` — para el toggle "ver en USD" del home. Distinto de
 * `useNetWorth`: ahí se resuelve una cotización por cuenta para armar el
 * total en base; acá hay un solo monto y una sola cotización más
 * (base→target), con la misma regla de `needs_fx`: si no hay rate para
 * hoy, `data` queda `null` — nunca se inventa un 1 ni se muestra 0.
 */
export function useNetWorthInCurrency(householdId: string | undefined, amount: Money | undefined, targetCurrency: string | null) {
  const enabled = !!householdId && !!amount && !!targetCurrency && amount.currency !== targetCurrency;

  return useQuery({
    queryKey: ["net-worth-fx", householdId, amount?.currency, amount?.amount.toString(), targetCurrency],
    // Mismo motivo que en `use-net-worth.ts`: la key lleva el monto exacto,
    // así que cada cambio arma una entrada nueva — `gcTime` corto para que
    // no se acumulen bajo el default largo del resto de la app.
    gcTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Money | null> => {
      const resolution = await fxRepo.resolve({ householdId: householdId!, base: amount!.currency, quote: targetCurrency!, date: todayIso(), liveRecalc: true });
      if (!resolution.rate) return null;
      return convert(amount!, targetCurrency!, resolution.rate);
    },
    enabled,
  });
}
