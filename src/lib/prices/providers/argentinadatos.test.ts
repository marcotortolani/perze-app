import { describe, expect, it, vi } from "vitest";
import { createArgentinaDatosFciProvider, searchArgentinaDatosFci } from "./argentinadatos";

const MERCADO_DINERO_ULTIMO = [{ fondo: "Alpha Pesos - Clase A", fecha: "2026-08-06", vcp: 100726.293 }];
const RENTA_FIJA_ULTIMO = [{ fondo: "Gestionar Renta Fija - Clase A", fecha: "2026-08-06", vcp: 1523.4 }];

function fakeFetch(): typeof fetch {
  return vi.fn((url: string) => {
    if (url.includes("/mercadoDinero/ultimo")) return Promise.resolve({ ok: true, json: async () => MERCADO_DINERO_ULTIMO } as Response);
    if (url.includes("/rentaFija/ultimo")) return Promise.resolve({ ok: true, json: async () => RENTA_FIJA_ULTIMO } as Response);
    return Promise.resolve({ ok: true, json: async () => [] } as Response);
  }) as unknown as typeof fetch;
}

describe("ArgentinaDatos FCI provider", () => {
  it("encuentra un fondo en la primera categoría", async () => {
    const provider = createArgentinaDatosFciProvider(fakeFetch());
    const quote = await provider.fetchPrice("Alpha Pesos - Clase A");
    expect(quote?.close).toBe(100726.293);
    expect(quote?.asOf).toBe("2026-08-06");
  });

  it("sigue buscando en la siguiente categoría si no está en la primera", async () => {
    const provider = createArgentinaDatosFciProvider(fakeFetch());
    const quote = await provider.fetchPrice("Gestionar Renta Fija - Clase A");
    expect(quote?.close).toBe(1523.4);
  });

  it("null si el fondo no está en ninguna categoría", async () => {
    const provider = createArgentinaDatosFciProvider(fakeFetch());
    const quote = await provider.fetchPrice("No existe");
    expect(quote).toBeNull();
  });
});

describe("searchArgentinaDatosFci", () => {
  function fakeFondosFetch(): typeof fetch {
    return vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        fechaActualizacion: "2026-08-07T00:00:00.000Z",
        fondos: [
          { nombre: "Alpha Pesos - Clase A", administradora: "Alpha Sociedad Gerente", moneda: "Peso Argentina" },
          { nombre: "Alpha Renta Dólares", administradora: "Alpha Sociedad Gerente", moneda: "Dolar Estadounidense" },
          { nombre: "Beta Ahorro", administradora: "Beta S.A.", moneda: "Peso Argentina" },
        ],
      }),
    }) as unknown as typeof fetch;
  }

  it("filtra por nombre, sin importar mayúsculas/minúsculas, y mapea moneda a ARS/USD", async () => {
    const results = await searchArgentinaDatosFci("alpha", fakeFondosFetch());
    expect(results).toEqual([
      { symbol: "Alpha Pesos - Clase A", name: "Alpha Pesos - Clase A", currencyCode: "ARS", administradora: "Alpha Sociedad Gerente" },
      { symbol: "Alpha Renta Dólares", name: "Alpha Renta Dólares", currencyCode: "USD", administradora: "Alpha Sociedad Gerente" },
    ]);
  });

  it("query de menos de 2 caracteres no llama a la API", async () => {
    const fetchImpl = vi.fn();
    const results = await searchArgentinaDatosFci("A", fetchImpl as unknown as typeof fetch);
    expect(results).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
