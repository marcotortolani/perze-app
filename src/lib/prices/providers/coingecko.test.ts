import { describe, expect, it, vi } from "vitest";
import { createCoinGeckoPriceProvider } from "./coingecko";

function fakeFetch(response: unknown): typeof fetch {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => response }) as unknown as typeof fetch;
}

describe("coingecko price provider", () => {
  it("devuelve el precio en USD por id de CoinGecko", async () => {
    const provider = createCoinGeckoPriceProvider(fakeFetch({ bitcoin: { usd: 64156 } }));
    const quote = await provider.fetchPrice("bitcoin");
    expect(quote?.close).toBe(64156);
  });

  it("null si el id no viene en la respuesta", async () => {
    const provider = createCoinGeckoPriceProvider(fakeFetch({}));
    const quote = await provider.fetchPrice("bitcoin");
    expect(quote).toBeNull();
  });
});
