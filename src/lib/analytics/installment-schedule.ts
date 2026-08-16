/**
 * G6 — genera el cronograma de cuotas de un plan/deuda nueva, en tres
 * sistemas de amortización:
 *
 * - `none`: cuotas parejas de capital, interés siempre cero. El default —
 *   el caso más común (12 cuotas sin interés) no le pide tecnicismos a un
 *   usuario amateur.
 * - `french`: cuota total constante; la proporción interés/capital varía
 *   cuota a cuota. El default cuando se activa el interés — es el sistema
 *   de casi todo préstamo real.
 * - `german`: capital constante por cuota, cuota total decreciente.
 *
 * Igual que `fx_rate`: lo que ya se generó y se pagó no se recalcula. Esto
 * solo genera cuotas nuevas — la congelación de las pagadas vive en
 * `debtsRepo.update()`.
 */

export type AmortizationSystem = "none" | "french" | "german";

export interface GeneratedInstallment {
  number: number;
  dueDate: string; // ISO date
  principalAmount: bigint;
  interestAmount: bigint;
}

export interface GenerateScheduleInput {
  principal: bigint;
  installments: number;
  startDate: Date;
  /** Tasa nominal anual en porcentaje (ej. 60 = 60% anual). `null`/`0` en `none`. */
  annualRatePct: number | null;
}

/** Último día del mes `month0` (0-based) de `year`, calendario-local. */
function lastDayOfMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

/**
 * Fecha de vencimiento de la cuota `i` (0-based) a partir de `startDate`:
 * un mes calendario por cuota, con clamp de fin de mes y mediodía UTC
 * (`CLAUDE.md`) — nunca medianoche, que cae en el día anterior en
 * cualquier huso negativo (UY/AR: UTC-3) apenas se formatea en hora local.
 */
function dueDateFor(startDate: Date, i: number): string {
  const startYear = startDate.getFullYear();
  const startMonth0 = startDate.getMonth();
  const startDay = startDate.getDate();

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

  const dueDate = new Date(Date.UTC(targetYear, targetMonth0, day, 12));
  return dueDate.toISOString().slice(0, 10);
}

/** Cuotas parejas de capital, interés siempre cero — el resto de la división entera cae en la última. */
function generateNoneSchedule(principal: bigint, installments: number, startDate: Date): GeneratedInstallment[] {
  const base = principal / BigInt(installments);
  const remainder = principal - base * BigInt(installments);

  return Array.from({ length: installments }, (_, i) => {
    const principalAmount = i === installments - 1 ? base + remainder : base;
    return { number: i + 1, dueDate: dueDateFor(startDate, i), principalAmount, interestAmount: 0n };
  });
}

/**
 * Sistema alemán: capital constante por cuota (`principal / installments`,
 * resto en la última), interés de cada cuota = saldo restante × tasa
 * mensual. Cuota total decreciente.
 */
function generateGermanSchedule(principal: bigint, installments: number, startDate: Date, annualRatePct: number): GeneratedInstallment[] {
  const base = principal / BigInt(installments);
  const remainder = principal - base * BigInt(installments);
  const monthlyRate = annualRatePct / 12 / 100;

  let outstanding = principal;
  return Array.from({ length: installments }, (_, i) => {
    const principalAmount = i === installments - 1 ? base + remainder : base;
    // Interés en floating point (no hay forma de resolver esto en bigint
    // puro) pero el resultado se redondea a bigint antes de devolverse —
    // nunca se expone un float hacia afuera de esta función.
    const interestAmount = BigInt(Math.round(Number(outstanding) * monthlyRate));
    outstanding -= principalAmount;
    return { number: i + 1, dueDate: dueDateFor(startDate, i), principalAmount, interestAmount };
  });
}

/**
 * Sistema francés: cuota total constante vía la fórmula estándar de
 * anualidad, `cuota = principal × r / (1 - (1+r)^-n)`. Interés = saldo × r,
 * capital = cuota - interés, por período. El redondeo de la última cuota
 * ajusta para que el total de capital cierre exacto a `principal` — ningún
 * centavo perdido ni de más.
 */
function generateFrenchSchedule(principal: bigint, installments: number, startDate: Date, annualRatePct: number): GeneratedInstallment[] {
  const monthlyRate = annualRatePct / 12 / 100;
  const principalNum = Number(principal);

  // Tasa efectivamente cero (ej. 0.0001% redondea a 0 en la fórmula):
  // cae al reparto parejo, evita una división por cero en la anualidad.
  if (monthlyRate === 0) return generateNoneSchedule(principal, installments, startDate);

  const paymentNum = (principalNum * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -installments));

  let outstandingNum = principalNum;
  let principalAccumulated = 0n;
  const items: GeneratedInstallment[] = [];
  for (let i = 0; i < installments; i++) {
    const interestNum = outstandingNum * monthlyRate;
    const isLast = i === installments - 1;
    let principalAmount: bigint;
    let interestAmount: bigint;
    if (isLast) {
      // La última cuota se cierra sobre lo que efectivamente falta de
      // capital, no sobre el redondeo acumulado de la fórmula.
      principalAmount = principal - principalAccumulated;
      interestAmount = BigInt(Math.round(interestNum));
    } else {
      const principalNumForRow = paymentNum - interestNum;
      principalAmount = BigInt(Math.round(principalNumForRow));
      interestAmount = BigInt(Math.round(interestNum));
    }
    principalAccumulated += principalAmount;
    outstandingNum -= Number(principalAmount);
    items.push({ number: i + 1, dueDate: dueDateFor(startDate, i), principalAmount, interestAmount });
  }
  return items;
}

export function generateSchedule(system: AmortizationSystem, input: GenerateScheduleInput): GeneratedInstallment[] {
  const { principal, installments, startDate, annualRatePct } = input;
  if (installments <= 0) return [];

  const rate = annualRatePct ?? 0;
  if (system === "none" || rate <= 0) return generateNoneSchedule(principal, installments, startDate);
  if (system === "german") return generateGermanSchedule(principal, installments, startDate, rate);
  return generateFrenchSchedule(principal, installments, startDate, rate);
}
