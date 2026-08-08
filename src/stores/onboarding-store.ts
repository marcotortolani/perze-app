import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AccountKind } from "@/lib/db/schema";
import { nullableStringOr, sanitizedPersist, stringOr } from "@/lib/stores/persist-sanitize";

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
  /** Nombre visible del preset elegido en A6 — puede ser una marca
   *  (`"Itaú"`) o, para "Efectivo"/"Otro", el label ya traducido al
   *  idioma de la app. `accountKind` es la identidad real: separarla del
   *  label es lo que permite traducir "Efectivo"/"Otro" sin romper la
   *  inferencia de tipo de cuenta que antes comparaba este string a mano. */
  accountPreset: string | null;
  accountKind: AccountKind | null;
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
    accountKind: null,
    pendingBalanceAccountId: null,
  };
}

const USAGES = ["solo", "pareja", "familia"] as const;
const ACCOUNT_KINDS = ["cash", "checking", "savings", "credit_card", "wallet", "broker", "loan", "receivable", "other"] as const;

/** Unión nullable: a diferencia de `oneOf()`, acá `null` es un valor válido del dominio, no un fallback de corrupción. */
function nullableOneOf<T extends string>(allowed: readonly T[], value: unknown): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function sanitize(persisted: unknown): { draft: OnboardingDraft } {
  const p = ((persisted ?? {}) as Record<string, unknown>).draft as Record<string, unknown> | undefined;
  const d = p ?? {};
  const empty = emptyDraft();
  return {
    draft: {
      email: stringOr(empty.email)(d.email),
      usage: nullableOneOf(USAGES, d.usage),
      countryCode: stringOr(empty.countryCode)(d.countryCode),
      currencyCode: stringOr(empty.currencyCode)(d.currencyCode),
      accountPreset: nullableStringOr()(d.accountPreset),
      accountKind: nullableOneOf(ACCOUNT_KINDS, d.accountKind),
      pendingBalanceAccountId: nullableStringOr()(d.pendingBalanceAccountId),
    },
  };
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      draft: emptyDraft(),
      setField: (key, value) => set((s) => ({ draft: { ...s.draft, [key]: value } })),
      reset: () => set({ draft: emptyDraft() }),
    }),
    { name: "perze-onboarding", version: 1, ...sanitizedPersist<OnboardingState, { draft: OnboardingDraft }>(sanitize) }
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
