/** I11 — calendario de renta futura: próximos cupones y amortizaciones proyectadas de posiciones de renta fija. */

export interface FixedIncomePosition {
  instrumentId: string;
  symbol: string;
  quantity: number; // valor nominal en cartera
  currencyCode: string;
  maturityDate: string | null;
  couponRate: number | null; // % anual
  couponFrequency: number | null; // pagos/año
}

export interface FutureIncomeEvent {
  instrumentId: string;
  symbol: string;
  date: string; // ISO date
  kind: "coupon" | "amortization" | "maturity";
  amount: bigint; // en unidades mínimas de currencyCode, sobre el nominal en cartera
  currencyCode: string;
}

/**
 * Cupones periódicos entre `now` y `maturityDate` (o `now + monthsAhead` si
 * no hay vencimiento), más el pago de capital en el vencimiento. Cupón
 * estimado sobre el nominal en cartera — no es una proyección de precio,
 * es la renta contractual del instrumento.
 */
export function computeFutureIncome(positions: readonly FixedIncomePosition[], now: Date, monthsAhead: number): FutureIncomeEvent[] {
  const horizon = new Date(now.getFullYear(), now.getMonth() + monthsAhead, now.getDate());
  const events: FutureIncomeEvent[] = [];

  for (const position of positions) {
    if (!position.couponRate || !position.couponFrequency || position.couponFrequency <= 0) continue;
    const monthsBetweenCoupons = 12 / position.couponFrequency;
    const maturity = position.maturityDate ? new Date(position.maturityDate) : null;
    const couponAmountPerPayment = BigInt(Math.round((position.quantity * position.couponRate) / 100 / position.couponFrequency));

    let cursor = new Date(now);
    for (let i = 0; i < 60; i++) {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + monthsBetweenCoupons, cursor.getDate());
      if (cursor > horizon) break;
      if (maturity && cursor > maturity) break;
      events.push({ instrumentId: position.instrumentId, symbol: position.symbol, date: cursor.toISOString().slice(0, 10), kind: "coupon", amount: couponAmountPerPayment, currencyCode: position.currencyCode });
    }

    if (maturity && maturity >= now && maturity <= horizon) {
      events.push({ instrumentId: position.instrumentId, symbol: position.symbol, date: maturity.toISOString().slice(0, 10), kind: "maturity", amount: BigInt(Math.round(position.quantity)), currencyCode: position.currencyCode });
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}
