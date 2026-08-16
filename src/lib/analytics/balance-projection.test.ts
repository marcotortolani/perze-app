import { describe, expect, it } from "vitest";
import { addDaysIso, computeBalanceProjection, type ProjectedEvent } from "./balance-projection";

describe("addDaysIso", () => {
  it("advances the calendar day, synthesized at UTC noon", () => {
    expect(addDaysIso("2026-08-16", 30)).toBe("2026-09-15");
  });

  it("never rolls back a day in a negative-UTC timezone reader (mediodía UTC, no medianoche)", () => {
    // Un día sintetizado a medianoche UTC caería en el día anterior al
    // formatearse en UTC-3 — este helper siempre da mediodía UTC (D10).
    const iso = addDaysIso("2026-01-01", 1);
    expect(iso).toBe("2026-01-02");
  });
});

describe("computeBalanceProjection", () => {
  const now = "2026-08-16";

  it("returns the current balance with no future events", () => {
    const projection = computeBalanceProjection(10000n, [], now);
    expect(projection.currentBalance).toBe(10000n);
    expect(projection.points).toEqual([{ date: now, balance: 10000n }]);
    expect(projection.horizons.map((h) => h.balance)).toEqual([10000n, 10000n, 10000n]);
  });

  it("accumulates income and expense events into the running balance", () => {
    const events: ProjectedEvent[] = [
      { date: "2026-08-20", label: "Sueldo", amount: 50000n, kind: "recurring-income" },
      { date: "2026-08-25", label: "Alquiler", amount: -30000n, kind: "recurring-expense" },
      { date: "2026-09-25", label: "Alquiler", amount: -30000n, kind: "recurring-expense" },
    ];
    const projection = computeBalanceProjection(10000n, events, now);
    expect(projection.points.at(-1)?.balance).toBe(10000n + 50000n - 30000n - 30000n);

    const [h30, h60] = projection.horizons;
    expect(h30!.balance).toBe(10000n + 50000n - 30000n); // solo los dos primeros eventos caen dentro de 30 días
    expect(h30!.committedIn).toBe(50000n);
    expect(h30!.committedOut).toBe(30000n);
    expect(h60!.balance).toBe(10000n + 50000n - 30000n - 30000n); // el alquiler de septiembre ya entra a los 60 días
  });

  it("ignores events dated before now (defensive — the caller should not send these, but a stale event must not double count)", () => {
    const events: ProjectedEvent[] = [{ date: "2026-08-01", label: "vencido", amount: -1000n, kind: "installment-i-owe" }];
    const projection = computeBalanceProjection(10000n, events, now);
    expect(projection.points).toEqual([{ date: now, balance: 10000n }]);
  });

  it("sorts events chronologically regardless of input order", () => {
    const events: ProjectedEvent[] = [
      { date: "2026-09-10", label: "b", amount: -100n, kind: "installment-i-owe" },
      { date: "2026-08-20", label: "a", amount: 200n, kind: "recurring-income" },
    ];
    const projection = computeBalanceProjection(0n, events, now);
    expect(projection.events.map((e) => e.label)).toEqual(["a", "b"]);
    expect(projection.points.map((p) => p.balance)).toEqual([0n, 200n, 100n]);
  });

  it("respects a custom set of horizons", () => {
    const events: ProjectedEvent[] = [{ date: "2026-08-20", label: "a", amount: 500n, kind: "recurring-income" }];
    const projection = computeBalanceProjection(0n, events, now, [7, 14]);
    expect(projection.horizons).toHaveLength(2);
    expect(projection.horizons[0]!.balance).toBe(500n);
    expect(projection.horizons[1]!.balance).toBe(500n);
  });
});
