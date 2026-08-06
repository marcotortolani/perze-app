import { createClient } from "../supabase/client";

export interface ProfileNotificationPreferences {
  profileId: string;
  inviteReceived: boolean;
  appUpdates: boolean;
}

const DEFAULTS = { inviteReceived: true, appUpdates: true };

/**
 * D35 — contraparte por-perfil de `notification-preferences-repo.ts`: para
 * lo que no es de ningún household en particular ("te invitaron" es ANTES
 * de ser miembro de nada; "nueva versión" es de la cuenta). Una fila por
 * perfil, sin `household_id`.
 */
export const profileNotificationPreferencesRepo = {
  async get(profileId: string): Promise<ProfileNotificationPreferences> {
    const supabase = createClient();
    const { data, error } = await supabase.from("profile_notification_preferences").select("profile_id, invite_received, app_updates").eq("profile_id", profileId).maybeSingle();
    if (error) throw error;
    if (!data) return { profileId, ...DEFAULTS };
    return { profileId: data.profile_id, inviteReceived: data.invite_received, appUpdates: data.app_updates };
  },

  async upsert(prefs: ProfileNotificationPreferences): Promise<void> {
    const supabase = createClient();
    const row = { profile_id: prefs.profileId, invite_received: prefs.inviteReceived, app_updates: prefs.appUpdates };
    const { error } = await supabase.from("profile_notification_preferences").upsert(row as never, { onConflict: "profile_id" });
    if (error) throw error;
  },
};
