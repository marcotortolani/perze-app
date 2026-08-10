import { createClient } from "../supabase/client";
import type { BirthDatePrecision } from "@/lib/analytics/age";

export interface Profile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  /** Ícono elegido por la persona (`IconName`, Phosphor) — mismo dato que `household_members.icon` sincroniza para que el resto del household lo vea. */
  icon: string;
  country: string | null;
  birthDate: string | null;
  /** `exact` = día real · `year` = solo la edad, `birthDate` es el 1 de julio sintético. `null` sin fecha cargada. */
  birthDatePrecision: BirthDatePrecision | null;
}

export type AccessStatus = "pending" | "approved" | "rejected" | "disabled";

export interface OwnAccess {
  accessStatus: AccessStatus;
  isAppAdmin: boolean;
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
    const { data, error } = await supabase.from("profiles").select("id, display_name, avatar_url, icon, country, birth_date, birth_date_precision").eq("id", userId).maybeSingle();
    if (error) throw error;
    return data
      ? {
          id: data.id,
          displayName: data.display_name,
          avatarUrl: data.avatar_url,
          icon: data.icon,
          country: data.country,
          birthDate: data.birth_date,
          birthDatePrecision: data.birth_date_precision as BirthDatePrecision | null,
        }
      : null;
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

  /**
   * Acceso controlado (§3) — `access_status`/`is_app_admin` de la propia
   * fila. `profiles_select` (self-only) alcanza para esto: nunca hace
   * falta una policy nueva para que alguien vea su propio estado.
   */
  async getOwnAccess(userId: string): Promise<OwnAccess | null> {
    const supabase = createClient();
    const { data, error } = await supabase.from("profiles").select("access_status, is_app_admin").eq("id", userId).maybeSingle();
    if (error) throw error;
    return data ? { accessStatus: data.access_status as AccessStatus, isAppAdmin: data.is_app_admin } : null;
  },

  /**
   * A4 — país elegido en onboarding (`20260801180000_access_control.sql`
   * documenta esta columna como completada acá, pero nada la escribía; la
   * métrica `byCountry` del panel de operador leía siempre `desconocido`).
   */
  async updateCountry(userId: string, country: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ country }).eq("id", userId);
    if (error) throw error;
  },

  /**
   * K2 / A4a — opcional, solo estadística agregada. `birthDate === null`
   * borra los dos campos: el CHECK de pareo (`profiles_birth_date_precision_pairing`)
   * rechaza `precision` sin fecha, así que la precisión SIEMPRE se anula
   * junto con la fecha, nunca se manda una sin la otra.
   */
  async updateBirthDate(userId: string, birthDate: string | null, precision: BirthDatePrecision | null): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ birth_date: birthDate, birth_date_precision: birthDate === null ? null : precision })
      .eq("id", userId);
    if (error) throw error;
  },

  /**
   * Ícono de perfil — un trigger en `profiles` (`sync_household_member_identity`,
   * `20260807120000_profile_icon.sql`) propaga el cambio a `household_members.icon`
   * de todos los households donde participa, así el resto del hogar lo ve sin
   * que este repo tenga que tocar esa tabla.
   */
  async updateIcon(userId: string, icon: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ icon }).eq("id", userId);
    if (error) throw error;
  },

  /**
   * AC-3 (`docs/auditoria-acceso.md`) — el household activo vivía SOLO en
   * el `meta` de Dexie: el único dato que un dispositivo nuevo necesita
   * era el único que nunca salía del dispositivo. Se escribe al cerrar A11
   * y `hydrateFromRemote()` lo usa para elegir qué household activar.
   */
  async setDefaultHousehold(userId: string, householdId: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ default_household_id: householdId }).eq("id", userId);
    if (error) throw error;
  },
};
