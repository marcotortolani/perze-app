import Dexie from "dexie";
import { getDb } from "../db/client";
import type { FxRateRow } from "../db/schema";
import { type FxRateRecord, type FxResolution, resolveFxRate } from "../fx/resolve";
import { invertRate, parseRate, type ScaledRate } from "../fx/rate";
import { nowIso, todayIso } from "./ids";

const MANUAL_PROVIDER = "manual";

function toRecord(row: FxRateRow): FxRateRecord {
  return {
    base: row.base,
    quote: row.quote,
    asOf: row.asOf,
    provider: row.provider,
    quoteKind: row.quoteKind,
    rate: row.rate,
    fetchedAt: row.fetchedAt,
  };
}

async function ratesForPair(base: string, quote: string): Promise<FxRateRow[]> {
  return getDb()
    .fxRates.where("[base+quote]")
    .equals([base, quote])
    .toArray();
}

async function getManualOverrideExact(householdId: string, base: string, quote: string): Promise<{ rate: ScaledRate; quoteKind: string } | null> {
  const rows = await ratesForPair(base, quote);
  const manual = rows
    .filter((r) => r.provider === MANUAL_PROVIDER && r.householdId === householdId)
    .sort((a, b) => (a.fetchedAt < b.fetchedAt ? 1 : -1))[0];
  return manual ? { rate: manual.rate, quoteKind: manual.quoteKind } : null;
}

export const fxRepo = {
  async getPreference(
    householdId: string,
    currencyPair: string
  ): Promise<{ preferredProvider?: string | undefined; preferredQuoteKind?: string | undefined }> {
    const row = await getDb().householdFxPreferences.get([householdId, currencyPair]);
    return {
      preferredProvider: row?.preferredProvider ?? undefined,
      preferredQuoteKind: row?.preferredQuoteKind ?? undefined,
    };
  },

  async setPreference(
    householdId: string,
    currencyPair: string,
    preferredProvider: string | null,
    preferredQuoteKind: string | null
  ): Promise<void> {
    await getDb().householdFxPreferences.put({ householdId, currencyPair, preferredProvider, preferredQuoteKind });
  },

  /**
   * Override manual "con vigencia": se guarda como una cotización más, con
   * `provider: 'manual'`, y gana siempre hasta que se reemplace.
   *
   * A8 — scoped por `householdId`: antes cualquier household con el mismo
   * par de monedas leía el override del otro (mismo `provider`/`quoteKind`
   * por default, sin dimensión de household en la fila). Sigue sin haber
   * vigencia real (`valid_from`/`valid_to` como sí tiene `fx_overrides` en
   * el servidor) — el modelo local sigue siendo "el último que se
   * escribió gana", ver nota de alcance en `lib/db/client.ts` versión 6.
   */
  async getManualOverride(householdId: string, base: string, quote: string): Promise<{ rate: ScaledRate; quoteKind: string } | null> {
    const direct = await getManualOverrideExact(householdId, base, quote);
    if (direct) return direct;
    // `/currencies` guarda el override SIEMPRE en una única dirección
    // canónica (`moneda → household.baseCurrency`, ver esa página) —
    // nunca en la dirección que a este caller le toque pedir. "Pagar
    // tarjeta" con una cuenta de origen en la moneda BASE hacia una
    // tarjeta en otra moneda pide exactamente el par inverso al
    // guardado (`base → moneda`, no `moneda → base`) y antes de esto no
    // lo encontraba — caía silenciosamente a la cotización del día de la
    // API, mostrando un número que no coincidía con nada configurado en
    // Ajustes. Buscar también el par invertido, e invertir el rate de
    // vuelta, hace que un override sirva sin importar qué lado de la
    // operación lo esté pidiendo.
    const inverse = await getManualOverrideExact(householdId, quote, base);
    return inverse ? { rate: invertRate(inverse.rate), quoteKind: inverse.quoteKind } : null;
  },

  async setManualOverride(householdId: string, base: string, quote: string, rate: ScaledRate, quoteKind = "custom"): Promise<void> {
    const row: FxRateRow = {
      base,
      quote,
      asOf: todayIso(),
      provider: MANUAL_PROVIDER,
      quoteKind,
      rate,
      bid: null,
      ask: null,
      fetchedAt: nowIso(),
      householdId,
    };
    await getDb().fxRates.put(row);
  },

  /**
   * Monedas con override manual contra `quote` para este household, aunque
   * ninguna cuenta las use — E6 ("Agregar una moneda") las suma a la lista
   * de pares además de las que ya aportan las cuentas.
   */
  async listOverrideCurrencies(householdId: string, quote: string): Promise<string[]> {
    const rows = await getDb()
      .fxRates.where("[householdId+base+quote]")
      .between([householdId, Dexie.minKey, Dexie.minKey], [householdId, Dexie.maxKey, Dexie.maxKey])
      .toArray();
    return [...new Set(rows.filter((r) => r.provider === MANUAL_PROVIDER && r.quote === quote).map((r) => r.base))];
  },

  async clearManualOverride(householdId: string, base: string, quote: string): Promise<void> {
    const rows = await ratesForPair(base, quote);
    const manualKeys = rows
      .filter((r) => r.provider === MANUAL_PROVIDER && r.householdId === householdId)
      .map((r): [string, string, string, string, string] => [r.base, r.quote, r.asOf, r.provider, r.quoteKind]);
    await getDb().fxRates.bulkDelete(manualKeys);
  },

  /** Cotizaciones de proveedor: globales, sin household (Patrón C) — `householdId: ""`. */
  async cacheQuotes(records: FxRateRecord[]): Promise<void> {
    const rows: FxRateRow[] = records.map((r) => ({ ...r, bid: null, ask: null, householdId: "" }));
    await getDb().fxRates.bulkPut(rows);
  },

  /**
   * Resuelve el rate para `base -> quote` en `date`: override manual >
   * cache local > `/api/fx` si hay red y no había nada > `pending`. Nunca
   * llama a un proveedor externo directo — siempre pasa por la ruta.
   */
  async resolve(params: {
    householdId: string;
    base: string;
    quote: string;
    date: string;
    /** Botón "Actualizar" de E6: pega a `/api/fx` aunque el cache ya tenga la cotización de hoy. El override manual sigue ganando igual — esto nunca lo pisa. */
    forceRefresh?: boolean;
  }): Promise<FxResolution> {
    const { householdId, base, quote, date, forceRefresh = false } = params;
    if (base === quote) {
      return resolveFxRate({ base, quote, date, ratesForPair: [] });
    }

    const pair = `${base}/${quote}`;
    const [manualOverride, preference, cachedRows] = await Promise.all([
      fxRepo.getManualOverride(householdId, base, quote),
      fxRepo.getPreference(householdId, pair),
      ratesForPair(base, quote),
    ]);

    let resolution = resolveFxRate({
      base,
      quote,
      date,
      manualOverride,
      ratesForPair: cachedRows.map(toRecord),
      preferredProvider: preference.preferredProvider,
      preferredQuoteKind: preference.preferredQuoteKind,
    });

    const isOnline = typeof navigator === "undefined" || navigator.onLine;
    // A8 — antes solo se consultaba la red cuando el local daba `pending`.
    // Con cache viejo, un movimiento de HOY quedaba `inherited` (con
    // `isStale: true`) sin volver a intentar la red, aunque hubiera
    // conexión — se sigue prefiriendo el cache si ya tiene la cotización
    // de hoy (`resolution.source === "api"`), pero un `inherited` para la
    // fecha de hoy vale la pena refrescar.
    const shouldRefetch = forceRefresh || resolution.source === "pending" || (resolution.source === "inherited" && date === todayIso());
    if (shouldRefetch && isOnline) {
      try {
        const url = new URL("/api/fx", typeof window !== "undefined" ? window.location.origin : "http://localhost");
        url.searchParams.set("base", base);
        url.searchParams.set("quote", quote);
        url.searchParams.set("date", date);
        url.searchParams.set("householdId", householdId);
        if (preference.preferredProvider) url.searchParams.set("provider", preference.preferredProvider);
        if (preference.preferredQuoteKind) url.searchParams.set("quoteKind", preference.preferredQuoteKind);

        const res = await fetch(url.toString());
        if (res.ok) {
          const data = (await res.json()) as {
            rate: string | null;
            provider: string | null;
            quoteKind: string | null;
            asOf: string | null;
          };
          if (data.rate !== null && data.provider && data.quoteKind && data.asOf) {
            await fxRepo.cacheQuotes([
              {
                base,
                quote,
                asOf: data.asOf,
                provider: data.provider,
                quoteKind: data.quoteKind,
                rate: parseRate(data.rate),
                fetchedAt: nowIso(),
              },
            ]);
            resolution = resolveFxRate({
              base,
              quote,
              date,
              manualOverride,
              ratesForPair: [
                ...cachedRows.map(toRecord),
                { base, quote, asOf: data.asOf, provider: data.provider, quoteKind: data.quoteKind, rate: parseRate(data.rate), fetchedAt: nowIso() },
              ],
              preferredProvider: preference.preferredProvider,
              preferredQuoteKind: preference.preferredQuoteKind,
            });
          }
        }
      } catch {
        // Sin red o la API falló: se guarda igual sin conversión (needs_fx). Nunca bloquea.
      }
    }

    return resolution;
  },
};
