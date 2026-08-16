import type { RecurringFrequency } from "@/lib/db/schema";

/** Subconjunto de `TransactionRow` — solo lo que el detector necesita, para poder testearlo con fixtures mínimos (mismo criterio que `amountSeries` en `recurring-history.ts`). */
export interface DetectableTransaction {
  id: string;
  occurredAt: string;
  kind: string;
  amount: bigint;
  currencyCode: string;
  categoryId: string | null;
  accountId: string;
  payeeId: string | null;
  status: string;
  recurringId: string | null;
  deletedAt: string | null;
}

/** Subconjunto de `RecurringRuleRow` — solo `name`/`archivedAt`. */
export interface DetectableRule {
  name: string;
  archivedAt: string | null;
}

/**
 * Auto-detección de recurrentes (docs/00-producto.md § "Goteo de
 * suscripciones") — agrupa el historial por comercio y detecta patrones de
 * periodicidad + monto estable, para sugerir "¿creamos una regla?" en vez de
 * exigir que el usuario la arme a mano. Nunca toca `recurring_rules`: es
 * puro cálculo sobre datos ya cargados, la creación real la sigue haciendo
 * `/recurring/new` cuando el usuario confirma la sugerencia.
 */

const LOOKBACK_MONTHS = 6;
/** Menos de 3 cargos no es un patrón, es coincidencia. */
const MIN_MATCHES = 3;
/** ±15% del monto mediano — deja pasar una factura de luz que varía mes a mes. */
const AMOUNT_TOLERANCE = 0.15;

interface FrequencyWindow {
  frequency: RecurringFrequency;
  minDays: number;
  maxDays: number;
}

/** Ventanas de tolerancia en días entre cargos consecutivos, más angostas primero — así un patrón semanal no se cuela como "mensual" solo porque también cabría en una ventana más ancha. */
const FREQUENCY_WINDOWS: FrequencyWindow[] = [
  { frequency: "weekly", minDays: 5, maxDays: 9 },
  { frequency: "biweekly", minDays: 12, maxDays: 16 },
  { frequency: "monthly", minDays: 26, maxDays: 34 },
  { frequency: "yearly", minDays: 350, maxDays: 380 },
];

export interface RecurringCandidate {
  /** Identidad estable para "descartar y no volver a sugerir" — cambia solo si el patrón real cambia (otro monto, otra frecuencia). */
  key: string;
  payeeId: string;
  payeeName: string;
  kind: "expense" | "income";
  categoryId: string | null;
  accountId: string;
  currencyCode: string;
  frequency: RecurringFrequency;
  /** Solo monthly/yearly — día mediano del grupo. */
  dayOfMonth: number | null;
  expectedAmount: bigint;
  matchCount: number;
  lastOccurredAt: string;
  lastTransactionId: string;
}

function daysBetween(isoA: string, isoB: string): number {
  return Math.round((new Date(isoB).getTime() - new Date(isoA).getTime()) / 86_400_000);
}

function median(values: readonly bigint[]): bigint {
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return sorted[Math.floor(sorted.length / 2)]!;
}

function mostCommon<T>(values: readonly T[]): T | null {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | null = null;
  let bestCount = 0;
  for (const [v, count] of counts) {
    if (count > bestCount) {
      best = v;
      bestCount = count;
    }
  }
  return best;
}

function detectFrequency(sortedOccurredAt: readonly string[]): RecurringFrequency | null {
  if (sortedOccurredAt.length < MIN_MATCHES) return null;
  const gaps: number[] = [];
  for (let i = 1; i < sortedOccurredAt.length; i++) gaps.push(daysBetween(sortedOccurredAt[i - 1]!, sortedOccurredAt[i]!));

  for (const w of FREQUENCY_WINDOWS) {
    const inWindow = gaps.filter((g) => g >= w.minDays && g <= w.maxDays).length;
    // Tolera UN outlier (una carga tardía, una omitida) — el resto de los
    // gaps tiene que caer en la ventana para no confundir ruido con patrón.
    if (inWindow >= gaps.length - 1) return w.frequency;
  }
  return null;
}

/**
 * `transactions`: historial completo del household, sin filtrar — la
 * función filtra internamente por `deletedAt`/`status`/ventana de lookback,
 * pero necesita ver movimientos VIEJOS también para poder excluir comercios
 * que ya tienen una regla (aunque la carga más reciente ya esté vinculada
 * vía `recurringId` y por eso no entre al grupo de candidatos).
 */
export function detectRecurringCandidates(
  transactions: readonly DetectableTransaction[],
  payeeNameById: ReadonlyMap<string, string>,
  existingRules: readonly DetectableRule[],
  todayIso: string
): RecurringCandidate[] {
  const cutoff = (() => {
    const [y, m, d] = todayIso.split("-").map(Number);
    const date = new Date(Date.UTC(y!, m! - 1 - LOOKBACK_MONTHS, d!));
    return date.toISOString().slice(0, 10);
  })();

  // Un comercio con AL MENOS UN movimiento ya vinculado a una regla está
  // cubierto — no importa que el resto del historial (previo a crear esa
  // regla) siga suelto, no hay que volver a sugerirlo.
  const coveredPayeeIds = new Set(transactions.filter((tx) => tx.recurringId !== null && tx.payeeId).map((tx) => tx.payeeId!));
  const activeRuleNames = new Set(existingRules.filter((r) => r.archivedAt === null).map((r) => r.name.trim().toLowerCase()));

  const groups = new Map<string, DetectableTransaction[]>();
  for (const tx of transactions) {
    if (tx.deletedAt !== null || tx.status === "void") continue;
    if (tx.kind !== "expense" && tx.kind !== "income") continue;
    if (!tx.payeeId || coveredPayeeIds.has(tx.payeeId)) continue;
    if (tx.occurredAt.slice(0, 10) < cutoff) continue;
    const key = `${tx.payeeId}:${tx.kind}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tx);
  }

  const candidates: RecurringCandidate[] = [];
  for (const txs of groups.values()) {
    if (txs.length < MIN_MATCHES) continue;
    const sorted = [...txs].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const first = sorted[0]!;
    const payeeName = payeeNameById.get(first.payeeId!);
    if (!payeeName || activeRuleNames.has(payeeName.trim().toLowerCase())) continue;

    const frequency = detectFrequency(sorted.map((tx) => tx.occurredAt));
    if (!frequency) continue;

    const amounts = sorted.map((tx) => (tx.amount < 0n ? -tx.amount : tx.amount));
    const medianAmount = median(amounts);
    if (medianAmount === 0n) continue;
    const withinTolerance = amounts.every((a) => {
      const diff = a > medianAmount ? a - medianAmount : medianAmount - a;
      return Number(diff) <= Number(medianAmount) * AMOUNT_TOLERANCE;
    });
    if (!withinTolerance) continue;

    const isDayBased = frequency === "monthly" || frequency === "yearly";
    const dayOfMonth = isDayBased ? Number(median(sorted.map((tx) => BigInt(tx.occurredAt.slice(8, 10))))) : null;
    const categoryId = mostCommon(sorted.map((tx) => tx.categoryId));
    const accountId = mostCommon(sorted.map((tx) => tx.accountId))!;
    const last = sorted[sorted.length - 1]!;

    candidates.push({
      key: `${first.payeeId}:${frequency}:${medianAmount}`,
      payeeId: first.payeeId!,
      payeeName,
      kind: last.kind as "expense" | "income",
      categoryId,
      accountId,
      currencyCode: last.currencyCode,
      frequency,
      dayOfMonth,
      expectedAmount: medianAmount,
      matchCount: sorted.length,
      lastOccurredAt: last.occurredAt,
      lastTransactionId: last.id,
    });
  }

  return candidates.sort((a, b) => b.lastOccurredAt.localeCompare(a.lastOccurredAt));
}
