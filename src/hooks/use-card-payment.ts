"use client";

import { useMemo } from "react";
import { useAccounts } from "@/hooks/use-accounts";
import { isCreditCardAccount } from "@/lib/analytics/card-cycle";

/**
 * `useAccounts` ya está montado en casi todas las pantallas que listan
 * movimientos (misma query key, `react-query` dedupea) — este hook no
 * agrega una llamada de red nueva, solo deriva el set de tarjetas una vez
 * por render. Un `transfer` cuyo `counterAccountId` cae en ese set ES un
 * pago de tarjeta, por definición — no depende de `card_statements`
 * (que no existe para pagos hechos antes de este cambio, ni offline).
 */
export function useIsCardPayment(householdId: string | undefined): (tx: { kind: string; counterAccountId: string | null }) => boolean {
  const { data: accounts = [] } = useAccounts(householdId);
  const cardIds = useMemo(() => new Set(accounts.filter(isCreditCardAccount).map((a) => a.id)), [accounts]);
  return (tx) => tx.kind === "transfer" && tx.counterAccountId !== null && cardIds.has(tx.counterAccountId);
}
