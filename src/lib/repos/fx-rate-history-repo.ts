import { createClient } from "../supabase/client";
import { parseRate, type ScaledRate } from "../fx/rate";

export interface FxMonthlyAverage {
  base: string;
  quote: string;
  /** 'YYYY-MM'. */
  yearMonth: string;
  avgRate: ScaledRate;
  sampleCount: number;
}

/**
 * `fx_rate_monthly_averages` — Patrón C puro (dato de mercado, no de
 * household), igual que `price_snapshots`: lectura para todo autenticado,
 * la escribe solo el cron mensual (`compute_fx_monthly_averages()`,
 * `supabase/migrations/20260802050000_fx_monthly_averages.sql`). Pensado
 * para métricas/gráficos de tendencia a lo largo del tiempo — nada en la
 * app todavía consume esto, es la base para esa próxima pantalla.
 */
export const fxRateHistoryRepo = {
  /** Más reciente primero. `limit` en meses, no en filas — un mes es una fila por definición. */
  async monthlyAverages(base: string, quote: string, months = 24): Promise<FxMonthlyAverage[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("fx_rate_monthly_averages")
      .select("base, quote, year_month, avg_rate::text, sample_count")
      .eq("base", base)
      .eq("quote", quote)
      .order("year_month", { ascending: false })
      .limit(months)
      .returns<Array<{ base: string; quote: string; year_month: string; avg_rate: string; sample_count: number }>>();
    if (error) throw error;
    return (data ?? []).map((r) => ({ base: r.base, quote: r.quote, yearMonth: r.year_month, avgRate: parseRate(r.avg_rate), sampleCount: r.sample_count }));
  },
};
