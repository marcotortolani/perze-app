import { describe, expect, it, vi } from "vitest";
import { formatRate } from "../rate";
import { createDolarApiUyProvider } from "./dolarapi-uy";

const FIXTURE = [
  { moneda: "USD", nombre: "Dólar", compra: 39.1, venta: 41.5, fechaActualizacion: "2026-08-06T13:01:14.553Z" },
  { moneda: "EUR", nombre: "Euro", compra: 44.27, venta: 49.14, fechaActualizacion: "2026-08-06T13:01:14.554Z" },
  { moneda: "UI", nombre: "Unidad Indexada", compra: null, venta: 6.6333, fechaActualizacion: "2026-08-06T13:01:14.555Z" },
];

function fakeFetch(): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => FIXTURE,
  }) as unknown as typeof fetch;
}

describe("dolarapi-uy provider", () => {
  it("mapea USD -> UYU directo con el valor de venta", async () => {
    const provider = createDolarApiUyProvider(fakeFetch());
    const quotes = await provider.fetchQuotes("USD", "UYU");
    expect(quotes).toHaveLength(1);
    expect(quotes[0]!.quoteKind).toBe("oficial");
    expect(formatRate(quotes[0]!.rate)).toBe("41.500000000000");
  });

  it("invierte para UYU -> USD", async () => {
    const provider = createDolarApiUyProvider(fakeFetch());
    const quotes = await provider.fetchQuotes("UYU", "USD");
    // 1/41.5 ≈ 0.024096...
    expect(formatRate(quotes[0]!.rate).startsWith("0.024096")).toBe(true);
  });

  it("solo soporta UYU contra las monedas que trae el endpoint", () => {
    const provider = createDolarApiUyProvider(fakeFetch());
    expect(provider.supports("USD", "UYU")).toBe(true);
    expect(provider.supports("UYU", "EUR")).toBe(true);
    expect(provider.supports("UYU", "XAU")).toBe(false);
    expect(provider.supports("USD", "ARS")).toBe(false);
  });

  it("sin cotización para una moneda que el endpoint no trae hoy", async () => {
    const provider = createDolarApiUyProvider(fakeFetch());
    const quotes = await provider.fetchQuotes("UYU", "BRL");
    expect(quotes).toHaveLength(0);
  });
});
