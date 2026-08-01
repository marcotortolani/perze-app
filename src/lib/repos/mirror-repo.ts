import { createClient } from "../supabase/client";

export interface MirrorAccount {
  id: string;
  name: string;
  currencyCode: string;
  currentBalance: string;
  kind: string;
}

export interface MirrorTransaction {
  id: string;
  accountId: string;
  amount: string;
  currencyCode: string;
  kind: string;
  occurredAt: string;
  note: string | null;
}

/**
 * J4b — modo espejo, server-side (`mirror_accounts`/`mirror_transactions`,
 * SECURITY DEFINER). Nunca amplía el acceso de quien mira: las funciones
 * validan que el llamador y el miembro espejado sean los dos miembros
 * activos del mismo household antes de devolver una sola fila.
 */
export const mirrorRepo = {
  async accounts(householdId: string, targetMemberId: string): Promise<MirrorAccount[]> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("mirror_accounts", { p_household_id: householdId, p_target_member: targetMemberId });
    if (error) throw error;
    // `current_balance` ya viaja como texto (cast explícito en la función SQL,
    // ver 20260801060100) — nunca pasa por un `number` de JS.
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      currencyCode: row.currency_code,
      currentBalance: row.current_balance,
      kind: row.kind,
    }));
  },

  async transactions(householdId: string, targetMemberId: string): Promise<MirrorTransaction[]> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("mirror_transactions", { p_household_id: householdId, p_target_member: targetMemberId });
    if (error) throw error;
    return (data ?? [])
      .map((row) => ({
        id: row.id,
        accountId: row.account_id,
        amount: row.amount,
        currencyCode: row.currency_code,
        kind: row.kind,
        occurredAt: row.occurred_at,
        note: row.note,
      }))
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
  },
};
