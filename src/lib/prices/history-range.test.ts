import { describe, expect, it } from "vitest";
import { sinceIsoForRange } from "./history-range";

describe("sinceIsoForRange", () => {
  it("resta 7 días para \"week\"", () => {
    expect(sinceIsoForRange("week", "2026-08-06")).toBe("2026-07-30");
  });

  it("resta 30 días para \"month\"", () => {
    expect(sinceIsoForRange("month", "2026-08-06")).toBe("2026-07-07");
  });

  it("cruza fin de año sin desfasarse (D10 — ancla a mediodía UTC)", () => {
    expect(sinceIsoForRange("week", "2026-01-02")).toBe("2025-12-26");
  });
});
