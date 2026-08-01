import { createClient } from "../supabase/client";

export interface VisibilityGrant {
  id: string;
  subjectType: "account" | "category";
  subjectId: string;
  memberId: string;
  grantedBy: string;
  grantedAt: string;
}

/**
 * J4/J9 — `visibility_grants` vive solo en Supabase, igual que
 * `household_invites`: es información sobre OTROS miembros (quién ve qué),
 * así que el modelo local-first no aplica — ver la misma nota en
 * `invites-repo.ts`.
 */
export const visibilityGrantsRepo = {
  async listActiveFor(subjectType: "account" | "category", subjectId: string): Promise<VisibilityGrant[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("visibility_grants")
      .select("id, subject_type, subject_id, member_id, granted_by, granted_at")
      .eq("subject_type", subjectType)
      .eq("subject_id", subjectId)
      .is("revoked_at", null);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      subjectType: row.subject_type as "account" | "category",
      subjectId: row.subject_id,
      memberId: row.member_id,
      grantedBy: row.granted_by,
      grantedAt: row.granted_at,
    }));
  },

  async grant(householdId: string, subjectType: "account" | "category", subjectId: string, memberId: string, grantedBy: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from("visibility_grants").upsert(
      {
        id: crypto.randomUUID(),
        household_id: householdId,
        subject_type: subjectType,
        subject_id: subjectId,
        member_id: memberId,
        granted_by: grantedBy,
        revoked_at: null,
      },
      { onConflict: "subject_type,subject_id,member_id" }
    );
    if (error) throw error;
  },

  async revoke(subjectType: "account" | "category", subjectId: string, memberId: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from("visibility_grants")
      .update({ revoked_at: new Date().toISOString() })
      .eq("subject_type", subjectType)
      .eq("subject_id", subjectId)
      .eq("member_id", memberId);
    if (error) throw error;
  },

  /** J9 — historial completo (altas y bajas), para auditar. */
  async listHistoryForHousehold(householdId: string): Promise<(VisibilityGrant & { revokedAt: string | null })[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("visibility_grants")
      .select("id, subject_type, subject_id, member_id, granted_by, granted_at, revoked_at")
      .eq("household_id", householdId)
      .order("granted_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      subjectType: row.subject_type as "account" | "category",
      subjectId: row.subject_id,
      memberId: row.member_id,
      grantedBy: row.granted_by,
      grantedAt: row.granted_at,
      revokedAt: row.revoked_at,
    }));
  },
};
