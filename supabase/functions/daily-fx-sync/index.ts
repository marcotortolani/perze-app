// E20 — sin esto, `fx_rates` queda vacía para siempre: nada más la
// escribe. Se llama una vez por día desde `pg_cron`+`pg_net`
// (`public.trigger_daily_fx_sync()`, ver `20260801160000_cron_engines.sql`),
// nunca directo desde el cliente — el cliente solo lee `fx_rates` (o pega
// contra `/api/fx` para un par puntual que todavía no está acá).
//
// Mismos proveedores que `src/lib/fx/providers/*.ts` en el cliente,
// portados a Deno: mismo alcance de monedas, misma fuente. Si un par no
// está cubierto por ninguno (ej. cripto contra UYU, que CoinGecko no
// cotiza como `vs_currency`), sigue sin cotización acá igual que en el
// cliente — este cron no agrega proveedores nuevos, solo automatiza los
// que ya existen del lado del cliente.
//
// Deploy: `supabase functions deploy daily-fx-sync`
// No necesita secrets propios — usa `SUPABASE_SERVICE_ROLE_KEY` que Supabase
// ya inyecta a toda Edge Function.
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Los 30 códigos reales de `GET /v1/currencies` — antes este set tenía
 * solo 14, un recorte que había quedado desalineado del `SUPPORTED` real
 * de `frankfurter.ts` (cliente), así que el cron nunca precargaba
 * `fx_rates` para 16 monedas que el cliente sí sabe cotizar en vivo.
 */
const FRANKFURTER_SUPPORTED = new Set([
  "AUD", "BRL", "CAD", "CHF", "CNY", "CZK", "DKK", "EUR", "GBP", "HKD",
  "HUF", "IDR", "ILS", "INR", "ISK", "JPY", "KRW", "MXN", "MYR", "NOK",
  "NZD", "PHP", "PLN", "RON", "SEK", "SGD", "THB", "TRY", "USD", "ZAR",
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

/** Igual a `dolarapi-uy.ts` del cliente. */
const UY_SUPPORTED_FOREIGN = new Set(["USD", "EUR", "ARS", "BRL", "GBP", "CHF", "PYG"]);

/** Igual a `coingecko.ts` del cliente. */
const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDT: "tether",
  USDC: "usd-coin",
  BNB: "binancecoin",
  SOL: "solana",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  DOT: "polkadot",
  LTC: "litecoin",
};
const COINGECKO_SUPPORTED_VS = new Set(["usd", "eur", "ars", "brl", "mxn", "clp", "gbp", "chf", "cny", "jpy"]);

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

async function fetchDolarApiUyRates(currencies: string[]): Promise<FxRateInsert[]> {
  const res = await fetch("https://uy.dolarapi.com/v1/cotizaciones");
  if (!res.ok) return [];
  const entries = (await res.json()) as Array<{ moneda: string; compra: number | null; venta: number | null; fechaActualizacion: string }>;
  const rows: FxRateInsert[] = [];

  for (const entry of entries) {
    if (!UY_SUPPORTED_FOREIGN.has(entry.moneda) || !currencies.includes(entry.moneda) || !entry.venta) continue;
    const asOf = entry.fechaActualizacion.slice(0, 10);
    // venta: cuánto cuesta comprar 1 unidad de `moneda` en UYU.
    rows.push({ base: entry.moneda, quote: "UYU", as_of: asOf, provider: "dolarapi-uy", quote_kind: "oficial", rate: entry.venta, bid: entry.compra ?? null, ask: entry.venta });
    rows.push({ base: "UYU", quote: entry.moneda, as_of: asOf, provider: "dolarapi-uy", quote_kind: "oficial", rate: 1 / entry.venta });
  }
  return rows;
}

async function fetchCoinGeckoRates(currencies: string[]): Promise<FxRateInsert[]> {
  const cryptoSymbols = Object.keys(SYMBOL_TO_COINGECKO_ID).filter((c) => currencies.includes(c));
  const fiatSymbols = currencies.filter((c) => COINGECKO_SUPPORTED_VS.has(c.toLowerCase()));
  if (cryptoSymbols.length === 0 || fiatSymbols.length === 0) return [];

  const ids = cryptoSymbols.map((s) => SYMBOL_TO_COINGECKO_ID[s]);
  const vsCurrencies = fiatSymbols.map((s) => s.toLowerCase());
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=${vsCurrencies.join(",")}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as Record<string, Record<string, number>>;
  const today = new Date().toISOString().slice(0, 10);
  const rows: FxRateInsert[] = [];

  for (const cryptoSymbol of cryptoSymbols) {
    const id = SYMBOL_TO_COINGECKO_ID[cryptoSymbol]!;
    for (const fiatSymbol of fiatSymbols) {
      const price = data[id]?.[fiatSymbol.toLowerCase()];
      if (price === undefined) continue;
      rows.push({ base: cryptoSymbol, quote: fiatSymbol, as_of: today, provider: "coingecko", quote_kind: "default", rate: price });
      rows.push({ base: fiatSymbol, quote: cryptoSymbol, as_of: today, provider: "coingecko", quote_kind: "default", rate: 1 / price });
    }
  }
  return rows;
}

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: currencies, error: currenciesError } = await supabase
    .from("currencies")
    .select("code")
    .eq("is_active", true);
  if (currenciesError) return new Response(JSON.stringify({ error: currenciesError.message }), { status: 500 });

  const codes = (currencies ?? []).map((c) => c.code as string);

  const [frankfurterRows, dolarApiRows, dolarApiUyRows, coinGeckoRows] = await Promise.all([
    fetchFrankfurterRates(codes),
    codes.includes("ARS") && codes.includes("USD") ? fetchDolarApiRates() : Promise.resolve([]),
    codes.includes("UYU") ? fetchDolarApiUyRates(codes) : Promise.resolve([]),
    fetchCoinGeckoRates(codes),
  ]);

  const rows = [...frankfurterRows, ...dolarApiRows, ...dolarApiUyRows, ...coinGeckoRows];
  if (rows.length === 0) {
    return new Response(JSON.stringify({ upserted: 0 }), { headers: { "Content-Type": "application/json" } });
  }

  const { error: upsertError } = await supabase
    .from("fx_rates")
    .upsert(rows, { onConflict: "base,quote,as_of,provider,quote_kind" });
  if (upsertError) return new Response(JSON.stringify({ error: upsertError.message }), { status: 500 });

  return new Response(JSON.stringify({ upserted: rows.length }), { headers: { "Content-Type": "application/json" } });
});
