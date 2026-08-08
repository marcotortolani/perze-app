import { portfoliosRepo } from "@/lib/repos/portfolios-repo";
import { tradesRepo } from "@/lib/repos/trades-repo";
import { instrumentsRepo } from "@/lib/repos/instruments-repo";
import { priceSnapshotsRepo } from "@/lib/repos/price-snapshots-repo";
import { fxRepo } from "@/lib/repos/fx-repo";
import { computePositions } from "@/lib/analytics/positions";
import { convert } from "@/lib/fx/rate";
import { todayIso } from "@/lib/repos/ids";
import { computeDayValue, type TrendPosition } from "./investments-trend-math";

export interface InvestmentsTrend {
  /** Un valor por día, cronológico, en moneda base. El último es el valor de hoy. */
  values: bigint[];
  /** `true` si hay al menos una posición con cantidad > 0 en algún portfolio del household. */
  hasPositions: boolean;
  excludedCount: number;
}

function dateIsoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Serie de valor de las posiciones ACTUALES (cantidad de hoy) a lo largo de
 * los últimos `days` días, usando el historial real de `price_snapshots`
 * (el cron diario que ya corre, sin nada nuevo que sincronizar). Dos
 * simplificaciones documentadas, no datos inventados:
 *
 * 1. La cantidad se mantiene fija en la de HOY para toda la ventana — un
 *    trade nuevo esta semana no "reescribe" el pasado. Es "cómo se movió
 *    el precio de lo que tenés ahora", no un histórico de patrimonio
 *    exacto (para eso haría falta `portfolio_snapshots`, hoy sin cron que
 *    la llene).
 * 2. La conversión a moneda base usa la cotización de HOY para toda la
 *    ventana, no una cotización histórica por día (que exigiría resolver
 *    `fx_rates` día por día, otro orden de magnitud de llamadas). El
 *    gráfico muestra movimiento de PRECIO, no de tipo de cambio.
 *
 * El cálculo puro (carry-forward de precio, suma por día) vive en
 * `investments-trend-math.ts`, sin imports de repos — así sus tests no
 * necesitan las env vars de Supabase, mismo criterio que separa `lib/` de
 * `lib/repos/` en el resto del proyecto.
 */
export async function computeInvestmentsTrend(householdId: string, baseCurrency: string, days = 14): Promise<InvestmentsTrend> {
  const [portfolios, instruments] = await Promise.all([portfoliosRepo.listForHousehold(householdId), instrumentsRepo.listForHousehold(householdId)]);
  const instrumentById = new Map(instruments.map((i) => [i.id, i]));

  const positionsByInstrument = new Map<string, number>();
  for (const portfolio of portfolios) {
    const trades = await tradesRepo.listForPortfolio(portfolio.id);
    const positions = computePositions(trades.map((tr) => ({ instrumentId: tr.instrumentId, kind: tr.kind, quantity: tr.quantity, netAmount: tr.netAmount })));
    for (const [instrumentId, position] of positions) {
      if (position.quantity <= 0) continue;
      positionsByInstrument.set(instrumentId, (positionsByInstrument.get(instrumentId) ?? 0) + position.quantity);
    }
  }

  if (positionsByInstrument.size === 0) {
    return { values: Array.from({ length: days }, () => 0n), hasPositions: false, excludedCount: 0 };
  }

  const trendPositions: TrendPosition[] = [...positionsByInstrument.entries()]
    .map(([instrumentId, quantity]) => {
      const instrument = instrumentById.get(instrumentId);
      return instrument ? { instrumentId, quantity, currencyCode: instrument.currencyCode } : null;
    })
    .filter((p): p is TrendPosition => p !== null);

  const instrumentIds = trendPositions.map((p) => p.instrumentId);
  // Un buffer de 7 días antes del arranque de la ventana para que el
  // primer día tenga de dónde hacer carry-forward (fin de semana/feriado
  // sin snapshot nuevo justo el primer día pedido).
  const [history, rates] = await Promise.all([
    priceSnapshotsRepo.historyFor(instrumentIds, dateIsoDaysAgo(days + 7)),
    Promise.all(
      [...new Set(trendPositions.map((p) => p.currencyCode))]
        .filter((c) => c !== baseCurrency)
        .map(async (currency) => [currency, (await fxRepo.resolve({ householdId, base: currency, quote: baseCurrency, date: todayIso() })).rate] as const)
    ),
  ]);
  const rateByCurrency = new Map(rates);
  const convertToBase = (amount: bigint, currency: string): bigint | null => {
    const rate = rateByCurrency.get(currency);
    if (!rate) return null;
    return convert({ amount, currency }, baseCurrency, rate).amount;
  };

  const values: bigint[] = [];
  let excludedCount = 0;
  for (let i = days - 1; i >= 0; i--) {
    const date = dateIsoDaysAgo(i);
    const dayResult = computeDayValue(trendPositions, history, date, baseCurrency, convertToBase);
    values.push(dayResult.value);
    if (i === 0) excludedCount = dayResult.excludedCount; // solo el conteo de HOY importa para el aviso
  }

  return { values, hasPositions: true, excludedCount };
}
