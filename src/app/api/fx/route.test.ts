import { describe, expect, it, vi } from "vitest";

/**
 * B5 — el route handler necesita un cliente de Supabase completo
 * (auth.getUser() + tres tablas encadenadas distintas); este mock modela
 * lo mínimo que `GET` toca: cada `.from(table)` devuelve un builder
 * encadenable (todo método vuelve `this`) que resuelve al `result`
 * configurado para esa tabla al ser awaited (`.then`), como hace
 * PostgREST-js de verdad.
 */
function makeSupabaseMock(opts: { user: { id: string } | null; tableResults?: Record<string, { data: unknown; error: unknown }> }) {
  const tableResults = opts.tableResults ?? {};

  function builderFor(table: string) {
    const result = tableResults[table] ?? { data: [], error: null };
    const builder: Record<string, unknown> = {
      select: () => builder,
      in: () => builder,
      eq: () => builder,
      lte: () => builder,
      or: () => builder,
      order: () => builder,
      limit: () => builder,
      returns: () => builder,
      maybeSingle: async () => result,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
    };
    return builder;
  }

  return {
    auth: { getUser: async () => ({ data: { user: opts.user } }) },
    from: (table: string) => builderFor(table),
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/fx/providers/dolarapi", () => ({ createDolarApiProvider: () => ({ id: "dolarapi", supports: () => false, fetchQuotes: async () => [] }) }));
vi.mock("@/lib/fx/providers/frankfurter", () => ({ createFrankfurterProvider: () => ({ id: "frankfurter", supports: () => false, fetchQuotes: async () => [] }) }));
vi.mock("@/lib/fx/providers/dolarapi-uy", () => ({ createDolarApiUyProvider: () => ({ id: "dolarapi-uy", supports: () => false, fetchQuotes: async () => [] }) }));

// Sin mockear, `fetchAllQuotes` llama al provider real de CoinGecko con
// `fetch` real — nada en este archivo lo necesitaba porque BTC/USD es el
// primer par de estos tests que un provider real llega a "soportar"
// (USD/ARS no matchea ninguno de los mocks de arriba). `coingeckoFetchQuotes`
// es un mock configurable por test: por default resuelve un precio, y los
// tests de la causa 2.4 (BTC sin cotizar) lo hacen fallar para probar que
// el fallo YA NO se traga en silencio sin dejar rastro en los logs.
const coingeckoFetchQuotes = vi.fn(async () => [
  // `asOf` dinámico, igual que el provider real (spot price, "hoy" es la
  // única fecha honesta) — un valor fijo desalinea con `todayIso()` del
  // route handler y el resultado cae a `inherited` en vez de `api`.
  { base: "BTC", quote: "USD", quoteKind: "default", rate: 63727n * 1_000_000_000_000n, asOf: new Date().toISOString().slice(0, 10) },
]);
vi.mock("@/lib/fx/providers/coingecko", () => ({
  createCoinGeckoProvider: () => ({
    id: "coingecko",
    supports: (base: string, quote: string) => (base === "BTC" && quote === "USD") || (base === "USD" && quote === "BTC"),
    fetchQuotes: coingeckoFetchQuotes,
  }),
}));

describe("GET /api/fx (B5)", () => {
  it("401 sin sesión", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock({ user: null }) as never);
    const { GET } = await import("./route");

    const res = await GET(new Request("http://localhost/api/fx?base=USD&quote=ARS"));

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: "UNAUTHENTICATED" });
  });

  it("400 con fecha malformada (el vector de inyección original)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(makeSupabaseMock({ user: { id: "u1" } }) as never);
    const { GET } = await import("./route");

    const res = await GET(new Request("http://localhost/api/fx?base=USD&quote=ARS&date=2026-01-01,rate.gte.0"));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("PARAMS_INVALIDOS");
  });

  it("400 con una moneda que no existe en el catálogo", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock({
        user: { id: "u1" },
        tableResults: { currencies: { data: [{ code: "USD" }], error: null } }, // "ZZZ" no vuelve
      }) as never
    );
    const { GET } = await import("./route");

    const res = await GET(new Request("http://localhost/api/fx?base=USD&quote=ZZZ"));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("MONEDA_DESCONOCIDA");
  });

  it("200 con sesión, params válidos y monedas conocidas", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock({
        user: { id: "u1" },
        tableResults: {
          currencies: { data: [{ code: "USD" }, { code: "ARS" }], error: null },
          fx_rates: { data: [], error: null },
        },
      }) as never
    );
    const { GET } = await import("./route");

    const res = await GET(new Request("http://localhost/api/fx?base=USD&quote=ARS&date=2026-07-27"));

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  // Punto 6 del reporte de bugs: una cuenta en BTC no entraba al
  // patrimonio neto. El diagnóstico contra el remoto descartó las dos
  // causas más probables — BTC ya está en `currencies` (activa) y la
  // moneda base real del household afectado (USD) SÍ está en
  // `SUPPORTED_VS` de CoinGecko — así que el problema no es de
  // configuración: es que el fetch en vivo nunca tuvo éxito y se
  // descartaba sin dejar rastro (0 filas en `fx_rates` para BTC/USD en
  // el remoto, siempre). Estos dos tests cubren ambos lados de ese fix.
  describe("BTC/USD — cripto vía CoinGecko", () => {
    it("200 con cotización resuelta cuando el proveedor responde bien", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      vi.mocked(createClient).mockResolvedValue(
        makeSupabaseMock({
          user: { id: "u1" },
          tableResults: {
            currencies: { data: [{ code: "BTC" }, { code: "USD" }], error: null },
            fx_rates: { data: [], error: null },
          },
        }) as never
      );
      const { GET } = await import("./route");

      const res = await GET(new Request("http://localhost/api/fx?base=BTC&quote=USD"));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.source).toBe("api");
      expect(body.provider).toBe("coingecko");
      expect(body.rate).not.toBeNull();
    });

    it("un proveedor que falla no rompe la ruta — resuelve pending y lo deja en los logs, nunca en silencio", async () => {
      coingeckoFetchQuotes.mockRejectedValueOnce(new Error("coingecko respondió 429"));
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        const { createClient } = await import("@/lib/supabase/server");
        vi.mocked(createClient).mockResolvedValue(
          makeSupabaseMock({
            user: { id: "u1" },
            tableResults: {
              currencies: { data: [{ code: "BTC" }, { code: "USD" }], error: null },
              fx_rates: { data: [], error: null },
            },
          }) as never
        );
        const { GET } = await import("./route");

        const res = await GET(new Request("http://localhost/api/fx?base=BTC&quote=USD"));
        const body = await res.json();

        // Nunca rate=1 inventado, nunca un 500 que le rompa el guardado al
        // caller — se sigue guardando, solo que needs_fx.
        expect(res.status).toBe(200);
        expect(body.rate).toBeNull();
        expect(body.source).toBe("pending");
        // El fix: antes esto se descartaba sin ningún log.
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("coingecko"), expect.anything());
      } finally {
        warn.mockRestore();
      }
    });
  });
});
