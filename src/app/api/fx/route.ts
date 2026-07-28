import { NextResponse } from "next/server";
import { formatRate } from "@/lib/fx/rate";
import { type FxRateRecord, resolveFxRate } from "@/lib/fx/resolve";
import { createDolarApiProvider } from "@/lib/fx/providers/dolarapi";
import { createFrankfurterProvider } from "@/lib/fx/providers/frankfurter";
import type { FxProvider } from "@/lib/fx/providers/types";

/**
 * Única puerta de entrada a cotizaciones externas — el cliente nunca llama
 * a una API de FX directo (`CLAUDE.md`). Cache en memoria de proceso como
 * estable provisorio: cuando exista la tabla `fx_rates` de Supabase
 * (Fase 9 en adelante), esto pasa a leer/escribir ahí en vez de un `Map`.
 */
const providers: FxProvider[] = [createDolarApiProvider(), createFrankfurterProvider()];

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { record: FxRateRecord; expiresAt: number }>();

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const base = searchParams.get("base");
  const quote = searchParams.get("quote");
  const date = searchParams.get("date") ?? todayIso();
  const preferredProvider = searchParams.get("provider") ?? undefined;
  const preferredQuoteKind = searchParams.get("quoteKind") ?? undefined;

  if (!base || !quote) {
    // Código estable, no un mensaje humano: un route handler no conoce el
    // locale del cliente que lo llama. El cliente traduce este código a
    // `errors.*` (ver `messages/*.json`) antes de mostrarlo.
    return NextResponse.json({ error: "MISSING_PARAMS" }, { status: 400 });
  }

  const cacheKey = `${base}:${quote}:${preferredProvider ?? "*"}:${preferredQuoteKind ?? "*"}`;
  const cached = cache.get(cacheKey);
  let ratesForPair: FxRateRecord[];

  if (cached && cached.expiresAt > Date.now()) {
    ratesForPair = [cached.record];
  } else {
    ratesForPair = base === quote ? [] : await fetchAllQuotes(base, quote);
    const freshest = ratesForPair.find((r) => r.asOf === todayIso());
    if (freshest) cache.set(cacheKey, { record: freshest, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  const resolution = resolveFxRate({
    base,
    quote,
    date,
    manualOverride: null,
    ratesForPair,
    preferredProvider,
    preferredQuoteKind,
  });

  return NextResponse.json({
    rate: resolution.rate === null ? null : formatRate(resolution.rate),
    source: resolution.source,
    provider: resolution.provider,
    quoteKind: resolution.quoteKind,
    asOf: resolution.asOf,
    isStale: resolution.isStale,
  });
}
