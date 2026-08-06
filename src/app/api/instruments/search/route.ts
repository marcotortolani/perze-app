import { NextResponse } from "next/server";
import { z } from "zod";
import { searchData912Instruments } from "@/lib/prices/providers/data912";
import { searchFinnhubInstruments } from "@/lib/prices/providers/finnhub";
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

  const [data912Results, cryptoMatches, finnhubResults] = await Promise.all([
    searchData912Instruments(query).catch(() => []),
    Promise.resolve(Object.keys(SYMBOL_TO_COINGECKO_ID).filter((symbol) => symbol.includes(query))),
    // `searchFinnhubInstruments` ya devuelve `[]` sin `FINNHUB_API_KEY` —
    // el `.catch` es solo por si la API responde con error de verdad.
    searchFinnhubInstruments(query).catch(() => []),
  ]);

  const results: InstrumentSearchResult[] = [
    ...data912Results.map((r): InstrumentSearchResult => ({ symbol: r.symbol, assetClass: r.assetClass, currencyCode: r.currencyCode, priceProvider: "data912", providerSymbol: r.symbol, close: r.close })),
    ...cryptoMatches.map((symbol): InstrumentSearchResult => ({ symbol, assetClass: "Crypto", currencyCode: "USD", priceProvider: "coingecko", providerSymbol: SYMBOL_TO_COINGECKO_ID[symbol]!, close: null })),
    // I10 — acciones/ETFs de EE.UU. (NYSE/NASDAQ), siempre en USD: Finnhub
    // no cotiza acá (su `/search` no trae precio), así que `close` queda
    // `null` como el resto de los proveedores que tampoco lo traen.
    ...finnhubResults.map((r): InstrumentSearchResult => ({ symbol: r.symbol, assetClass: r.assetClass, currencyCode: "USD", priceProvider: "finnhub", providerSymbol: r.symbol, close: null })),
  ];

  return NextResponse.json({ results }, { headers: NO_STORE_HEADERS });
}
