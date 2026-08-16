import { create } from "zustand";
import { persist } from "zustand/middleware";
import { sanitizedPersist, stringArrayOr } from "@/lib/stores/persist-sanitize";

/**
 * Sugerencias de recurrentes descartadas — apagado definitivo, sin
 * reaparición automática (mismo criterio que `dismissedForever` en
 * `reminder-banner-store.ts`, no el de `birthday-banner-store.ts` que
 * vuelve el año que viene). `key` es `RecurringCandidate.key`
 * (`payeeId:frequency:monto`, ver `recurring-detection.ts`): si el patrón
 * real cambia — otro monto, otra frecuencia — la clave cambia sola y la
 * sugerencia puede volver a aparecer, que es lo correcto (no es la misma
 * sugerencia, es una nueva).
 */
interface RecurringSuggestionsState {
  dismissedKeys: string[];
  dismiss: (key: string) => void;
}

type PersistedRecurringSuggestions = Pick<RecurringSuggestionsState, "dismissedKeys">;

function sanitize(persisted: unknown): PersistedRecurringSuggestions {
  const p = (persisted ?? {}) as Record<string, unknown>;
  return { dismissedKeys: stringArrayOr()(p.dismissedKeys) };
}

export const useRecurringSuggestionsStore = create<RecurringSuggestionsState>()(
  persist(
    (set, get) => ({
      dismissedKeys: [],
      dismiss: (key) => set({ dismissedKeys: [...get().dismissedKeys, key] }),
    }),
    { name: "perze-recurring-suggestions", version: 1, ...sanitizedPersist<RecurringSuggestionsState, PersistedRecurringSuggestions>(sanitize) }
  )
);
