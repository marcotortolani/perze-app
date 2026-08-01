import { createClient } from "../supabase/client";
import { newId } from "./ids";

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
}

/**
 * E4 — resúmenes de tarjeta. Hija de accounts, vive solo en Supabase: es
 * dato de bajo volumen (un resumen por ciclo) sin sync local — igual que
 * payees/tags. Sin integración bancaria real, el usuario carga el resumen
 * a mano (fecha de cierre/vencimiento, monto) cuando le llega.
 */
export const cardStatementsRepo = {
  async list(accountId: string): Promise<CardStatement[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("card_statements")
      .select("id, account_id, period_start, period_end, closing_date, due_date, statement_balance::text, minimum_payment::text, currency_code, paid_amount::text, status")
      .eq("account_id", accountId)
      .order("period_start", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromRow);
  },

  async latestOpen(accountId: string): Promise<CardStatement | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("card_statements")
      .select("id, account_id, period_start, period_end, closing_date, due_date, statement_balance::text, minimum_payment::text, currency_code, paid_amount::text, status")
      .eq("account_id", accountId)
      .in("status", ["open", "closed", "overdue"])
      .order("period_start", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? fromRow(data) : null;
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
    };
    const { error } = await supabase.from("card_statements").insert(row as never);
    if (error) throw error;
    return { ...input, id: row.id };
  },

  async markPaid(id: string, paidAmount: bigint): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from("card_statements").update({ status: "paid", paid_amount: paidAmount.toString() } as never).eq("id", id);
    if (error) throw error;
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
  };
}
