import { create } from "zustand";
import { persist } from "zustand/middleware";
import { oneOf, sanitizedPersist } from "@/lib/stores/persist-sanitize";

/**
 * Cuarto slot del tab bar, lo elige el usuario — `docs/02-design-system.md`
 * § 8. Default "Análisis". Solo se ofrecen las opciones activas (Cuentas
 * siempre; Inversiones/Presupuestos cuando su módulo está encendido — eso
 * se resuelve en la pantalla de Ajustes que todavía no existe). La app
 * nunca reconfigura esto sola.
 */
export type FourthTab = "analytics" | "accounts" | "investments" | "budgets";

interface NavState {
  fourthTab: FourthTab;
  setFourthTab: (tab: FourthTab) => void;
}

const FOURTH_TABS = ["analytics", "accounts", "investments", "budgets"] as const;

function sanitize(persisted: unknown): { fourthTab: FourthTab } {
  const p = (persisted ?? {}) as Record<string, unknown>;
  return { fourthTab: oneOf(FOURTH_TABS, "analytics")(p.fourthTab) };
}

export const useNavStore = create<NavState>()(
  persist(
    (set) => ({
      fourthTab: "analytics",
      setFourthTab: (fourthTab) => set({ fourthTab }),
    }),
    { name: "perze-fourth-tab", version: 1, ...sanitizedPersist<NavState, { fourthTab: FourthTab }>(sanitize) }
  )
);
