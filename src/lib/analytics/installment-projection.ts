/** E4.2/G6 — cuotas y proyección: solo lo ya comprometido, nunca una estimación de consumo nuevo. */

export interface InstallmentScheduleInput {
  debtId: string;
  dueDate: string;
  principalAmount: bigint;
  interestAmount: bigint;
  paidAt: string | null;
}

export interface InstallmentPlanSummary {
  debtId: string;
  remaining: bigint;
  monthlyAmount: bigint;
  installmentsLeft: number;
  installmentsTotal: number;
  lastDueDate: string;
}

export interface MonthBar {
  month: string; // "YYYY-MM"
  amount: bigint;
}

export interface InstallmentProjection {
  totalCommitted: bigint;
  monthlyTotal: bigint;
  lastDueDate: string | null;
  plans: InstallmentPlanSummary[];
  monthBars: MonthBar[];
}

/** Total comprometido, cuota mensual actual y el mes de la última cuota — solo con lo ya pendiente, nunca con cuotas ya pagas. */
export function computeInstallmentProjection(schedule: readonly InstallmentScheduleInput[], now: Date, monthsAhead: number): InstallmentProjection {
  const pending = schedule.filter((item) => item.paidAt === null);
  const totalCommitted = pending.reduce((sum, item) => sum + item.principalAmount + item.interestAmount, 0n);

  const byDebt = new Map<string, InstallmentScheduleInput[]>();
  for (const item of pending) {
    const list = byDebt.get(item.debtId) ?? [];
    list.push(item);
    byDebt.set(item.debtId, list);
  }

  const plans: InstallmentPlanSummary[] = [];
  for (const [debtId, items] of byDebt) {
    const sorted = [...items].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const remaining = sorted.reduce((sum, item) => sum + item.principalAmount + item.interestAmount, 0n);
    const next = sorted[0]!;
    plans.push({
      debtId,
      remaining,
      monthlyAmount: next.principalAmount + next.interestAmount,
      installmentsLeft: sorted.length,
      installmentsTotal: sorted.length + schedule.filter((s) => s.debtId === debtId && s.paidAt !== null).length,
      lastDueDate: sorted[sorted.length - 1]!.dueDate,
    });
  }

  const monthlyTotal = plans.reduce((sum, p) => sum + p.monthlyAmount, 0n);
  const lastDueDate = pending.length > 0 ? pending.map((i) => i.dueDate).sort().at(-1)! : null;

  const monthBars: MonthBar[] = [];
  for (let i = 0; i < monthsAhead; i++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
    const amount = pending.filter((item) => item.dueDate.slice(0, 7) === monthKey).reduce((sum, item) => sum + item.principalAmount + item.interestAmount, 0n);
    monthBars.push({ month: monthKey, amount });
  }

  return { totalCommitted, monthlyTotal, lastDueDate, plans, monthBars };
}
