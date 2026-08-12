"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button, Card, ListRow, Sheet, usePageHeader } from "@/design-system";
import { useCurrentHousehold } from "@/hooks/use-current-household";
import { useEffectiveUserId } from "@/hooks/use-current-user";
import { useRemoteHouseholdMembers } from "@/hooks/use-remote-household-members";
import { useAccounts } from "@/hooks/use-accounts";
import { useCategories } from "@/hooks/use-categories";
import { useTags } from "@/hooks/use-tags";
import { useTransactions } from "@/hooks/use-transactions";
import { useBudgets } from "@/hooks/use-budgets";
import { useGoals } from "@/hooks/use-goals";
import { useRecurringRules } from "@/hooks/use-recurring-rules";
import { useDebts } from "@/hooks/use-debts";
import { usePortfolios } from "@/hooks/use-investments";
import { finishPurge, PURGE_STEPS, runPurgeStep, wipeLocalHouseholdData } from "@/lib/repos/purge-household-repo";
import { clearHouseholdDataStores } from "@/lib/auth/sign-out";
import { purgeNavigationCaches } from "@/lib/pwa/navigation-caches";

// Un solo literal del token de marca en todo el archivo (presupuesto de
// ruido: 1 violeta visible por pantalla) — la barra "en progreso" y la
// barra llena de "éxito" nunca se ven a la vez (son dos fases distintas
// del mismo `Sheet`), pero el lint estático cuenta ocurrencias en el
// código fuente, no en el runtime.
const PROGRESS_FILL: CSSProperties = { background: "var(--primary-fill)" };

type PurgeFlow =
  | { phase: "confirm" }
  | { phase: "running"; index: number }
  | { phase: "success" }
  | { phase: "error"; index: number; message: string };

/**
 * Hub "Datos y backup" — antes dos filas sueltas en el índice de Más
 * (Exportar backup / Importar CSV), reagrupadas acá por decisión de
 * producto. `/more/export` (K10) y `/more/import` (K9) no cambian: siguen
 * siendo las mismas pantallas, solo se llega a ellas desde acá.
 *
 * Zona destructiva nueva: "Borrar todos mis datos" — solo visible para el
 * `owner` del household (chequeo contra Supabase directo, no Dexie: un
 * miembro agregado desde otro dispositivo puede no estar en el caché
 * local todavía — ver `useRemoteHouseholdMembers`). El borrado real vive
 * en `purge_household_step` (`20260804000000_purge_household.sql`,
 * SECURITY DEFINER — es la única excepción del esquema a "DELETE nunca se
 * expone por RLS", consciente y acotada a este flujo).
 */
export default function DataAndBackupPage() {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: household } = useCurrentHousehold();
  const userId = useEffectiveUserId();
  const { data: members } = useRemoteHouseholdMembers(household?.id);
  const { data: accounts } = useAccounts(household?.id);
  const { data: categories } = useCategories(household?.id);
  const { data: tags } = useTags(household?.id);
  const { data: transactions } = useTransactions(household?.id);
  const { data: budgets } = useBudgets(household?.id);
  const { data: goals } = useGoals(household?.id);
  const { data: recurringRules } = useRecurringRules(household?.id);
  const { data: debts } = useDebts(household?.id);
  const { data: portfolios } = usePortfolios(household?.id);
  usePageHeader({ title: t("morePage.dataAndBackup"), onBack: () => router.back(), backLabel: t("ds.appHeader.back") });

  const [flow, setFlow] = useState<PurgeFlow | null>(null);

  const isOwner = (members ?? []).some((m) => m.profileId === userId && m.role === "owner" && m.status === "active");
  const otherActiveMembers = (members ?? []).filter((m) => m.profileId !== userId && m.status === "active").length;

  const counts = {
    accounts: accounts?.length ?? 0,
    categories: categories?.length ?? 0,
    tags: tags?.length ?? 0,
    transactions: transactions?.length ?? 0,
    budgetsGoals: (budgets?.length ?? 0) + (goals?.length ?? 0),
    recurringDebts: (recurringRules?.length ?? 0) + (debts?.length ?? 0),
    investments: portfolios?.length ?? 0,
  };

  // Cada paso es un round-trip real al servidor — la barra de progreso
  // avanza con llamadas de verdad, nunca con un timer simulado. `fromIndex`
  // permite reintentar DESDE el paso que falló (son idempotentes, no hace
  // falta volver a correr los anteriores).
  const runPurge = async (fromIndex: number) => {
    if (!household) return;
    for (let i = fromIndex; i < PURGE_STEPS.length; i++) {
      setFlow({ phase: "running", index: i });
      try {
        await runPurgeStep(household.id, PURGE_STEPS[i]!.key);
      } catch (error) {
        setFlow({ phase: "error", index: i, message: error instanceof Error ? error.message : String(error) });
        return;
      }
    }
    await wipeLocalHouseholdData(household.id);
    clearHouseholdDataStores();
    // Best-effort — los payloads RSC cacheados de `/transactions` y `/`
    // traen datos renderizados de antes del borrado. `purgeNavigationCaches`
    // ya existe (se usa al cerrar sesión y en onboarding) y nunca puede
    // bloquear una transición de estado.
    await purgeNavigationCaches();
    // Recién ACÁ, después de que el caché local ya quedó limpio: estampa
    // `households.purged_at` para que cualquier OTRO dispositivo se entere
    // en su próximo pull (`reconcileRemotePurge`) y guarda el marcador local
    // con el timestamp exacto que devolvió el servidor, para que el PROPIO
    // dispositivo no repita el wipe en el próximo tick.
    await finishPurge(household.id).catch(() => {});
    queryClient.clear();
    setFlow({ phase: "success" });
  };

  const sheetTitle =
    flow?.phase === "confirm"
      ? t("dataPage.purge.confirmTitle")
      : flow?.phase === "running"
        ? t("dataPage.purge.runningTitle")
        : flow?.phase === "success"
          ? t("dataPage.purge.successTitle")
          : flow?.phase === "error"
            ? t("dataPage.purge.errorTitle")
            : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ paddingTop: 12, display: "flex", flexDirection: "column", gap: 20 }}>
        <Card padding="4px 16px">
          <ListRow icon="install" label={t("exportPage.headerTitle")} meta={t("dataPage.exportMeta")} onClick={() => router.push("/more/export")} />
          <ListRow icon="install" label={t("importCsvPage.title")} meta={t("dataPage.importMeta")} onClick={() => router.push("/more/import")} />
        </Card>

        {isOwner ? (
          <div>
            <div className="t-caption" style={{ color: "var(--text-muted)", marginBottom: 4 }}>{t("dataPage.dangerZoneTitle")}</div>
            <Card padding="4px 16px">
              <ListRow icon="trash" label={t("dataPage.purge.rowLabel")} destructive onClick={() => setFlow({ phase: "confirm" })} />
            </Card>
          </div>
        ) : null}
      </div>

      <Sheet
        open={flow !== null}
        title={sheetTitle}
        onClose={() => (flow?.phase === "running" ? undefined : setFlow(null))}
        height={flow?.phase === "confirm" ? 540 : 320}
      >
        {flow?.phase === "confirm" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p className="t-body" style={{ margin: 0, color: "var(--text-secondary)" }}>{t("dataPage.purge.confirmBody")}</p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              <li className="t-body" style={{ color: "var(--text-primary)" }}>{t("dataPage.purge.itemAccounts", { count: counts.accounts })}</li>
              <li className="t-body" style={{ color: "var(--text-primary)" }}>{t("dataPage.purge.itemTransactions", { count: counts.transactions })}</li>
              <li className="t-body" style={{ color: "var(--text-primary)" }}>{t("dataPage.purge.itemCategories", { count: counts.categories })}</li>
              <li className="t-body" style={{ color: "var(--text-primary)" }}>{t("dataPage.purge.itemTags", { count: counts.tags })}</li>
              <li className="t-body" style={{ color: "var(--text-primary)" }}>{t("dataPage.purge.itemBudgetsGoals", { count: counts.budgetsGoals })}</li>
              <li className="t-body" style={{ color: "var(--text-primary)" }}>{t("dataPage.purge.itemRecurringDebts", { count: counts.recurringDebts })}</li>
              <li className="t-body" style={{ color: "var(--text-primary)" }}>{t("dataPage.purge.itemInvestments", { count: counts.investments })}</li>
            </ul>
            {otherActiveMembers > 0 ? (
              <p className="t-body" style={{ margin: 0, color: "var(--critical)" }}>
                {t("dataPage.purge.othersWarning", { count: otherActiveMembers })}
              </p>
            ) : null}
            <Button variant="danger" onClick={() => void runPurge(0)}>
              {t("dataPage.purge.confirmAction")}
            </Button>
            <Button variant="secondary" onClick={() => setFlow(null)}>
              {t("common.cancel")}
            </Button>
          </div>
        ) : null}

        {flow?.phase === "running" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p className="t-body" style={{ margin: 0, color: "var(--text-secondary)" }}>{t(PURGE_STEPS[flow.index]!.labelKey as Parameters<typeof t>[0])}</p>
            <div style={{ height: 8, borderRadius: 999, background: "var(--surface-3)", overflow: "hidden" }}>
              <div
                style={{
                  width: `${(flow.index / PURGE_STEPS.length) * 100}%`,
                  height: "100%",
                  borderRadius: 999,
                  transition: "width var(--duration-slow) var(--ease-spring-soft)",
                  ...PROGRESS_FILL,
                }}
              />
            </div>
            <p className="t-caption" style={{ margin: 0, color: "var(--text-muted)", textAlign: "center" }}>
              {t("dataPage.purge.stepProgress", { current: flow.index + 1, total: PURGE_STEPS.length })}
            </p>
          </div>
        ) : null}

        {flow?.phase === "success" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ height: 8, borderRadius: 999, ...PROGRESS_FILL }} />
            <p className="t-body" style={{ margin: 0, color: "var(--text-secondary)" }}>{t("dataPage.purge.successBody")}</p>
            <Button onClick={() => router.push("/")}>{t("dataPage.purge.successAction")}</Button>
          </div>
        ) : null}

        {flow?.phase === "error" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p className="t-body" style={{ margin: 0, color: "var(--critical)" }}>
              {t("dataPage.purge.errorBody", { step: t(PURGE_STEPS[flow.index]!.labelKey as Parameters<typeof t>[0]) })}
            </p>
            <Button variant="danger" onClick={() => void runPurge(flow.index)}>
              {t("dataPage.purge.retryAction")}
            </Button>
            <Button variant="secondary" onClick={() => setFlow(null)}>
              {t("common.cancel")}
            </Button>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
