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
// ONs, letras, sin key) y CoinGecko (crypto). Un instrumento sin
// `price_provider` (FCI, plazo fijo, inmuebles, cualquier cosa sin
// cobertura) queda sin cotización automática — el precio a mano sigue
// siendo el camino de primera clase para esos, no un fallback.
//
// Deploy: `supabase functions deploy daily-price-sync`
// No necesita secrets propios — usa `SUPABASE_SERVICE_ROLE_KEY` que Supabase
// ya inyecta a toda Edge Function.
import { createClient } from "npm:@supabase/supabase-js@2";

const DATA912_CATEGORIES = ["arg_stocks", "arg_cedears", "arg_bonds", "arg_corp", "arg_notes"];

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

  const [data912Rows, coinGeckoRows] = await Promise.all([fetchData912Prices(data912Instruments), fetchCoinGeckoPrices(coinGeckoInstruments)]);

  const rows = [...data912Rows, ...coinGeckoRows];
  if (rows.length === 0) {
    return new Response(JSON.stringify({ upserted: 0 }), { headers: { "Content-Type": "application/json" } });
  }

  const { error: upsertError } = await supabase.from("price_snapshots").upsert(rows, { onConflict: "instrument_id,as_of,provider" });
  if (upsertError) return new Response(JSON.stringify({ error: upsertError.message }), { status: 500 });

  return new Response(JSON.stringify({ upserted: rows.length }), { headers: { "Content-Type": "application/json" } });
});
