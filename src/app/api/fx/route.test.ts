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
});
