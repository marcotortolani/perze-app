import { describe, expect, it, vi } from "vitest";
import { formatRate } from "../rate";
import { createCoinGeckoProvider } from "./coingecko";

function fakeFetch(response: unknown): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => response,
  }) as unknown as typeof fetch;
}

describe("coingecko provider", () => {
  it("mapea BTC -> USD directo", async () => {
    const provider = createCoinGeckoProvider(fakeFetch({ bitcoin: { usd: 64156 } }));
    const quotes = await provider.fetchQuotes("BTC", "USD");
    expect(quotes).toHaveLength(1);
    expect(formatRate(quotes[0]!.rate)).toBe("64156.000000000000");
  });

  it("invierte para USD -> BTC", async () => {
    const provider = createCoinGeckoProvider(fakeFetch({ bitcoin: { usd: 64156 } }));
    const quotes = await provider.fetchQuotes("USD", "BTC");
    // 1/64156 ≈ 0.0000155866...
    expect(formatRate(quotes[0]!.rate).startsWith("0.0000155")).toBe(true);
  });

  it("soporta cryptos conocidas contra fiat que CoinGecko cotiza", () => {
    const provider = createCoinGeckoProvider(fakeFetch({}));
    expect(provider.supports("BTC", "USD")).toBe(true);
    expect(provider.supports("ARS", "ETH")).toBe(true);
    expect(provider.supports("BTC", "UYU")).toBe(false);
    expect(provider.supports("USD", "ARS")).toBe(false);
  });

  it("sin symbol reconocido, no soporta el par", () => {
    const provider = createCoinGeckoProvider(fakeFetch({}));
    expect(provider.supports("XYZ", "USD")).toBe(false);
  });
});
