import type { ImportedRow } from "./column-mapping";

export interface ExistingTransactionForDedup {
  occurredAt: string; // ISO
  amount: bigint; // unidades mínimas, en moneda de cuenta
}

export interface DedupedRow {
  row: ImportedRow;
  isDuplicate: boolean;
}

/** K9c — un importado es "probable duplicado" si ya existe un movimiento del mismo día y mismo monto en la cuenta destino. */
export function detectDuplicates(rows: readonly ImportedRow[], existing: readonly ExistingTransactionForDedup[], decimals: number): DedupedRow[] {
  const existingKeys = new Set(existing.map((tx) => `${tx.occurredAt.slice(0, 10)}:${tx.amount.toString()}`));
  return rows.map((row) => {
    const minorUnits = BigInt(Math.round(Math.abs(row.amount) * 10 ** decimals));
    const key = `${row.date.slice(0, 10)}:${minorUnits.toString()}`;
    return { row, isDuplicate: existingKeys.has(key) };
  });
}
