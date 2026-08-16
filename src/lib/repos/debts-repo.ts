import { createClient } from "../supabase/client";
import { newId } from "./ids";
import { generateSchedule, type AmortizationSystem } from "../analytics/installment-schedule";

export type { AmortizationSystem } from "../analytics/installment-schedule";
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
  amortizationSystem: AmortizationSystem;
  createdBy: string;
}

/**
 * Campos editables desde `debts/[id]/edit` — no capital ni fecha de
 * inicio (`principal`/`startDate`): si ya hay cuotas pagadas, esos dos
 * valores son la base sobre la que se calculó lo ya pago y tocarlos
 * corrompería el historial, mismo principio que `fx_rate` nunca se
 * recalcula. `installments` reemplaza tanto `installment_count` como
 * `term_months` — hoy nacen sincronizados y no hay un caso real donde
 * difieran.
 */
export interface DebtUpdatePatch {
  name?: string;
  accountId?: string | null;
  interestRate?: number | null;
  amortizationSystem?: AmortizationSystem;
  installments?: number;
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
      .select("id, household_id, account_id, kind, name, principal::text, currency_code, interest_rate, term_months, start_date, counterpart, direction, origin_transaction_id, installment_count, amortization_system, created_by")
      .eq("household_id", householdId)
      .is("deleted_at", null);
    if (error) throw error;
    return (data ?? []).map(fromDebtRow);
  },

  async listByAccount(accountId: string): Promise<Debt[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("debts")
      .select("id, household_id, account_id, kind, name, principal::text, currency_code, interest_rate, term_months, start_date, counterpart, direction, origin_transaction_id, installment_count, amortization_system, created_by")
      .eq("account_id", accountId)
      .is("deleted_at", null);
    if (error) throw error;
    return (data ?? []).map(fromDebtRow);
  },

  async get(id: string): Promise<Debt | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("debts")
      .select("id, household_id, account_id, kind, name, principal::text, currency_code, interest_rate, term_months, start_date, counterpart, direction, origin_transaction_id, installment_count, amortization_system, created_by")
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
      amortization_system: input.amortizationSystem,
      created_by: input.createdBy,
    };
    const { error } = await supabase.from("debts").insert(row as never);
    if (error) throw error;
    return { ...input, id: row.id };
  },

  /**
   * Actualiza los campos editables de una deuda. Si el patch toca algo
   * que afecta el cronograma (tasa, sistema o cantidad de cuotas),
   * regenera las cuotas PENDIENTES — las ya pagadas (`paid_at IS NOT
   * NULL`) se congelan, nunca se tocan, mismo principio que `fx_rate`.
   * El capital que queda se recalcula como `principal - Σ
   * principalAmount` de las cuotas pagadas, y las nuevas cuotas
   * arrancan después del último vencimiento ya pago (o de `start_date`
   * si no hay ninguna paga todavía).
   */
  async update(id: string, patch: DebtUpdatePatch): Promise<void> {
    const supabase = createClient();
    const current = await this.get(id);
    if (!current) return;

    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.accountId !== undefined) row.account_id = patch.accountId;
    if (patch.interestRate !== undefined) row.interest_rate = patch.interestRate;
    if (patch.amortizationSystem !== undefined) row.amortization_system = patch.amortizationSystem;
    if (patch.installments !== undefined) {
      row.installment_count = patch.installments;
      row.term_months = patch.installments;
    }

    const { error } = await supabase.from("debts").update(row as never).eq("id", id);
    if (error) throw error;

    const affectsSchedule = patch.interestRate !== undefined || patch.amortizationSystem !== undefined || patch.installments !== undefined;
    if (!affectsSchedule) return;

    const schedule = await this.listSchedule(id);
    if (schedule.length === 0) return; // nunca hubo cronograma (kind sin cuotas) — nada que regenerar.

    const paidItems = schedule.filter((item) => item.paidAt !== null);
    const paidPrincipal = paidItems.reduce((sum, item) => sum + item.principalAmount, 0n);
    const remainingPrincipal = current.principal - paidPrincipal;

    const totalInstallments = patch.installments ?? current.installmentCount ?? schedule.length;
    const remainingInstallments = totalInstallments - paidItems.length;

    if (remainingInstallments <= 0 || remainingPrincipal <= 0n) {
      await this.replacePendingSchedule(id, []);
      return;
    }

    // Base de fechas: sigue desde el último vencimiento ya pago, o desde
    // `start_date` si todavía no se pagó ninguna cuota — mediodía UTC
    // para evitar el corrimiento de huso al parsear el string ISO.
    const lastPaidDueDate = paidItems.length > 0 ? [...paidItems].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).at(-1)!.dueDate : current.startDate;
    const [y, m, d] = lastPaidDueDate.split("-").map(Number) as [number, number, number];
    const baseDate = new Date(Date.UTC(y, m - 1, d, 12));

    const system = patch.amortizationSystem ?? current.amortizationSystem;
    const rate = patch.interestRate !== undefined ? patch.interestRate : current.interestRate;

    const generated = generateSchedule(system, { principal: remainingPrincipal, installments: remainingInstallments, startDate: baseDate, annualRatePct: rate });
    const nextNumber = paidItems.length;
    const items = generated.map((g) => ({ dueDate: g.dueDate, number: nextNumber + g.number, principalAmount: g.principalAmount, interestAmount: g.interestAmount }));
    await this.replacePendingSchedule(id, items);
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

  /**
   * Marcar/desmarcar una cuota pagada a mano — fuera del flujo de pago de
   * tarjeta (`pay-card.ts`), que es hoy el único lugar que llama a
   * `markInstallmentPaid`. Sin `transactionId`: es una marca manual, no
   * un movimiento real vinculado.
   */
  async markInstallmentPaidManually(scheduleId: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from("debt_schedule").update({ paid_at: new Date().toISOString() } as never).eq("id", scheduleId);
    if (error) throw error;
  },

  async unmarkInstallmentPaid(scheduleId: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from("debt_schedule").update({ paid_at: null, transaction_id: null } as never).eq("id", scheduleId);
    if (error) throw error;
  },

  /**
   * Reemplaza SOLO las cuotas pendientes (`paid_at IS NULL`) de una
   * deuda — usado por `update()` al regenerar el cronograma. Las pagadas
   * nunca se borran ni se tocan acá.
   */
  async replacePendingSchedule(debtId: string, items: readonly Omit<DebtScheduleItem, "id" | "debtId" | "paidAt" | "transactionId">[]): Promise<void> {
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("debt_schedule").delete().eq("debt_id", debtId).is("paid_at", null);
    if (deleteError) throw deleteError;
    if (items.length === 0) return;
    const rows = items.map((item) => ({
      id: newId(),
      debt_id: debtId,
      due_date: item.dueDate,
      number: item.number,
      principal_amount: item.principalAmount.toString(),
      interest_amount: item.interestAmount.toString(),
      paid_at: null,
      transaction_id: null,
    }));
    const { error } = await supabase.from("debt_schedule").insert(rows as never[]);
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
  amortization_system: string;
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
    amortizationSystem: row.amortization_system as AmortizationSystem,
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
