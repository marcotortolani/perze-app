import { describe, expect, it, beforeEach } from "vitest";
import { PRICE_CACHE_MAX_AGE_DAYS, prunePrices, useInstrumentPricesStore } from "./instrument-prices-store";

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

describe("prunePrices", () => {
  const NOW = new Date("2026-08-08T12:00:00Z").getTime();

  it("descarta una entrada más vieja que PRICE_CACHE_MAX_AGE_DAYS", () => {
    const oldAsOf = new Date(NOW - (PRICE_CACHE_MAX_AGE_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();
    const result = prunePrices({ "inst-old": { close: 100, currencyCode: "USD", asOf: oldAsOf, provider: "data912" } }, NOW);

    expect(result["inst-old"]).toBeUndefined();
  });

  it("conserva una entrada más reciente que PRICE_CACHE_MAX_AGE_DAYS", () => {
    const recentAsOf = new Date(NOW - (PRICE_CACHE_MAX_AGE_DAYS - 1) * 24 * 60 * 60 * 1000).toISOString();
    const result = prunePrices({ "inst-recent": { close: 100, currencyCode: "USD", asOf: recentAsOf, provider: "data912" } }, NOW);

    expect(result["inst-recent"]?.close).toBe(100);
  });

  it("descarta una entrada con `asOf` no parseable", () => {
    const result = prunePrices({ "inst-bad": { close: 100, currencyCode: "USD", asOf: "no-es-una-fecha", provider: "data912" } }, NOW);

    expect(result["inst-bad"]).toBeUndefined();
  });
});
