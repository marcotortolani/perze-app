import { describe, expect, it } from "vitest";
import type { Instrument } from "@/lib/repos/instruments-repo";
import { findExistingInstrument } from "./find-existing-instrument";

function instrument(overrides: Partial<Instrument> & Pick<Instrument, "id" | "symbol" | "priceProvider" | "currencyCode">): Instrument {
  return {
    name: overrides.symbol,
    householdId: null,
    assetClassId: null,
    quantityDecimals: null,
    maturityDate: null,
    couponRate: null,
    couponFrequency: null,
    amortizationSchedule: null,
    providerSymbol: null,
    ...overrides,
  };
}

describe("findExistingInstrument", () => {
  it("mismo símbolo y proveedor, moneda distinta — NO es el mismo instrumento (el bug de SPCX)", () => {
    const existing = [instrument({ id: "1", symbol: "SPCX", priceProvider: "data912", currencyCode: "ARS" })];
    const found = findExistingInstrument(existing, { symbol: "SPCX", priceProvider: "data912", currencyCode: "USD" });
    expect(found).toBeUndefined();
  });

  it("mismo símbolo, proveedor y moneda — sí es el mismo, se reusa", () => {
    const existing = [instrument({ id: "1", symbol: "SPCX", priceProvider: "data912", currencyCode: "ARS" })];
    const found = findExistingInstrument(existing, { symbol: "SPCX", priceProvider: "data912", currencyCode: "ARS" });
    expect(found?.id).toBe("1");
  });

  it("mismo símbolo, proveedor distinto — no es el mismo instrumento", () => {
    const existing = [instrument({ id: "1", symbol: "BTC", priceProvider: "coingecko", currencyCode: "USD" })];
    const found = findExistingInstrument(existing, { symbol: "BTC", priceProvider: "finnhub", currencyCode: "USD" });
    expect(found).toBeUndefined();
  });

  it("instrumento cargado a mano (priceProvider null) matchea contra otro cargado a mano igual", () => {
    const existing = [instrument({ id: "1", symbol: "FCI-X", priceProvider: null, currencyCode: "ARS" })];
    const found = findExistingInstrument(existing, { symbol: "FCI-X", priceProvider: null, currencyCode: "ARS" });
    expect(found?.id).toBe("1");
  });
});
