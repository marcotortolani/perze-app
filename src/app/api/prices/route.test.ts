import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

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
// `finnhub.ts` (agregado al mapa de proveedores de esta ruta) importa
// `@/env` — sin mockearlo, `createEnv` explota en test por las env vars
// públicas requeridas (`NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY`) que no
// están seteadas acá.
vi.mock("@/env", () => ({ env: {} }));

const fetchPriceMock = vi.fn();
vi.mock("@/lib/prices/providers/data912", () => ({ createData912Provider: () => ({ id: "data912", fetchPrice: fetchPriceMock }) }));
vi.mock("@/lib/prices/providers/coingecko", () => ({ createCoinGeckoPriceProvider: () => ({ id: "coingecko", fetchPrice: async () => null }) }));

const INSTRUMENT_ID = "11111111-1111-4111-8111-111111111111";

/**
 * La ruta decide "¿este snapshot es de hoy?" contra el reloj real
 * (`new Date().toISOString().slice(0, 10)`, decisión deliberada de D10: es
 * fecha de mercado del servidor, no calendario del usuario — ver la nota de
 * `/api/fx/route.ts`). Con fixtures de fecha literal, los tests envejecían y
 * fallaban al día siguiente de escribirlos.
 *
 * Se ancla el reloj en vez de seguirlo: los fixtures quedan legibles y las
 * aserciones no dependen de cuándo corre la suite. Se falsea **solo `Date`**
 * — con los timers completos falseados, cualquier `await` que dependa de la
 * cola de macrotareas quedaría colgado.
 *
 * `T12:00:00Z` a propósito: a mediodía UTC el día calendario es el mismo en
 * cualquier huso realista, así que la corrida no cambia de resultado entre
 * las 21:00 y las 00:00 de Uruguay.
 */
const FIXTURE_TODAY = "2026-08-06";

describe("GET /api/prices (D45)", () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(`${FIXTURE_TODAY}T12:00:00.000Z`) });
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("un snapshot 'manual' de hoy NO tapa la cotización real de un instrumento con proveedor", async () => {
    fetchPriceMock.mockResolvedValue({ close: 33560, asOf: FIXTURE_TODAY });
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseMock({
        user: { id: "u1" },
        tableResults: {
          instruments: { data: { id: INSTRUMENT_ID, price_provider: "data912", provider_symbol: "TSLAm", currency_code: "ARS" }, error: null },
          price_snapshots: { data: [{ as_of: FIXTURE_TODAY, provider: "manual", close: 150 }], error: null },
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
          price_snapshots: { data: [{ as_of: FIXTURE_TODAY, provider: "data912", close: 33560 }], error: null },
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
          price_snapshots: { data: [{ as_of: FIXTURE_TODAY, provider: "manual", close: 1500 }], error: null },
        },
      }) as never
    );
    const { GET } = await import("./route");

    const res = await GET(new Request(`http://localhost/api/prices?instrumentId=${INSTRUMENT_ID}`));

    expect(await res.json()).toMatchObject({ close: 1500, provider: "manual", isStale: false });
  });
});
