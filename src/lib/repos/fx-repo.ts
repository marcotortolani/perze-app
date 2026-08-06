import Dexie from "dexie";
import { getDb } from "../db/client";
import type { FxRateRow } from "../db/schema";
import { type FxRateRecord, type FxResolution, resolveFxRate } from "../fx/resolve";
import { invertRate, parseRate, type ScaledRate } from "../fx/rate";
import { nowIso, todayIso } from "./ids";

// `import()` dinámico, no estático: `fx-overrides-repo.ts`/
// `fx-preferences-repo.ts` importan `supabase/client.ts`, que valida
// `env.ts` en el top-level del módulo. Un import estático acá arrastraría
// esa validación a CUALQUIER archivo que importe `fx-repo.ts` — que son
// decenas, la mayoría tests puros de lógica de captura/movimientos que
// nunca tocan Supabase y no mockean el módulo. El dynamic import solo
// resuelve cuando de verdad se llama a un método que sincroniza con el
// servidor.
const fxOverridesRepoAsync = () => import("./fx-overrides-repo").then((m) => m.fxOverridesRepo);
const fxPreferencesRepoAsync = () => import("./fx-preferences-repo").then((m) => m.fxPreferencesRepo);

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

/** Una fila por `quoteKind`, la más reciente ≤ `date` — mismo criterio que usa `resolveFxRate` para elegir UNA, aplicado a cada variante para el picker de E6. */
function bestByQuoteKind(records: readonly FxRateRecord[], date: string): FxRateRecord[] {
  const best = new Map<string, FxRateRecord>();
  for (const r of records) {
    if (r.asOf > date) continue;
    const current = best.get(r.quoteKind);
    if (!current || r.asOf > current.asOf) best.set(r.quoteKind, r);
  }
  return [...best.values()];
}

/** Solo Dexie, sin pushear al servidor — usado por `setManualOverride` (después de pushear) y por `syncFromServer` (el valor YA vino del servidor). */
async function putManualOverrideLocal(householdId: string, base: string, quote: string, rate: ScaledRate, quoteKind: string): Promise<void> {
  const row: FxRateRow = { base, quote, asOf: todayIso(), provider: MANUAL_PROVIDER, quoteKind, rate, bid: null, ask: null, fetchedAt: nowIso(), householdId };
  await getDb().fxRates.put(row);
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
    // Best-effort: `household_fx_preferences` en el servidor (existía sin
    // ningún caller — ver `fx-preferences-repo.ts`) es lo que hace que
    // elegir blue/CCL en un dispositivo se vea en los demás. Si falla
    // (offline, RLS de un household ajeno) la elección local ya quedó
    // aplicada — nunca bloquea el guardado.
    try {
      await (await fxPreferencesRepoAsync()).set(householdId, currencyPair, preferredProvider, preferredQuoteKind);
    } catch {
      // sin red o error del servidor: la preferencia sigue vigente local, se reintentará en el próximo `setPreference` o pull.
    }
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

  /**
   * `createdBy` es opcional para no romper los callers de test que no
   * simulan un usuario real — en producción `/currencies` y
   * `/accounts/resolve-fx` siempre lo pasan (`fx_overrides.created_by` es
   * nullable en el schema igual, así que un `undefined` no rompe el
   * insert, solo pierde autoría).
   */
  async setManualOverride(householdId: string, base: string, quote: string, rate: ScaledRate, quoteKind = "custom", createdBy?: string): Promise<void> {
    await putManualOverrideLocal(householdId, base, quote, rate, quoteKind);
    // Best-effort — ver la nota de `setPreference`. Acá además es lo que
    // hace que los cron jobs server-side (recurrentes, resolución de
    // `needs_fx` en lote) vean el mismo override que ve el cliente: antes
    // `fx_overrides` quedaba siempre vacía.
    if (createdBy) {
      try {
        await (await fxOverridesRepoAsync()).setOverride(householdId, base, quote, rate, createdBy);
      } catch {
        // sin red o error del servidor: el override local ya está aplicado.
      }
    }
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
    try {
      await (await fxOverridesRepoAsync()).clearOverride(householdId, base, quote);
    } catch {
      // sin red o error del servidor: el override local ya se limpió.
    }
  },

  /** Cotizaciones de proveedor: globales, sin household (Patrón C) — `householdId: ""`. */
  async cacheQuotes(records: FxRateRecord[]): Promise<void> {
    const rows: FxRateRow[] = records.map((r) => ({ ...r, bid: null, ask: null, householdId: "" }));
    await getDb().fxRates.bulkPut(rows);
  },

  /**
   * Trae los overrides y preferencias vigentes del servidor y los cachea
   * en Dexie — es lo que hace visible en ESTE dispositivo un override que
   * se cargó en otro, o desde otro miembro del household. Deliberadamente
   * NO se llama desde `resolve()`: agregarle un round-trip a Supabase al
   * camino de "cargar un gasto" viola el objetivo de <5s de CLAUDE.md, y
   * además `resolve()` corre en cada guardado de movimiento — no es el
   * lugar para sincronizar. Se llama explícito desde `/currencies` (al
   * entrar a la pantalla y al tocar "Actualizar"), que es donde de verdad
   * importa ver el estado real del household.
   */
  async syncFromServer(householdId: string): Promise<void> {
    const [overridesRepo, preferencesRepo] = await Promise.all([fxOverridesRepoAsync(), fxPreferencesRepoAsync()]);
    const [overrides, preferences] = await Promise.all([overridesRepo.listActive(householdId), preferencesRepo.listForHousehold(householdId)]);
    await Promise.all([
      ...overrides.map((o) => putManualOverrideLocal(householdId, o.baseCurrency, o.quoteCurrency, o.rate, "custom")),
      ...preferences.map((p) => getDb().householdFxPreferences.put({ householdId, currencyPair: p.currencyPair, preferredProvider: p.preferredProvider, preferredQuoteKind: p.preferredQuoteKind })),
    ]);
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

    let resolution: FxResolution = {
      ...resolveFxRate({
        base,
        quote,
        date,
        manualOverride,
        ratesForPair: cachedRows.map(toRecord),
        preferredProvider: preference.preferredProvider,
        preferredQuoteKind: preference.preferredQuoteKind,
      }),
      availableQuoteKinds: bestByQuoteKind(cachedRows.map(toRecord), date),
    };

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
            availableQuoteKinds?: Array<{ quoteKind: string; rate: string; asOf: string; provider: string }>;
          };
          // Todas las variantes que trajo la ruta (blue/CCL/tarjeta, no
          // solo la que quedó resuelta) se cachean acá — sin esto, el
          // picker de E6 solo podría ofrecer la que ya se había resuelto
          // antes, porque `/api/fx` es la única puerta a un proveedor
          // externo y el resto se descartaba en silencio.
          const variantRecords: FxRateRecord[] = (data.availableQuoteKinds ?? []).map((q) => ({
            base,
            quote,
            asOf: q.asOf,
            provider: q.provider,
            quoteKind: q.quoteKind,
            rate: parseRate(q.rate),
            fetchedAt: nowIso(),
          }));
          // La variante resuelta SIEMPRE entra explícita, esté o no en
          // `availableQuoteKinds` — una respuesta que no la mande ahí (un
          // proveedor viejo, un mock de test) no debe perder el rate que
          // sí vino en `data.rate`.
          const resolvedRecord: FxRateRecord | null =
            data.rate !== null && data.provider && data.quoteKind && data.asOf
              ? { base, quote, asOf: data.asOf, provider: data.provider, quoteKind: data.quoteKind, rate: parseRate(data.rate), fetchedAt: nowIso() }
              : null;
          const freshRecords = resolvedRecord
            ? [resolvedRecord, ...variantRecords.filter((v) => v.quoteKind !== resolvedRecord.quoteKind)]
            : variantRecords;
          if (freshRecords.length > 0) await fxRepo.cacheQuotes(freshRecords);

          if (resolvedRecord) {
            resolution = resolveFxRate({
              base,
              quote,
              date,
              manualOverride,
              ratesForPair: [...cachedRows.map(toRecord), ...freshRecords],
              preferredProvider: preference.preferredProvider,
              preferredQuoteKind: preference.preferredQuoteKind,
            });
          }
          resolution = { ...resolution, availableQuoteKinds: freshRecords.length > 0 ? freshRecords : resolution.availableQuoteKinds };
        }
      } catch {
        // Sin red o la API falló: se guarda igual sin conversión (needs_fx). Nunca bloquea.
      }
    }

    return resolution;
  },
};
