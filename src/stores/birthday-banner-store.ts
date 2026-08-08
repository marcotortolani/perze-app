import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nullableNumberOr, sanitizedPersist } from "@/lib/stores/persist-sanitize";

/** El banner de cumpleaños se puede cerrar — `dismissedYear` guarda el año en que se cerró, así que vuelve a aparecer el próximo cumpleaños sin volver a tocar código. */
interface BirthdayBannerState {
  dismissedYear: number | null;
  dismiss: (year: number) => void;
}

function sanitize(persisted: unknown): { dismissedYear: number | null } {
  const p = (persisted ?? {}) as Record<string, unknown>;
  return { dismissedYear: nullableNumberOr()(p.dismissedYear) };
}

export const useBirthdayBannerStore = create<BirthdayBannerState>()(
  persist(
    (set) => ({
      dismissedYear: null,
      dismiss: (year) => set({ dismissedYear: year }),
    }),
    { name: "perze-birthday-banner", version: 1, ...sanitizedPersist<BirthdayBannerState, { dismissedYear: number | null }>(sanitize) }
  )
);
