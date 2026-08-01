import { describe, expect, it } from "vitest";
import { needsFxSeverity, resolveFxRate } from "./resolve";
import { rateFromInteger } from "./rate";

const RATE_1000 = rateFromInteger(1000);
const RATE_1200 = rateFromInteger(1200);

describe("resolveFxRate — cadena de resolución estricta", () => {
  it("misma moneda es identity, sin tocar nada más", () => {
    const r = resolveFxRate({ base: "USD", quote: "USD", date: "2026-07-27", ratesForPair: [] });
    expect(r.source).toBe("identity");
  });

  it("override manual gana siempre, aunque haya cotización del día", () => {
    const r = resolveFxRate({
      base: "USD",
      quote: "ARS",
      date: "2026-07-27",
      manualOverride: { rate: RATE_1200, quoteKind: "custom" },
      ratesForPair: [
        { base: "USD", quote: "ARS", asOf: "2026-07-27", provider: "dolarapi", quoteKind: "oficial", rate: RATE_1000, fetchedAt: "2026-07-27T10:00:00Z" },
      ],
    });
    expect(r.source).toBe("manual");
    expect(r.rate).toBe(RATE_1200);
    expect(r.isStale).toBe(false);
  });

  it("sin override, usa la cotización del día", () => {
    const r = resolveFxRate({
      base: "USD",
      quote: "ARS",
      date: "2026-07-27",
      ratesForPair: [
        { base: "USD", quote: "ARS", asOf: "2026-07-27", provider: "dolarapi", quoteKind: "oficial", rate: RATE_1000, fetchedAt: "2026-07-27T10:00:00Z" },
      ],
    });
    expect(r.source).toBe("api");
    expect(r.isStale).toBe(false);
  });

  it("sin cotización del día, hereda el último valor conocido", () => {
    const r = resolveFxRate({
      base: "USD",
      quote: "ARS",
      date: "2026-07-27",
      ratesForPair: [
        { base: "USD", quote: "ARS", asOf: "2026-07-20", provider: "dolarapi", quoteKind: "oficial", rate: RATE_1000, fetchedAt: "2026-07-20T10:00:00Z" },
      ],
    });
    expect(r.source).toBe("inherited");
    expect(r.isStale).toBe(true);
    expect(r.asOf).toBe("2026-07-20");
  });

  it("hereda el más reciente entre varios, no el primero de la lista", () => {
    const r = resolveFxRate({
      base: "USD",
      quote: "ARS",
      date: "2026-07-27",
      ratesForPair: [
        { base: "USD", quote: "ARS", asOf: "2026-07-10", provider: "dolarapi", quoteKind: "oficial", rate: RATE_1000, fetchedAt: "" },
        { base: "USD", quote: "ARS", asOf: "2026-07-22", provider: "dolarapi", quoteKind: "oficial", rate: RATE_1200, fetchedAt: "" },
      ],
    });
    expect(r.asOf).toBe("2026-07-22");
    expect(r.rate).toBe(RATE_1200);
  });

  it("A7 — nunca hereda una cotización POSTERIOR a la fecha del movimiento", () => {
    // Import retroactivo: el movimiento es del 10, pero lo único cacheado
    // es del 27 (hoy). Antes de A7 esto heredaba el rate de hoy — hay que
    // caer a pending en vez de inventar una cotización futura.
    const r = resolveFxRate({
      base: "USD",
      quote: "ARS",
      date: "2026-07-10",
      ratesForPair: [
        { base: "USD", quote: "ARS", asOf: "2026-07-27", provider: "dolarapi", quoteKind: "oficial", rate: RATE_1200, fetchedAt: "" },
      ],
    });
    expect(r.source).toBe("pending");
    expect(r.rate).toBeNull();
  });

  it("A7 — con candidatos antes y después de la fecha, hereda el más reciente que no sea futuro", () => {
    const r = resolveFxRate({
      base: "USD",
      quote: "ARS",
      date: "2026-07-15",
      ratesForPair: [
        { base: "USD", quote: "ARS", asOf: "2026-07-10", provider: "dolarapi", quoteKind: "oficial", rate: RATE_1000, fetchedAt: "" },
        { base: "USD", quote: "ARS", asOf: "2026-07-27", provider: "dolarapi", quoteKind: "oficial", rate: RATE_1200, fetchedAt: "" },
      ],
    });
    expect(r.source).toBe("inherited");
    expect(r.asOf).toBe("2026-07-10");
    expect(r.rate).toBe(RATE_1000);
  });

  it("sin nada disponible, pending — nunca cae a rate = 1", () => {
    const r = resolveFxRate({ base: "USD", quote: "ARS", date: "2026-07-27", ratesForPair: [] });
    expect(r.source).toBe("pending");
    expect(r.rate).toBeNull();
  });

  it("respeta la preferencia de proveedor/tipo de cotización del household", () => {
    const r = resolveFxRate({
      base: "USD",
      quote: "ARS",
      date: "2026-07-27",
      preferredQuoteKind: "blue",
      ratesForPair: [
        { base: "USD", quote: "ARS", asOf: "2026-07-27", provider: "dolarapi", quoteKind: "oficial", rate: RATE_1000, fetchedAt: "" },
        { base: "USD", quote: "ARS", asOf: "2026-07-27", provider: "dolarapi", quoteKind: "blue", rate: RATE_1200, fetchedAt: "" },
      ],
    });
    expect(r.quoteKind).toBe("blue");
    expect(r.rate).toBe(RATE_1200);
  });
});

describe("needsFxSeverity — única excepción que escala por tiempo", () => {
  it("neutral antes de 7 días", () => {
    const now = new Date("2026-07-27T00:00:00Z");
    expect(needsFxSeverity("2026-07-22T00:00:00Z", now)).toBe("neutral");
  });

  it("warning después de 7 días", () => {
    const now = new Date("2026-07-27T00:00:00Z");
    expect(needsFxSeverity("2026-07-01T00:00:00Z", now)).toBe("warning");
  });
});
