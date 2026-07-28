import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Borrador de onboarding (Bloque A) — decisiones que se van tomando entre
 * A2 y A6 antes de que exista el household real (recién se crea al final,
 * A11), y el estado post-A11: A7 (saldo inicial) y A10 (instalar PWA)
 * salen del camino crítico y se piden después del primer gasto real.
 */
export type HouseholdUsage = "solo" | "pareja" | "familia";

interface OnboardingDraft {
  email: string;
  usage: HouseholdUsage | null;
  countryCode: string;
  currencyCode: string;
  accountPreset: string | null;
  /** Cuenta creada al cerrar A11 — a la que todavía le falta el saldo real (A7). */
  pendingBalanceAccountId: string | null;
}

interface OnboardingState {
  draft: OnboardingDraft;
  setField: <K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => void;
  reset: () => void;
}

function emptyDraft(): OnboardingDraft {
  return {
    email: "",
    usage: null,
    countryCode: "UY",
    currencyCode: "UYU",
    accountPreset: null,
    pendingBalanceAccountId: null,
  };
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      draft: emptyDraft(),
      setField: (key, value) => set((s) => ({ draft: { ...s.draft, [key]: value } })),
      reset: () => set({ draft: emptyDraft() }),
    }),
    { name: "perze-onboarding" }
  )
);

/**
 * `persist` rehidrata desde `localStorage` de forma asíncrona: leer el
 * draft en el primer render (p. ej. para decidir un redirect) puede ver
 * todavía el estado inicial vacío, no el guardado. Este hook evita esa
 * carrera — `/onboarding/complete` lo usa antes de decidir si redirige.
 */
export function useOnboardingHydrated(): boolean {
  // El chequeo síncrono ya cubre el caso "ya hidrató antes del mount" en el
  // initializer; el efecto solo se suscribe para el caso restante (todavía
  // hidratando), nunca llama a `setHydrated` de forma incondicional.
  const [hydrated, setHydrated] = useState(() => useOnboardingStore.persist.hasHydrated());

  useEffect(() => {
    if (hydrated) return;
    return useOnboardingStore.persist.onFinishHydration(() => setHydrated(true));
  }, [hydrated]);

  return hydrated;
}
