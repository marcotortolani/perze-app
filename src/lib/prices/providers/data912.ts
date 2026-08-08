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

/** `instruments.asset_class_id` no es esto — es el nombre de la fila sembrada (`20260801070100_fix_asset_classes_seed.sql`) que el caller resuelve a un id real contra la lista del household. */
export const DATA912_CATEGORY_ASSET_CLASS: Record<Data912Category, string> = {
  arg_stocks: "Acciones",
  arg_cedears: "CEDEARs",
  arg_bonds: "Bonos soberanos",
  arg_corp: "ONs",
  arg_notes: "Letras",
};

export interface Data912SearchResult {
  symbol: string;
  category: Data912Category;
  assetClass: string;
  currencyCode: "ARS" | "USD";
  close: number;
  /** Ticker sin el sufijo D/C cuando `detectVariantOf` lo identificó como su variante dólar-cable/MEP — nunca un símbolo real distinto, para que la UI pueda etiquetar la relación en vez de dejar que el usuario adivine por el nombre. */
  variantOf: string | null;
}

/**
 * D52 — data912 SÍ separa pesos de dólares, solo que no con un campo:
 * un ticker que termina en "D" o "C" es la variante dólar-cable/MEP del
 * mismo instrumento en pesos ("D" = "dólar", "C" = "contado con liqui"),
 * cotizada directamente en USD — confirmado contra la API en vivo:
 * `AL30` (bono) cierra ~85.850 (pesos) mientras `AL30D`/`AL30C` cierran
 * ~56 (dólares, coherente con el tipo de cambio implícito), y lo mismo
 * pasa con acciones: `YPFD` (YPF S.A., ticker real, TERMINA en "D" pero
 * no es un sufijo) cierra ~7.840 pesos mientras `YPFDD` — `YPFD` + el
 * sufijo "D" — cierra ~5,18 dólares. Ahí está la trampa que reportó el
 * usuario buscando "YPF": los dos resultados parecían iguales
 * ("Acciones · ARS" los dos) pero uno es en pesos y el otro en dólares.
 *
 * No alcanza con "termina en D → dólar" (`YPFD` mismo termina en "D" y
 * es en pesos): el sufijo solo es tal si el símbolo SIN esa última letra
 * existe como otro instrumento en la misma categoría — ahí sí es la
 * variante dólar de ese otro. Heurística estructural, no un patrón de
 * texto fijo. Devuelve el ticker base (`"YPFD"`) cuando `symbol` es su
 * variante dólar, `null` si no.
 */
function detectVariantOf(symbol: string, symbolsInCategory: ReadonlySet<string>): string | null {
  const suffix = symbol.at(-1);
  if (suffix !== "D" && suffix !== "C") return null;
  const base = symbol.slice(0, -1);
  return symbolsInCategory.has(base) ? base : null;
}

/**
 * Búsqueda por símbolo (Data912 no trae nombre de compañía, solo ticker,
 * en ninguna de sus 5 categorías) — I7, para no obligar a "inventar" el
 * símbolo exacto de memoria antes de poder cargarlo. Un CEDEAR de AAPL/TSLA
 * cotiza acá mismo, con el mismo ticker que el mercado de origen, así que
 * cubre el caso de uso real sin necesitar una fuente de EE.UU. aparte.
 */
export async function searchData912Instruments(query: string, fetchImpl: typeof fetch = fetch): Promise<Data912SearchResult[]> {
  const needle = query.trim().toUpperCase();
  if (needle.length < 2) return [];

  const results = await Promise.all(
    CATEGORIES.map(async (category) => {
      const entries = await fetchCategory(fetchImpl, category).catch(() => [] as Data912Entry[]);
      const symbolsInCategory = new Set(entries.map((e) => e.symbol));
      return entries
        .filter((e) => e.symbol.includes(needle))
        .map((e): Data912SearchResult => {
          const variantOf = detectVariantOf(e.symbol, symbolsInCategory);
          return { symbol: e.symbol, category, assetClass: DATA912_CATEGORY_ASSET_CLASS[category], currencyCode: variantOf !== null ? "USD" : "ARS", close: e.c, variantOf };
        });
    })
  );
  return results.flat().sort((a, b) => a.symbol.localeCompare(b.symbol));
}
