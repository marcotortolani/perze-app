"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Icon, IconButton } from "@/design-system";
import type { IconName } from "@/design-system/core/Icon";
import { useMotionIntensity } from "@/components/motion";
import { useReminderBannerStore } from "@/stores/reminder-banner-store";
import { detectInstallPlatform } from "@/lib/pwa/platform";
import { REMINDER_ROUTE, type ReminderId } from "@/lib/reminders/definitions";
import { todayIso } from "@/lib/dates/today";

const REMINDER_ICON: Record<ReminderId, IconName> = {
  birthdate: "flag",
  installPwa: "install",
  modules: "plus",
  theme: "eye",
  format: "calendar",
  backdrop: "globe",
};

interface ReminderBannerProps {
  /** `null` = nada elegible hoy o ya descartado — ver `useActiveReminder()`. */
  reminder: ReminderId | null;
}

/**
 * Un solo recordatorio a la vez, rotando de a uno por día — la idea es
 * contarle al usuario qué puede ajustar a su gusto (cumpleaños, moneda,
 * formato, tema, fondo, instalar la app, más funciones), no una lista de
 * tareas pendientes. Mismo motivo por el que NO hay contador "3 cosas por
 * configurar": eso convierte una sugerencia en una obligación percibida.
 *
 * Cero violeta de marca acá — el presupuesto de un solo `--primary-fill`
 * visible por pantalla ya lo tiene la acción primaria del dashboard.
 * Puramente presentacional: quién decide el `reminder` es
 * `useActiveReminder()`, compartido con el layout del dashboard para que
 * el espaciado de abajo sepa si hay que reservarle lugar.
 */
export function ReminderBanner({ reminder }: ReminderBannerProps) {
  const t = useTranslations();
  const router = useRouter();
  const intensity = useMotionIntensity();
  const animated = intensity !== "minimal";
  const dismissForToday = useReminderBannerStore((s) => s.dismissForToday);
  const dismissForever = useReminderBannerStore((s) => s.dismissForever);

  if (!reminder) return null;

  // "Instalar la app" reusa exactamente la guía por plataforma de
  // Ajustes → Instalar app (`settingsPage.installGuide.*`) en vez de
  // duplicar el copy — un solo lugar que sabe explicar cada plataforma.
  const howText = reminder === "installPwa" ? t(`settingsPage.installGuide.${detectInstallPlatform()}`) : t(`home.reminders.${reminder}How`);

  return (
    <motion.div
      initial={animated ? { opacity: 0, y: -6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "14px 16px",
        borderRadius: "var(--radius-card)",
        background: "var(--surface-1)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <Icon name={REMINDER_ICON[reminder]} size={20} color="var(--text-secondary)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <p className="t-body" style={{ margin: 0, color: "var(--text-primary)", fontWeight: 600 }}>
            {t(`home.reminders.${reminder}Title`)}
          </p>
          <p className="t-label" style={{ margin: 0, color: "var(--text-secondary)" }}>
            {howText}
          </p>
        </div>
        <IconButton icon="close" ariaLabel={t("home.reminders.dismissToday")} onClick={() => dismissForToday(todayIso())} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, paddingLeft: 32 }}>
        <button
          type="button"
          onClick={() => router.push(REMINDER_ROUTE[reminder])}
          style={{ background: "none", border: 0, cursor: "pointer", padding: 0, color: "var(--text-primary)", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700 }}
        >
          {t("home.reminders.action")}
        </button>
        <button
          type="button"
          onClick={dismissForever}
          style={{ background: "none", border: 0, cursor: "pointer", padding: 0, color: "var(--text-muted)", fontFamily: "var(--font-sans)", fontSize: 13 }}
        >
          {t("home.reminders.dismissForever")}
        </button>
      </div>
    </motion.div>
  );
}
