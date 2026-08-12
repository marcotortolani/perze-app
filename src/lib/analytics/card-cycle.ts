import type { AccountRow, AccountGroupRow, AccountKind, TransactionKind } from "@/lib/db/schema";
import type { CardStatement } from "@/lib/repos/card-statements-repo";

/** El único lugar donde se decide "esto es una tarjeta de crédito" — reemplaza los `kind === 'credit_card'` sueltos que había en cada pantalla. */
export function isCreditCardAccount(a: Pick<AccountRow, "kind">): boolean {
  return a.kind === ("credit_card" satisfies AccountKind);
}

export interface EffectiveCardCycleConfig {
  statementDay: number | null;
  dueDay: number | null;
  creditLimit: bigint | null;
  limitCurrency: string | null;
  /** `true` si la tarjeta pertenece a un grupo multi-moneda (Tanda 4). */
  isGrouped: boolean;
}

/**
 * Tanda 4 — límite y ciclo pasan a vivir en `AccountGroupRow` cuando la
 * cuenta pertenece a uno; una tarjeta sin agrupar sigue usando sus propias
 * columnas (compatibilidad, caso de una sola moneda). Gemela del `COALESCE`
 * que hace `open_card_statements()`/`confirm_card_statement()` del lado de
 * Postgres — mismo criterio, no tiene que divergir.
 */
export function effectiveCardCycleConfig(account: Pick<AccountRow, "statementDay" | "dueDay" | "creditLimit" | "currencyCode">, group: AccountGroupRow | null): EffectiveCardCycleConfig {
  if (group) {
    return {
      statementDay: group.statementDay,
      dueDay: group.dueDay,
      creditLimit: group.creditLimit,
      limitCurrency: group.limitCurrency,
      isGrouped: true,
    };
  }
  return {
    statementDay: account.statementDay,
    dueDay: account.dueDay,
    creditLimit: account.creditLimit,
    limitCurrency: account.currencyCode,
    isGrouped: false,
  };
}

/**
 * Cuentas elegibles como ORIGEN de un pago de tarjeta: no la tarjeta misma,
 * no archivada/borrada, y — el pedido explícito del usuario — nunca otra
 * tarjeta de crédito. "Pagar tarjeta con tarjeta" no es una transferencia
 * que la app tenga que habilitar.
 */
export function cardPaymentSources(accounts: readonly AccountRow[], card: Pick<AccountRow, "id">): AccountRow[] {
  return accounts.filter((a) => a.id !== card.id && a.archivedAt === null && !isCreditCardAccount(a));
}

/**
 * Cuentas elegibles como liquidación de un trade: no archivadas, y nunca una
 * tarjeta de crédito — no se puede liquidar la compra de un instrumento con
 * una tarjeta en este modelo. `currentAccountId` es la salida para un trade
 * VIEJO que ya quedó apuntando a una tarjeta (de antes de esta regla): esa
 * cuenta se mantiene visible y seleccionable al editar, para no dejar la
 * edición en un callejón sin salida — pero una vez que se elige otra, no se
 * puede volver a una tarjeta.
 */
export function tradeSettlementAccounts(accounts: readonly AccountRow[], currentAccountId: string | null): AccountRow[] {
  return accounts.filter((a) => a.id === currentAccountId || (a.archivedAt === null && !isCreditCardAccount(a)));
}

export interface CardCycle {
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
  closingDate: string;
  dueDate: string;
}

function clampedDate(year: number, month0: number, day: number): Date {
  // Mismo criterio que `clamped_date()` en `20260801160000_cron_engines.sql`:
  // cae al último día real del mes en vez de reventar con un "31 de
  // febrero". `month0` es 0-indexado (convención de `Date`).
  const lastDayOfMonth = new Date(year, month0 + 1, 0).getDate();
  return new Date(year, month0, Math.min(day, lastDayOfMonth));
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Gemela exacta de `card_statement_cycle()` (SQL,
 * `20260804010000_card_statement_autoopen.sql`) — mismo comentario en las
 * dos, para que el cálculo del cliente (usado en `PayCardSheet` cuando
 * todavía no hay fila de `card_statements`) y el del cron nunca diverjan.
 * Regla del vencimiento: si el `dueDay` calculado en el mes del cierre cae
 * ANTES del cierre, el vencimiento pasa al mes siguiente.
 */
export function cardCycle(statementDay: number, dueDay: number, ref: Date): CardCycle {
  const refClampedThisMonth = clampedDate(ref.getFullYear(), ref.getMonth(), statementDay);
  const periodStartDate =
    refClampedThisMonth <= ref
      ? refClampedThisMonth
      : clampedDate(ref.getFullYear(), ref.getMonth() - 1, statementDay);

  const nextMonth = new Date(periodStartDate.getFullYear(), periodStartDate.getMonth() + 1, 1);
  const closingDate = clampedDate(nextMonth.getFullYear(), nextMonth.getMonth(), statementDay);
  closingDate.setDate(closingDate.getDate() - 1);

  const dueCandidate = clampedDate(closingDate.getFullYear(), closingDate.getMonth(), dueDay);
  const dueDate =
    dueCandidate < closingDate
      ? clampedDate(closingDate.getFullYear(), closingDate.getMonth() + 1, dueDay)
      : dueCandidate;

  return {
    periodStart: toIso(periodStartDate),
    periodEnd: toIso(closingDate),
    closingDate: toIso(closingDate),
    dueDate: toIso(dueDate),
  };
}

/** Cuándo empieza el ciclo en curso — usado como fallback cuando no hay `statementDay` (cae al 1ro del mes). */
export function currentCycleStart(statementDay: number | null, now: Date): Date {
  if (!statementDay) return new Date(now.getFullYear(), now.getMonth(), 1);
  const start = new Date(now.getFullYear(), now.getMonth(), statementDay);
  if (start > now) start.setMonth(start.getMonth() - 1);
  return start;
}

export interface CycleExpenseInput {
  kind: TransactionKind;
  amount: bigint;
  occurredAt: string;
  deletedAt?: string | null;
}

/**
 * Misma suma con signo que el `UPDATE` de `open_card_statements()` (SQL):
 * `expense` suma, `income` resta, `adjustment` resta, `transfer` se
 * ignora (los pagos van a `paid_amount`, no a `statement_balance`). Nunca
 * usa `amount_base` — el saldo de una cuenta de tarjeta ya está en su
 * propia moneda (CLAUDE.md § dinero, "dos conversiones, no una").
 *
 * `investing` espeja a `adjustment` (`total -= tx.amount`): el monto ya
 * lleva el signo (negativo en una compra), así que restarlo aumenta la
 * deuda igual que un gasto. Solo puede aparecer acá por una liquidación
 * vieja que quedó apuntando a una tarjeta — desde `tradeSettlementAccounts`
 * ninguna liquidación nueva puede elegir una tarjeta como cuenta.
 */
export function cycleExpenseTotal(transactions: readonly CycleExpenseInput[], periodStart: string, closingDateExclusive: string): bigint {
  let total = 0n;
  for (const tx of transactions) {
    if (tx.deletedAt) continue;
    if (tx.occurredAt < periodStart || tx.occurredAt >= closingDateExclusive) continue;
    if (tx.kind === "expense") total += tx.amount;
    else if (tx.kind === "income") total -= tx.amount;
    else if (tx.kind === "adjustment" || tx.kind === "investing") total -= tx.amount;
  }
  return total;
}

/**
 * Cuánto falta pagar hoy. Sin resumen (todavía no corrió el cron, o la
 * cuenta no tiene `statementDay`/`dueDay` configurados): `-currentBalance`,
 * la deuda acumulada real de la cuenta — el fallback que ya usaba
 * `accounts/[id]/page.tsx` (`card/page.tsx` tenía uno distinto, `cycleTotal`,
 * que ignoraba saldo arrastrado de ciclos previos sin resumen; se unifica
 * al más correcto).
 *
 * Con resumen: nunca menos que `-currentBalance`. `statement.statementBalance`
 * es la suma de UN ciclo (`period_start`↔`closing_date`) — si ese resumen
 * se abrió después de que ya hubiera consumos previos sin pagar (deuda
 * arrastrada de un ciclo anterior, o el primer `open_card_statements()`
 * corriendo sobre una cuenta con historial), el resumen puede quedar por
 * DEBAJO de la deuda real. `currentBalance` es el saldo íntegro de la
 * cuenta — nunca miente — así que sirve de piso: nunca se sugiere pagar
 * menos de lo que la cuenta diga que se debe en total, aunque el resumen
 * del ciclo diga otra cosa.
 */
export function expectedDueAmount(card: Pick<AccountRow, "currentBalance">, statement: CardStatement | null): bigint {
  const fromBalance = -card.currentBalance;
  if (!statement) return fromBalance;
  const fromStatement = statement.statementBalance - statement.paidAmount;
  return fromStatement > fromBalance ? fromStatement : fromBalance;
}
