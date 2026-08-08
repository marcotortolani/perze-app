import { createClient } from "../supabase/client";

export interface RemoteHouseholdSummary {
  id: string;
  name: string;
  baseCurrency: string;
  role: "owner" | "admin" | "member" | "viewer";
}

/**
 * Household switcher (PR 3 del plan de multi-household) — la lista de TODOS
 * los households del usuario, no solo el activo. Mismo motivo que
 * `household-members-remote.ts`: Dexie no la tiene completa hasta que se
 * hidrata cada household (`hydrateFromRemote({ householdId })`), así que
 * esto va directo a Supabase. `household_members_select` en RLS ya acota a
 * la propia fila — no hace falta filtrar por `profile_id` client-side, pero
 * se agrega igual para no depender solo de RLS al armar la query.
 *
 * `status='active'` — mismo criterio que `current_households()`: un
 * household del que el usuario fue `former` no debe aparecer para volver a
 * elegirlo.
 */
export async function listMyHouseholds(userId: string): Promise<RemoteHouseholdSummary[]> {
  const supabase = createClient();
  const { data: memberships, error: membershipsError } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("profile_id", userId)
    .eq("status", "active");
  if (membershipsError) throw membershipsError;
  if (!memberships || memberships.length === 0) return [];

  const roleByHouseholdId = new Map(memberships.map((m) => [m.household_id, m.role as RemoteHouseholdSummary["role"]]));
  // Sin embedded resource (`households(...)`): el shape que PostgREST
  // devuelve para una relación many-to-one no queda claro en los tipos
  // generados de este proyecto, y el resto del repo no lo usa en ningún
  // lado — dos queries simples es el patrón establecido acá.
  const { data: households, error: householdsError } = await supabase
    .from("households")
    .select("id, name, base_currency")
    .in("id", [...roleByHouseholdId.keys()])
    .is("deleted_at", null);
  if (householdsError) throw householdsError;

  return (households ?? []).map((h) => ({
    id: h.id,
    name: h.name,
    baseCurrency: h.base_currency,
    role: roleByHouseholdId.get(h.id)!,
  }));
}
