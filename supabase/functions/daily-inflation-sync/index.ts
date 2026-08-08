// H7 — sin esto, `price_index` queda vacía para siempre: nada más la
// escribe (Patrón C, sin policy de INSERT para `service_role` aparte). Se
// llama una vez por día desde `pg_cron`+`pg_net`
// (`public.trigger_daily_inflation_sync()`, ver la migración de cron de
// inflación), nunca directo desde el cliente — el cliente solo lee
// `price_index` (`priceIndexRepo.list()`).
//
// Fuente: ArgentinaDatos (BCRA), sin key. `/v1/finanzas/indices/inflacion`
// trae variación MENSUAL, no un nivel de índice — hay que componerla
// (mismo cálculo que `src/lib/inflation/build-index.ts`, portado a Deno
// como el resto de los proveedores de este directorio). La serie completa
// vuelve entera en cada corrida (~1000 meses, liviano) y se upsertea toda:
// a diferencia de un `fx_rate` ya resuelto (que se congela para siempre,
// CLAUDE.md), el IPC de un mes reciente a veces sale "provisorio" y se
// revisa un poco al mes siguiente — este cache SÍ tiene que poder
// actualizarse, es un índice macro compartido, no un valor ya aplicado a
// una transacción.
//
// Deploy: `supabase functions deploy daily-inflation-sync`
// Usa `SUPABASE_SERVICE_ROLE_KEY`, que Supabase ya inyecta a toda Edge
// Function. No necesita ningún secret propio (sin key).
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * La serie completa arranca en 1943 — componerla entera desborda
 * `numeric(24,12)` (`price_index.index_value`): la inflación acumulada de
 * Argentina desde 1943 es ~3,85×10¹⁸. No es un artefacto de la fuente (sin
 * salto espurio en el empalme de 1992, verificado contra la API en vivo),
 * es la magnitud real de ocho décadas de hiperinflaciones. Se ancla en
 * enero de 1992 (Plan de Convertibilidad, el peso que sigue circulando
 * hoy) — a esa fecha el índice llega a ~95.000 para 2026, con margen de
 * sobra. Mismo corte que `MIN_INFLATION_PERIOD` en
 * `src/lib/inflation/build-index.ts` (Deno no puede importar ese módulo,
 * así que queda duplicado con comentario cruzado, mismo criterio que
 * `data912.ts`/`daily-price-sync`).
 */
const MIN_PERIOD = "1992-01";

interface MonthlyChange {
  fecha: string; // "YYYY-MM-DD", último día del mes
  valor: number; // variación % mensual
}

interface PriceIndexInsert {
  id: string;
  currency_code: string;
  period: string; // "YYYY-MM-01"
  index_value: number;
  source: string;
}

/**
 * Mismo cálculo que `buildPriceIndexFromMonthlyChanges` — ver ese archivo
 * para el porqué de la base 100 y de no interpolar huecos. `existingIds`
 * reusa el id de una fila ya sincronizada (`period` → `id`); `price_index.id`
 * no tiene `DEFAULT` en el schema, así que hay que generarlo SIEMPRE, pero
 * reasignarlo de cero en cada corrida sería un churn de PK sin motivo para
 * un mes que solo cambió de valor (revisión del dato provisorio).
 */
function buildIndex(changes: MonthlyChange[], existingIds: Map<string, string>): PriceIndexInsert[] {
  const sorted = changes.filter((c) => c.fecha.slice(0, 7) >= MIN_PERIOD).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const rows: PriceIndexInsert[] = [];
  let level = 100;
  for (const [i, change] of sorted.entries()) {
    if (i > 0) level *= 1 + change.valor / 100;
    const period = `${change.fecha.slice(0, 7)}-01`;
    rows.push({ id: existingIds.get(period) ?? crypto.randomUUID(), currency_code: "ARS", period, index_value: level, source: "argentinadatos" });
  }
  return rows;
}

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const res = await fetch("https://api.argentinadatos.com/v1/finanzas/indices/inflacion");
  if (!res.ok) return new Response(JSON.stringify({ error: `argentinadatos respondió ${res.status}` }), { status: 502 });
  const changes = (await res.json()) as MonthlyChange[];

  const { data: existing, error: existingError } = await supabase.from("price_index").select("id, period").eq("currency_code", "ARS");
  if (existingError) return new Response(JSON.stringify({ error: existingError.message }), { status: 500 });
  const existingIds = new Map((existing ?? []).map((r: { id: string; period: string }) => [r.period, r.id]));

  const rows = buildIndex(changes, existingIds);
  if (rows.length === 0) {
    return new Response(JSON.stringify({ upserted: 0 }), { headers: { "Content-Type": "application/json" } });
  }

  const { error: upsertError } = await supabase.from("price_index").upsert(rows, { onConflict: "currency_code,period" });
  if (upsertError) return new Response(JSON.stringify({ error: upsertError.message }), { status: 500 });

  return new Response(JSON.stringify({ upserted: rows.length }), { headers: { "Content-Type": "application/json" } });
});
