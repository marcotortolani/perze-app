"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Amount, Icon, IconButton } from "@/design-system";
import { useMotionIntensity } from "@/components/motion";
import { money } from "@/lib/money/money";
import type { BudgetClosureStatus } from "@/lib/analytics/budget-closure";

export interface BudgetClosureBannerProps {
  budgetId: string;
  budgetName: string;
  currencyCode: string;
  closure: BudgetClosureStatus;
  onDismiss: () => void;
}

/**
 * Banner de cierre de período — aplica a CUALQUIER presupuesto, tenga
 * rollover activado o no: si el período que acaba de cerrar terminó bajo
 * el límite felicita, si lo superó motiva a ajustar. Mismo molde de card
 * que `ReminderBanner` (ícono + título + cuerpo + acción + cerrar), no el
 * `Banner` de una línea — acá hay un monto de por medio y una acción
 * concreta ("ver presupuesto"), no un aviso de una sola frase.
 */
export function BudgetClosureBanner({ budgetId, budgetName, currencyCode, closure, onDismiss }: BudgetClosureBannerProps) {
  const t = useTranslations();
  const router = useRouter();
  const intensity = useMotionIntensity();
  const animated = intensity !== "minimal";
  const under = closure.status === "under";
  const diff = under ? closure.effectiveLimit - closure.spent : closure.spent - closure.effectiveLimit;

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
        <Icon name={under ? "check" : "alert"} size={20} color="var(--text-secondary)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <p className="t-body" style={{ margin: 0, color: "var(--text-primary)", fontWeight: 600 }}>
            {t(under ? "budgetsPage.closureBanner.underTitle" : "budgetsPage.closureBanner.overTitle", { name: budgetName })}
          </p>
          <p className="t-label" style={{ margin: 0, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            {t(under ? "budgetsPage.closureBanner.underBody" : "budgetsPage.closureBanner.overBody")}{" "}
            <Amount value={money(diff, currencyCode)} size="label" showSign={false} polarity="neutral" tabular />
          </p>
        </div>
        <IconButton icon="close" ariaLabel={t("budgetsPage.closureBanner.dismiss")} onClick={onDismiss} />
      </div>
      <div style={{ paddingLeft: 32 }}>
        <button
          type="button"
          onClick={() => router.push(`/budgets/${budgetId}`)}
          style={{ background: "none", border: 0, cursor: "pointer", padding: 0, color: "var(--text-primary)", fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 700 }}
        >
          {t("budgetsPage.closureBanner.action")}
        </button>
      </div>
    </motion.div>
  );
}
