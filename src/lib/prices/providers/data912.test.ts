import { describe, expect, it, vi } from "vitest";
import { createData912Provider } from "./data912";

const STOCKS = [{ symbol: "ALUA", c: 927.5 }];
const CEDEARS = [{ symbol: "AAPL", c: 24660 }];

function fakeFetch(): typeof fetch {
  return vi.fn((url: string) => {
    if (url.includes("arg_stocks")) return Promise.resolve({ ok: true, json: async () => STOCKS } as Response);
    if (url.includes("arg_cedears")) return Promise.resolve({ ok: true, json: async () => CEDEARS } as Response);
    return Promise.resolve({ ok: true, json: async () => [] } as Response);
  }) as unknown as typeof fetch;
}

describe("data912 provider", () => {
  it("encuentra un símbolo en arg_stocks", async () => {
    const provider = createData912Provider(fakeFetch());
    const quote = await provider.fetchPrice("ALUA");
    expect(quote?.close).toBe(927.5);
  });

  it("sigue buscando en la siguiente categoría si no está en la primera", async () => {
    const provider = createData912Provider(fakeFetch());
    const quote = await provider.fetchPrice("AAPL");
    expect(quote?.close).toBe(24660);
  });

  it("null si el símbolo no está en ninguna categoría", async () => {
    const provider = createData912Provider(fakeFetch());
    const quote = await provider.fetchPrice("NOEXISTE");
    expect(quote).toBeNull();
  });
});
