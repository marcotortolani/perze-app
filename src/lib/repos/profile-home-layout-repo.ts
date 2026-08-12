import { createClient } from "../supabase/client";
import { parseStoredHomeLayout } from "@/features/home/layout/types";
import type { StoredHomeLayout, StoredHomeLayoutDoc } from "@/features/home/layout/types";

/**
 * Orden/columna/visibilidad de los bloques del home, por perfil —
 * `profiles.home_layout` (`20260812110000_profile_home_layout.sql`).
 * Mismo patrón que `profile-notification-preferences-repo.ts`: una fila
 * por perfil, sin `household_id`, porque es una preferencia de la
 * persona, no del hogar.
 */
export const profileHomeLayoutRepo = {
  async get(profileId: string): Promise<StoredHomeLayoutDoc> {
    const supabase = createClient();
    const { data, error } = await supabase.from("profiles").select("home_layout").eq("id", profileId).maybeSingle();
    if (error) throw error;
    return parseStoredHomeLayout(data?.home_layout ?? null);
  },

  async save(profileId: string, layout: StoredHomeLayout): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ home_layout: layout } as never).eq("id", profileId);
    if (error) throw error;
  },

  async reset(profileId: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ home_layout: null }).eq("id", profileId);
    if (error) throw error;
  },
};
