import { resolveFxForAccountCurrency } from "@/features/capture/save-transaction";
import { getDb } from "@/lib/db/client";
import type { HouseholdRow, RecurringRuleRow, TransactionRow } from "@/lib/db/schema";
import { money } from "@/lib/money/money";
import { transactionsRepo } from "@/lib/repos/transactions-repo";
import { occurredAtFor, occurrencesBetween } from "./occurrences";

/** Dos períodos completos sea cual sea `period_start_day` — espejo de la constante SQL en `20260805000000_recurring_v3.sql`. */
export const RECURRING_LOOKBACK_DAYS = 62;
/** Tope por regla por corrida — evita que un usuario que vuelve después de meses reciba una avalancha silenciosa. */
export const RECURRING_MAX_PER_RUN = 6;

function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function addDays(dateOnly: string, days: number): string {
  const [y, m, d] = dateOnly.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + days));
  return dt.toISOString().slice(0, 10);
}

/**
 * Materializa las ocurrencias vencidas de las reglas con `autoPost` — motor
 * cliente, hermano del `materialize_recurring_transactions()` de Postgres
 * (`supabase/migrations/20260805000000_recurring_v3.sql`). Corren los dos:
 * el cron solo se rompe si el proyecto gratuito de Supabase está pausado
 * (`CLAUDE.md`), y el cliente solo deja a otro miembro del household sin
 * ver nada hasta que el dueño de la regla abra la app. La idempotencia real
 * la da el índice único `transactions_recurring_occurrence_uniq` — acá se
 * imita contra Dexie con la misma clave `(recurringId, fecha)`.
 *
 * No pasa por `createOptimisticMutation()`: no hay gesto de usuario ni
 * snapshot al que volver — sigue el precedente de `payCard()`
 * (`src/features/cards/pay-card.ts`), que también llama al repo directo.
 */
export async function materializeDueRecurring(household: HouseholdRow, userId: string, todayDateOnly: string): Promise<TransactionRow[]> {
  const db = getDb();
  const rules = await db.recurringRules.where("householdId").equals(household.id).toArray();
  const created: TransactionRow[] = [];

  for (const rule of rules) {
    if (rule.archivedAt !== null || !rule.autoPost) continue;

    const floor = maxDate([rule.anchorDate, addDays(todayDateOnly, -RECURRING_LOOKBACK_DAYS), rule.anchorDate]);
    const ceiling = minDate([todayDateOnly, rule.endDate ?? todayDateOnly]);
    if (floor > ceiling) continue;

    const occurrences = occurrencesBetween(
      { frequency: rule.frequency, anchorDate: rule.anchorDate, dayOfMonth: rule.dayOfMonth, endDate: rule.endDate },
      floor,
      ceiling
    ).slice(0, RECURRING_MAX_PER_RUN);
    if (occurrences.length === 0) continue;

    // Idempotencia contra Dexie, misma clave que el índice único de
    // Postgres — INCLUYENDO soft-deleted: si el usuario deshizo la carga,
    // la fecha queda ocupada y no se recrea.
    const existing = await db.transactions.where("recurringId").equals(rule.id).toArray();
    const existingDates = new Set(existing.map((t) => toDateOnly(t.occurredAt)));

    for (const occDate of occurrences) {
      if (existingDates.has(occDate)) continue;
      const row = await materializeOne(household, userId, rule, occDate);
      created.push(row);
    }
  }

  return created;
}

/**
 * "Cargar ahora" (G1/G2) — el mismo camino que el motor automático, para
 * una regla con `autoPost = false` o para la carta de catch-up que el
 * usuario decide cargar a mano. A diferencia de `materializeDueRecurring`,
 * esto SÍ lo dispara un gesto de usuario — el caller lo envuelve en
 * `createOptimisticMutation()`.
 */
export async function chargeRecurringNow(household: HouseholdRow, userId: string, rule: RecurringRuleRow, occDate: string): Promise<TransactionRow> {
  return materializeOne(household, userId, rule, occDate);
}

async function materializeOne(household: HouseholdRow, userId: string, rule: RecurringRuleRow, occDate: string): Promise<TransactionRow> {
  const amount = money(rule.expectedAmount, rule.currencyCode);
  const fx = await resolveFxForAccountCurrency(household, rule.currencyCode, amount, occDate);

  return transactionsRepo.create({
    householdId: household.id,
    createdBy: userId,
    kind: rule.kind,
    occurredAt: occurredAtFor(occDate),
    accountId: rule.accountId,
    counterAccountId: null,
    amount: rule.expectedAmount,
    currencyCode: rule.currencyCode,
    originalAmount: null,
    originalCurrency: null,
    originalRate: null,
    fxRate: fx.fxRate,
    fxSource: fx.fxSource,
    fxProvider: fx.fxProvider,
    fxQuoteKind: fx.fxQuoteKind,
    fxResolvedAt: fx.fxResolvedAt,
    amountBase: fx.amountBase,
    counterAmount: null,
    counterCurrencyCode: null,
    counterFxRate: null,
    categoryId: rule.categoryId,
    payeeId: null,
    note: null,
    attachments: [],
    location: null,
    status: "cleared",
    visibility: "household",
    recurringId: rule.id,
    installmentGroupId: null,
    installmentNumber: null,
    installmentTotal: null,
    source: "recurring",
  });
}

function maxDate(dates: string[]): string {
  return dates.reduce((a, b) => (a > b ? a : b));
}

function minDate(dates: string[]): string {
  return dates.reduce((a, b) => (a < b ? a : b));
}
