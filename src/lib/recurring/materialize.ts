import { resolveFxForAccountCurrency } from "@/features/capture/save-transaction";
import { getDb } from "@/lib/db/client";
import type { AccountRow, HouseholdRow, RecurringRuleRow, TransactionRow } from "@/lib/db/schema";
import { convert, type ScaledRate } from "@/lib/fx/rate";
import { money, type Money } from "@/lib/money/money";
import { fxRepo } from "@/lib/repos/fx-repo";
import { transactionsRepo, type NewTransactionInput } from "@/lib/repos/transactions-repo";
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
    // Postgres — `recurringOccurrenceDate`, NUNCA `occurredAt` (una carga
    // manual tardía registra `occurredAt` con la fecha real de pago, no
    // con la del período que salda — ver `chargeRecurringNow`). INCLUYE
    // soft-deleted: si el usuario deshizo la carga, el período queda
    // ocupado y no se recrea.
    const existing = await db.transactions.where("recurringId").equals(rule.id).toArray();
    const existingDates = new Set(existing.map((t) => t.recurringOccurrenceDate ?? toDateOnly(t.occurredAt)));

    for (const occDate of occurrences) {
      if (existingDates.has(occDate)) continue;
      const row = await materializeOne(household, userId, rule, occDate, occDate);
      created.push(row);
    }
  }

  return created;
}

export interface ResolvedChargeAccount {
  /** La cuenta donde termina posando el movimiento — principal o de respaldo. */
  account: AccountRow;
  /** En la moneda de `account`. */
  amount: Money;
  original: Pick<NewTransactionInput, "originalAmount" | "originalCurrency" | "originalRate"> | null;
  usedFallback: boolean;
  /** El respaldo aplicaba (sin fondos, monedas distintas) pero no había cotización para convertir — se cargó en la principal igual. */
  fallbackSkippedNoRate: boolean;
}

/**
 * ¿Hay algo para elegir antes de cargar? Espeja las primeras tres
 * condiciones de `resolveChargeAccount()` (hay respaldo, es gasto, la
 * principal no alcanza, las monedas difieren) sin llamar a `fxRepo` — la
 * pantalla la usa para decidir si abre la preview editable de tasa/monto
 * ANTES de tocar nada. `false` acá significa que "Cargar ahora" sigue
 * siendo un solo tap: misma moneda o cuenta principal con fondos no
 * necesitan tasa que revisar.
 */
export function needsFxPreview(rule: RecurringRuleRow, primaryAccount: AccountRow, fallbackAccount: AccountRow | null): boolean {
  if (fallbackAccount === null || rule.kind !== "expense") return false;
  if (primaryAccount.currentBalance - rule.expectedAmount >= 0n) return false;
  return fallbackAccount.currencyCode !== rule.currencyCode;
}

/**
 * Decide dónde postea "Cargar ahora": la cuenta principal, salvo que le
 * falten fondos para cubrir el gasto y la regla tenga cuenta de respaldo —
 * ahí se usa esa, convertida a SU moneda con la cotización del día
 * efectivo (nunca la de la regla: "SON DOS CONVERSIONES, NO UNA",
 * `CLAUDE.md`). Solo aplica a gastos: un ingreso no puede quedar sin
 * fondos. Un solo salto — si el respaldo tampoco alcanza, se carga ahí
 * igual, no hay cadena.
 *
 * `rateOverride`: la preview editable (`ChargeFallbackPreviewSheet`) deja
 * ajustar la tasa sugerida o el monto final antes de confirmar — la
 * realidad del pago (lo que el banco/casa de cambio dio de verdad) puede
 * distar de cualquier cotización resuelta automáticamente. Si viene
 * definida, se usa tal cual y NUNCA se vuelve a resolver "por las dudas"
 * (mismo criterio que `counterFxRateOverride` en `save-transaction.ts` y
 * `pay-card.ts`) — es WYSIWYG con lo que el usuario confirmó en pantalla.
 * Sin `rateOverride` y sin cotización resuelta, el respaldo NO se aplica:
 * mejor la principal con un `needs_fx` de verdad que un movimiento en $0
 * que no mueve la plata que el usuario quiso mover.
 */
export async function resolveChargeAccount(
  householdId: string,
  rule: RecurringRuleRow,
  primaryAccount: AccountRow,
  fallbackAccount: AccountRow | null,
  effectiveDate: string,
  rateOverride?: ScaledRate | null
): Promise<ResolvedChargeAccount> {
  const ruleAmount = money(rule.expectedAmount, rule.currencyCode);
  const primary: ResolvedChargeAccount = { account: primaryAccount, amount: ruleAmount, original: null, usedFallback: false, fallbackSkippedNoRate: false };

  if (fallbackAccount === null || rule.kind !== "expense") return primary;
  if (primaryAccount.currentBalance - rule.expectedAmount >= 0n) return primary;

  if (fallbackAccount.currencyCode === rule.currencyCode) {
    return { account: fallbackAccount, amount: ruleAmount, original: null, usedFallback: true, fallbackSkippedNoRate: false };
  }

  const rate = rateOverride ?? (await fxRepo.resolve({ householdId, base: rule.currencyCode, quote: fallbackAccount.currencyCode, date: effectiveDate })).rate;
  if (rate === null) return { ...primary, fallbackSkippedNoRate: true };

  return {
    account: fallbackAccount,
    amount: convert(ruleAmount, fallbackAccount.currencyCode, rate),
    original: { originalAmount: ruleAmount.amount, originalCurrency: rule.currencyCode, originalRate: rate },
    usedFallback: true,
    fallbackSkippedNoRate: false,
  };
}

export interface ChargeRecurringNowResult {
  transaction: TransactionRow;
  usedFallback: boolean;
  fallbackSkippedNoRate: boolean;
}

/**
 * "Cargar ahora" (G1/G2) — el mismo camino que el motor automático, para
 * una regla con `autoPost = false` o para la carta de catch-up que el
 * usuario decide cargar a mano. A diferencia de `materializeDueRecurring`,
 * esto SÍ lo dispara un gesto de usuario — el caller lo envuelve en
 * `createOptimisticMutation()`.
 *
 * `occDate` (la fecha programada de la regla) y la fecha real del
 * movimiento son cosas DISTINTAS acá: con el auto-registro apagado, esa
 * fecha es un aviso/organización, no un hecho contable — el gasto/ingreso
 * ocurre administrativamente el día en que el usuario lo carga a mano, así
 * que `occurredAt` y la cotización usada son de HOY, no de `occDate`.
 * `occDate` sigue viviendo en `recurringOccurrenceDate` — es el período
 * que esta carga salda, y ahí vive toda la idempotencia.
 *
 * A diferencia del motor automático, acá SÍ puede terminar posando en la
 * cuenta de respaldo (`resolveChargeAccount`) — el automático corre sin
 * usuario presente y no hay a quién avisarle que la plata salió de otro lado.
 */
export async function chargeRecurringNow(household: HouseholdRow, userId: string, rule: RecurringRuleRow, occDate: string, todayDateOnly: string, rateOverride?: ScaledRate | null): Promise<ChargeRecurringNowResult> {
  const db = getDb();
  const primaryAccount = await db.accounts.get(rule.accountId);
  if (!primaryAccount) throw new Error("Cuenta principal del recurrente no encontrada");
  const fallbackAccount = rule.fallbackAccountId ? ((await db.accounts.get(rule.fallbackAccountId)) ?? null) : null;

  const charge = await resolveChargeAccount(household.id, rule, primaryAccount, fallbackAccount, todayDateOnly, rateOverride);
  const transaction = await materializeOne(household, userId, rule, occDate, todayDateOnly, charge);
  return { transaction, usedFallback: charge.usedFallback, fallbackSkippedNoRate: charge.fallbackSkippedNoRate };
}

async function materializeOne(household: HouseholdRow, userId: string, rule: RecurringRuleRow, occDate: string, effectiveDate: string, charge?: ResolvedChargeAccount): Promise<TransactionRow> {
  const accountId = charge?.account.id ?? rule.accountId;
  const currencyCode = charge?.account.currencyCode ?? rule.currencyCode;
  const amount = charge?.amount ?? money(rule.expectedAmount, rule.currencyCode);
  const original = charge?.original ?? { originalAmount: null, originalCurrency: null, originalRate: null };
  const fx = await resolveFxForAccountCurrency(household, currencyCode, amount, effectiveDate);

  return transactionsRepo.create({
    householdId: household.id,
    createdBy: userId,
    kind: rule.kind,
    occurredAt: occurredAtFor(effectiveDate),
    accountId,
    counterAccountId: null,
    amount: amount.amount,
    currencyCode,
    ...original,
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
    recurringOccurrenceDate: occDate,
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
