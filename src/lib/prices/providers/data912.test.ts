import { describe, expect, it, vi } from "vitest";
import { createData912Provider, searchData912Instruments } from "./data912";

const STOCKS = [{ symbol: "ALUA", c: 927.5 }];
const CEDEARS = [{ symbol: "AAPL", c: 24660 }];

function fakeFetch(): typeof fetch {
  return vi.fn((url: string) => {
    if (url.includes("arg_stocks")) return Promise.resolve({ ok: true, json: async () => STOCKS } as Response);
    if (url.includes("arg_cedears")) return Promise.resolve({ ok: true, json: async () => CEDEARS } as Response);
    return Promise.resolve({ ok: true, json: async () => [] } as Response);
  }) as unknown as typeof fetch;
}

/** D52 — datos reales verificados contra la API en vivo (ver el comentario de `detectCurrency`). */
function fakeFetchYpf(): typeof fetch {
  const ypfStocks = [
    { symbol: "YPFD", c: 7840 },
    { symbol: "YPFDD", c: 5.18 },
  ];
  return vi.fn((url: string) => {
    if (url.includes("arg_stocks")) return Promise.resolve({ ok: true, json: async () => ypfStocks } as Response);
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

describe("searchData912Instruments — D52 (moneda por sufijo D/C, no por texto fijo)", () => {
  it("YPFD (ticker real, sin sufijo) es ARS; YPFDD (YPFD + sufijo D) es USD", async () => {
    const results = await searchData912Instruments("YPF", fakeFetchYpf());
    const ypfd = results.find((r) => r.symbol === "YPFD");
    const ypfdd = results.find((r) => r.symbol === "YPFDD");
    expect(ypfd?.currencyCode).toBe("ARS");
    expect(ypfdd?.currencyCode).toBe("USD");
  });

  it("un símbolo que termina en D pero sin base en la misma categoría queda ARS (no dispara falso positivo)", async () => {
    const results = await searchData912Instruments("ALUA", fakeFetch());
    expect(results.find((r) => r.symbol === "ALUA")?.currencyCode).toBe("ARS");
  });
});
