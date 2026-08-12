import { describe, expect, it } from "vitest";
import {
  dayKeyOf,
  dayRange,
  expenseTotalsByDay,
  HEAT_CEILING,
  HEAT_FLOOR,
  heatMixPercent,
  isFutureDay,
  localMidnightIso,
  monthFromParams,
  monthGrid,
  monthOfDay,
  monthRange,
  periodStartFor,
  scopeFromParams,
  shiftMonth,
  weekdayAnchors,
} from "./calendar-scope";
import type { TransactionRow as TransactionRecord } from "@/lib/db/schema";

/**
 * La suite corre con `TZ=America/Montevideo` (UTC−3, sin horario de verano
 * desde 2015) — ver `vitest.setup.ts`. Varias aserciones de acá abajo son
 * literales con el offset adentro a propósito: son las que distinguen
 * medianoche local de medianoche UTC, y en un huso UTC pasarían sin probar nada.
 */
const OFFSET_SUFFIX = "T03:00:00.000Z";

describe("límites de rango", () => {
  it("arma medianoche LOCAL, no medianoche UTC", () => {
    expect(dayRange("2026-08-04").from).toBe(`2026-08-04${OFFSET_SUFFIX}`);
    expect(monthRange("2026-08").from).toBe(`2026-08-01${OFFSET_SUFFIX}`);
  });

  it("usa la MISMA receta que los presets del sheet de filtros", () => {
    // El test que impide que las dos puntas diverjan: si alguien cambia una
    // receta y no la otra, elegir "este mes" en el sheet y elegir el mes en el
    // calendario dejarían de dar el mismo rango.
    const now = new Date(2026, 7, 5, 14, 30);
    const currentMonth = "2026-08";
    expect(monthRange(currentMonth).from).toBe(periodStartFor("this-month", now).from);
  });

  it("`to` es exclusivo y cae en la medianoche del día siguiente", () => {
    expect(dayRange("2026-08-04").to).toBe(dayRange("2026-08-05").from);
    expect(monthRange("2026-08").to).toBe(dayRange("2026-09-01").from);
  });

  it("cruza el fin de mes y el fin de año sin caso especial", () => {
    expect(dayRange("2026-08-31").to).toBe(`2026-09-01${OFFSET_SUFFIX}`);
    expect(monthRange("2026-12").to).toBe(`2027-01-01${OFFSET_SUFFIX}`);
    expect(dayRange("2024-02-29").to).toBe(`2024-03-01${OFFSET_SUFFIX}`);
  });
});

describe("scopeFromParams", () => {
  it("lee de vuelta el mes entero", () => {
    const { from, to } = monthRange("2026-08");
    expect(scopeFromParams(from, to, new Date())).toEqual({ month: "2026-08", day: null });
  });

  it("lee de vuelta el día elegido", () => {
    const { from, to } = dayRange("2026-08-04");
    expect(scopeFromParams(from, to, new Date())).toEqual({ month: "2026-08", day: "2026-08-04" });
  });

  it("un rango que no armó el calendario no cuenta como día elegido", () => {
    // El home linkea con el rango del período del household, que puede
    // arrancar cualquier día y no es ni un mes ni un día calendario.
    const from = localMidnightIso(2026, 7, 5);
    const to = localMidnightIso(2026, 8, 5);
    expect(scopeFromParams(from, to, new Date())).toEqual({ month: "2026-08", day: null });
  });

  it("sin params cae en el mes de la fecha de referencia", () => {
    expect(scopeFromParams(null, null, new Date(2026, 7, 5))).toEqual({ month: "2026-08", day: null });
  });

  it("un `from` sin `to` no es un día elegido", () => {
    expect(scopeFromParams(dayRange("2026-08-04").from, null, new Date())).toEqual({ month: "2026-08", day: null });
  });

  it("no explota con un `from` inválido escrito a mano en la URL", () => {
    expect(scopeFromParams("no-es-una-fecha", null, new Date(2026, 7, 5))).toEqual({ month: "2026-08", day: null });
  });
});

describe("monthFromParams", () => {
  it("reconoce un rango que ES exactamente un mes calendario", () => {
    const { from, to } = monthRange("2026-08");
    expect(monthFromParams(from, to)).toBe("2026-08");
  });

  it("un día suelto no cuenta como mes elegido", () => {
    const { from, to } = dayRange("2026-08-04");
    expect(monthFromParams(from, to)).toBeNull();
  });

  it("un rango arbitrario (el período del household que linkea el home) no cuenta", () => {
    const from = localMidnightIso(2026, 7, 5);
    const to = localMidnightIso(2026, 8, 5);
    expect(monthFromParams(from, to)).toBeNull();
  });

  it("sin from o sin to, null", () => {
    const { from } = monthRange("2026-08");
    expect(monthFromParams(null, null)).toBeNull();
    expect(monthFromParams(from, null)).toBeNull();
    expect(monthFromParams(null, "2026-09-01T00:00:00.000Z")).toBeNull();
  });

  it("no explota con un `from` inválido", () => {
    expect(monthFromParams("no-es-una-fecha", "tampoco")).toBeNull();
  });
});

describe("dayKeyOf", () => {
  it("agrupa por el día LOCAL, no por el día UTC", () => {
    // 2026-08-04T02:00:00Z son las 23:00 del 3 de agosto en UTC−3. El
    // `occurredAt.slice(0, 10)` que se usaba antes devolvía "2026-08-04" y
    // contaba el movimiento en el día equivocado.
    expect(dayKeyOf("2026-08-04T02:00:00.000Z")).toBe("2026-08-03");
    expect("2026-08-04T02:00:00.000Z".slice(0, 10)).toBe("2026-08-04");
  });

  it("es la inversa de `localMidnightIso`", () => {
    expect(dayKeyOf(localMidnightIso(2026, 7, 4))).toBe("2026-08-04");
  });

  it("el último instante del día local sigue siendo ese día", () => {
    const justBeforeMidnight = new Date(new Date(dayRange("2026-08-04").to).getTime() - 1).toISOString();
    expect(dayKeyOf(justBeforeMidnight)).toBe("2026-08-04");
  });
});

describe("monthGrid", () => {
  it("arranca la semana en lunes por default", () => {
    // El 1 de agosto de 2026 es sábado: con la semana arrancando en lunes
    // quedan cinco celdas de relleno adelante.
    const cells = monthGrid("2026-08");
    expect(cells.slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(cells[5]).toBe("2026-08-01");
  });

  it("con la semana en domingo el relleno es uno más", () => {
    const cells = monthGrid("2026-08", { weekStartsOn: 0 });
    expect(cells.filter((c) => c === null)).toHaveLength(6);
    expect(cells[6]).toBe("2026-08-01");
  });

  it("un mes que arranca lunes no lleva relleno", () => {
    // 1 de junio de 2026, lunes.
    expect(monthGrid("2026-06")[0]).toBe("2026-06-01");
  });

  it("cubre el mes completo, incluido febrero bisiesto", () => {
    expect(monthGrid("2024-02").filter(Boolean)).toHaveLength(29);
    expect(monthGrid("2026-02").filter(Boolean)).toHaveLength(28);
    expect(monthGrid("2026-08").filter(Boolean)).toHaveLength(31);
  });

  it("no rellena al final", () => {
    const cells = monthGrid("2026-08");
    expect(cells[cells.length - 1]).toBe("2026-08-31");
  });
});

describe("weekdayAnchors", () => {
  it("devuelve siete días consecutivos que arrancan en lunes", () => {
    // 5 de agosto de 2026, miércoles.
    const anchors = weekdayAnchors(new Date(2026, 7, 5));
    expect(anchors).toHaveLength(7);
    expect(anchors[0]!.getDay()).toBe(1);
    expect(anchors[6]!.getDay()).toBe(0);
  });

  it("respeta un ancla en domingo", () => {
    expect(weekdayAnchors(new Date(2026, 7, 5), 0)[0]!.getDay()).toBe(0);
  });
});

describe("shiftMonth", () => {
  it("cruza el año en los dos sentidos", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("se mueve de a un mes", () => {
    expect(shiftMonth("2026-08", 1)).toBe("2026-09");
    expect(shiftMonth("2026-08", -1)).toBe("2026-07");
  });
});

describe("monthOfDay e isFutureDay", () => {
  it("monthOfDay recorta al mes", () => {
    expect(monthOfDay("2026-08-04")).toBe("2026-08");
  });

  it("isFutureDay compara contra hoy", () => {
    expect(isFutureDay("2026-08-06", "2026-08-05")).toBe(true);
    expect(isFutureDay("2026-08-05", "2026-08-05")).toBe(false);
    expect(isFutureDay("2026-08-04", "2026-08-05")).toBe(false);
  });
});

describe("heatMixPercent", () => {
  it("un día sin gasto no tiene color", () => {
    // Cero se reserva para "no hubo gasto", que es información: la celda queda
    // idéntica al fondo.
    expect(heatMixPercent(0n, 1000)).toBe(0);
  });

  it("cualquier gasto, por chico que sea, se separa del día vacío", () => {
    // El bug reportado: con la escala lineal y piso 8%, un gasto minúsculo
    // contra un mes con un día caro quedaba indistinguible de no gastar nada.
    expect(heatMixPercent(1n, 1_000_000)).toBeGreaterThanOrEqual(HEAT_FLOOR);
    expect(heatMixPercent(1n, 1_000_000)).toBeGreaterThan(0);
  });

  it("el día más caro del mes llega al techo", () => {
    expect(heatMixPercent(1000n, 1000)).toBeCloseTo(HEAT_CEILING, 10);
  });

  it("nunca se pasa del techo aunque el total supere el máximo", () => {
    // Defensivo: si `maxTotal` llegara desfasado, el `color-mix` no puede
    // emitir un porcentaje fuera de rango.
    expect(heatMixPercent(5000n, 1000)).toBe(HEAT_CEILING);
  });

  it("más gasto nunca da menos color", () => {
    const totals = [20n, 40n, 80n, 150n, 300n, 1000n];
    const mixes = totals.map((t) => heatMixPercent(t, 1000));
    for (let i = 1; i < mixes.length; i++) {
      expect(mixes[i]!).toBeGreaterThan(mixes[i - 1]!);
    }
  });

  it("reparte los días de un mes sesgado en vez de amontonarlos", () => {
    // Este es el test que falla si alguien vuelve a la escala lineal: con
    // lineal, estos seis días daban 11/12/15/19/28/70 — los cuatro más chicos
    // separados por 1 y 3 puntos, o sea indistinguibles a ojo.
    const mixes = [20n, 40n, 80n, 150n, 300n, 1000n].map((t) => heatMixPercent(t, 1000));
    for (let i = 1; i < mixes.length; i++) {
      expect(mixes[i]! - mixes[i - 1]!).toBeGreaterThanOrEqual(3);
    }
  });

  it("se mantiene dentro del rango declarado", () => {
    for (const total of [1n, 7n, 250n, 999n, 1000n]) {
      const mix = heatMixPercent(total, 1000);
      expect(mix).toBeGreaterThanOrEqual(HEAT_FLOOR);
      expect(mix).toBeLessThanOrEqual(HEAT_CEILING);
    }
  });
});

describe("expenseTotalsByDay", () => {
  const tx = (kind: string, amountBase: bigint | null, occurredAt: string) =>
    ({ kind, amountBase, occurredAt }) as Pick<TransactionRecord, "kind" | "amountBase" | "occurredAt">;

  it("suma solo gastos", () => {
    const totals = expenseTotalsByDay([
      tx("expense", 1000n, localMidnightIso(2026, 7, 4)),
      tx("income", 5000n, localMidnightIso(2026, 7, 4)),
      tx("transfer", 2000n, localMidnightIso(2026, 7, 4)),
    ]);
    expect(totals.get("2026-08-04")).toBe(1000n);
  });

  it("excluye los movimientos sin cotización en vez de contarlos como cero", () => {
    // Un gasto `pending` no tiene `amountBase`; contarlo como cero pintaría el
    // día más claro de lo que es (`CLAUDE.md` § needs_fx).
    const totals = expenseTotalsByDay([tx("expense", null, localMidnightIso(2026, 7, 4))]);
    expect(totals.has("2026-08-04")).toBe(false);
  });

  it("acumula varios gastos del mismo día", () => {
    const totals = expenseTotalsByDay([
      tx("expense", 1000n, localMidnightIso(2026, 7, 4)),
      tx("expense", 250n, new Date(2026, 7, 4, 23, 30).toISOString()),
    ]);
    expect(totals.get("2026-08-04")).toBe(1250n);
  });

  it("no pinta el mapa de calor con compras/ventas de instrumentos — no son consumo", () => {
    const totals = expenseTotalsByDay([
      tx("expense", 1000n, localMidnightIso(2026, 7, 4)),
      tx("investing", -5000n, localMidnightIso(2026, 7, 4)),
      tx("investing", 800n, localMidnightIso(2026, 7, 4)),
    ]);
    expect(totals.get("2026-08-04")).toBe(1000n);
  });
});
