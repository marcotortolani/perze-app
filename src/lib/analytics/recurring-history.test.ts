import { describe, expect, it } from "vitest";
import { amountSeries, detectPriceIncrease, RECURRING_HISTORY_MIN_POINTS, suggestedNextAmount } from "./recurring-history";

function tx(occurredAt: string, amount: bigint, deletedAt: string | null = null) {
  return { occurredAt, amount, deletedAt };
}

describe("amountSeries", () => {
  it("ordena por fecha y excluye soft-deleted", () => {
    const series = amountSeries([tx("2026-03-01T12:00:00Z", 300n), tx("2026-01-01T12:00:00Z", 100n), tx("2026-02-01T12:00:00Z", 200n, "2026-02-05T00:00:00Z")]);
    expect(series.map((p) => p.amount)).toEqual([100n, 300n]);
  });
});

describe("detectPriceIncrease", () => {
  it("null con menos del mínimo de puntos", () => {
    const series = amountSeries([tx("2026-01-01T12:00:00Z", 100n), tx("2026-02-01T12:00:00Z", 200n)]);
    expect(series.length).toBeLessThan(RECURRING_HISTORY_MIN_POINTS);
    expect(detectPriceIncrease(series, "monthly")).toBeNull();
  });

  it("detecta un aumento por encima del umbral, con impacto anual", () => {
    const series = amountSeries([tx("2026-01-01T12:00:00Z", 2400n), tx("2026-02-01T12:00:00Z", 2400n), tx("2026-03-01T12:00:00Z", 2400n), tx("2026-04-01T12:00:00Z", 3100n)]);
    const inc = detectPriceIncrease(series, "monthly");
    expect(inc).not.toBeNull();
    expect(inc!.from).toBe(2400n);
    expect(inc!.to).toBe(3100n);
    expect(inc!.annualImpact).toBe(700n * 12n);
  });

  it("null si el cambio no llega al umbral", () => {
    const series = amountSeries([tx("2026-01-01T12:00:00Z", 1000n), tx("2026-02-01T12:00:00Z", 1000n), tx("2026-03-01T12:00:00Z", 1030n)]);
    expect(detectPriceIncrease(series, "monthly")).toBeNull();
  });

  it("null si el monto bajó", () => {
    const series = amountSeries([tx("2026-01-01T12:00:00Z", 3100n), tx("2026-02-01T12:00:00Z", 3100n), tx("2026-03-01T12:00:00Z", 2400n)]);
    expect(detectPriceIncrease(series, "monthly")).toBeNull();
  });
});

describe("suggestedNextAmount", () => {
  it("null con menos del mínimo de puntos", () => {
    const series = amountSeries([tx("2026-01-01T12:00:00Z", 100n), tx("2026-02-01T12:00:00Z", 200n)]);
    expect(suggestedNextAmount(series)).toBeNull();
  });

  it("promedia los últimos 3 cargos, ignorando los más viejos", () => {
    const series = amountSeries([
      tx("2026-01-01T12:00:00Z", 900n), // fuera del promedio
      tx("2026-02-01T12:00:00Z", 1000n),
      tx("2026-03-01T12:00:00Z", 1100n),
      tx("2026-04-01T12:00:00Z", 1200n),
    ]);
    expect(suggestedNextAmount(series)).toBe((1000n + 1100n + 1200n) / 3n);
  });
});
