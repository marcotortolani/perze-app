"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Skeleton, Switch, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { useInvalidateNotificationPreferences, useNotificationPreferences } from "@/hooks/use-notification-preferences";
import { notificationPreferencesRepo, type NotificationPreferences } from "@/lib/repos/notification-preferences-repo";
import { getCurrentPushSubscription, PushUnsupportedError, subscribeToPush, unsubscribeFromPush } from "@/lib/push/subscribe";

type ToggleKey = "budgetAlerts" | "weeklySummary" | "recurringReminders" | "insights" | "cardStatementDue";
const TOGGLES: ToggleKey[] = ["budgetAlerts", "weeklySummary", "recurringReminders", "insights", "cardStatementDue"];

/** K12 — notificaciones: push por dispositivo + preferencias por tipo. Sin promesa de engagement: apagado por defecto, el usuario prende lo que quiere. */
export default function NotificationsPage() {
  const t = useTranslations();
  const router = useRouter();
  const { data: household } = useCurrentHousehold();
  const userId = useCurrentUserId();
  const { data: prefs } = useNotificationPreferences(household?.id, userId ?? undefined);
  const invalidate = useInvalidateNotificationPreferences(household?.id, userId ?? undefined);
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  usePageHeader({ title: t("notificationsPage.title"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  useEffect(() => {
    getCurrentPushSubscription().then((sub) => setPushEnabled(sub !== null));
  }, []);

  if (!household || !prefs || pushEnabled === null || !userId) return <Skeleton height={280} style={{ marginTop: 16 }} />;

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

  const handleTogglePreference = async (key: ToggleKey, value: boolean) => {
    const next: NotificationPreferences = { ...prefs, [key]: value };
    await notificationPreferencesRepo.upsert(next);
    invalidate();
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

        <p className="t-caption" style={{ color: "var(--text-muted)", marginTop: 18 }}>{t("notificationsPage.noEngagementPromise")}</p>
      </div>
    </div>
  );
}
