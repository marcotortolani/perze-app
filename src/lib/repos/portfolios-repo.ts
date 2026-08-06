import { createClient } from "../supabase/client";

export interface Portfolio {
  id: string;
  householdId: string;
  name: string;
  baseCurrency: string;
  brokerAccountId: string | null;
}

/**
 * Bloque I — a diferencia de accounts/transactions, este módulo NO pasa
 * por Dexie/outbox todavía: es una simplificación de arquitectura
 * deliberada para la primera versión (inversiones se edita con mucha
 * menos frecuencia que un gasto, y el objetivo de 5s no aplica acá). Si
 * en algún momento hace falta cargar una operación sin conexión, este
 * repo es el que hay que migrar a local-first — no `trades-repo.ts` solo.
 */
export const portfoliosRepo = {
  async listForHousehold(householdId: string): Promise<Portfolio[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("portfolios")
      .select("id, household_id, name, base_currency, broker_account_id")
      .eq("household_id", householdId)
      .is("deleted_at", null);
    if (error) throw error;
    return (data ?? []).map((row) => ({ id: row.id, householdId: row.household_id, name: row.name, baseCurrency: row.base_currency, brokerAccountId: row.broker_account_id }));
  },

  async create(input: { householdId: string; name: string; baseCurrency: string; brokerAccountId: string | null; createdBy: string }): Promise<Portfolio> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("portfolios")
      .insert({
        id: crypto.randomUUID(),
        household_id: input.householdId,
        name: input.name,
        base_currency: input.baseCurrency,
        broker_account_id: input.brokerAccountId,
        created_by: input.createdBy,
      } as never)
      .select("id, household_id, name, base_currency, broker_account_id")
      .single<{ id: string; household_id: string; name: string; base_currency: string; broker_account_id: string | null }>();
    if (error) throw error;
    return { id: data.id, householdId: data.household_id, name: data.name, baseCurrency: data.base_currency, brokerAccountId: data.broker_account_id };
  },

  async rename(id: string, name: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from("portfolios").update({ name } as never).eq("id", id);
    if (error) throw error;
  },

  /** Soft delete (`deleted_at`), como el resto de las entidades raíz (`01-arquitectura-datos.md` § 1). Las operaciones cargadas no se tocan — quedan huérfanas de un portfolio invisible, nunca se borran. */
  async softDelete(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from("portfolios").update({ deleted_at: new Date().toISOString() } as never).eq("id", id);
    if (error) throw error;
  },
};
