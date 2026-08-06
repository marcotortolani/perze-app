import { describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({ env: { FINNHUB_API_KEY: "test-key" } }));

function fakeFetch(response: unknown): typeof fetch {
  return vi.fn().mockResolvedValue({ ok: true, json: async () => response }) as unknown as typeof fetch;
}

describe("finnhub price provider", () => {
  it("devuelve el precio de cierre por ticker", async () => {
    const { createFinnhubProvider } = await import("./finnhub");
    const provider = createFinnhubProvider(fakeFetch({ c: 246.6, h: 250, l: 244, o: 245, pc: 244.8, t: 1735689600 }));
    const quote = await provider.fetchPrice("AAPL");
    expect(quote?.close).toBe(246.6);
  });

  it("null si el ticker no existe (t === 0, la señal real de Finnhub, no c === 0)", async () => {
    const { createFinnhubProvider } = await import("./finnhub");
    const provider = createFinnhubProvider(fakeFetch({ c: 0, h: 0, l: 0, o: 0, pc: 0, t: 0 }));
    const quote = await provider.fetchPrice("NOPE");
    expect(quote).toBeNull();
  });
});

describe("searchFinnhubInstruments", () => {
  it("mapea Common Stock y ETF a Acciones/ETFs, filtrando el resto", async () => {
    const { searchFinnhubInstruments } = await import("./finnhub");
    const fetchImpl = fakeFetch({
      result: [
        { symbol: "AAPL", description: "Apple Inc", type: "Common Stock" },
        { symbol: "SPY", description: "SPDR S&P 500 ETF", type: "ETF" },
        { symbol: "AAPL-USD", description: "Apple ADR fund", type: "Mutual Fund" },
      ],
    });
    const results = await searchFinnhubInstruments("AAPL", fetchImpl);
    expect(results).toEqual([
      { symbol: "AAPL", name: "Apple Inc", assetClass: "Acciones" },
      { symbol: "SPY", name: "SPDR S&P 500 ETF", assetClass: "ETFs" },
    ]);
  });

  it("descarta tickers con sufijo de otra bolsa (fuera de NYSE/NASDAQ)", async () => {
    const { searchFinnhubInstruments } = await import("./finnhub");
    const fetchImpl = fakeFetch({ result: [{ symbol: "AAPL.MX", description: "Apple Inc (Mexico)", type: "Common Stock" }] });
    const results = await searchFinnhubInstruments("AAPL", fetchImpl);
    expect(results).toEqual([]);
  });

  it("query de menos de 2 caracteres no llama a la API", async () => {
    const { searchFinnhubInstruments } = await import("./finnhub");
    const fetchImpl = vi.fn();
    const results = await searchFinnhubInstruments("A", fetchImpl as unknown as typeof fetch);
    expect(results).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("sin FINNHUB_API_KEY", () => {
  it("fetchPrice y la búsqueda devuelven vacío/null en vez de romper", async () => {
    vi.resetModules();
    vi.doMock("@/env", () => ({ env: {} }));
    const { createFinnhubProvider, searchFinnhubInstruments } = await import("./finnhub");
    const fetchImpl = vi.fn();

    const quote = await createFinnhubProvider(fetchImpl as unknown as typeof fetch).fetchPrice("AAPL");
    const results = await searchFinnhubInstruments("AAPL", fetchImpl as unknown as typeof fetch);

    expect(quote).toBeNull();
    expect(results).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();

    vi.doUnmock("@/env");
    vi.resetModules();
  });
});
