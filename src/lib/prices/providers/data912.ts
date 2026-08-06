import type { PriceProvider, PriceQuote } from "./types";

/**
 * D10 — a propósito NO usa `lib/dates/today.ts` (el helper tz-aware del
 * cliente): estos proveedores solo se llaman desde el servidor (route
 * handler / Edge Function de cron), sin conocer la zona horaria de nadie.
 * Mismo criterio que `todayIso()` de `src/app/api/fx/route.ts`.
 */
function serverTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** `docs/01-arquitectura-datos.md` § 2.8 — mercado argentino, comunitaria, gratis, sin key. */
const CATEGORIES = ["arg_stocks", "arg_cedears", "arg_bonds", "arg_corp", "arg_notes"] as const;
type Data912Category = (typeof CATEGORIES)[number];

interface Data912Entry {
  symbol: string;
  /** Último cierre — la referencia más estable de las que trae la API (a diferencia de `px_bid`/`px_ask`, que pueden venir en 0 fuera de rueda). */
  c: number;
}

/**
 * Data912 no separa por símbolo — cada categoría trae el mercado entero.
 * Un `fetchPrice()` puntual (route handler bajo demanda) paga el costo de
 * bajar la categoría completa una vez; el cron diario (`daily-price-sync`)
 * hace exactamente esto mismo una vez por categoría y lo reparte entre
 * todos los instrumentos que la usan, así que ahí el costo por
 * instrumento es ínfimo.
 */
export function createData912Provider(fetchImpl: typeof fetch = fetch): PriceProvider {
  return {
    id: "data912",
    async fetchPrice(providerSymbol: string): Promise<PriceQuote | null> {
      for (const category of CATEGORIES) {
        const entry = await fetchOne(fetchImpl, category, providerSymbol);
        if (entry) return { close: entry.c, asOf: serverTodayIso() };
      }
      return null;
    },
  };
}

async function fetchOne(fetchImpl: typeof fetch, category: Data912Category, symbol: string): Promise<Data912Entry | null> {
  const entries = await fetchCategory(fetchImpl, category);
  return entries.find((e) => e.symbol === symbol) ?? null;
}

async function fetchCategory(fetchImpl: typeof fetch, category: Data912Category): Promise<Data912Entry[]> {
  const res = await fetchImpl(`https://data912.com/live/${category}`);
  if (!res.ok) throw new Error(`data912 (${category}) respondió ${res.status}`);
  return (await res.json()) as Data912Entry[];
}
