import { describe, expect, it } from "vitest";
import { computeBudgetProgressWithRollover, computeBudgetRollover, identifyBudgetAlertsWithRollover } from "./budget-rollover";

// Household con período_start_day = 1: los períodos son meses calendario.
const periodStartDay = 1;

function budget(overrides: Partial<Parameters<typeof computeBudgetRollover>[0]> = {}) {
  return {
    categoryId: null as string | null,
    amountLimit: 10_000n,
    rolloverSurplus: false,
    rolloverDeficit: false,
    rolloverSince: null as string | null,
    ...overrides,
  };
}

describe("computeBudgetRollover", () => {
  it("es 0 con los dos flags apagados", () => {
    const result = computeBudgetRollover(
      budget(),
      [{ kind: "expense" as const, categoryId: null, amountBase: 5_000n, occurredAt: "2026-06-10" }],
      periodStartDay,
      new Date(2026, 6, 20),
      []
    );
    expect(result).toEqual({ carry: 0n, excludedCount: 0 });
  });

  it("arrastra el sobrante de un período subgastado (rolloverSurplus)", () => {
    // Junio: límite 10.000, gastó 6.000 → sobran 4.000.
    const result = computeBudgetRollover(
      budget({ rolloverSurplus: true, rolloverSince: "2026-06-01" }),
      [{ kind: "expense" as const, categoryId: null, amountBase: 6_000n, occurredAt: "2026-06-10" }],
      periodStartDay,
      new Date(2026, 6, 20), // ahora estamos en julio
      []
    );
    expect(result.carry).toBe(4_000n);
    expect(result.excludedCount).toBe(0);
  });

  it("resetea el déficit a 0 cuando solo rolloverSurplus está activo", () => {
    // Junio: límite 10.000, gastó 13.000 → se pasó por 3.000, pero el déficit no se arrastra.
    const result = computeBudgetRollover(
      budget({ rolloverSurplus: true, rolloverSince: "2026-06-01" }),
      [{ kind: "expense" as const, categoryId: null, amountBase: 13_000n, occurredAt: "2026-06-10" }],
      periodStartDay,
      new Date(2026, 6, 20),
      []
    );
    expect(result.carry).toBe(0n);
  });

  it("arrastra el exceso de un período que se pasó (rolloverDeficit)", () => {
    const result = computeBudgetRollover(
      budget({ rolloverDeficit: true, rolloverSince: "2026-06-01" }),
      [{ kind: "expense" as const, categoryId: null, amountBase: 13_000n, occurredAt: "2026-06-10" }],
      periodStartDay,
      new Date(2026, 6, 20),
      []
    );
    expect(result.carry).toBe(-3_000n);
  });

  it("resetea el sobrante a 0 cuando solo rolloverDeficit está activo", () => {
    const result = computeBudgetRollover(
      budget({ rolloverDeficit: true, rolloverSince: "2026-06-01" }),
      [{ kind: "expense" as const, categoryId: null, amountBase: 6_000n, occurredAt: "2026-06-10" }],
      periodStartDay,
      new Date(2026, 6, 20),
      []
    );
    expect(result.carry).toBe(0n);
  });

  it("con los dos flags activos, no recorta en ninguna dirección", () => {
    const result = computeBudgetRollover(
      budget({ rolloverSurplus: true, rolloverDeficit: true, rolloverSince: "2026-06-01" }),
      [{ kind: "expense" as const, categoryId: null, amountBase: 13_000n, occurredAt: "2026-06-10" }],
      periodStartDay,
      new Date(2026, 6, 20),
      []
    );
    expect(result.carry).toBe(-3_000n);
  });

  it("acumula dos períodos cerrados en cadena", () => {
    // Mayo: sobran 4.000. Junio: límite efectivo 14.000, gasta 9.000 → sobran 5.000.
    const result = computeBudgetRollover(
      budget({ rolloverSurplus: true, rolloverSince: "2026-05-01" }),
      [
        { kind: "expense" as const, categoryId: null, amountBase: 6_000n, occurredAt: "2026-05-10" },
        { kind: "expense" as const, categoryId: null, amountBase: 9_000n, occurredAt: "2026-06-10" },
      ],
      periodStartDay,
      new Date(2026, 6, 20), // ahora julio
      []
    );
    expect(result.carry).toBe(5_000n);
  });

  it("no es retroactivo: solo cuenta períodos que arrancaron en o después de rolloverSince", () => {
    // rolloverSince cae DENTRO de junio (a mitad de mes) — mayo queda afuera
    // y junio también, porque su inicio (1/jun) es anterior a rolloverSince.
    const result = computeBudgetRollover(
      budget({ rolloverSurplus: true, rolloverSince: "2026-06-15" }),
      [
        { kind: "expense" as const, categoryId: null, amountBase: 1_000n, occurredAt: "2026-05-10" },
        { kind: "expense" as const, categoryId: null, amountBase: 1_000n, occurredAt: "2026-06-10" },
      ],
      periodStartDay,
      new Date(2026, 6, 20),
      []
    );
    expect(result.carry).toBe(0n);
  });

  it("acumula el excludedCount de needs_fx de los períodos que entraron en el cálculo", () => {
    const result = computeBudgetRollover(
      budget({ rolloverSurplus: true, rolloverSince: "2026-06-01" }),
      [
        { kind: "expense" as const, categoryId: null, amountBase: 6_000n, occurredAt: "2026-06-10" },
        { kind: "expense" as const, categoryId: null, amountBase: null, occurredAt: "2026-06-11" },
      ],
      periodStartDay,
      new Date(2026, 6, 20),
      []
    );
    expect(result.excludedCount).toBe(1);
  });
});

describe("computeBudgetProgressWithRollover", () => {
  it("suma el carry al límite del período en curso", () => {
    const result = computeBudgetProgressWithRollover(
      budget({ rolloverSurplus: true, rolloverSince: "2026-06-01" }),
      [
        { kind: "expense" as const, categoryId: null, amountBase: 6_000n, occurredAt: "2026-06-10" }, // sobran 4.000
        { kind: "expense" as const, categoryId: null, amountBase: 8_000n, occurredAt: "2026-07-10" }, // julio, período en curso
      ],
      periodStartDay,
      new Date(2026, 6, 20),
      []
    );
    expect(result.carry).toBe(4_000n);
    expect(result.spent).toBe(8_000n);
    // Límite efectivo 14.000, gastó 8.000.
    expect(result.progress).toBeCloseTo(8_000 / 14_000);
  });

  it("es idéntico a computeBudgetProgress cuando no hay rollover activo", () => {
    const result = computeBudgetProgressWithRollover(
      budget(),
      [{ kind: "expense" as const, categoryId: null, amountBase: 6_000n, occurredAt: "2026-07-10" }],
      periodStartDay,
      new Date(2026, 6, 20),
      []
    );
    expect(result.carry).toBe(0n);
    expect(result.spent).toBe(6_000n);
    expect(result.progress).toBeCloseTo(0.6);
  });
});

describe("identifyBudgetAlertsWithRollover", () => {
  it("un presupuesto que estaría exceeded sin rollover deja de estarlo con sobrante arrastrado", () => {
    const b = budget({ rolloverSurplus: true, rolloverSince: "2026-06-01", amountLimit: 10_000n });
    const alerts = identifyBudgetAlertsWithRollover(
      [b],
      [
        { kind: "expense" as const, categoryId: null, amountBase: 2_000n, occurredAt: "2026-06-10" }, // sobran 8.000
        { kind: "expense" as const, categoryId: null, amountBase: 11_000n, occurredAt: "2026-07-10" }, // límite efectivo 18.000
      ],
      periodStartDay,
      new Date(2026, 6, 20),
      []
    );
    expect(alerts).toEqual([]);
  });
});
