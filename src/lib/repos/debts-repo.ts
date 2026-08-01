import { createClient } from "../supabase/client";
import { newId } from "./ids";

export type DebtKind = "installment_plan" | "loan" | "credit_line" | "personal";
export type DebtDirection = "owe" | "owed";

export interface Debt {
  id: string;
  householdId: string;
  accountId: string | null;
  kind: DebtKind;
  name: string;
  principal: bigint;
  currencyCode: string;
  interestRate: number | null;
  termMonths: number | null;
  startDate: string;
  counterpart: string | null;
  direction: DebtDirection;
  originTransactionId: string | null;
  installmentCount: number | null;
  createdBy: string;
}

export interface DebtScheduleItem {
  id: string;
  debtId: string;
  dueDate: string;
  number: number;
  principalAmount: bigint;
  interestAmount: bigint;
  paidAt: string | null;
  transactionId: string | null;
}

/**
 * G4/G5/G6 — deudas y planes de cuotas. Vive solo en Supabase, igual que
 * tags/payees/investments: bajo volumen, no participa del camino de
 * captura de 5 segundos. `debt_schedule` es hija (Patrón B), sin
 * `household_id` propio — se llega por `debt_id`.
 */
export const debtsRepo = {
  async listByHousehold(householdId: string): Promise<Debt[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("debts")
      .select("id, household_id, account_id, kind, name, principal::text, currency_code, interest_rate, term_months, start_date, counterpart, direction, origin_transaction_id, installment_count, created_by")
      .eq("household_id", householdId)
      .is("deleted_at", null);
    if (error) throw error;
    return (data ?? []).map(fromDebtRow);
  },

  async listByAccount(accountId: string): Promise<Debt[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("debts")
      .select("id, household_id, account_id, kind, name, principal::text, currency_code, interest_rate, term_months, start_date, counterpart, direction, origin_transaction_id, installment_count, created_by")
      .eq("account_id", accountId)
      .is("deleted_at", null);
    if (error) throw error;
    return (data ?? []).map(fromDebtRow);
  },

  async get(id: string): Promise<Debt | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("debts")
      .select("id, household_id, account_id, kind, name, principal::text, currency_code, interest_rate, term_months, start_date, counterpart, direction, origin_transaction_id, installment_count, created_by")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? fromDebtRow(data) : null;
  },

  async create(input: Omit<Debt, "id">): Promise<Debt> {
    const supabase = createClient();
    const row = {
      id: newId(),
      household_id: input.householdId,
      account_id: input.accountId,
      kind: input.kind,
      name: input.name,
      principal: input.principal.toString(),
      currency_code: input.currencyCode,
      interest_rate: input.interestRate,
      term_months: input.termMonths,
      start_date: input.startDate,
      counterpart: input.counterpart,
      direction: input.direction,
      origin_transaction_id: input.originTransactionId,
      installment_count: input.installmentCount,
      created_by: input.createdBy,
    };
    const { error } = await supabase.from("debts").insert(row as never);
    if (error) throw error;
    return { ...input, id: row.id };
  },

  async archive(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from("debts").update({ deleted_at: new Date().toISOString() } as never).eq("id", id);
    if (error) throw error;
  },

  async listSchedule(debtId: string): Promise<DebtScheduleItem[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("debt_schedule")
      .select("id, debt_id, due_date, number, principal_amount::text, interest_amount::text, paid_at, transaction_id")
      .eq("debt_id", debtId)
      .order("number");
    if (error) throw error;
    return (data ?? []).map(fromScheduleRow);
  },

  async createSchedule(items: readonly Omit<DebtScheduleItem, "id">[]): Promise<void> {
    const supabase = createClient();
    const rows = items.map((item) => ({
      id: newId(),
      debt_id: item.debtId,
      due_date: item.dueDate,
      number: item.number,
      principal_amount: item.principalAmount.toString(),
      interest_amount: item.interestAmount.toString(),
      paid_at: item.paidAt,
      transaction_id: item.transactionId,
    }));
    const { error } = await supabase.from("debt_schedule").insert(rows as never[]);
    if (error) throw error;
  },

  async markInstallmentPaid(scheduleId: string, transactionId: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from("debt_schedule").update({ paid_at: new Date().toISOString(), transaction_id: transactionId } as never).eq("id", scheduleId);
    if (error) throw error;
  },
};

interface DebtRow {
  id: string;
  household_id: string;
  account_id: string | null;
  kind: string;
  name: string;
  principal: string;
  currency_code: string;
  interest_rate: number | null;
  term_months: number | null;
  start_date: string;
  counterpart: string | null;
  direction: string;
  origin_transaction_id: string | null;
  installment_count: number | null;
  created_by: string;
}

function fromDebtRow(row: DebtRow): Debt {
  return {
    id: row.id,
    householdId: row.household_id,
    accountId: row.account_id,
    kind: row.kind as DebtKind,
    name: row.name,
    principal: BigInt(row.principal),
    currencyCode: row.currency_code,
    interestRate: row.interest_rate,
    termMonths: row.term_months,
    startDate: row.start_date,
    counterpart: row.counterpart,
    direction: row.direction as DebtDirection,
    originTransactionId: row.origin_transaction_id,
    installmentCount: row.installment_count,
    createdBy: row.created_by,
  };
}

interface DebtScheduleRow {
  id: string;
  debt_id: string;
  due_date: string;
  number: number;
  principal_amount: string;
  interest_amount: string;
  paid_at: string | null;
  transaction_id: string | null;
}

function fromScheduleRow(row: DebtScheduleRow): DebtScheduleItem {
  return {
    id: row.id,
    debtId: row.debt_id,
    dueDate: row.due_date,
    number: row.number,
    principalAmount: BigInt(row.principal_amount),
    interestAmount: BigInt(row.interest_amount),
    paidAt: row.paid_at,
    transactionId: row.transaction_id,
  };
}
