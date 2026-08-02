import { create } from "zustand";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

interface PwaState {
  /**
   * El navegador dispara `beforeinstallprompt` una sola vez, apenas se
   * cumplen sus heurísticas — puede pasar antes de que el usuario visite
   * Ajustes. Por eso el listener vive una sola vez en `Providers` (ver
   * `pwa-install-listener.tsx`) y guarda el evento acá, no en cada pantalla
   * que lo necesita (Ajustes K3 y el post-primer-gasto A10, que antes tenía
   * su propio listener duplicado).
   */
  deferredPrompt: BeforeInstallPromptEvent | null;
  setDeferredPrompt: (event: BeforeInstallPromptEvent | null) => void;
}

export const usePwaStore = create<PwaState>((set) => ({
  deferredPrompt: null,
  setDeferredPrompt: (deferredPrompt) => set({ deferredPrompt }),
}));
