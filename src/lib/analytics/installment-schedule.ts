/** G6 — genera un cronograma parejo (cuota fija) para un plan de cuotas nuevo. Sin interés: repartir intereses reales requiere una tabla de amortización que nadie pidió todavía. */

export interface GeneratedInstallment {
  number: number;
  dueDate: string; // ISO date
  principalAmount: bigint;
  interestAmount: bigint;
}

/** Último día del mes `month0` (0-based) de `year`, calendario-local. */
function lastDayOfMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

export function generateEvenSchedule(principal: bigint, installments: number, startDate: Date): GeneratedInstallment[] {
  if (installments <= 0) return [];
  const base = principal / BigInt(installments);
  const remainder = principal - base * BigInt(installments);

  const startYear = startDate.getFullYear();
  const startMonth0 = startDate.getMonth();
  const startDay = startDate.getDate();

  return Array.from({ length: installments }, (_, i) => {
    // `Date(year, month0 + i + 1, day)` con `month0` corrido más allá de
    // diciembre lo resuelve JS solo — pasa al año siguiente sin overflow
    // manual. Lo que JS NO resuelve es el día: si `startDay` (p.ej. 31) no
    // existe en el mes destino (p.ej. febrero), `new Date(y, m, 31)`
    // desborda en silencio al mes SIGUIENTE en vez de clampear al 28/29 —
    // por eso el clamp explícito acá.
    const targetIndex = startMonth0 + i + 1;
    const targetYear = startYear + Math.floor(targetIndex / 12);
    const targetMonth0 = ((targetIndex % 12) + 12) % 12;
    const day = Math.min(startDay, lastDayOfMonth(targetYear, targetMonth0));

    // Mediodía UTC, nunca medianoche (`CLAUDE.md`): medianoche UTC cae en
    // el día anterior apenas se formatea en un huso negativo (UY/AR:
    // UTC-3), que es el bug que ya rompió "1 de septiembre" en otro lado.
    const dueDate = new Date(Date.UTC(targetYear, targetMonth0, day, 12));
    // El resto de la división entera se suma a la última cuota — el total tiene que cerrar exacto.
    const principalAmount = i === installments - 1 ? base + remainder : base;
    return { number: i + 1, dueDate: dueDate.toISOString().slice(0, 10), principalAmount, interestAmount: 0n };
  });
}
