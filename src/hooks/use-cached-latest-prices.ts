"use client";

import { useEffect, useMemo } from "react";
import { useInstrumentPricesStore, type CachedInstrumentPrice } from "@/stores/instrument-prices-store";
import type { LatestPrice } from "@/lib/repos/price-snapshots-repo";

/**
 * D36 — envuelve el resultado de `useLatestPrices()` con el cache
 * persistido: mientras la consulta real (a `price_snapshots` o al
 * refresh en vivo) todavía no resolvió — o falló por red/API caída — el
 * último precio conocido de ese instrumento (localStorage, sobrevive
 * recargas y sesiones) rellena el hueco. Se pisa solo cuando `queryData`
 * SÍ trae un valor para ese instrumento — el cache nunca gana sobre un
 * dato fresco, solo cubre la ausencia.
 */
export function useCachedLatestPrices(queryData: Map<string, LatestPrice> | undefined): Map<string, LatestPrice> {
  const cached = useInstrumentPricesStore((s) => s.prices);

  useEffect(() => {
    if (!queryData || queryData.size === 0) return;
    const updates: Record<string, CachedInstrumentPrice> = {};
    for (const [id, p] of queryData) {
      updates[id] = { close: p.close, currencyCode: p.currencyCode, asOf: p.asOf, provider: p.provider };
    }
    useInstrumentPricesStore.getState().setPrices(updates);
  }, [queryData]);

  return useMemo(() => {
    const merged = new Map<string, LatestPrice>(queryData ?? []);
    for (const [id, c] of Object.entries(cached)) {
      if (!merged.has(id)) merged.set(id, { instrumentId: id, close: c.close, currencyCode: c.currencyCode, asOf: c.asOf, provider: c.provider });
    }
    return merged;
  }, [queryData, cached]);
}
