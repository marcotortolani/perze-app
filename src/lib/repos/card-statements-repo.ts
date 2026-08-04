import { createClient } from "../supabase/client";
import { newId } from "./ids";
import { cardCycle } from "@/lib/analytics/card-cycle";
import type { AccountRow } from "@/lib/db/schema";

export interface CardStatement {
  id: string;
  accountId: string;
  periodStart: string;
  periodEnd: string;
  closingDate: string;
  dueDate: string;
  statementBalance: bigint;
  minimumPayment: bigint | null;
  currencyCode: string;
  paidAmount: bigint;
  status: "open" | "closed" | "paid" | "overdue";
  settlementTransactionId: string | null;
}

/**
 * E4 — resúmenes de tarjeta. Hija de accounts, vive solo en Supabase: es
 * dato de bajo volumen (un resumen por ciclo) sin sync local — igual que
 * payees/tags. El cron diario `open_card_statements()`
 * (`20260804010000_card_statement_autoopen.sql`) abre/realinea el resumen
 * del ciclo en curso de cada tarjeta y recalcula su saldo — no hay carga
 * manual. `ensureCurrentCycle()` es el mismo cálculo del lado del cliente,
 * para el caso en que el usuario pague ANTES de que el cron haya corrido
 * ese día (o la cuenta sea nueva).
 */
export const cardStatementsRepo = {
  async list(accountId: string): Promise<CardStatement[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("card_statements")
      .select("id, account_id, period_start, period_end, closing_date, due_date, statement_balance::text, minimum_payment::text, currency_code, paid_amount::text, status, settlement_transaction_id")
      .eq("account_id", accountId)
      .order("period_start", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },

  async latestOpen(accountId: string): Promise<CardStatement | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("card_statements")
      .select("id, account_id, period_start, period_end, closing_date, due_date, statement_balance::text, minimum_payment::text, currency_code, paid_amount::text, status, settlement_transaction_id")
      .eq("account_id", accountId)
      .in("status", ["open", "closed", "overdue"])
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data) : null;
  },

  /**
   * Si ya hay un resumen abierto para el ciclo actual, lo devuelve tal
   * cual. Si no, lo crea (`upsert` con `ON CONFLICT DO NOTHING` sobre
   * `(account_id, period_start)` — mismo índice de guarda que usa el
   * cron, así que dos llamadas simultáneas nunca duplican) y lo relee.
   * Nunca lanza por estar offline: `card_statements` vive solo en
   * Supabase, sin espejo en Dexie, y "pagar tarjeta" no puede depender de
   * tener señal — el caller decide seguir guardando la transferencia
   * igual si esto devuelve `null`.
   */
  async ensureCurrentCycle(card: Pick<AccountRow, "id" | "statementDay" | "dueDay" | "currencyCode">): Promise<CardStatement | null> {
    if (!card.statementDay || !card.dueDay) return null;
    try {
      const existing = await cardStatementsRepo.latestOpen(card.id);
      if (existing) return existing;

      const cycle = cardCycle(card.statementDay, card.dueDay, new Date());
      const supabase = createClient();
      const row = {
        id: newId(),
        account_id: card.id,
        period_start: cycle.periodStart,
        period_end: cycle.periodEnd,
        closing_date: cycle.closingDate,
        due_date: cycle.dueDate,
        statement_balance: "0",
        minimum_payment: null,
        currency_code: card.currencyCode,
        paid_amount: "0",
        status: "open",
      };
      const { error } = await supabase.from("card_statements").upsert(row as never, { onConflict: "account_id,period_start", ignoreDuplicates: true });
      if (error) throw error;
      return await cardStatementsRepo.latestOpen(card.id);
    } catch {
      return null;
    }
  },

  async create(input: Omit<CardStatement, "id">): Promise<CardStatement> {
    const supabase = createClient();
    const row = {
      id: newId(),
      account_id: input.accountId,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      closing_date: input.closingDate,
      due_date: input.dueDate,
      statement_balance: input.statementBalance.toString(),
      minimum_payment: input.minimumPayment?.toString() ?? null,
      currency_code: input.currencyCode,
      paid_amount: input.paidAmount.toString(),
      status: input.status,
      settlement_transaction_id: input.settlementTransactionId,
    };
    const { error } = await supabase.from("card_statements").insert(row as never);
    if (error) throw error;
    return { ...input, id: row.id };
  },

  /**
   * Liquidación real (no reemplazo): `additionalPaid` es lo aplicado en ESTA
   * transferencia, en la moneda de la tarjeta (`tx.counterAmount` cuando la
   * cuenta de origen tiene otra moneda) — se sabe cuánto costó realmente,
   * no cuánto decía el resumen. `paid_amount` acumula pagos parciales;
   * `status` pasa a `paid` solo cuando cubre el `statement_balance` nominal.
   * Si NO cubre, el estado anterior se preserva tal cual — antes esto
   * forzaba `'closed'` sin mirar de dónde venía, así que un pago parcial
   * sobre un resumen `'overdue'` lo "subía" a `'closed'`, deshaciendo el
   * trabajo de `close_overdue_card_statements()` y sacándolo del loop de
   * aviso a vencidos (`dispatch_due_notifications()`).
   */
  async markPaid(id: string, additionalPaid: bigint, transactionId: string, forcePaid = false): Promise<CardStatement> {
    const supabase = createClient();
    const { data: current, error: fetchError } = await supabase
      .from("card_statements")
      .select("statement_balance::text, paid_amount::text, status")
      .eq("id", id)
      .single();
    if (fetchError) throw fetchError;
    const row = current as unknown as { statement_balance: string; paid_amount: string; status: string };
    const newPaid = BigInt(row.paid_amount) + additionalPaid;
    const covered = newPaid >= BigInt(row.statement_balance);
    const status = covered || forcePaid ? "paid" : row.status;
    const { error } = await supabase
      .from("card_statements")
      .update({ paid_amount: newPaid.toString(), status, settlement_transaction_id: transactionId } as never)
      .eq("id", id);
    if (error) throw error;
    const updated = await supabase
      .from("card_statements")
      .select("id, account_id, period_start, period_end, closing_date, due_date, statement_balance::text, minimum_payment::text, currency_code, paid_amount::text, status, settlement_transaction_id")
      .eq("id", id)
      .single();
    if (updated.error) throw updated.error;
    return fromRow(updated.data);
  },
};

interface CardStatementRow {
  id: string;
  account_id: string;
  period_start: string;
  period_end: string;
  closing_date: string;
  due_date: string;
  statement_balance: string;
  minimum_payment: string | null;
  currency_code: string;
  paid_amount: string;
  status: string;
  settlement_transaction_id: string | null;
}

function fromRow(row: CardStatementRow): CardStatement {
  return {
    id: row.id,
    accountId: row.account_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    closingDate: row.closing_date,
    dueDate: row.due_date,
    statementBalance: BigInt(row.statement_balance),
    minimumPayment: row.minimum_payment !== null ? BigInt(row.minimum_payment) : null,
    currencyCode: row.currency_code,
    paidAmount: BigInt(row.paid_amount),
    status: row.status as CardStatement["status"],
    settlementTransactionId: row.settlement_transaction_id,
  };
}
