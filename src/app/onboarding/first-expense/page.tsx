"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Icon } from "@/design-system";
import { ScreenShell } from "@/components/screen-shell";
import { useOnboardingHydrated, useOnboardingStore } from "@/stores/onboarding-store";
import { useCaptureDraftStore } from "@/stores/capture-draft-store";
import { advanceFirstTx } from "@/lib/onboarding/first-tx-machine";

/**
 * Pantalla intermedia entre el primer ingreso y el primer gasto real —
 * "cargá tu primer gasto" es la acción por la que la app se juzga
 * (CLAUDE.md: "menos de 5 segundos y 3 decisiones"), pero recién tiene
 * sentido pedirla después de que exista plata que gastar (el primer
 * ingreso, en A11). Sin `ProgressSteps`: la barra de 5 pasos terminó en
 * A6, esto ya es post-household.
 */
export default function OnboardingFirstExpensePage() {
  const router = useRouter();
  const t = useTranslations();
  const hydrated = useOnboardingHydrated();
  const firstTxStep = useOnboardingStore((s) => s.draft.firstTxStep);
  const setField = useOnboardingStore((s) => s.setField);

  useEffect(() => {
    if (hydrated && firstTxStep !== "expense") router.replace("/");
  }, [hydrated, firstTxStep, router]);

  if (!hydrated || firstTxStep !== "expense") return null;

  const handleLater = () => {
    const { next } = advanceFirstTx(firstTxStep, { type: "skipped" });
    setField("firstTxStep", next);
    router.push("/onboarding/complete");
  };

  return (
    <ScreenShell style={{ alignItems: "center", justifyContent: "center", padding: "var(--screen-padding)", gap: 20, textAlign: "center" }}>
      <Icon name="wallet" size={48} color="var(--primary-ink)" />
      <h1 className="t-title" style={{ margin: 0 }}>{t("onboarding.firstExpense.title")}</h1>
      <p className="t-body" style={{ color: "var(--text-secondary)", maxWidth: "32ch" }}>
        {t("onboarding.firstExpense.subtitle")}
      </p>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
        <Button
          size="lg"
          onClick={() => {
            // Explícito aunque sea el default del store — mismo criterio
            // que el override a "income" de A11: acá se pisa a propósito,
            // una sola vez, antes de navegar.
            useCaptureDraftStore.getState().setKind("expense");
            router.push("/add");
          }}
        >
          {t("onboarding.firstExpense.cta")}
        </Button>
        <Button variant="secondary" onClick={handleLater}>
          {t("onboarding.firstExpense.later")}
        </Button>
      </div>
    </ScreenShell>
  );
}
