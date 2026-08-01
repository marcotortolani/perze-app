import { createClient } from "../supabase/client";

export type SettlementMethod = "cash" | "transfer" | "forgiven" | "other";
export type SettlementStatus = "pending" | "done" | "forgiven";

export interface NewSettlementInput {
  householdId: string;
  fromMember: string;
  toMember: string;
  amount: bigint;
  currencyCode: string;
  method: SettlementMethod;
  createdBy: string;
}

export interface Settlement {
  id: string;
  fromMember: string;
  toMember: string;
  amount: bigint;
  currencyCode: string;
  method: SettlementMethod | null;
  status: SettlementStatus;
  settledAt: string | null;
}

/** J7/J10 — liquidaciones. Igual que `transaction-shares-repo.ts`: vive solo en Supabase. */
export const settlementsRepo = {
  async create(input: NewSettlementInput): Promise<Settlement> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("settlements")
      .insert({
        id: crypto.randomUUID(),
        household_id: input.householdId,
        from_member: input.fromMember,
        to_member: input.toMember,
        amount: input.amount.toString(),
        currency_code: input.currencyCode,
        fx_source: "identity",
        method: input.method,
        status: "done",
        settled_at: new Date().toISOString(),
        created_by: input.createdBy,
      } as never)
      .select("id, from_member, to_member, amount::text, currency_code, method, status, settled_at")
      .single<{
        id: string;
        from_member: string;
        to_member: string;
        amount: string;
        currency_code: string;
        method: SettlementMethod | null;
        status: SettlementStatus;
        settled_at: string | null;
      }>();
    if (error) throw error;
    return {
      id: data.id,
      fromMember: data.from_member,
      toMember: data.to_member,
      amount: BigInt(data.amount),
      currencyCode: data.currency_code,
      method: data.method,
      status: data.status,
      settledAt: data.settled_at,
    };
  },

  async listForHousehold(householdId: string): Promise<Settlement[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("settlements")
      .select("id, from_member, to_member, amount::text, currency_code, method, status, settled_at")
      .eq("household_id", householdId)
      .is("deleted_at", null)
      .order("settled_at", { ascending: false })
      .returns<
        {
          id: string;
          from_member: string;
          to_member: string;
          amount: string;
          currency_code: string;
          method: SettlementMethod | null;
          status: SettlementStatus;
          settled_at: string | null;
        }[]
      >();
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      fromMember: row.from_member,
      toMember: row.to_member,
      amount: BigInt(row.amount),
      currencyCode: row.currency_code,
      method: row.method,
      status: row.status,
      settledAt: row.settled_at,
    }));
  },
};
