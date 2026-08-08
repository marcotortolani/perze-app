import type { PriceProvider, PriceQuote } from "./types";

/** D10 — mismo criterio que `data912.ts`: server-only, sin zona horaria de nadie. */
function serverTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const BASE_URL = "https://api.argentinadatos.com/v1/finanzas/fci";

/**
 * ArgentinaDatos separa los FCI en categorías (CAFCI), pero a diferencia de
 * Data912 (que sí expone en qué categoría vive cada ticker vía `/fondos`)
 * el campo `tipoRenta` de esa ficha no mapea 1:1 a estos nombres de ruta.
 * Mismo criterio que `DATA912_CATEGORIES`: se busca el `fondo` (nombre
 * exacto) en las categorías una por una hasta encontrarlo, sin intentar
 * adivinar la categoría de antemano.
 */
const CATEGORIES = ["mercadoDinero", "rentaFija", "rentaVariable", "rentaMixta", "retornoTotal", "otros"] as const;
type FciCategory = (typeof CATEGORIES)[number];

interface FciSnapshot {
  fondo: string;
  fecha: string;
  vcp: number;
}

async function fetchCategoryLatest(fetchImpl: typeof fetch, category: FciCategory): Promise<FciSnapshot[]> {
  const res = await fetchImpl(`${BASE_URL}/${category}/ultimo`);
  if (!res.ok) throw new Error(`argentinadatos (fci/${category}) respondió ${res.status}`);
  return (await res.json()) as FciSnapshot[];
}

/**
 * I10 — VCP (valor de cuotaparte) diario de fondos comunes de inversión
 * argentinos, vía ArgentinaDatos (CAFCI), sin key. Cubre un hueco que ni
 * Data912 ni Finnhub tenían: hasta acá un FCI solo se podía cargar con
 * precio a mano (sigue siendo el camino de primera clase para los que no
 * aparezcan acá — fondos cerrados, muy chicos, o dados de baja).
 */
export function createArgentinaDatosFciProvider(fetchImpl: typeof fetch = fetch): PriceProvider {
  return {
    id: "argentinadatos-fci",
    async fetchPrice(providerSymbol: string): Promise<PriceQuote | null> {
      for (const category of CATEGORIES) {
        const entries = await fetchCategoryLatest(fetchImpl, category).catch(() => [] as FciSnapshot[]);
        const entry = entries.find((e) => e.fondo === providerSymbol);
        if (entry) return { close: entry.vcp, asOf: entry.fecha || serverTodayIso() };
      }
      return null;
    },
  };
}

export interface ArgentinaDatosFciSearchResult {
  /** Nombre completo del fondo tal cual lo devuelve CAFCI — es el único identificador que existe, no hay ticker. */
  symbol: string;
  name: string;
  currencyCode: "ARS" | "USD";
  administradora: string;
}

const MONEDA_TO_CURRENCY: Record<string, "ARS" | "USD"> = {
  "Peso Argentina": "ARS",
  "Dolar Estadounidense": "USD",
  "Dolar Estadounidense Billete": "USD",
};

interface FciFondoEntry {
  nombre: string;
  administradora: string;
  moneda: string;
}

/**
 * `/fondos` trae el catálogo completo (~4.700 fondos, sin paginado ni
 * `?q=`) con nombre, administradora y moneda — bastante más rico que
 * Data912, que no tiene nombre de compañía en ninguna de sus categorías.
 * Se filtra acá, mismo criterio que Data912 (trae la categoría/catálogo
 * entero y filtra en el server, nunca en el cliente).
 */
export async function searchArgentinaDatosFci(query: string, fetchImpl: typeof fetch = fetch): Promise<ArgentinaDatosFciSearchResult[]> {
  const needle = query.trim().toUpperCase();
  if (needle.length < 2) return [];

  const res = await fetchImpl(`${BASE_URL}/fondos`);
  if (!res.ok) throw new Error(`argentinadatos (fci/fondos) respondió ${res.status}`);
  const data = (await res.json()) as { fondos: FciFondoEntry[] };

  return data.fondos
    .filter((f) => f.nombre.toUpperCase().includes(needle))
    .map((f): ArgentinaDatosFciSearchResult => ({ symbol: f.nombre, name: f.nombre, currencyCode: MONEDA_TO_CURRENCY[f.moneda] ?? "ARS", administradora: f.administradora }));
}
