import { createClient } from "../supabase/client";

export interface Profile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * K2 — perfil propio. `profiles_select` en RLS solo deja ver la fila
 * propia (`id = auth.uid()`) — a diferencia de accounts/transactions esto
 * vive solo en Supabase, no en el Dexie local (que sí tiene una tabla
 * `profiles` pero sin sync wireado — ver la nota en `sync-config.ts`).
 */
export const profilesRepo = {
  async getOwn(userId: string): Promise<Profile | null> {
    const supabase = createClient();
    const { data, error } = await supabase.from("profiles").select("id, display_name, avatar_url").eq("id", userId).maybeSingle();
    if (error) throw error;
    return data ? { id: data.id, displayName: data.display_name, avatarUrl: data.avatar_url } : null;
  },

  /**
   * `household_members.display_name` es una copia denormalizada y NO se
   * actualiza acá: `household_members_update` en RLS solo deja escribir a
   * `owner`/`admin` sobre CUALQUIER fila, ninguna policy separada permite
   * que un `member` común corrija su propia fila. Cambiar el nombre acá
   * actualiza el perfil real (fuente de verdad para futuros `households`);
   * el nombre ya visible en un household existente se corrige aparte
   * (fuera de alcance de esta versión, requiere una policy nueva).
   */
  async updateDisplayName(userId: string, displayName: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", userId);
    if (error) throw error;
  },
};
