import { describe, expect, it } from "vitest";
import { parseRate } from "../fx/rate";
import { SYNC_TABLES } from "./sync-config";

/**
 * A1 — los rates viajaban al outbox con `bigintToString` (el entero escalado
 * × 10^12 tal cual) en vez de `formatRate` (el decimal plano que espera
 * `numeric(24,12)`). Este test corre el `toRow` real de `transactions` — el
 * mismo código que drena el outbox — y verifica el round-trip completo
 * contra el payload tal como sale hacia Supabase.
 */
describe("sync-config — round-trip de rates (A1)", () => {
  const toRow = SYNC_TABLES.transactions!.toRow;

  it("fx_rate: round-trip parseRate(toRow(...).fx_rate) === rate original", () => {
    const rate = parseRate("1050.00"); // ARS/USD típico
    const row = toRow({ fxRate: rate });
    expect(row.fx_rate).toBe("1050.000000000000");
    expect(parseRate(row.fx_rate as string)).toBe(rate);
  });

  it("original_rate y counter_fx_rate siguen el mismo camino", () => {
    const originalRate = parseRate("0.00095238"); // 1/1050 truncado
    const counterFxRate = parseRate("3.333333333333");
    const row = toRow({ originalRate, counterFxRate });
    expect(parseRate(row.original_rate as string)).toBe(originalRate);
    expect(parseRate(row.counter_fx_rate as string)).toBe(counterFxRate);
  });

  it("null se mantiene null (needs_fx pendiente, nunca rate=1)", () => {
    const row = toRow({ fxRate: null, originalRate: null, counterFxRate: null });
    expect(row.fx_rate).toBeNull();
    expect(row.original_rate).toBeNull();
    expect(row.counter_fx_rate).toBeNull();
  });

  it("un rate grande no se infla 10^12 veces (regresión directa de A1)", () => {
    // Antes del fix, bigintToString(rate) mandaba el bigint escalado crudo:
    // un rate de 1050 llegaba como "1050000000000000" a una columna
    // numeric(24,12), leído como 1.050.000.000.000.000 — 10^12 más grande.
    const rate = parseRate("1050");
    const row = toRow({ fxRate: rate });
    const asNumeric = Number(row.fx_rate);
    expect(asNumeric).toBeCloseTo(1050, 6);
    expect(asNumeric).not.toBeCloseTo(1050e12, 6);
  });
});
