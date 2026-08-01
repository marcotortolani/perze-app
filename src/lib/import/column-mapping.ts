/** K9b — mapeo de columnas: adivina qué columna cruda es fecha/detalle/importe por nombre de encabezado. */

export type ImportField = "date" | "description" | "amount";

const HEADER_PATTERNS: Record<ImportField, RegExp> = {
  date: /fecha|date|dia/i,
  description: /detalle|descripcion|description|concepto|glosa|comercio|merchant/i,
  amount: /importe|monto|amount|valor|debe|haber/i,
};

export type ColumnMapping = Partial<Record<ImportField, number>>;

/** Devuelve el índice de columna adivinado para cada campo — `undefined` si ninguna columna matchea (K9b: "con una sin resolver"). */
export function guessColumnMapping(headers: readonly string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const field of Object.keys(HEADER_PATTERNS) as ImportField[]) {
    const index = headers.findIndex((h) => HEADER_PATTERNS[field].test(h));
    if (index !== -1) mapping[field] = index;
  }
  return mapping;
}

/** Extractos bancarios traen `$`/miles con "." o ","/decimales con el otro — el separador decimal es el último signo de puntuación que aparece. */
function parseLooseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,.-]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const decimalSeparator = lastComma > lastDot ? "," : lastDot > lastComma ? "." : null;
  let normalized = cleaned;
  if (decimalSeparator) {
    const thousandSeparator = decimalSeparator === "," ? "." : ",";
    normalized = cleaned.split(thousandSeparator).join("").replace(decimalSeparator, ".");
  }
  const value = Number(normalized);
  return Number.isNaN(value) ? null : value;
}

export interface ImportedRow {
  date: string; // ISO
  description: string;
  amount: number; // major units, con signo (negativo = gasto)
}

/** Convierte filas crudas a `ImportedRow` según el mapeo — descarta filas donde falta fecha o importe. */
export function applyColumnMapping(rows: readonly string[][], mapping: ColumnMapping): ImportedRow[] {
  if (mapping.date === undefined || mapping.amount === undefined) return [];
  const result: ImportedRow[] = [];
  for (const row of rows) {
    const rawDate = row[mapping.date];
    const rawAmount = mapping.amount !== undefined ? row[mapping.amount] : undefined;
    if (!rawDate || !rawAmount) continue;
    const amount = parseLooseAmount(rawAmount);
    if (amount === null) continue;
    result.push({
      date: rawDate,
      description: mapping.description !== undefined ? (row[mapping.description] ?? "") : "",
      amount,
    });
  }
  return result;
}
