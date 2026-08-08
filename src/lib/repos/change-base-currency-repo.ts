import { createClient } from "../supabase/client";
import { pullFromRemote } from "../offline/pull";

export interface BaseCurrencyPreflight {
  changed: boolean;
  identityCount: number;
  resetCount: number;
  settlementsIdentityCount: number;
  settlementsResetCount: number;
}

/**
 * PR 4 del plan de multi-household — cambiar `households.base_currency`
 * cuando ya hay movimientos. `householdsRepo.update()` (el camino genérico
 * de household, vía outbox) NO sirve acá: reescribía la columna sin tocar
 * un solo `amount_base`, dejando todo el histórico congelado contra la
 * base vieja pero rotulado con la nueva — corrupción silenciosa de todos
 * los agregados. La RPC `change_household_base_currency`
 * (`20260808110000_change_base_currency_refx.sql`) hace las dos cosas
 * atómicamente del lado servidor: nunca recalcula un `fx_rate` ya resuelto
 * (lo descarta a `pending`, que es la transición legítima), y resuelve
 * gratis a identidad lo que ya está en la moneda nueva.
 *
 * Va directo a Supabase, no por el outbox: la operación toca potencialmente
 * miles de filas de golpe (transactions + sus splits/shares + settlements),
 * y transaction_splits/shares ni siquiera tienen espejo en Dexie hoy (ver
 * `resolve-pending-fx.ts`) — no hay forma de hacerlo enteramente client-side.
 */
export const changeBaseCurrencyRepo = {
  async preflight(householdId: string, newBaseCurrency: string): Promise<BaseCurrencyPreflight> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("preflight_change_base_currency", {
      p_household_id: householdId,
      p_new_base_currency: newBaseCurrency,
    });
    if (error) throw error;
    return data as unknown as BaseCurrencyPreflight;
  },

  /**
   * Ejecuta el cambio y fuerza un pull inmediato: la RPC escribe directo
   * por SQL, nunca por el outbox del cliente, así que sin este pull el
   * Dexie local (households + transactions) queda mostrando fx_rate/
   * amount_base viejos hasta el próximo tick del sync loop (~30s).
   */
  async apply(householdId: string, newBaseCurrency: string): Promise<BaseCurrencyPreflight> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("change_household_base_currency", {
      p_household_id: householdId,
      p_new_base_currency: newBaseCurrency,
    });
    if (error) throw error;
    await pullFromRemote(householdId);
    return data as unknown as BaseCurrencyPreflight;
  },
};
