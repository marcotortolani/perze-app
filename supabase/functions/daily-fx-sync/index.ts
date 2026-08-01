// E20 — sin esto, `fx_rates` queda vacía para siempre: nada más la
// escribe. Se llama una vez por día desde `pg_cron`+`pg_net`
// (`public.trigger_daily_fx_sync()`, ver `20260801160000_cron_engines.sql`),
// nunca directo desde el cliente — el cliente solo lee `fx_rates` (o pega
// contra `/api/fx` para un par puntual que todavía no está acá).
//
// Mismos dos proveedores que `src/lib/fx/providers/*.ts` en el cliente,
// portados a Deno: mismo alcance de monedas, misma fuente. Si un par no
// está cubierto por ninguno de los dos (ej. cualquier cosa con UYU o CLP
// hoy), sigue sin cotización acá igual que en el cliente — este cron no
// agrega proveedores nuevos, solo automatiza los que ya existían.
//
// Deploy: `supabase functions deploy daily-fx-sync`
// No necesita secrets propios — usa `SUPABASE_SERVICE_ROLE_KEY` que Supabase
// ya inyecta a toda Edge Function.
import { createClient } from "npm:@supabase/supabase-js@2";

/** Igual a `frankfurter.ts` del cliente — ~30 monedas del BCE, sin crypto ni la mayoría de LatAm. */
const FRANKFURTER_SUPPORTED = new Set([
  "EUR", "USD", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "BRL", "MXN", "CNY", "SEK", "NOK", "DKK",
]);

const DOLARAPI_CASA_TO_QUOTE_KIND: Record<string, string> = {
  oficial: "oficial",
  blue: "blue",
  bolsa: "mep",
  contadoconliqui: "ccl",
  mayorista: "mayorista",
  cripto: "cripto",
  tarjeta: "tarjeta",
};

interface FxRateInsert {
  base: string;
  quote: string;
  as_of: string;
  provider: string;
  quote_kind: string;
  rate: number;
  bid?: number | null;
  ask?: number | null;
}

async function fetchFrankfurterRates(currencies: string[]): Promise<FxRateInsert[]> {
  const relevant = currencies.filter((c) => FRANKFURTER_SUPPORTED.has(c));
  const rows: FxRateInsert[] = [];

  for (const base of relevant) {
    const symbols = relevant.filter((c) => c !== base);
    if (symbols.length === 0) continue;
    const url = `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${symbols.join(",")}`;
    const res = await fetch(url);
    if (!res.ok) continue; // un proveedor caído no tira abajo el resto del sync — se reintenta mañana.
    const data = (await res.json()) as { date: string; rates: Record<string, number> };
    for (const quote of symbols) {
      const rate = data.rates[quote];
      if (rate === undefined) continue;
      rows.push({ base, quote, as_of: data.date, provider: "frankfurter", quote_kind: "default", rate });
    }
  }
  return rows;
}

async function fetchDolarApiRates(): Promise<FxRateInsert[]> {
  const res = await fetch("https://dolarapi.com/v1/dolares");
  if (!res.ok) return [];
  const entries = (await res.json()) as Array<{ casa: string; compra: number; venta: number; fechaActualizacion: string }>;
  const rows: FxRateInsert[] = [];

  for (const entry of entries) {
    const quoteKind = DOLARAPI_CASA_TO_QUOTE_KIND[entry.casa];
    if (!quoteKind || !entry.venta) continue;
    const asOf = entry.fechaActualizacion.slice(0, 10);
    // Venta: lo que cuesta comprar 1 USD en ARS — misma referencia que usa el cliente.
    rows.push({ base: "USD", quote: "ARS", as_of: asOf, provider: "dolarapi", quote_kind: quoteKind, rate: entry.venta, bid: entry.compra || null, ask: entry.venta });
    rows.push({ base: "ARS", quote: "USD", as_of: asOf, provider: "dolarapi", quote_kind: quoteKind, rate: 1 / entry.venta });
  }
  return rows;
}

Deno.serve(async (_req) => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: currencies, error: currenciesError } = await supabase
    .from("currencies")
    .select("code")
    .eq("is_active", true);
  if (currenciesError) return new Response(JSON.stringify({ error: currenciesError.message }), { status: 500 });

  const codes = (currencies ?? []).map((c) => c.code as string);

  const [frankfurterRows, dolarApiRows] = await Promise.all([
    fetchFrankfurterRates(codes),
    codes.includes("ARS") && codes.includes("USD") ? fetchDolarApiRates() : Promise.resolve([]),
  ]);

  const rows = [...frankfurterRows, ...dolarApiRows];
  if (rows.length === 0) {
    return new Response(JSON.stringify({ upserted: 0 }), { headers: { "Content-Type": "application/json" } });
  }

  const { error: upsertError } = await supabase
    .from("fx_rates")
    .upsert(rows, { onConflict: "base,quote,as_of,provider,quote_kind" });
  if (upsertError) return new Response(JSON.stringify({ error: upsertError.message }), { status: 500 });

  return new Response(JSON.stringify({ upserted: rows.length }), { headers: { "Content-Type": "application/json" } });
});
