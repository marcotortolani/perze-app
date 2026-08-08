import { NextResponse } from "next/server";
import { z } from "zod";
import { searchData912Instruments } from "@/lib/prices/providers/data912";
import { searchFinnhubInstruments } from "@/lib/prices/providers/finnhub";
import { searchArgentinaDatosFci } from "@/lib/prices/providers/argentinadatos";
import { SYMBOL_TO_COINGECKO_ID } from "@/lib/prices/coingecko-symbols";
import { createClient } from "@/lib/supabase/server";

/**
 * I7 — buscador de instrumentos: antes la única forma de agregar uno era
 * "crear a mano" (I7b), que le pedía al usuario inventar el símbolo/nombre
 * de memoria. El cliente nunca llama a Data912/CoinGecko directo (mismo
 * criterio que `/api/fx`/`/api/prices`) — esta ruta es la única puerta.
 */
const querySchema = z.object({ q: z.string().min(2).max(20) });

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export interface InstrumentSearchResult {
  symbol: string;
  assetClass: string;
  currencyCode: string;
  priceProvider: string;
  providerSymbol: string;
  close: number | null;
  /** Nombre completo del instrumento — solo Finnhub lo trae; Data912 no tiene este dato en ninguna de sus 5 categorías. */
  name: string | null;
  /** Ticker base cuando este resultado es la variante dólar-cable/MEP de otro CEDEAR de la misma búsqueda (Data912, sufijo D/C) — nunca un instrumento distinto aunque el ticker coincida con uno real de otra bolsa. */
  variantOf: string | null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const parsed = querySchema.safeParse({ q: searchParams.get("q") ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ error: "PARAMS_INVALIDOS", issues: parsed.error.issues }, { status: 400, headers: NO_STORE_HEADERS });
  }
  const query = parsed.data.q.trim().toUpperCase();

  const [data912Results, cryptoMatches, finnhubResults, fciResults] = await Promise.all([
    searchData912Instruments(query).catch(() => []),
    Promise.resolve(Object.keys(SYMBOL_TO_COINGECKO_ID).filter((symbol) => symbol.includes(query))),
    // `searchFinnhubInstruments` ya devuelve `[]` sin `FINNHUB_API_KEY` —
    // el `.catch` es solo por si la API responde con error de verdad.
    searchFinnhubInstruments(query).catch(() => []),
    searchArgentinaDatosFci(query).catch(() => []),
  ]);

  const results: InstrumentSearchResult[] = [
    ...data912Results.map((r): InstrumentSearchResult => ({ symbol: r.symbol, assetClass: r.assetClass, currencyCode: r.currencyCode, priceProvider: "data912", providerSymbol: r.symbol, close: r.close, name: null, variantOf: r.variantOf })),
    ...cryptoMatches.map((symbol): InstrumentSearchResult => ({ symbol, assetClass: "Crypto", currencyCode: "USD", priceProvider: "coingecko", providerSymbol: SYMBOL_TO_COINGECKO_ID[symbol]!, close: null, name: null, variantOf: null })),
    // I10 — acciones/ETFs de EE.UU. (NYSE/NASDAQ), siempre en USD: Finnhub
    // no cotiza acá (su `/search` no trae precio), así que `close` queda
    // `null` como el resto de los proveedores que tampoco lo traen.
    ...finnhubResults.map((r): InstrumentSearchResult => ({ symbol: r.symbol, assetClass: r.assetClass, currencyCode: "USD", priceProvider: "finnhub", providerSymbol: r.symbol, close: null, name: r.name, variantOf: null })),
    // I10 — FCI (ArgentinaDatos/CAFCI): el nombre del fondo ES el símbolo,
    // no hay ticker. `close` queda `null` como Finnhub — el catálogo
    // (`/fondos`) no trae el VCP de hoy, solo metadata; el precio en vivo
    // sale de `fetchPrice` (categoría `/ultimo`), igual que el resto.
    ...fciResults.map((r): InstrumentSearchResult => ({ symbol: r.symbol, assetClass: "FCI", currencyCode: r.currencyCode, priceProvider: "argentinadatos-fci", providerSymbol: r.symbol, close: null, name: r.name, variantOf: null })),
  ];

  return NextResponse.json({ results }, { headers: NO_STORE_HEADERS });
}
