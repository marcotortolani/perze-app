/** G6 — genera un cronograma parejo (cuota fija) para un plan de cuotas nuevo. Sin interés: repartir intereses reales requiere una tabla de amortización que nadie pidió todavía. */

export interface GeneratedInstallment {
  number: number;
  dueDate: string; // ISO date
  principalAmount: bigint;
  interestAmount: bigint;
}

export function generateEvenSchedule(principal: bigint, installments: number, startDate: Date): GeneratedInstallment[] {
  if (installments <= 0) return [];
  const base = principal / BigInt(installments);
  const remainder = principal - base * BigInt(installments);

  return Array.from({ length: installments }, (_, i) => {
    const dueDate = new Date(startDate.getFullYear(), startDate.getMonth() + i + 1, startDate.getDate());
    // El resto de la división entera se suma a la última cuota — el total tiene que cerrar exacto.
    const principalAmount = i === installments - 1 ? base + remainder : base;
    return { number: i + 1, dueDate: dueDate.toISOString().slice(0, 10), principalAmount, interestAmount: 0n };
  });
}
