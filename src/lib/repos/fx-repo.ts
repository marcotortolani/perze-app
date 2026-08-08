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

/**
 * Antes, una vez que un dispositivo cacheaba la cotización de HOY
 * (`source: "api"`), nunca más volvía a pedirla a `/api/fx` ese mismo día
 * — así que si el proveedor la corregía más tarde, dos dispositivos que la
 * cacharon en momentos distintos del día quedaban mostrando montos en base
 * distintos para el mismo saldo real, sin forma de notarlo. Revalidar cada
 * 15 minutos no compite con el objetivo de <5s de captura: solo se activa
 * cuando el caller pasa `liveRecalc: true` (patrimonio neto, saldos
 * consolidados) — `resolve()` para GUARDAR un movimiento (rate que se
 * congela) sigue sirviendo del cache de hoy sin round-trip extra.
 */
const FX_REFRESH_TTL_MS = 15 * 60_000;

/**
 * Último intento de revalidación por TTL, por par — si `/api/fx` no
 * resolvió (proveedor caído, fin de semana), `fetchedAt` no se actualiza y
 * sin esta marca cada recálculo repetiría el round-trip completo.
 */
const liveRefetchAttemptedAt = new Map<string, number>();

/** Push de override que falló sin red — `syncFromServer` lo re-empuja y mientras tanto NO pisa ese par con el valor viejo del servidor. */
const overridePushKey = (householdId: string, base: string, quote: string) => `fxOverridePush:${householdId}|${base}|${quote}`;

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

  /** Borra la preferencia — a diferencia de `setPreference(pair, null, null)`, la FILA deja de existir (una fila con nulls igual "ancla" la moneda, ver `listPreferenceCurrencies`). */
  async clearPreference(householdId: string, currencyPair: string): Promise<void> {
    await getDb().householdFxPreferences.delete([householdId, currencyPair]);
    try {
      await (await fxPreferencesRepoAsync()).clear(householdId, currencyPair);
    } catch {
      // sin red o error del servidor: la preferencia local ya se borró.
    }
  },

  /**
   * Monedas con preferencia elegida contra `quote` (blue/CCL/"estándar"),
   * aunque nunca hayan tenido un override manual ni una cuenta — D32: sin
   * esto, aceptar la cotización sugerida al agregar una moneda (o volver a
   * "Estándar" desde un override) la dejaba sin ningún ancla en la lista y
   * desaparecía apenas se limpiaba el override.
   */
  async listPreferenceCurrencies(householdId: string, quote: string): Promise<string[]> {
    const rows = await getDb().householdFxPreferences.where("householdId").equals(householdId).toArray();
    const suffix = `/${quote}`;
    return rows.filter((r) => r.currencyPair.endsWith(suffix)).map((r) => r.currencyPair.slice(0, -suffix.length));
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
        await getDb().meta.delete(overridePushKey(householdId, base, quote));
      } catch {
        // Sin red o error del servidor: el override local ya está aplicado.
        // Queda anotado para que `syncFromServer` lo re-empuje en el próximo
        // pull — sin esto, el pull pisaría este override con el del servidor.
        await getDb().meta.put({ key: overridePushKey(householdId, base, quote), value: { rate: rate.toString(), createdBy } });
      }
    }
  },

  /**
   * Monedas con override manual contra `quote` para este household, aunque
   * ninguna cuenta las use — E6 ("Agregar una moneda") las suma a la lista
   * de pares además de las que ya aportan las cuentas.
   *
   * Sin test directo: su `.between()` con `Dexie.minKey`/`Dexie.maxKey`
   * sobre el índice compuesto `[householdId+base+quote]` tira `DataError`
   * bajo `fake-indexeddb` (la librería de test), sea cual sea el estado de
   * la tabla — no se pudo reproducir el bug de D32 pasando por acá por esa
   * razón, ver `fx-repo.test.ts`. Funciona en el browser real (la propia
   * pantalla de E6 lo usa hoy sin errores reportados); si algún día hay que
   * tocar esta query, verificar manual en `/currencies`, no solo con
   * `pnpm test`.
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
      await getDb().meta.delete(overridePushKey(householdId, base, quote));
    } catch {
      // Sin red o error del servidor: el override local ya se limpió. Igual
      // que en `setManualOverride`, queda pendiente para el próximo pull —
      // si no, `syncFromServer` resucitaría el override recién borrado.
      await getDb().meta.put({ key: overridePushKey(householdId, base, quote), value: { clear: true } });
    }
  },

  /**
   * "Eliminar moneda" (D32) — solo tiene sentido para una moneda que
   * ninguna cuenta usa: si hay una cuenta en esa moneda, la moneda sigue
   * necesitando una cotización a la base pase lo que pase acá, y el caller
   * no debe ofrecer esta acción. Borra las dos anclas (override +
   * preferencia) — dejar cualquiera de las dos viva la resucitaría en la
   * lista sola.
   */
  async forgetCurrency(householdId: string, base: string, quote: string): Promise<void> {
    await Promise.all([fxRepo.clearManualOverride(householdId, base, quote), fxRepo.clearPreference(householdId, `${base}/${quote}`)]);
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

    // Primero re-empujar los overrides cuyo push original falló sin red —
    // y no pisar localmente los pares que sigan pendientes: el valor local
    // es más nuevo que el que tiene el servidor.
    const pendingPushes = await getDb().meta.where("key").startsWith(`fxOverridePush:${householdId}|`).toArray();
    const stillPending = new Set<string>();
    for (const pendingPush of pendingPushes) {
      const [, base, quote] = pendingPush.key.slice("fxOverridePush:".length).split("|");
      const value = pendingPush.value as { rate?: string; createdBy?: string; clear?: boolean };
      try {
        if (value.clear) await overridesRepo.clearOverride(householdId, base!, quote!);
        else await overridesRepo.setOverride(householdId, base!, quote!, BigInt(value.rate!), value.createdBy!);
        await getDb().meta.delete(pendingPush.key);
      } catch {
        stillPending.add(`${base}|${quote}`);
      }
    }

    const [overrides, preferences] = await Promise.all([overridesRepo.listActive(householdId), preferencesRepo.listForHousehold(householdId)]);
    await Promise.all([
      ...overrides.filter((o) => !stillPending.has(`${o.baseCurrency}|${o.quoteCurrency}`)).map((o) => putManualOverrideLocal(householdId, o.baseCurrency, o.quoteCurrency, o.rate, "custom")),
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
    /**
     * Para pantallas que recalculan un agregado EN VIVO (patrimonio neto,
     * saldos consolidados) y no para congelar el rate de un movimiento: se
     * permite revalidar una cotización de hoy contra el servidor si el
     * cache tiene más de `FX_REFRESH_TTL_MS`. Deliberadamente `false` por
     * default — el camino de captura (`save-transaction.ts` y afines)
     * necesita servir del cache al instante, nunca agregar un round-trip
     * extra a los <5s de guardar un gasto.
     */
    liveRecalc?: boolean;
  }): Promise<FxResolution> {
    const { householdId, base, quote, date, forceRefresh = false, liveRecalc = false } = params;
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
    const todayCacheAgeMs =
      resolution.source === "api" && resolution.asOf === date
        ? (() => {
            const match = cachedRows.find((r) => r.asOf === date && r.provider === resolution.provider && r.quoteKind === resolution.quoteKind);
            return match ? Date.now() - new Date(match.fetchedAt).getTime() : null;
          })()
        : null;
    const ttlKey = `${householdId}|${base}|${quote}|${date}`;
    const ttlRefetch =
      liveRecalc &&
      todayCacheAgeMs !== null &&
      todayCacheAgeMs > FX_REFRESH_TTL_MS &&
      Date.now() - (liveRefetchAttemptedAt.get(ttlKey) ?? 0) > FX_REFRESH_TTL_MS;
    const shouldRefetch = forceRefresh || resolution.source === "pending" || (resolution.source === "inherited" && date === todayIso()) || ttlRefetch;
    // Cuando el ÚNICO motivo del refetch es el TTL ya hay una cotización de
    // hoy servible: el timeout es corto para que una red colgada (portal
    // cautivo, `onLine` mintiendo) no deje el patrimonio neto en skeleton.
    const ttlOnly = ttlRefetch && !forceRefresh && resolution.source === "api";
    if (ttlOnly) liveRefetchAttemptedAt.set(ttlKey, Date.now());
    if (shouldRefetch && isOnline) {
      try {
        const url = new URL("/api/fx", typeof window !== "undefined" ? window.location.origin : "http://localhost");
        url.searchParams.set("base", base);
        url.searchParams.set("quote", quote);
        url.searchParams.set("date", date);
        url.searchParams.set("householdId", householdId);
        if (preference.preferredProvider) url.searchParams.set("provider", preference.preferredProvider);
        if (preference.preferredQuoteKind) url.searchParams.set("quoteKind", preference.preferredQuoteKind);

        // Acotado siempre: si expira, cae al catch y se sirve lo local
        // (cache o `pending`) — el guardado nunca se bloquea (CLAUDE.md).
        const res = await fetch(url.toString(), { signal: AbortSignal.timeout(ttlOnly ? 4_000 : 10_000) });
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
            // Un record fresco con la misma identidad (asOf+provider+
            // quoteKind) que uno cacheado lo REEMPLAZA para esta resolución
            // — sin el filtro, el viejo ganaba el empate y el caller recibía
            // el rate desactualizado aunque el cache de Dexie ya tuviera el
            // corregido (recién visible en el próximo resolve).
            const identity = (r: FxRateRecord) => `${r.base}|${r.quote}|${r.asOf}|${r.provider}|${r.quoteKind}`;
            const freshIdentities = new Set(freshRecords.map(identity));
            resolution = resolveFxRate({
              base,
              quote,
              date,
              manualOverride,
              ratesForPair: [...cachedRows.map(toRecord).filter((r) => !freshIdentities.has(identity(r))), ...freshRecords],
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
