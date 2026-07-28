import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Modo privacidad: difumina los montos con un tap — para abrir la app en el colectivo. */
interface PrivacyState {
  privacyMode: boolean;
  toggle: () => void;
  setPrivacyMode: (value: boolean) => void;
}

export const usePrivacyStore = create<PrivacyState>()(
  persist(
    (set) => ({
      privacyMode: false,
      toggle: () => set((s) => ({ privacyMode: !s.privacyMode })),
      setPrivacyMode: (value) => set({ privacyMode: value }),
    }),
    { name: "perze-privacy-mode" }
  )
);
