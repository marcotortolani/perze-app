import { createClient } from "../supabase/client";
import { formatRate, parseRate, type ScaledRate } from "../fx/rate";
import { newId, todayIso } from "./ids";

export interface FxOverrideRow {
  id: string;
  householdId: string;
  baseCurrency: string;
  quoteCurrency: string;
  rate: ScaledRate;
  validFrom: string;
  createdBy: string | null;
}

/** Un día calendario antes de `iso`, en UTC — mismo criterio D10 que `todayIso()`: nunca resta sobre una hora local que pueda cruzar el día. */
function dayBefore(iso: string): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * `fx_overrides` en el servidor (01-arquitectura-datos.md § 2.6, tabla ya
 * creada con RLS desde `20260801010800_fx_overrides.sql`) — hasta acá,
 * `fx-repo.ts` solo escribía el override en Dexie: cada dispositivo/
 * miembro del household veía una cotización manual distinta, y el cron
 * `materialize_recurring_transactions()` (`perze-materialize-recurring`,
 * `20260801160000_cron_engines.sql`, que sí consulta `fx_overrides`) nunca
 * veía el override porque la tabla quedaba siempre vacía. Bitácora
 * inmutable por convención de app: nunca se pisa `rate` de una fila
 * existente, se cierra su vigencia (`valid_to`) y se abre una nueva.
 */
export const fxOverridesRepo = {
  /** Overrides vigentes (`valid_to IS NULL`) del household — para hidratar el cache local de otros dispositivos/miembros. */
  async listActive(householdId: string): Promise<FxOverrideRow[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("fx_overrides")
      .select("id, household_id, base_currency, quote_currency, rate::text, valid_from, created_by")
      .eq("household_id", householdId)
      .is("valid_to", null)
      .returns<Array<{ id: string; household_id: string; base_currency: string; quote_currency: string; rate: string; valid_from: string; created_by: string | null }>>();
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      householdId: r.household_id,
      baseCurrency: r.base_currency,
      quoteCurrency: r.quote_currency,
      rate: parseRate(r.rate),
      validFrom: r.valid_from,
      createdBy: r.created_by,
    }));
  },

  async setOverride(householdId: string, base: string, quote: string, rate: ScaledRate, createdBy: string): Promise<void> {
    const supabase = createClient();
    const today = todayIso();
    // Cierra la vigencia anterior (si hay) el día previo — nunca el mismo
    // `valid_from` que la fila nueva, o las dos coinciden en la consulta
    // "vigente hoy" del cron (`valid_from <= hoy AND valid_to >= hoy`) y
    // el orden entre ellas queda indefinido.
    const { error: closeError } = await supabase
      .from("fx_overrides")
      .update({ valid_to: dayBefore(today) } as never)
      .eq("household_id", householdId)
      .eq("base_currency", base)
      .eq("quote_currency", quote)
      .is("valid_to", null);
    if (closeError) throw closeError;

    const { error } = await supabase.from("fx_overrides").insert({
      id: newId(),
      household_id: householdId,
      base_currency: base,
      quote_currency: quote,
      rate: formatRate(rate),
      valid_from: today,
      created_by: createdBy,
    } as never);
    if (error) throw error;
  },

  /** "Quiero volver a una cotización de mercado": cierra la vigencia sin abrir una nueva. */
  async clearOverride(householdId: string, base: string, quote: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from("fx_overrides")
      .update({ valid_to: dayBefore(todayIso()) } as never)
      .eq("household_id", householdId)
      .eq("base_currency", base)
      .eq("quote_currency", quote)
      .is("valid_to", null);
    if (error) throw error;
  },
};
