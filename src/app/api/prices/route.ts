import { NextResponse } from "next/server";
import { z } from "zod";
import { createData912Provider } from "@/lib/prices/providers/data912";
import { createCoinGeckoPriceProvider } from "@/lib/prices/providers/coingecko";
import type { PriceProvider } from "@/lib/prices/providers/types";
import { createClient } from "@/lib/supabase/server";

/**
 * Única puerta de entrada a cotizaciones de instrumentos — el cliente
 * nunca llama a Data912/CoinGecko directo (mismo criterio que `/api/fx`).
 *
 * **No escribe** en `price_snapshots` con el precio real recién traído:
 * esta ruta corre con la sesión del usuario, y la policy de escritura de
 * `price_snapshots` solo permite `provider = 'manual'` — precargar
 * cotizaciones reales es trabajo del cron diario
 * (`daily-price-sync`/`trigger_daily_price_sync()`). Mientras tanto, esta
 * ruta vuelve a pedirle al proveedor en cada request sin persistir nada,
 * igual que `/api/fx` documenta para sí misma.
 */
const providers: Record<string, PriceProvider> = {
  data912: createData912Provider(),
  coingecko: createCoinGeckoPriceProvider(),
};

const querySchema = z.object({ instrumentId: z.uuid("INSTRUMENTO_INVALIDO") });

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

/** D10 — mismo criterio que `todayIso()` de `/api/fx/route.ts`: server-side, sin zona horaria de nadie. */
function serverTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface PriceSnapshotRow {
  as_of: string;
  provider: string;
  close: number;
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

  const parsed = querySchema.safeParse({ instrumentId: searchParams.get("instrumentId") ?? undefined });
  if (!parsed.success) {
    return NextResponse.json({ error: "PARAMS_INVALIDOS", issues: parsed.error.issues }, { status: 400, headers: NO_STORE_HEADERS });
  }
  const { instrumentId } = parsed.data;

  const { data: instrument, error: instrumentError } = await supabase
    .from("instruments")
    .select("id, price_provider, provider_symbol, currency_code")
    .eq("id", instrumentId)
    .maybeSingle<{ id: string; price_provider: string | null; provider_symbol: string | null; currency_code: string }>();
  if (instrumentError) {
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500, headers: NO_STORE_HEADERS });
  }
  if (!instrument) {
    return NextResponse.json({ error: "INSTRUMENTO_DESCONOCIDO" }, { status: 404, headers: NO_STORE_HEADERS });
  }

  const { data: latestRows } = await supabase
    .from("price_snapshots")
    .select("as_of, provider, close")
    .eq("instrument_id", instrumentId)
    .order("as_of", { ascending: false })
    .limit(5)
    .returns<PriceSnapshotRow[]>();

  const currencyCode = instrument.currency_code;
  const today = serverTodayIso();
  const freshestToday = (latestRows ?? []).find((r) => r.as_of === today);
  if (freshestToday) {
    return NextResponse.json({ close: freshestToday.close, provider: freshestToday.provider, asOf: freshestToday.as_of, currencyCode, isStale: false }, { headers: NO_STORE_HEADERS });
  }

  // Sin nada de hoy en cache: si el instrumento declara un proveedor real,
  // se lo pide en vivo (ver nota de arriba — no queda persistido acá).
  const provider = instrument.price_provider ? providers[instrument.price_provider] : undefined;
  if (provider && instrument.provider_symbol) {
    try {
      const quote = await provider.fetchPrice(instrument.provider_symbol);
      if (quote) {
        return NextResponse.json({ close: quote.close, provider: instrument.price_provider, asOf: quote.asOf, currencyCode, isStale: false }, { headers: NO_STORE_HEADERS });
      }
    } catch {
      // Proveedor caído — cae al último conocido de abajo, nunca bloquea.
    }
  }

  const mostRecent = (latestRows ?? [])[0];
  if (mostRecent) {
    return NextResponse.json({ close: mostRecent.close, provider: mostRecent.provider, asOf: mostRecent.as_of, currencyCode, isStale: true }, { headers: NO_STORE_HEADERS });
  }

  return NextResponse.json({ close: null, provider: null, asOf: null, currencyCode, isStale: false }, { headers: NO_STORE_HEADERS });
}
