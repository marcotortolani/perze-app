import { describe, expect, it, vi } from "vitest";
import { formatRate } from "../rate";
import { createFrankfurterProvider } from "./frankfurter";

function fakeFetch(rates: Record<string, number>): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ amount: 1, base: "EUR", date: "2026-07-27", rates }),
  }) as unknown as typeof fetch;
}

describe("frankfurter provider", () => {
  it("mapea el rate del par pedido", async () => {
    const provider = createFrankfurterProvider(fakeFetch({ USD: 1.08 }));
    const quotes = await provider.fetchQuotes("EUR", "USD");
    expect(formatRate(quotes[0]!.rate)).toBe("1.080000000000");
  });

  it("solo soporta pares dentro del set de monedas del BCE", () => {
    const provider = createFrankfurterProvider(fakeFetch({}));
    expect(provider.supports("EUR", "USD")).toBe(true);
    expect(provider.supports("EUR", "ARS")).toBe(false);
  });

  /**
   * B5 — `encodeURIComponent` explícito en la URL: este provider no debe
   * confiar en que el caller ya filtró `base`/`quote` con `supports()`.
   * Se llama `fetchQuotes` directo (sin pasar por `supports()`) con un
   * valor que necesitaría escape para probar que la URL no se arma con
   * interpolación cruda.
   */
  it("escapa base/quote en la URL en vez de interpolarlos crudos", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ amount: 1, base: "EUR", date: "2026-07-27", rates: {} }) });
    const provider = createFrankfurterProvider(fetchImpl as unknown as typeof fetch);

    await provider.fetchQuotes("EUR&x=1", "USD");

    const calledUrl = fetchImpl.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain(encodeURIComponent("EUR&x=1"));
    expect(calledUrl).not.toContain("base=EUR&x=1"); // el `&` crudo partiría la query string
  });
});
