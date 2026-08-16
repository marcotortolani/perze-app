import { create } from "zustand";
import { persist } from "zustand/middleware";
import { sanitizedPersist, stringArrayOr } from "@/lib/stores/persist-sanitize";

/**
 * Descarte del banner de cierre de período — mismo molde que
 * `birthday-banner-store.ts`, pero la clave no es "el año" sino
 * `"${budgetId}:${periodEnd ISO}"`: un presupuesto cierra un período
 * distinto cada mes, así que descartar el aviso de julio no puede tapar
 * el de agosto, y dos presupuestos nunca comparten clave aunque cierren
 * el mismo día.
 */
interface BudgetClosureBannerState {
  dismissedKeys: string[];
  dismiss: (key: string) => void;
  isDismissed: (key: string) => boolean;
}

function sanitize(persisted: unknown): { dismissedKeys: string[] } {
  const p = (persisted ?? {}) as Record<string, unknown>;
  return { dismissedKeys: stringArrayOr()(p.dismissedKeys) };
}

export const useBudgetClosureBannerStore = create<BudgetClosureBannerState>()(
  persist(
    (set, get) => ({
      dismissedKeys: [],
      dismiss: (key) => set((s) => ({ dismissedKeys: s.dismissedKeys.includes(key) ? s.dismissedKeys : [...s.dismissedKeys, key] })),
      isDismissed: (key) => get().dismissedKeys.includes(key),
    }),
    { name: "perze-budget-closure-banner", version: 1, ...sanitizedPersist<BudgetClosureBannerState, { dismissedKeys: string[] }>(sanitize) }
  )
);

export function budgetClosureKey(budgetId: string, periodEnd: Date): string {
  return `${budgetId}:${periodEnd.toISOString().slice(0, 10)}`;
}
