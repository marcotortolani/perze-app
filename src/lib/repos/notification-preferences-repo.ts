import { createClient } from "../supabase/client";
import { newId } from "./ids";

export interface NotificationPreferences {
  id: string;
  householdId: string;
  profileId: string;
  budgetAlerts: boolean;
  weeklySummary: boolean;
  recurringReminders: boolean;
  insights: boolean;
  cardStatementDue: boolean;
  /** D35 — "alguien se unió a tu hogar" (owner/admin). */
  householdJoined: boolean;
}

const DEFAULTS = { budgetAlerts: true, weeklySummary: true, recurringReminders: true, insights: true, cardStatementDue: true, householdJoined: true };

/**
 * K12 — preferencias de notificación, una fila por miembro (RLS: solo la
 * propia). Vive solo en Supabase: es configuración de cuenta, no dato de
 * captura que necesite el outbox offline.
 */
export const notificationPreferencesRepo = {
  async get(householdId: string, profileId: string): Promise<NotificationPreferences> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("notification_preferences")
      .select("id, household_id, profile_id, budget_alerts, weekly_summary, recurring_reminders, insights, card_statement_due, household_joined")
      .eq("household_id", householdId)
      .eq("profile_id", profileId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { id: "", householdId, profileId, ...DEFAULTS };
    return {
      id: data.id,
      householdId: data.household_id,
      profileId: data.profile_id,
      budgetAlerts: data.budget_alerts,
      weeklySummary: data.weekly_summary,
      recurringReminders: data.recurring_reminders,
      insights: data.insights,
      cardStatementDue: data.card_statement_due,
      householdJoined: data.household_joined,
    };
  },

  async upsert(prefs: NotificationPreferences): Promise<void> {
    const supabase = createClient();
    const row = {
      id: prefs.id || newId(),
      household_id: prefs.householdId,
      profile_id: prefs.profileId,
      budget_alerts: prefs.budgetAlerts,
      weekly_summary: prefs.weeklySummary,
      recurring_reminders: prefs.recurringReminders,
      insights: prefs.insights,
      card_statement_due: prefs.cardStatementDue,
      household_joined: prefs.householdJoined,
    };
    const { error } = await supabase.from("notification_preferences").upsert(row as never, { onConflict: "household_id,profile_id" });
    if (error) throw error;
  },
};
