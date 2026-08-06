import { createClient } from "../supabase/client";

export interface FxPreferenceRow {
  currencyPair: string;
  preferredProvider: string | null;
  preferredQuoteKind: string | null;
}

/**
 * `household_fx_preferences` en el servidor — mismo gap que
 * `fx-overrides-repo.ts`: la tabla existe desde `20260801010200_identity.sql`
 * con `PRIMARY KEY (household_id, currency_pair)` (upsert directo, no hace
 * falta bitácora — a diferencia de `fx_overrides` no es "un hecho con
 * fecha", es una preferencia de vista que se reemplaza sin más), pero
 * nunca la escribía nadie: elegir blue/CCL en un dispositivo no se veía en
 * los demás miembros del household.
 */
export const fxPreferencesRepo = {
  async listForHousehold(householdId: string): Promise<FxPreferenceRow[]> {
    const supabase = createClient();
    const { data, error } = await supabase.from("household_fx_preferences").select("currency_pair, preferred_provider, preferred_quote_kind").eq("household_id", householdId);
    if (error) throw error;
    return (data ?? []).map((r) => ({ currencyPair: r.currency_pair, preferredProvider: r.preferred_provider, preferredQuoteKind: r.preferred_quote_kind }));
  },

  async set(householdId: string, currencyPair: string, preferredProvider: string | null, preferredQuoteKind: string | null): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from("household_fx_preferences")
      .upsert({ household_id: householdId, currency_pair: currencyPair, preferred_provider: preferredProvider, preferred_quote_kind: preferredQuoteKind } as never, {
        onConflict: "household_id,currency_pair",
      });
    if (error) throw error;
  },
};
