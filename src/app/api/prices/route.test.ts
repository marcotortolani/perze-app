import { describe, expect, it, vi } from "vitest";

/**
 * D45 — mismo patrón de mock que `/api/fx/route.test.ts`: cada `.from(table)`
 * devuelve un builder encadenable que resuelve al resultado configurado.
 */
function makeSupabaseMock(opts: { user: { id: string } | null; tableResults?: Record<string, { data: unknown; error: unknown }> }) {
  const tableResults = opts.tableResults ?? {};

  function builderFor(table: string) {
    const result = tableResults[table] ?? { data: [], error: null };
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
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

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const fetchPriceMock = vi.fn();
vi.mock("@/lib/prices/providers/data912", () => ({ createData912Provider: () => ({ id: "data912", fetchPrice: fetchPriceMock }) }));
vi.mock("@/lib/prices/providers/coingecko", () => ({ createCoinGeckoPriceProvider: () => ({ id: "coingecko", fetchPrice: async () => null }) }));

const INSTRUMENT_ID = "11111111-1111-4111-8111-111111111111";

describe("GET /api/prices (D45)", () => {
  it("un snapshot 'manual' de hoy NO tapa la cotización real de un instrumento con proveedor", async () => {
    fetchPriceMock.mockResolvedValue({ close: 33560, asOf: "2026-08-06" });
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock({
        user: { id: "u1" },
        tableResults: {
          instruments: { data: { id: INSTRUMENT_ID, price_provider: "data912", provider_symbol: "TSLAm", currency_code: "ARS" }, error: null },
          price_snapshots: { data: [{ as_of: "2026-08-06", provider: "manual", close: 150 }], error: null },
        },
      }) as never
    );
    const { GET } = await import("./route");

    const res = await GET(new Request(`http://localhost/api/prices?instrumentId=${INSTRUMENT_ID}`));

    expect(await res.json()).toMatchObject({ close: 33560, provider: "data912", isStale: false });
    expect(fetchPriceMock).toHaveBeenCalledWith("TSLAm");
  });

  it("un snapshot de hoy del MISMO proveedor sí se usa como cache, sin pegarle a la API", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock({
        user: { id: "u1" },
        tableResults: {
          instruments: { data: { id: INSTRUMENT_ID, price_provider: "data912", provider_symbol: "TSLAm", currency_code: "ARS" }, error: null },
          price_snapshots: { data: [{ as_of: "2026-08-06", provider: "data912", close: 33560 }], error: null },
        },
      }) as never
    );
    fetchPriceMock.mockClear();
    const { GET } = await import("./route");

    const res = await GET(new Request(`http://localhost/api/prices?instrumentId=${INSTRUMENT_ID}`));

    expect(await res.json()).toMatchObject({ close: 33560, provider: "data912", isStale: false });
    expect(fetchPriceMock).not.toHaveBeenCalled();
  });

  it("un instrumento SIN proveedor (FCI, plazo fijo) sigue respetando el manual de hoy", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock({
        user: { id: "u1" },
        tableResults: {
          instruments: { data: { id: INSTRUMENT_ID, price_provider: null, provider_symbol: null, currency_code: "ARS" }, error: null },
          price_snapshots: { data: [{ as_of: "2026-08-06", provider: "manual", close: 1500 }], error: null },
        },
      }) as never
    );
    const { GET } = await import("./route");

    const res = await GET(new Request(`http://localhost/api/prices?instrumentId=${INSTRUMENT_ID}`));

    expect(await res.json()).toMatchObject({ close: 1500, provider: "manual", isStale: false });
  });
});
