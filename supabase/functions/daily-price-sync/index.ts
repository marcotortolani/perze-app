// Bloque I — sin esto, `price_snapshots` queda vacía para siempre: nada
// más la escribe (Patrón C, sin policy de INSERT para `service_role`
// aparte). Se llama una vez por día desde `pg_cron`+`pg_net`
// (`public.trigger_daily_price_sync()`, ver
// `20260806090000_investment_prices_infra.sql`), nunca directo desde el
// cliente — el cliente solo lee `price_snapshots`, o carga un precio a
// mano (`provider: 'manual'`, su propia policy separada).
//
// Mismos proveedores que `src/lib/prices/providers/*.ts` del cliente,
// portados a Deno: Data912 (mercado argentino — acciones, CEDEARs, bonos,
// ONs, letras, sin key), CoinGecko (crypto), Finnhub (acciones/ETFs de
// EE.UU., NYSE/NASDAQ) y ArgentinaDatos/CAFCI (FCI, sin key). Un
// instrumento sin `price_provider` (plazo fijo, inmuebles, un FCI que no
// aparece en el catálogo de CAFCI, cualquier cosa sin cobertura) queda sin
// cotización automática — el precio a mano sigue siendo el camino de
// primera clase para esos, no un fallback.
//
// Deploy: `supabase functions deploy daily-price-sync`
// Usa `SUPABASE_SERVICE_ROLE_KEY`, que Supabase ya inyecta a toda Edge
// Function. Finnhub SÍ necesita un secret propio, que este archivo no
// comparte con `.env`/`src/env.ts` (esto es Deno, no Next):
// `supabase secrets set FINNHUB_API_KEY=...` (ver `docs/self-hosting.md`).
// Sin ese secret, `fetchFinnhubPrices` devuelve `[]` sin romper el resto
// del sync — mismo contrato que el proveedor del lado Next.
import { createClient } from "npm:@supabase/supabase-js@2";

const DATA912_CATEGORIES = ["arg_stocks", "arg_cedears", "arg_bonds", "arg_corp", "arg_notes"];
// `src/lib/prices/providers/argentinadatos.ts` — mismas 6 categorías, mismo criterio de "buscar hasta encontrar".
const FCI_CATEGORIES = ["mercadoDinero", "rentaFija", "rentaVariable", "rentaMixta", "retornoTotal", "otros"];

interface PriceSnapshotInsert {
  instrument_id: string;
  as_of: string;
  provider: string;
  close: number;
  currency_code: string;
}

async function fetchData912Prices(instruments: Array<{ id: string; provider_symbol: string; currency_code: string }>): Promise<PriceSnapshotInsert[]> {
  if (instruments.length === 0) return [];
  const bySymbol = new Map(instruments.map((i) => [i.provider_symbol, i]));
  const today = new Date().toISOString().slice(0, 10);
  const rows: PriceSnapshotInsert[] = [];

  for (const category of DATA912_CATEGORIES) {
    const res = await fetch(`https://data912.com/live/${category}`);
    if (!res.ok) continue; // una categoría caída no tira abajo el resto — se reintenta mañana.
    const entries = (await res.json()) as Array<{ symbol: string; c: number }>;
    for (const entry of entries) {
      const instrument = bySymbol.get(entry.symbol);
      if (!instrument) continue;
      rows.push({ instrument_id: instrument.id, as_of: today, provider: "data912", close: entry.c, currency_code: instrument.currency_code });
      bySymbol.delete(entry.symbol); // ya resuelto, no hace falta seguir buscándolo en otra categoría.
    }
  }
  return rows;
}

async function fetchCoinGeckoPrices(instruments: Array<{ id: string; provider_symbol: string; currency_code: string }>): Promise<PriceSnapshotInsert[]> {
  if (instruments.length === 0) return [];
  const ids = [...new Set(instruments.map((i) => i.provider_symbol))];
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as Record<string, { usd?: number }>;
  const today = new Date().toISOString().slice(0, 10);
  const rows: PriceSnapshotInsert[] = [];

  for (const instrument of instruments) {
    const price = data[instrument.provider_symbol]?.usd;
    if (price === undefined) continue;
    rows.push({ instrument_id: instrument.id, as_of: today, provider: "coingecko", close: price, currency_code: instrument.currency_code });
  }
  return rows;
}

/**
 * FCI, vía ArgentinaDatos/CAFCI: `fondo` (nombre completo) es el
 * `provider_symbol` — no hay ticker. Cada categoría trae el catálogo
 * entero del día (`/ultimo`), igual que Data912 con sus 5 categorías; una
 * categoría caída no tira abajo el resto, se reintenta mañana.
 */
async function fetchArgentinaDatosFciPrices(instruments: Array<{ id: string; provider_symbol: string; currency_code: string }>): Promise<PriceSnapshotInsert[]> {
  if (instruments.length === 0) return [];
  const bySymbol = new Map(instruments.map((i) => [i.provider_symbol, i]));

  const rows: PriceSnapshotInsert[] = [];
  for (const category of FCI_CATEGORIES) {
    if (bySymbol.size === 0) break;
    const res = await fetch(`https://api.argentinadatos.com/v1/finanzas/fci/${category}/ultimo`);
    if (!res.ok) continue;
    const entries = (await res.json()) as Array<{ fondo: string; fecha: string; vcp: number }>;
    for (const entry of entries) {
      const instrument = bySymbol.get(entry.fondo);
      if (!instrument) continue;
      rows.push({ instrument_id: instrument.id, as_of: entry.fecha, provider: "argentinadatos-fci", close: entry.vcp, currency_code: instrument.currency_code });
      bySymbol.delete(entry.fondo);
    }
  }
  return rows;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A diferencia de Data912/CoinGecko (una llamada trae el mercado/lote
 * entero), el free tier de Finnhub solo tiene `/quote` por símbolo — un
 * pedido por instrumento, secuencial. 60 llamadas/min de tope: 1.1s entre
 * pedidos deja margen real sin acercarse al límite. Un símbolo que falla
 * (404, rate limit puntual) no tira abajo el resto — se reintenta mañana,
 * mismo criterio que una categoría caída de Data912.
 */
async function fetchFinnhubPrices(instruments: Array<{ id: string; provider_symbol: string; currency_code: string }>): Promise<PriceSnapshotInsert[]> {
  if (instruments.length === 0) return [];
  const apiKey = Deno.env.get("FINNHUB_API_KEY");
  if (!apiKey) return [];

  const today = new Date().toISOString().slice(0, 10);
  const rows: PriceSnapshotInsert[] = [];

  for (const [i, instrument] of instruments.entries()) {
    if (i > 0) await sleep(1100);
    try {
      const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(instrument.provider_symbol)}&token=${apiKey}`);
      if (!res.ok) continue;
      const data = (await res.json()) as { c: number; t: number };
      if (data.t === 0) continue; // símbolo inexistente — ver la misma nota en finnhub.ts
      rows.push({ instrument_id: instrument.id, as_of: today, provider: "finnhub", close: data.c, currency_code: instrument.currency_code });
    } catch {
      continue;
    }
  }
  return rows;
}

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: instruments, error: instrumentsError } = await supabase
    .from("instruments")
    .select("id, price_provider, provider_symbol, currency_code")
    .not("price_provider", "is", null)
    .not("provider_symbol", "is", null);
  if (instrumentsError) return new Response(JSON.stringify({ error: instrumentsError.message }), { status: 500 });

  const all = (instruments ?? []) as Array<{ id: string; price_provider: string; provider_symbol: string; currency_code: string }>;
  const data912Instruments = all.filter((i) => i.price_provider === "data912");
  const coinGeckoInstruments = all.filter((i) => i.price_provider === "coingecko");
  const finnhubInstruments = all.filter((i) => i.price_provider === "finnhub");
  const fciInstruments = all.filter((i) => i.price_provider === "argentinadatos-fci");

  // Finnhub no va en el mismo `Promise.all`: es secuencial por dentro
  // (rate limit, ver `fetchFinnhubPrices`) y correrlo en paralelo con los
  // otros no lo acelera — el resto ya termina mucho antes.
  const [data912Rows, coinGeckoRows, fciRows] = await Promise.all([fetchData912Prices(data912Instruments), fetchCoinGeckoPrices(coinGeckoInstruments), fetchArgentinaDatosFciPrices(fciInstruments)]);
  const finnhubRows = await fetchFinnhubPrices(finnhubInstruments);

  const rows = [...data912Rows, ...coinGeckoRows, ...finnhubRows, ...fciRows];
  if (rows.length === 0) {
    return new Response(JSON.stringify({ upserted: 0 }), { headers: { "Content-Type": "application/json" } });
  }

  const { error: upsertError } = await supabase.from("price_snapshots").upsert(rows, { onConflict: "instrument_id,as_of,provider" });
  if (upsertError) return new Response(JSON.stringify({ error: upsertError.message }), { status: 500 });

  return new Response(JSON.stringify({ upserted: rows.length }), { headers: { "Content-Type": "application/json" } });
});
