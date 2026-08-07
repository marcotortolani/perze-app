import { createClient } from "../supabase/client";
import type { AccessStatus } from "./profiles-repo";

export interface AccessRequest {
  profileId: string;
  email: string | null;
  displayName: string | null;
  country: string | null;
  accessStatus: AccessStatus;
  accessRequestedAt: string;
  lastSeenAt: string | null;
  /** Operador de la instancia — nunca se ofrece deshabilitar a otro operador ni a uno mismo, ver `admin_set_access_status()`. */
  isAppAdmin: boolean;
}

export interface AdminMetrics {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  disabled: number;
  byCountry: Record<string, number>;
  byAgeRange: Record<string, number>;
  activeToday: number;
  active7d: number;
  active30d: number;
  inactive: number;
}

/**
 * Panel del operador (§3.3/§3.4) — las tres únicas RPC que el cliente
 * invoca (`supabase.rpc(...)`), todas `SECURITY DEFINER` con
 * `is_app_admin()` como primera línea. Ninguna toca `transactions`,
 * `accounts` ni ninguna tabla financiera — ver
 * `20260801180000_access_control.sql`.
 */
export const adminRepo = {
  async listAccessRequests(): Promise<AccessRequest[]> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("admin_list_access_requests");
    if (error) throw error;
    return (data ?? []).map((row) => ({
      profileId: row.profile_id,
      email: row.email,
      displayName: row.display_name,
      country: row.country,
      accessStatus: row.access_status as AccessStatus,
      accessRequestedAt: row.access_requested_at,
      lastSeenAt: row.last_seen_at,
      isAppAdmin: row.is_app_admin,
    }));
  },

  async metrics(): Promise<AdminMetrics> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("admin_metrics");
    if (error) throw error;
    const m = (data ?? {}) as Record<string, unknown>;
    return {
      total: Number(m.total ?? 0),
      pending: Number(m.pending ?? 0),
      approved: Number(m.approved ?? 0),
      rejected: Number(m.rejected ?? 0),
      disabled: Number(m.disabled ?? 0),
      byCountry: (m.byCountry ?? {}) as Record<string, number>,
      byAgeRange: (m.byAgeRange ?? {}) as Record<string, number>,
      activeToday: Number(m.activeToday ?? 0),
      active7d: Number(m.active7d ?? 0),
      active30d: Number(m.active30d ?? 0),
      inactive: Number(m.inactive ?? 0),
    };
  },

  async setAccessStatus(profileId: string, status: AccessStatus): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_set_access_status", { target_id: profileId, new_status: status });
    if (error) throw error;
  },
};
