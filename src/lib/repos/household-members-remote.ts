import { createClient } from "../supabase/client";

export interface RemoteHouseholdMember {
  profileId: string;
  role: "owner" | "admin" | "member" | "viewer";
  displayName: string | null;
  color: string | null;
  status: "active" | "invited" | "former";
  joinedAt: string | null;
}

/**
 * J2/J9 — lista de miembros directo de Supabase, no de Dexie: un miembro
 * que otro usuario invitó y aceptó desde SU dispositivo no llega a este
 * Dexie local sin un pull-sync que todavía no existe (BASE-05, Realtime
 * diferido). Ver la misma nota en `invites-repo.ts`.
 */
/**
 * J10 — un miembro que se va queda `status: 'former'`, nunca se borra la
 * fila (pierde el historial de quién cargó qué). El caller tiene que
 * verificar ANTES que no tenga saldo pendiente (`computeNetBalances`) —
 * esta función no lo chequea de nuevo, es deliberadamente el último paso.
 */
export async function markHouseholdMemberFormer(householdId: string, profileId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("household_members")
    .update({ status: "former", left_at: new Date().toISOString() })
    .eq("household_id", householdId)
    .eq("profile_id", profileId);
  if (error) throw error;
}

export async function listRemoteHouseholdMembers(householdId: string): Promise<RemoteHouseholdMember[]> {
  const supabase = createClient();
  // Bug real reportado en vivo: sin este filtro, un miembro que se saca
  // (`markHouseholdMemberFormer`, `status: 'former'`) seguía apareciendo
  // en J1 para siempre — la fila nunca se borra (J10: se conserva el
  // historial de quién cargó qué), pero tampoco debe listarse como activo.
  const { data, error } = await supabase
    .from("household_members")
    .select("profile_id, role, display_name, color, status, joined_at")
    .eq("household_id", householdId)
    .neq("status", "former");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    profileId: row.profile_id,
    role: row.role as RemoteHouseholdMember["role"],
    displayName: row.display_name,
    color: row.color,
    status: row.status as RemoteHouseholdMember["status"],
    joinedAt: row.joined_at,
  }));
}
