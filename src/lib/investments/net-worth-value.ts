import { portfoliosRepo } from "@/lib/repos/portfolios-repo";
import { tradesRepo } from "@/lib/repos/trades-repo";
import { instrumentsRepo } from "@/lib/repos/instruments-repo";
import { priceSnapshotsRepo } from "@/lib/repos/price-snapshots-repo";
import { fxRepo } from "@/lib/repos/fx-repo";
import { computePositions } from "@/lib/analytics/positions";
import { fromMajorUnitsUnsafe } from "@/lib/money/money";
import { convert } from "@/lib/fx/rate";
import { todayIso } from "@/lib/repos/ids";

export interface InvestmentsValueResult {
  /** Suma del valor de mercado de todas las posiciones, en moneda base. */
  value: bigint;
  /** Posiciones sin precio conocido o sin cotización a la moneda base — nunca se cuentan como 0. */
  excludedCount: number;
}

/**
 * Suma el valor de mercado de TODAS las posiciones de TODOS los portfolios
 * del household, convertido a la moneda base — el otro lado del bug de
 * settlement: sin esto, comprar un instrumento bajaba el efectivo de la
 * cuenta (una vez resuelto ese bug) sin que el activo comprado apareciera
 * en ningún lado, así que el patrimonio neto quedaba peor que antes. No es
 * un hook — se pensó para usarse dentro de un único `useQuery` en
 * `useNetWorth`, no como N hooks por portfolio (rompería las reglas de
 * hooks con una lista de tamaño variable).
 */
export async function computeInvestmentsValue(householdId: string, baseCurrency: string): Promise<InvestmentsValueResult> {
  const [portfolios, instruments] = await Promise.all([portfoliosRepo.listForHousehold(householdId), instrumentsRepo.listForHousehold(householdId)]);
  const instrumentById = new Map(instruments.map((i) => [i.id, i]));
  const rateCache = new Map<string, bigint | null>();

  const resolveRate = async (currency: string): Promise<bigint | null> => {
    if (currency === baseCurrency) return null; // sin conversión, se usa el valor tal cual
    if (rateCache.has(currency)) return rateCache.get(currency)!;
    const resolution = await fxRepo.resolve({ householdId, base: currency, quote: baseCurrency, date: todayIso(), liveRecalc: true });
    rateCache.set(currency, resolution.rate);
    return resolution.rate;
  };

  let value = 0n;
  let excludedCount = 0;

  for (const portfolio of portfolios) {
    const trades = await tradesRepo.listForPortfolio(portfolio.id);
    const positions = computePositions(trades.map((tr) => ({ instrumentId: tr.instrumentId, kind: tr.kind, quantity: tr.quantity, netAmount: tr.netAmount })));
    const instrumentIds = [...positions.keys()];
    const prices = await priceSnapshotsRepo.latestFor(instrumentIds);

    for (const [instrumentId, position] of positions) {
      if (position.quantity <= 0) continue;
      const instrument = instrumentById.get(instrumentId);
      const price = prices.get(instrumentId);
      if (!instrument || !price) {
        excludedCount += 1;
        continue;
      }
      const marketValue = fromMajorUnitsUnsafe(position.quantity * price.close, instrument.currencyCode);
      if (instrument.currencyCode === baseCurrency) {
        value += marketValue;
        continue;
      }
      const rate = await resolveRate(instrument.currencyCode);
      if (rate === null) {
        excludedCount += 1;
        continue;
      }
      value += convert({ amount: marketValue, currency: instrument.currencyCode }, baseCurrency, rate).amount;
    }
  }

  return { value, excludedCount };
}
