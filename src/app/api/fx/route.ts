import { NextResponse } from "next/server";
import { z } from "zod";
import { formatRate, parseRate, type ScaledRate } from "@/lib/fx/rate";
import { type FxManualOverride, type FxRateRecord, resolveFxRate } from "@/lib/fx/resolve";
import { createDolarApiProvider } from "@/lib/fx/providers/dolarapi";
import { createDolarApiUyProvider } from "@/lib/fx/providers/dolarapi-uy";
import { createFrankfurterProvider } from "@/lib/fx/providers/frankfurter";
import { createCoinGeckoProvider } from "@/lib/fx/providers/coingecko";
import type { FxProvider } from "@/lib/fx/providers/types";
import { createClient } from "@/lib/supabase/server";

/**
 * Única puerta de entrada a cotizaciones externas — el cliente nunca llama
 * a una API de FX directo (`CLAUDE.md`). Lee `fx_overrides` (paso 1 de la
 * cadena) y el cache persistente `fx_rates` (paso 2/3) desde Supabase, con
 * las policies de RLS del usuario autenticado.
 *
 * **No escribe** en `fx_rates`: esa tabla es Patrón C puro
 * (`docs/01-arquitectura-datos.md` § 3), escritura solo por `service_role`.
 * Precargar cotizaciones frescas es el trabajo del cron diario
 * (`BASE-02`, pendiente) — este route handler, mientras tanto, vuelve a
 * pedirle a los providers en cada request sin cache sin persistir, igual
 * que antes de conectar Supabase. Cuando exista el cron, esto debería
 * encontrar casi siempre un `fx_rates` fresco y dejar de llamar afuera.
 */
const providers: FxProvider[] = [createDolarApiProvider(), createDolarApiUyProvider(), createFrankfurterProvider(), createCoinGeckoProvider()];

/**
 * D10 — a propósito NO usa `lib/dates/today.ts` (el helper tz-aware del
 * cliente): esto corre en el servidor, sin conocer la zona horaria del
 * usuario. Se usa solo para (a) el fallback de `date` cuando el caller no
 * lo manda — hoy ningún caller real omite `date`, siempre lo calculan
 * ellos con el helper del cliente — y (b) `hasFreshToday`, que pregunta
 * "¿ya tenemos la cotización global de hoy en cache", un concepto de
 * fecha de mercado, no de calendario del usuario. Usar la zona del
 * dispositivo servidor acá sería tan arbitrario como UTC.
 */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * B5 — antes: sin `getUser()`, `date` interpolado crudo en un `.or()` de
 * PostgREST (`?date=2026-01-01,rate.gte.0` reescribía el filtro entero),
 * y `base`/`quote`/`householdId` sin validar. El regex de `date` por sí
 * solo ya cierra la inyección (los únicos caracteres permitidos son
 * dígitos y guiones — no hay forma de colar una coma). Los códigos de
 * moneda NO se acotan a 3 letras (`CLAUDE.md`: "USDT no entra en tres
 * caracteres") — la forma se valida acá, la existencia real contra el
 * catálogo de `currencies` en el propio handler.
 */
const querySchema = z.object({
  base: z.string().regex(/^[A-Z0-9]{2,10}$/, "MONEDA_INVALIDA"),
  quote: z.string().regex(/^[A-Z0-9]{2,10}$/, "MONEDA_INVALIDA"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "FECHA_INVALIDA")
    .optional(),
  householdId: z.uuid("HOUSEHOLD_INVALIDO").optional(),
  provider: z.string().max(40).optional(),
  quoteKind: z.string().max(40).optional(),
});

async function fetchAllQuotes(base: string, quote: string): Promise<FxRateRecord[]> {
  const supporting = providers.filter((p) => p.supports(base, quote));
  const results = await Promise.allSettled(supporting.map((p) => p.fetchQuotes(base, quote)));

  const records: FxRateRecord[] = [];
  for (const [i, r] of results.entries()) {
    if (r.status !== "fulfilled") continue;
    const provider = supporting[i];
    if (!provider) continue;
    for (const q of r.value) {
      records.push({
        base: q.base,
        quote: q.quote,
        asOf: q.asOf,
        provider: provider.id,
        quoteKind: q.quoteKind,
        rate: q.rate,
        fetchedAt: new Date().toISOString(),
      });
    }
  }
  return records;
}

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const supabase = await createClient();

  // B5 — 401 sin sesión: antes cualquier anónimo disparaba fetches
  // salientes a dolarapi/frankfurter gratis (amplificación, riesgo de
  // baneo por IP) y podía leer overrides de cualquier household.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const parsed = querySchema.safeParse({
    base: searchParams.get("base") ?? undefined,
    quote: searchParams.get("quote") ?? undefined,
    date: searchParams.get("date") ?? undefined,
    householdId: searchParams.get("householdId") ?? undefined,
    provider: searchParams.get("provider") ?? undefined,
    quoteKind: searchParams.get("quoteKind") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "PARAMS_INVALIDOS", issues: parsed.error.issues }, { status: 400, headers: NO_STORE_HEADERS });
  }
  const { base, quote, householdId, provider: preferredProvider, quoteKind: preferredQuoteKind } = parsed.data;
  const date = parsed.data.date ?? todayIso();

  // Existencia real contra el catálogo — el regex de arriba solo valida
  // forma, no que la moneda exista (Patrón C: catálogo global, ver `CLAUDE.md`).
  const codesToCheck = base === quote ? [base] : [base, quote];
  const { data: knownCurrencies, error: currenciesError } = await supabase
    .from("currencies")
    .select("code")
    .in("code", codesToCheck)
    .eq("is_active", true);
  if (currenciesError) {
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500, headers: NO_STORE_HEADERS });
  }
  if ((knownCurrencies ?? []).length !== codesToCheck.length) {
    return NextResponse.json({ error: "MONEDA_DESCONOCIDA" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  // Paso 1 de la cadena: override manual vigente del household, a la
  // fecha del movimiento (no "el último"). `rate::text` evita que
  // PostgREST serialice el numeric(24,12) como JSON number y le vuele
  // precisión — se parsea siempre desde texto, nunca desde `number`.
  let manualOverride: FxManualOverride | null = null;
  if (householdId && base !== quote) {
    const { data } = await supabase
      .from("fx_overrides")
      .select("rate::text, valid_from, valid_to")
      .eq("household_id", householdId)
      .eq("base_currency", base)
      .eq("quote_currency", quote)
      .lte("valid_from", date)
      .or(`valid_to.is.null,valid_to.gte.${date}`)
      .order("valid_from", { ascending: false })
      .limit(1)
      .maybeSingle<{ rate: string; valid_from: string; valid_to: string | null }>();

    if (data) {
      manualOverride = { rate: parseRate(data.rate), quoteKind: "custom" };
    }
  }

  // Paso 2/3: candidatos ya persistidos en fx_rates (cache real, no en
  // memoria de proceso — sobrevive un redeploy/cold start).
  let ratesForPair: FxRateRecord[] = [];
  if (base !== quote) {
    const { data } = await supabase
      .from("fx_rates")
      .select("base, quote, as_of, provider, quote_kind, rate::text, fetched_at")
      .eq("base", base)
      .eq("quote", quote)
      .order("as_of", { ascending: false })
      .limit(30)
      .returns<Array<{ base: string; quote: string; as_of: string; provider: string; quote_kind: string; rate: string; fetched_at: string }>>();

    ratesForPair = (data ?? []).map((r) => ({
      base: r.base,
      quote: r.quote,
      asOf: r.as_of,
      provider: r.provider,
      quoteKind: r.quote_kind,
      rate: parseRate(r.rate) as ScaledRate,
      fetchedAt: r.fetched_at,
    }));
  }

  const hasFreshToday = ratesForPair.some((r) => r.asOf === todayIso());
  if (!hasFreshToday && base !== quote) {
    const fresh = await fetchAllQuotes(base, quote);
    ratesForPair = [...fresh, ...ratesForPair];
  }

  // Variantes disponibles para el par (blue/CCL/tarjeta, oficial, etc.)
  // — `resolveFxRate` ya elige UNA sola por preferencia, pero E6 necesita
  // mostrarle al usuario todas las que existan para que elija con un
  // click. Misma regla de "más reciente ≤ date" que la cadena de
  // resolución, aplicada por separado a cada `quoteKind`.
  const bestByQuoteKind = new Map<string, FxRateRecord>();
  for (const r of ratesForPair) {
    if (r.asOf > date) continue;
    const current = bestByQuoteKind.get(r.quoteKind);
    if (!current || r.asOf > current.asOf) bestByQuoteKind.set(r.quoteKind, r);
  }
  const availableQuoteKinds = [...bestByQuoteKind.values()].sort((a, b) => a.quoteKind.localeCompare(b.quoteKind));

  const resolution = resolveFxRate({
    base,
    quote,
    date,
    manualOverride,
    ratesForPair,
    preferredProvider,
    preferredQuoteKind,
  });

  return NextResponse.json(
    {
      rate: resolution.rate === null ? null : formatRate(resolution.rate),
      source: resolution.source,
      provider: resolution.provider,
      quoteKind: resolution.quoteKind,
      asOf: resolution.asOf,
      isStale: resolution.isStale,
      availableQuoteKinds: availableQuoteKinds.map((r) => ({ quoteKind: r.quoteKind, rate: formatRate(r.rate), asOf: r.asOf, provider: r.provider })),
    },
    { headers: NO_STORE_HEADERS }
  );
}
