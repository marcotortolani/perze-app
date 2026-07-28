import { describe, expect, it, vi } from "vitest";
import { formatRate } from "../rate";
import { createDolarApiProvider } from "./dolarapi";

const FIXTURE = [
  { casa: "oficial", nombre: "Oficial", compra: 985, venta: 1005, fechaActualizacion: "2026-07-27T10:00:00.000Z" },
  { casa: "blue", nombre: "Blue", compra: 1180, venta: 1200, fechaActualizacion: "2026-07-27T10:00:00.000Z" },
  { casa: "cripto", nombre: "Cripto", compra: 1190, venta: 1210, fechaActualizacion: "2026-07-27T10:00:00.000Z" },
];

function fakeFetch(): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => FIXTURE,
  }) as unknown as typeof fetch;
}

describe("dolarapi provider", () => {
  it("mapea USD -> ARS directo con el valor de venta", async () => {
    const provider = createDolarApiProvider(fakeFetch());
    const quotes = await provider.fetchQuotes("USD", "ARS");
    const oficial = quotes.find((q) => q.quoteKind === "oficial");
    expect(oficial).toBeDefined();
    expect(formatRate(oficial!.rate)).toBe("1005.000000000000");
  });

  it("invierte para ARS -> USD", async () => {
    const provider = createDolarApiProvider(fakeFetch());
    const quotes = await provider.fetchQuotes("ARS", "USD");
    const oficial = quotes.find((q) => q.quoteKind === "oficial");
    expect(oficial).toBeDefined();
    // 1/1005 ≈ 0.000995024875...
    expect(formatRate(oficial!.rate).startsWith("0.000995")).toBe(true);
  });

  it("solo soporta el par USD/ARS", () => {
    const provider = createDolarApiProvider(fakeFetch());
    expect(provider.supports("USD", "ARS")).toBe(true);
    expect(provider.supports("ARS", "USD")).toBe(true);
    expect(provider.supports("USD", "UYU")).toBe(false);
  });
});
