import { create } from "zustand";
import { persist } from "zustand/middleware";
import { boolOr, sanitizedPersist } from "@/lib/stores/persist-sanitize";

/** Modo privacidad: difumina los montos con un tap — para abrir la app en el colectivo. */
interface PrivacyState {
  privacyMode: boolean;
  toggle: () => void;
  setPrivacyMode: (value: boolean) => void;
}

function sanitize(persisted: unknown): { privacyMode: boolean } {
  const p = (persisted ?? {}) as Record<string, unknown>;
  return { privacyMode: boolOr(false)(p.privacyMode) };
}

export const usePrivacyStore = create<PrivacyState>()(
  persist(
    (set) => ({
      privacyMode: false,
      toggle: () => set((s) => ({ privacyMode: !s.privacyMode })),
      setPrivacyMode: (value) => set({ privacyMode: value }),
    }),
    { name: "perze-privacy-mode", version: 1, ...sanitizedPersist<PrivacyState, { privacyMode: boolean }>(sanitize) }
  )
);
