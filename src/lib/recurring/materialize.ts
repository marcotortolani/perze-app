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

    // Sin cuenta (borrada localmente pero la regla no sincronizó todavía) no
    // hay dónde postear — se salta, el próximo pull la resuelve o la regla
    // se termina archivando.
    const account = await db.accounts.get(rule.accountId);
    if (!account) continue;

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
      // Sin usuario presente el motor automático nunca usa la cuenta de
      // respaldo (ver docstring de `resolveChargeAccount`) — sólo resuelve
      // la conversión regla→principal, a la fecha de ESTA ocurrencia
      // (un catch-up de 3 meses atrás no puede usar la cotización de hoy).
      const { amount, original } = await convertRuleAmountToAccount(household.id, rule, account, occDate);
      const row = await materializeOne(household, userId, rule, occDate, occDate, {
        account,
        amount,
        original,
        usedFallback: false,
        fallbackSkippedNoRate: false,
      });
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
 * Primera conversión de un recurrente: `rule.currencyCode` (lo pactado,
 * "el alquiler vale $U 25.000") → la moneda de la cuenta donde termina
 * posando el movimiento (lo que sale de verdad). Espejo directo de la
 * rama de captura de `saveDraftAsTransaction()`
 * (`src/features/capture/save-transaction.ts`) — misma regla, "SON DOS
 * CONVERSIONES, NO UNA" (`CLAUDE.md`): esto es la primera; la segunda (a
 * moneda base) la resuelve `resolveFxForAccountCurrency()` en
 * `materializeOne()`, aparte.
 *
 * `amountOverride` reemplaza `rule.expectedAmount` como el monto pactado —
 * lo usa la confirmación manual cuando el usuario corrige el número de
 * origen (un servicio variable: la boleta de UTE no es la que se esperaba).
 * `rateOverride` gana siempre sobre lo resuelto, igual que
 * `captureFxRateOverride` en la captura normal.
 *
 * Misma moneda: sin conversión, terna en `null`. Con tasa: convierte y
 * completa la terna. Sin tasa disponible: **nunca reinterpreta el número
 * como si ya estuviera en la moneda de la cuenta** (A3 de
 * `save-transaction.ts`) — el monto queda en 0 y la terna se guarda con
 * `originalRate: null`, que dispara `needs_capture_fx` en Postgres.
 */
export async function convertRuleAmountToAccount(
  householdId: string,
  rule: RecurringRuleRow,
  account: AccountRow,
  effectiveDate: string,
  rateOverride?: ScaledRate | null,
  amountOverride?: bigint | null
): Promise<{ amount: Money; original: Pick<NewTransactionInput, "originalAmount" | "originalCurrency" | "originalRate"> | null }> {
  const ruleAmount = money(amountOverride ?? rule.expectedAmount, rule.currencyCode);
  if (rule.currencyCode === account.currencyCode) return { amount: ruleAmount, original: null };

  const rate = rateOverride ?? (await fxRepo.resolve({ householdId, base: rule.currencyCode, quote: account.currencyCode, date: effectiveDate })).rate;
  if (rate === null) {
    return {
      amount: money(0n, account.currencyCode),
      original: { originalAmount: ruleAmount.amount, originalCurrency: rule.currencyCode, originalRate: null },
    };
  }

  return {
    amount: convert(ruleAmount, account.currencyCode, rate),
    original: { originalAmount: ruleAmount.amount, originalCurrency: rule.currencyCode, originalRate: rate },
  };
}

/**
 * A qué cuenta cae el cargo, sin resolver ninguna tasa — mismo criterio de
 * fondos que `resolveChargeAccount()` (ver su comentario sobre por qué el
 * respaldo sólo se evalúa cuando la regla ya comparte moneda con la
 * principal). La usan `needsChargePreview()` y la pantalla de detalle,
 * para saber qué cuenta mostrarle al usuario en el sheet de confirmación
 * ANTES de resolver nada — las dos tienen que coincidir siempre con lo que
 * termine eligiendo `resolveChargeAccount`.
 */
export function chargeTargetAccount(rule: RecurringRuleRow, primaryAccount: AccountRow, fallbackAccount: AccountRow | null): AccountRow {
  if (fallbackAccount === null || rule.kind !== "expense" || rule.currencyCode !== primaryAccount.currencyCode) {
    return primaryAccount;
  }
  const usesFallback = primaryAccount.currentBalance - rule.expectedAmount < 0n;
  return usesFallback ? fallbackAccount : primaryAccount;
}

/**
 * ¿Hay algo para elegir antes de cargar? La pantalla la usa para decidir
 * si abre la preview editable de tasa/monto ANTES de tocar nada. Aparece
 * siempre que la moneda de la cuenta donde va a caer el cargo
 * (`chargeTargetAccount`) difiera de la de la regla — sea la principal
 * (alquiler/servicios pactados en otra moneda, el caso nuevo) o el
 * respaldo (el caso que ya existía). `false` acá significa que "Cargar
 * ahora" sigue siendo un solo tap.
 */
export function needsChargePreview(rule: RecurringRuleRow, primaryAccount: AccountRow, fallbackAccount: AccountRow | null): boolean {
  return chargeTargetAccount(rule, primaryAccount, fallbackAccount).currencyCode !== rule.currencyCode;
}

/**
 * Decide dónde postea "Cargar ahora" y en qué moneda, con las dos
 * conversiones que puede necesitar: `rule.currencyCode → account.currencyCode`
 * (`convertRuleAmountToAccount`, arriba) siempre, y de ahí encima la
 * decisión de cuenta.
 *
 * La cuenta es la principal, salvo que le falten fondos para cubrir el
 * gasto y la regla tenga cuenta de respaldo — ahí se usa esa, convertida a
 * SU moneda con la cotización del día efectivo. Solo aplica a gastos: un
 * ingreso no puede quedar sin fondos. Un solo salto — si el respaldo
 * tampoco alcanza, se carga ahí igual, no hay cadena.
 *
 * El respaldo **solo se evalúa cuando la regla ya comparte moneda con la
 * principal** — es la única forma de comparar fondos sin resolver una
 * tasa primero, y es la misma condición que espeja `needsChargePreview`.
 * Si la regla está en otra moneda que la principal, el cargo va directo
 * ahí (con su propia conversión) y el respaldo, si existe, no entra en
 * juego — combinar las dos cosas (regla en una tercera moneda, respaldo en
 * otra distinta) queda fuera de alcance.
 *
 * `rateOverride`: la preview editable (`ChargeRecurringPreviewSheet`) deja
 * ajustar la tasa sugerida o el monto final antes de confirmar — la
 * realidad del pago (lo que el banco/casa de cambio dio de verdad) puede
 * distar de cualquier cotización resuelta automáticamente. Si viene
 * definida, se usa tal cual y NUNCA se vuelve a resolver "por las dudas"
 * (mismo criterio que `counterFxRateOverride` en `save-transaction.ts` y
 * `pay-card.ts`) — es WYSIWYG con lo que el usuario confirmó en pantalla.
 * Sin `rateOverride` y sin cotización resuelta, el respaldo NO se aplica:
 * mejor la principal con un `needs_fx`/`needs_capture_fx` de verdad que un
 * movimiento en $0 que no mueve la plata que el usuario quiso mover.
 *
 * `amountOverride`: el monto de origen corregido (servicio variable) —
 * ver `convertRuleAmountToAccount`.
 */
export async function resolveChargeAccount(
  householdId: string,
  rule: RecurringRuleRow,
  primaryAccount: AccountRow,
  fallbackAccount: AccountRow | null,
  effectiveDate: string,
  rateOverride?: ScaledRate | null,
  amountOverride?: bigint | null
): Promise<ResolvedChargeAccount> {
  const chargeToPrimary = async (fallbackSkippedNoRate = false): Promise<ResolvedChargeAccount> => {
    const { amount, original } = await convertRuleAmountToAccount(householdId, rule, primaryAccount, effectiveDate, rateOverride, amountOverride);
    return { account: primaryAccount, amount, original, usedFallback: false, fallbackSkippedNoRate };
  };

  if (fallbackAccount === null || rule.kind !== "expense" || rule.currencyCode !== primaryAccount.currencyCode) {
    return chargeToPrimary();
  }
  if (primaryAccount.currentBalance - rule.expectedAmount >= 0n) return chargeToPrimary();

  const ruleAmount = money(amountOverride ?? rule.expectedAmount, rule.currencyCode);
  if (fallbackAccount.currencyCode === rule.currencyCode) {
    return { account: fallbackAccount, amount: ruleAmount, original: null, usedFallback: true, fallbackSkippedNoRate: false };
  }

  const rate = rateOverride ?? (await fxRepo.resolve({ householdId, base: rule.currencyCode, quote: fallbackAccount.currencyCode, date: effectiveDate })).rate;
  if (rate === null) return chargeToPrimary(true);

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
 *
 * `amountOverride`: el monto de origen que el usuario corrigió en
 * `ChargeRecurringPreviewSheet` (servicio variable) — decisión de producto:
 * confirmar con un monto distinto actualiza `expectedAmount` de la regla,
 * pero esa escritura la hace el caller (`recurring/[id]/page.tsx`) después
 * de esta llamada, no acá — esta función sólo crea el movimiento.
 */
export async function chargeRecurringNow(
  household: HouseholdRow,
  userId: string,
  rule: RecurringRuleRow,
  occDate: string,
  todayDateOnly: string,
  rateOverride?: ScaledRate | null,
  amountOverride?: bigint | null
): Promise<ChargeRecurringNowResult> {
  const db = getDb();
  const primaryAccount = await db.accounts.get(rule.accountId);
  if (!primaryAccount) throw new Error("Cuenta principal del recurrente no encontrada");
  const fallbackAccount = rule.fallbackAccountId ? ((await db.accounts.get(rule.fallbackAccountId)) ?? null) : null;

  const charge = await resolveChargeAccount(household.id, rule, primaryAccount, fallbackAccount, todayDateOnly, rateOverride, amountOverride);
  const transaction = await materializeOne(household, userId, rule, occDate, todayDateOnly, charge);
  return { transaction, usedFallback: charge.usedFallback, fallbackSkippedNoRate: charge.fallbackSkippedNoRate };
}

async function materializeOne(household: HouseholdRow, userId: string, rule: RecurringRuleRow, occDate: string, effectiveDate: string, charge: ResolvedChargeAccount): Promise<TransactionRow> {
  const original = charge.original ?? { originalAmount: null, originalCurrency: null, originalRate: null };
  const fx = await resolveFxForAccountCurrency(household, charge.account.currencyCode, charge.amount, effectiveDate);

  return transactionsRepo.create({
    householdId: household.id,
    createdBy: userId,
    kind: rule.kind,
    occurredAt: occurredAtFor(effectiveDate),
    accountId: charge.account.id,
    counterAccountId: null,
    amount: charge.amount.amount,
    currencyCode: charge.account.currencyCode,
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
