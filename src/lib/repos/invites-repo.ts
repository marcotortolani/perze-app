import { createClient } from "../supabase/client";

export interface HouseholdInvite {
  id: string;
  householdId: string;
  code: string;
  email: string | null;
  role: "owner" | "admin" | "member" | "viewer";
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  acceptedBy: string | null;
}

function randomCode(): string {
  // 8 caracteres alfanuméricos en mayúscula — cómodo de tipear a mano si
  // no se puede compartir el link (J3, invitación por código).
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I, ambiguos al tipear
  return Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

/**
 * J3 — invitar a un miembro. `household_invites` vive solo en Supabase (no
 * en Dexie): una invitación tiene que ser visible para alguien que TODAVÍA
 * no tiene sesión ni cuenta local, así que el modelo local-first no aplica
 * acá — es, a propósito, la excepción de "lecturas que necesitan Realtime"
 * que ya anota `lib/supabase/client.ts`.
 */
export const invitesRepo = {
  async listForHousehold(householdId: string): Promise<HouseholdInvite[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("household_invites")
      .select("id, household_id, code, email, role, created_at, expires_at, revoked_at, accepted_by")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      householdId: row.household_id,
      code: row.code,
      email: row.email,
      role: row.role as HouseholdInvite["role"],
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      acceptedBy: row.accepted_by,
    }));
  },

  async create(params: { householdId: string; email: string | null; role: "admin" | "member" | "viewer" }): Promise<HouseholdInvite> {
    const supabase = createClient();
    const code = randomCode();
    const { data, error } = await supabase
      .from("household_invites")
      .insert({ id: crypto.randomUUID(), household_id: params.householdId, email: params.email, code, role: params.role })
      .select("id, household_id, code, email, role, created_at, expires_at, revoked_at, accepted_by")
      .single();
    if (error) throw error;
    return {
      id: data.id,
      householdId: data.household_id,
      code: data.code,
      email: data.email,
      role: data.role as HouseholdInvite["role"],
      createdAt: data.created_at,
      expiresAt: data.expires_at,
      revokedAt: data.revoked_at,
      acceptedBy: data.accepted_by,
    };
  },

  async revoke(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from("household_invites").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
  },

  /** Devuelve el `household_id` al que se unió. */
  async accept(code: string): Promise<string> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("accept_invite", { invite_code: code });
    if (error) throw error;
    return data;
  },
};
