import { create } from "zustand";
import { persist } from "zustand/middleware";
import { sanitizedPersist, stringArrayOr } from "@/lib/stores/persist-sanitize";

/**
 * Anomalías descartadas — apagado definitivo, sin reaparición automática
 * (mismo criterio que `recurring-suggestions-store.ts`). La clave es el
 * `transactionId` del movimiento marcado como atípico: estable mientras el
 * movimiento exista, y si se edita el monto/categoría el detector lo
 * reevalúa de cero en la próxima corrida — puede volver a aparecer con
 * otro `mz`, que es lo correcto (ya no es la misma anomalía).
 */
interface AnomalyDismissalsState {
  dismissedIds: string[];
  dismiss: (transactionId: string) => void;
}

type PersistedAnomalyDismissals = Pick<AnomalyDismissalsState, "dismissedIds">;

function sanitize(persisted: unknown): PersistedAnomalyDismissals {
  const p = (persisted ?? {}) as Record<string, unknown>;
  return { dismissedIds: stringArrayOr()(p.dismissedIds) };
}

export const useAnomalyDismissalsStore = create<AnomalyDismissalsState>()(
  persist(
    (set, get) => ({
      dismissedIds: [],
      dismiss: (transactionId) => set({ dismissedIds: [...get().dismissedIds, transactionId] }),
    }),
    { name: "perze-anomaly-dismissals", version: 1, ...sanitizedPersist<AnomalyDismissalsState, PersistedAnomalyDismissals>(sanitize) }
  )
);
