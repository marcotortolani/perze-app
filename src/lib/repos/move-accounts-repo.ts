import { createClient } from "../supabase/client";
import { pullFromRemote } from "../offline/pull";

export interface MovePreflight {
  transactionCount: number;
  newCategories: number;
  newPayees: number;
  newTags: number;
  baseCurrencyMismatch: boolean;
  sourceBaseCurrency: string;
  targetBaseCurrency: string;
}

export interface MoveResult {
  transactionCount: number;
  newCategories: number;
  newPayees: number;
  newTags: number;
  identityCount: number;
  resetCount: number;
}

/**
 * "Sumar una cuenta al grupo" (PR 5 del plan de multi-household) —
 * mueve una o más cuentas y todo su historial de un household a otro.
 * Va directo a la RPC (`20260808120000_move_accounts_to_household.sql`),
 * nunca por el outbox: la operación clona categorías/payees/tags entre
 * households y toca potencialmente miles de filas de golpe (transactions +
 * sus splits/tags + satélites), y `transaction_splits`/`shares` ni
 * siquiera tienen espejo en Dexie hoy.
 *
 * Es **confirmable e irreversible** — la excepción a "reversible, no
 * confirmable" de CLAUDE.md, igual que sacar a un miembro del hogar o
 * cambiar la moneda base. `preflight()` alimenta esa confirmación con
 * números reales, nunca una advertencia genérica.
 */
export const moveAccountsRepo = {
  async preflight(accountIds: string[], targetHouseholdId: string): Promise<MovePreflight> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("preflight_move_accounts", {
      p_account_ids: accountIds,
      p_target_household_id: targetHouseholdId,
    });
    if (error) throw error;
    return data as unknown as MovePreflight;
  },

  /**
   * Fuerza un pull inmediato de LOS DOS households después de mover: la
   * RPC escribe directo por SQL, y el household de origen también cambió
   * (perdió las cuentas) — sin refrescar los dos, alguno de los dos
   * dispositivos activos queda mostrando datos viejos hasta el próximo
   * tick del sync loop.
   */
  async apply(accountIds: string[], sourceHouseholdId: string, targetHouseholdId: string): Promise<MoveResult> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("move_accounts_to_household", {
      p_account_ids: accountIds,
      p_target_household_id: targetHouseholdId,
    });
    if (error) throw error;
    await Promise.all([pullFromRemote(sourceHouseholdId), pullFromRemote(targetHouseholdId)]);
    return data as unknown as MoveResult;
  },
};
