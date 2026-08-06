import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, resetDbForTests } from "../db/client";
import { formatRate, invertRate, rateFromInteger } from "../fx/rate";
import { todayIso } from "./ids";
import { fxRepo } from "./fx-repo";

describe("fxRepo — overrides manuales scoped por household (A8)", () => {
  beforeEach(() => {
    resetDbForTests(`perze-test-fx-repo-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await getDb().delete();
    vi.unstubAllGlobals();
  });

  it("un override de household A no es visible para household B", async () => {
    await fxRepo.setManualOverride("household-a", "USD", "ARS", rateFromInteger(1000));

    const overrideA = await fxRepo.getManualOverride("household-a", "USD", "ARS");
    const overrideB = await fxRepo.getManualOverride("household-b", "USD", "ARS");

    expect(overrideA?.rate).toBe(rateFromInteger(1000));
    expect(overrideB).toBeNull();
  });

  it("clearManualOverride solo borra el override del household indicado", async () => {
    // Pares de moneda DISTINTOS para A y B a propósito: la clave primaria
    // local hoy sigue siendo [base+quote+asOf+provider+quoteKind], SIN
    // householdId (ver la nota de alcance en lib/db/client.ts, versión 6)
    // — dos households escribiendo el MISMO par el MISMO día todavía se
    // pisan el uno al otro físicamente. Este test prueba el filtrado por
    // household que sí se arregló (la lectura), no ese caso pendiente.
    await fxRepo.setManualOverride("household-a", "USD", "ARS", rateFromInteger(1000));
    await fxRepo.setManualOverride("household-b", "USD", "UYU", rateFromInteger(1200));

    await fxRepo.clearManualOverride("household-a", "USD", "ARS");

    expect(await fxRepo.getManualOverride("household-a", "USD", "ARS")).toBeNull();
    expect((await fxRepo.getManualOverride("household-b", "USD", "UYU"))?.rate).toBe(rateFromInteger(1200));
  });

  it("resolve() de household A usa el override de A, nunca el de B", async () => {
    await fxRepo.setManualOverride("household-a", "USD", "ARS", rateFromInteger(1000));
    await fxRepo.setManualOverride("household-b", "USD", "UYU", rateFromInteger(9999));

    const resolution = await fxRepo.resolve({ householdId: "household-a", base: "USD", quote: "ARS", date: "2026-07-27" });

    expect(resolution.source).toBe("manual");
    expect(resolution.rate).toBe(rateFromInteger(1000));
  });

  it("D25 — elegir una variante real (blue/CCL/etc) exige limpiar el override manual, o resolve() lo sigue devolviendo", async () => {
    // El picker de E6 (`/currencies`) llama a las dos cosas juntas
    // (`clearManualOverride` + `setPreference`) — este test prueba que
    // hacerlo de verdad cambia la resolución, no solo que las funciones
    // individuales no tiran error.
    await fxRepo.setManualOverride("household-a", "USD", "ARS", rateFromInteger(1000));
    await fxRepo.cacheQuotes([{ base: "USD", quote: "ARS", asOf: todayIso(), provider: "dolarapi", quoteKind: "blue", rate: rateFromInteger(1300), fetchedAt: "2026-07-27T10:00:00Z" }]);

    // Con el override todavía vigente, blue no gana — coincide con el bug reportado en vivo.
    const beforeClear = await fxRepo.resolve({ householdId: "household-a", base: "USD", quote: "ARS", date: todayIso() });
    expect(beforeClear.source).toBe("manual");

    await fxRepo.clearManualOverride("household-a", "USD", "ARS");
    await fxRepo.setPreference("household-a", "USD/ARS", "dolarapi", "blue");

    const afterClear = await fxRepo.resolve({ householdId: "household-a", base: "USD", quote: "ARS", date: todayIso() });
    expect(afterClear.source).toBe("api");
    expect(afterClear.quoteKind).toBe("blue");
    expect(afterClear.rate).toBe(rateFromInteger(1300));
  });

  it("A8 — un rate 'inherited' para HOY vuelve a consultar /api/fx si hay red", async () => {
    const today = todayIso();
    // Cache local: solo una cotización vieja (heredada), nada de hoy.
    await fxRepo.cacheQuotes([
      { base: "USD", quote: "ARS", asOf: "2020-01-01", provider: "dolarapi", quoteKind: "oficial", rate: rateFromInteger(1000), fetchedAt: "2020-01-01T10:00:00Z" },
    ]);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rate: formatRate(rateFromInteger(1200)), source: "api", provider: "dolarapi", quoteKind: "oficial", asOf: today, isStale: false }),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { onLine: true });

    const resolution = await fxRepo.resolve({ householdId: "household-a", base: "USD", quote: "ARS", date: today });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(resolution.source).toBe("api");
    expect(resolution.rate).toBe(rateFromInteger(1200));
  });

  describe("getManualOverride — encuentra el par guardado al revés", () => {
    it("un override guardado como base→quote también sirve para quote→base, invertido", async () => {
      // `/currencies` guarda SIEMPRE en una única dirección canónica
      // (`moneda → household.baseCurrency`) — un caller que necesite la
      // dirección opuesta (p. ej. "pagar tarjeta" con la cuenta de origen
      // en la moneda base) antes no encontraba nada acá y caía en
      // silencio a la cotización del día de la API, ignorando el override.
      await fxRepo.setManualOverride("household-a", "ARS", "USD", rateFromInteger(1000));

      const direct = await fxRepo.getManualOverride("household-a", "ARS", "USD");
      const inverse = await fxRepo.getManualOverride("household-a", "USD", "ARS");

      expect(direct?.rate).toBe(rateFromInteger(1000));
      expect(inverse?.rate).toBe(invertRate(rateFromInteger(1000)));
    });

    it("prefiere el override directo por sobre el invertido cuando existen los dos", async () => {
      await fxRepo.setManualOverride("household-a", "ARS", "USD", rateFromInteger(1000));
      await fxRepo.setManualOverride("household-a", "USD", "ARS", rateFromInteger(2000));

      const rate = await fxRepo.getManualOverride("household-a", "USD", "ARS");

      expect(rate?.rate).toBe(rateFromInteger(2000));
    });

    it("resolve() también encuentra el override invertido, con source 'manual'", async () => {
      await fxRepo.setManualOverride("household-a", "ARS", "USD", rateFromInteger(1000));

      const resolution = await fxRepo.resolve({ householdId: "household-a", base: "USD", quote: "ARS", date: "2026-07-27" });

      expect(resolution.source).toBe("manual");
      expect(resolution.rate).toBe(invertRate(rateFromInteger(1000)));
    });

    it("null cuando no existe ninguno de los dos", async () => {
      expect(await fxRepo.getManualOverride("household-a", "USD", "ARS")).toBeNull();
    });
  });
});
