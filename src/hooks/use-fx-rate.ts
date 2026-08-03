"use client";

import { useQuery } from "@tanstack/react-query";
import { fxRepo } from "@/lib/repos/fx-repo";
import { todayIso } from "@/lib/repos/ids";

/**
 * Rate sugerido entre dos monedas para el día de hoy — usado por
 * `AmountStep` para mostrar `FxEditor` en una transferencia entre cuentas
 * de distinta moneda. Misma resolución que cualquier otra parte de la app
 * (`fxRepo.resolve`): override manual → cotización del día → última
 * conocida → `pending`.
 */
export function useSuggestedFxRate(householdId: string | undefined, base: string | undefined, quote: string | undefined) {
  return useQuery({
    queryKey: ["fx-suggested-rate", householdId, base, quote],
    queryFn: () => fxRepo.resolve({ householdId: householdId!, base: base!, quote: quote!, date: todayIso() }),
    enabled: !!householdId && !!base && !!quote && base !== quote,
  });
}
