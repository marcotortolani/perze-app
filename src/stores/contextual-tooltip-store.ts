import { create } from "zustand";
import { persist } from "zustand/middleware";
import { sanitizedPersist, stringArrayOr } from "@/lib/stores/persist-sanitize";

/** L5: un tooltip contextual se muestra una sola vez por `id`, nunca más de uno visible a la vez lo decide el caller. */
interface ContextualTooltipState {
  seen: string[];
  markSeen: (id: string) => void;
  hasSeen: (id: string) => boolean;
}

function sanitize(persisted: unknown): { seen: string[] } {
  const p = (persisted ?? {}) as Record<string, unknown>;
  return { seen: stringArrayOr()(p.seen) };
}

export const useContextualTooltipStore = create<ContextualTooltipState>()(
  persist(
    (set, get) => ({
      seen: [],
      markSeen: (id) => set((s) => (s.seen.includes(id) ? s : { seen: [...s.seen, id] })),
      hasSeen: (id) => get().seen.includes(id),
    }),
    { name: "perze-contextual-tooltips", version: 1, ...sanitizedPersist<ContextualTooltipState, { seen: string[] }>(sanitize) }
  )
);
