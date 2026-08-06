import { describe, expect, it, beforeEach } from "vitest";
import { useInstrumentPricesStore } from "./instrument-prices-store";

describe("instrument-prices-store", () => {
  beforeEach(() => {
    useInstrumentPricesStore.setState({ prices: {} });
  });

  it("D36 — setPrices agrega sin pisar lo que ya había de otros instrumentos", () => {
    useInstrumentPricesStore.getState().setPrices({ "inst-1": { close: 100, currencyCode: "USD", asOf: "2026-08-06", provider: "data912" } });
    useInstrumentPricesStore.getState().setPrices({ "inst-2": { close: 200, currencyCode: "ARS", asOf: "2026-08-06", provider: "data912" } });

    expect(useInstrumentPricesStore.getState().prices["inst-1"]?.close).toBe(100);
    expect(useInstrumentPricesStore.getState().prices["inst-2"]?.close).toBe(200);
  });

  it("un instrumento repetido se pisa con el valor más nuevo", () => {
    useInstrumentPricesStore.getState().setPrices({ "inst-1": { close: 100, currencyCode: "USD", asOf: "2026-08-05", provider: "data912" } });
    useInstrumentPricesStore.getState().setPrices({ "inst-1": { close: 150, currencyCode: "USD", asOf: "2026-08-06", provider: "data912" } });

    expect(useInstrumentPricesStore.getState().prices["inst-1"]?.close).toBe(150);
  });
});
