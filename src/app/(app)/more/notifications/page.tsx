"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Skeleton, Switch, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { useInvalidateNotificationPreferences, useNotificationPreferences } from "@/hooks/use-notification-preferences";
import { useInvalidateProfileNotificationPreferences, useProfileNotificationPreferences } from "@/hooks/use-profile-notification-preferences";
import { notificationPreferencesRepo, type NotificationPreferences } from "@/lib/repos/notification-preferences-repo";
import { profileNotificationPreferencesRepo, type ProfileNotificationPreferences } from "@/lib/repos/profile-notification-preferences-repo";
import { getCurrentPushSubscription, PushUnsupportedError, subscribeToPush, unsubscribeFromPush } from "@/lib/push/subscribe";

type ToggleKey = "budgetAlerts" | "recurringReminders" | "insights" | "cardStatementDue" | "householdJoined";
const TOGGLES: ToggleKey[] = ["budgetAlerts", "recurringReminders", "insights", "cardStatementDue", "householdJoined"];

/**
 * Preferencias que NO son push: van por mail y por eso no se apagan con el
 * switch de notificaciones ni se atenúan cuando está en off. Meterlas en
 * `TOGGLES` las dejaría deshabilitadas para quien nunca aceptó push —
 * o sea, invisibles para la mayoría.
 */
type EmailToggleKey = "monthlySummary";
const EMAIL_TOGGLES: { key: EmailToggleKey; pref: "monthlySummaryEmail" }[] = [{ key: "monthlySummary", pref: "monthlySummaryEmail" }];

type ProfileToggleKey = "inviteReceived" | "appUpdates";
const PROFILE_TOGGLES: ProfileToggleKey[] = ["inviteReceived", "appUpdates"];

/** K12 — notificaciones: push por dispositivo + preferencias por tipo. Sin promesa de engagement: apagado por defecto, el usuario prende lo que quiere. */
export default function NotificationsPage() {
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const userId = useEffectiveUserId();
  const { data: prefs } = useNotificationPreferences(household?.id, userId ?? undefined);
  const invalidate = useInvalidateNotificationPreferences(household?.id, userId ?? undefined);
  // D35 — "te invitaron" y "nueva versión" no son de ningún household en
  // particular (el primero es ANTES de ser miembro de nada) — preferencia
  // aparte, por perfil, sin `household_id`.
  const { data: profilePrefs } = useProfileNotificationPreferences(userId ?? undefined);
  const invalidateProfilePrefs = useInvalidateProfileNotificationPreferences(userId ?? undefined);
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  usePageHeader({ title: t("notificationsPage.title"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  useEffect(() => {
    getCurrentPushSubscription().then((sub) => setPushEnabled(sub !== null));
  }, []);

  if (!household || !prefs || !profilePrefs || pushEnabled === null || !userId) return <Skeleton height={280} style={{ marginTop: 16 }} />;

  const handleTogglePush = async (on: boolean) => {
    setPushBusy(true);
    try {
      if (on) {
        await subscribeToPush(userId);
        setPushEnabled(true);
      } else {
        await unsubscribeFromPush();
        setPushEnabled(false);
      }
    } catch (error) {
      toast(error instanceof PushUnsupportedError ? t("notificationsPage.pushUnsupported") : t("notificationsPage.pushError"));
    } finally {
      setPushBusy(false);
    }
  };

  const handleTogglePreference = async (key: ToggleKey | "monthlySummaryEmail", value: boolean) => {
    const next: NotificationPreferences = { ...prefs, [key]: value };
    await notificationPreferencesRepo.upsert(next);
    invalidate();
  };

  const handleToggleProfilePreference = async (key: ProfileToggleKey, value: boolean) => {
    const next: ProfileNotificationPreferences = { ...profilePrefs, [key]: value };
    await profileNotificationPreferencesRepo.upsert(next);
    invalidateProfilePrefs();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ paddingTop: 12, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minHeight: 60 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, color: "var(--text-primary)" }}>{t("notificationsPage.enablePush")}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 1 }}>{t("notificationsPage.enablePushMeta")}</div>
          </div>
          <Switch checked={pushEnabled} onChange={handleTogglePush} disabled={pushBusy} id="push-enabled" />
        </div>

        <div style={{ height: 4 }} />

        {TOGGLES.map((key) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 14, minHeight: 56, opacity: pushEnabled ? 1 : 0.4 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, color: "var(--text-primary)" }}>{t(`notificationsPage.toggles.${key}.label`)}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 1 }}>{t(`notificationsPage.toggles.${key}.description`)}</div>
            </div>
            <Switch checked={prefs[key]} onChange={(v) => handleTogglePreference(key, v)} disabled={!pushEnabled} id={`pref-${key}`} />
          </div>
        ))}

        {PROFILE_TOGGLES.map((key) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 14, minHeight: 56, opacity: pushEnabled ? 1 : 0.4 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, color: "var(--text-primary)" }}>{t(`notificationsPage.profileToggles.${key}.label`)}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 1 }}>{t(`notificationsPage.profileToggles.${key}.description`)}</div>
            </div>
            <Switch checked={profilePrefs[key]} onChange={(v) => handleToggleProfilePreference(key, v)} disabled={!pushEnabled} id={`profile-pref-${key}`} />
          </div>
        ))}

        <p className="t-caption" style={{ color: "var(--text-muted)", marginTop: 18 }}>{t("notificationsPage.noEngagementPromise")}</p>

        <div className="t-label" style={{ color: "var(--text-muted)", marginTop: 28 }}>{t("notificationsPage.emailSection")}</div>

        {EMAIL_TOGGLES.map(({ key, pref }) => (
          <div key={key} className="flex items-center gap-3.5" style={{ minHeight: 56 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, color: "var(--text-primary)" }}>{t(`notificationsPage.emailToggles.${key}.label`)}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 1 }}>{t(`notificationsPage.emailToggles.${key}.description`)}</div>
            </div>
            <Switch checked={prefs[pref]} onChange={(v) => handleTogglePreference(pref, v)} id={`pref-${pref}`} />
          </div>
        ))}

        <p className="t-caption" style={{ color: "var(--text-muted)", marginTop: 8 }}>{t("notificationsPage.emailSectionHint")}</p>
      </div>
    </div>
  );
}
