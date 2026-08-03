"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Icon, IconButton } from "@/design-system";
import { useMotionIntensity } from "@/components/motion";

export interface BirthdayBannerProps {
  age: number;
  onDismiss: () => void;
}

/**
 * No bloqueante (no es un modal ni pide confirmar nada) y se puede cerrar
 * — el único ruido que agrega es una entrada animada. 900ms es la
 * excepción "celebración" del motion budget de `CLAUDE.md` (el resto de
 * la interfaz no supera 320ms).
 */
export function BirthdayBanner({ age, onDismiss }: BirthdayBannerProps) {
  const t = useTranslations();
  const intensity = useMotionIntensity();
  const animated = intensity !== "minimal";

  return (
    <motion.div
      initial={animated ? { opacity: 0, scale: 0.92, y: -6 } : false}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.9, ease: [0.16, 1.4, 0.3, 1] }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        borderRadius: "var(--radius-card)",
        background: "var(--surface-1)",
        margin: "0 calc(-1 * var(--screen-padding))",
      }}
    >
      <motion.span
        animate={animated ? { rotate: [0, -12, 12, -8, 8, 0] } : {}}
        transition={{ duration: 0.9, ease: "easeInOut" }}
        style={{ display: "flex", flexShrink: 0 }}
      >
        <Icon name="flag" size={22} color="var(--primary-fill)" />
      </motion.span>
      <p className="t-body" style={{ flex: 1, margin: 0, color: "var(--text-primary)" }}>
        {t("home.birthdayBanner", { age })}
      </p>
      <IconButton icon="close" ariaLabel={t("home.birthdayBannerDismiss")} onClick={onDismiss} />
    </motion.div>
  );
}
