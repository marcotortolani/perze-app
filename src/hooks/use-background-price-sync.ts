"use client";

import { useEffect } from "react";
import { useCurrentHousehold } from "./use-current-household";
import { useInstruments } from "./use-investments";
import { priceSnapshotsRepo } from "@/lib/repos/price-snapshots-repo";
import { useInstrumentPricesStore, type CachedInstrumentPrice } from "@/stores/instrument-prices-store";
import { BACKGROUND_REFRESH_MS } from "@/lib/prices/refresh-cadence";

/**
 * D50 — mientras el usuario está en la app pero no en ninguna pantalla de
 * inversiones, nada refrescaba precios: `useLatestPrices()` solo corre
 * mientras algún componente de inversiones está montado. Sin esto, volver
 * a `/investments` después de un rato mostraba el cache tal cual quedó al
 * salir, aunque hubieran pasado horas.
 *
 * Montado una sola vez en `(app)/layout.tsx` (todo el shell autenticado).
 * Escribe SOLO en el store persistido (`useInstrumentPricesStore`), nunca
 * en el cache de `useLatestPrices` — cada pantalla arma su query key con
 * un subconjunto distinto de instrumentIds (tenidos vs. todo el catálogo),
 * así que no hay una sola key a la que escribirle. `useCachedLatestPrices()`
 * ya mezcla el store persistido con lo que traiga esa query, sea cual sea
 * su key — es el canal que de verdad propaga a cualquier pantalla montada.
 */
export function useBackgroundPriceSync(): void {
  const { data: household } = useCurrentHousehold();
  const { data: instruments } = useInstruments(household?.id);

  useEffect(() => {
    if (!household?.enabledModules.includes("investments")) return;
    const providerInstrumentIds = (instruments ?? []).filter((i) => i.priceProvider).map((i) => i.id);
    if (providerInstrumentIds.length === 0) return;

    const sync = async () => {
      // Pestaña en background: no vale la pena gastar red/batería por un
      // precio que nadie está mirando — se retoma solo cuando vuelve a
      // estar visible (el próximo tick del interval, o D42 al recuperar
      // foco si en el medio también dispara un refresh de inversiones).
      if (document.visibilityState === "hidden") return;
      const results = await Promise.all(
        providerInstrumentIds.map((id) => priceSnapshotsRepo.refreshFromProvider(id).then((quote) => [id, quote] as const))
      );
      const updates: Record<string, CachedInstrumentPrice> = {};
      for (const [id, quote] of results) if (quote) updates[id] = quote;
      if (Object.keys(updates).length === 0) return;
      useInstrumentPricesStore.getState().setPrices(updates);
    };

    const interval = setInterval(() => {
      sync().catch(() => {
        // Sin red o proveedor caído: se reintenta solo en el próximo tick, nunca rompe el resto de la app.
      });
    }, BACKGROUND_REFRESH_MS);
    return () => clearInterval(interval);
  }, [household?.enabledModules, instruments]);
}
