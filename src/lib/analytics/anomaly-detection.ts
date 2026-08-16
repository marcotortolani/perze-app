/**
 * Detección de anomalías (auditoría técnica 16-ago-2026, gap declarado):
 * marca un MOVIMIENTO INDIVIDUAL atípico dentro de su categoría — no una
 * tendencia agregada de categoría, eso queda fuera. Método: mediana + MAD
 * (median absolute deviation), z-score modificado de Iglewicz-Hoaglin
 * (`mz = 0.6745 * (x - mediana) / MAD`) — robusto a outliers, a diferencia
 * de media+desvío estándar (un solo gasto gigante ya distorsiona la media
 * misma que se usaría para medirlo).
 *
 * Mismo molde que `recurring-detection.ts`: función pura, interfaz mínima
 * desacoplada de `TransactionRow` completo, constantes documentadas.
 */

/** Subconjunto de `TransactionRow` — solo lo que el detector necesita. */
export interface DetectableTransaction {
  id: string;
  occurredAt: string;
  kind: string;
  /** `null` = needs_fx — se excluye del cálculo y se cuenta, nunca se trata como 0 (CLAUDE.md § needs_fx). */
  amountBase: bigint | null;
  categoryId: string | null;
  deletedAt: string | null;
  status: string;
}

/** Umbral canónico del método de Iglewicz-Hoaglin para marcar un outlier. */
export const MODIFIED_Z_THRESHOLD = 3.5;
/**
 * "Realmente notable" — sin este segundo filtro, una categoría con gasto
 * muy parejo (MAD chico) dispara por diferencias de apenas unos pesos que
 * cruzan `mz >= 3.5` sin ser un monto que nadie notaría.
 */
export const NOTABLE_MULTIPLIER = 2.5;
/** Mínimo de historial declarado para este análisis (CLAUDE.md § "Mínimos de historial"). */
export const MIN_CATEGORY_TRANSACTIONS = 20;

export interface AnomalyResult {
  transactionId: string;
  categoryId: string;
  occurredAt: string;
  /** Monto real del movimiento — bigint, el que se muestra. Nunca el `Number` intermedio del cálculo. */
  amountBase: bigint;
  /** Mediana de la categoría — bigint, mismo criterio: es lo que se muestra como "tu típico". */
  medianAmountBase: bigint;
  categoryTransactionCount: number;
}

export interface AnomalyDetectionResult {
  anomalies: AnomalyResult[];
  /** `needs_fx` dentro de las categorías evaluadas — nunca se cuentan como si valieran 0. */
  excludedCount: number;
}

function sortBigints(values: readonly bigint[]): bigint[] {
  return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Mediana simple (índice del medio, sin promediar el par central en `n` par) — mismo criterio que `median()` en `recurring-detection.ts`, así el valor mostrado siempre es un monto real de la muestra, nunca un promedio sintético. */
function medianBigint(sortedValues: readonly bigint[]): bigint {
  return sortedValues[Math.floor(sortedValues.length / 2)]!;
}

/**
 * Agrupa por categoría, calcula mediana + MAD sobre `amountBase` y marca
 * como anomalía todo movimiento que cumpla las tres condiciones a la vez:
 * `mz >= MODIFIED_Z_THRESHOLD`, `monto >= NOTABLE_MULTIPLIER * mediana` y
 * la categoría tiene al menos `MIN_CATEGORY_TRANSACTIONS` movimientos.
 *
 * Solo `kind === "expense"` — un ingreso o una inversión atípicos son otra
 * pregunta, fuera de alcance acá (mismo recorte que `classifyConsumption`,
 * pero no se reusa esa función porque acá hace falta el `amountBase`
 * crudo por transacción, no un total agregado).
 */
export function detectAnomalies(transactions: readonly DetectableTransaction[]): AnomalyDetectionResult {
  const groups = new Map<string, DetectableTransaction[]>();
  let excludedCount = 0;

  for (const tx of transactions) {
    if (tx.deletedAt !== null || tx.status === "void") continue;
    if (tx.kind !== "expense") continue;
    if (!tx.categoryId) continue;
    if (tx.amountBase === null) {
      excludedCount += 1;
      continue;
    }
    if (!groups.has(tx.categoryId)) groups.set(tx.categoryId, []);
    groups.get(tx.categoryId)!.push(tx);
  }

  const anomalies: AnomalyResult[] = [];

  for (const [categoryId, txs] of groups) {
    if (txs.length < MIN_CATEGORY_TRANSACTIONS) continue;

    // Los gastos ya deberían venir negativos o positivos según convención
    // de la cuenta — la magnitud es lo que importa para "cuánto se gastó".
    const amounts = txs.map((tx) => (tx.amountBase! < 0n ? -tx.amountBase! : tx.amountBase!));
    const sortedAmounts = sortBigints(amounts);
    const medianAmount = medianBigint(sortedAmounts);

    // Number solo para la aritmética estadística intermedia (MAD implica
    // una división que rara vez es entera) — el monto que se muestra sigue
    // saliendo de `amountBase`/`medianAmount` en bigint, nunca de acá.
    const numericMedian = Number(medianAmount);
    const deviations = amounts.map((a) => Math.abs(Number(a) - numericMedian)).sort((a, b) => a - b);
    const mad = deviations[Math.floor(deviations.length / 2)] ?? 0;

    // MAD = 0 significa que la categoría no tiene variabilidad real (todos
    // los montos caen en la mitad "de abajo" de la muestra) — sin MAD no
    // hay forma robusta de medir cuán atípico es un valor, así que no se
    // puede evaluar `mz` sin dividir por cero.
    if (mad === 0) continue;

    for (const tx of txs) {
      const amount = tx.amountBase! < 0n ? -tx.amountBase! : tx.amountBase!;
      const numericAmount = Number(amount);
      const mz = (0.6745 * (numericAmount - numericMedian)) / mad;
      const isNotable = numericAmount >= NOTABLE_MULTIPLIER * numericMedian;

      if (mz >= MODIFIED_Z_THRESHOLD && isNotable) {
        anomalies.push({
          transactionId: tx.id,
          categoryId,
          occurredAt: tx.occurredAt,
          amountBase: amount,
          medianAmountBase: medianAmount,
          categoryTransactionCount: txs.length,
        });
      }
    }
  }

  return { anomalies: anomalies.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)), excludedCount };
}
