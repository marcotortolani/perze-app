import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AccountKind } from "@/lib/db/schema";
import type { FirstTxStep } from "@/lib/onboarding/first-tx-machine";
import { boolOr, nullableStringOr, sanitizedPersist, stringOr } from "@/lib/stores/persist-sanitize";

/**
 * Borrador de onboarding (Bloque A) — decisiones que se van tomando entre
 * A4a y A6 antes de que exista el household real (recién se crea al
 * final, A11), y el estado post-A11: el primer ingreso, el primer gasto y
 * la instalación de la PWA (A10) salen del camino crítico y se piden
 * después de A11, guiados por `firstTxStep` (`src/lib/onboarding/first-tx-machine.ts`).
 * A7 (saldo inicial) se eliminó del flujo — el saldo queda editable desde
 * la cuenta.
 */
export type HouseholdUsage = "solo" | "pareja" | "familia";

interface OnboardingDraft {
  email: string;
  /** A4a — nombre visible; puede llegar precargado del trigger `handle_new_user()`, pero el usuario lo confirma o lo cambia acá. */
  displayName: string;
  usage: HouseholdUsage | null;
  countryCode: string;
  currencyCode: string;
  /** `true` recién después de tocar "Continuar" en A4 — distingue "el
   *  usuario ya eligió país y moneda" de "`countryCode`/`currencyCode`
   *  están en su default sin tocar". Sin esto, volver a A4 desde A4b no
   *  puede distinguir esos dos casos (el default coincide con un país
   *  real, Uruguay) y siempre vuelve a auto-detectar, pisando una
   *  elección real. */
  countryConfirmed: boolean;
  /** Nombre visible del preset elegido en A6 — puede ser una marca
   *  (`"Itaú"`) o, para "Efectivo"/"Otro", el label ya traducido al
   *  idioma de la app. `accountKind` es la identidad real: separarla del
   *  label es lo que permite traducir "Efectivo"/"Otro" sin romper la
   *  inferencia de tipo de cuenta que antes comparaba este string a mano. */
  accountPreset: string | null;
  accountKind: AccountKind | null;
  /** `null` = fuera del flujo post-A11. Ver `first-tx-machine.ts` para las transiciones. */
  firstTxStep: FirstTxStep | null;
}

interface OnboardingState {
  draft: OnboardingDraft;
  setField: <K extends keyof OnboardingDraft>(key: K, value: OnboardingDraft[K]) => void;
  reset: () => void;
}

function emptyDraft(): OnboardingDraft {
  return {
    email: "",
    displayName: "",
    usage: null,
    countryCode: "UY",
    currencyCode: "UYU",
    countryConfirmed: false,
    accountPreset: null,
    accountKind: null,
    firstTxStep: null,
  };
}

const USAGES = ["solo", "pareja", "familia"] as const;
const ACCOUNT_KINDS = ["cash", "checking", "savings", "credit_card", "wallet", "broker", "loan", "receivable", "other"] as const;
const FIRST_TX_STEPS = ["income", "expense", "install"] as const;

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
      displayName: stringOr(empty.displayName)(d.displayName),
      usage: nullableOneOf(USAGES, d.usage),
      countryCode: stringOr(empty.countryCode)(d.countryCode),
      currencyCode: stringOr(empty.currencyCode)(d.currencyCode),
      countryConfirmed: boolOr(empty.countryConfirmed)(d.countryConfirmed),
      accountPreset: nullableStringOr()(d.accountPreset),
      accountKind: nullableOneOf(ACCOUNT_KINDS, d.accountKind),
      firstTxStep: nullableOneOf(FIRST_TX_STEPS, d.firstTxStep),
    },
  };
}

/**
 * v1 → v2: `pendingBalanceAccountId` (A7, eliminada) se reemplaza por
 * `firstTxStep` + se suma `displayName`. v2 → v3: se suma `countryConfirmed`.
 * No hace falta un `migrate` escrito a mano en ninguno de los dos casos:
 * `sanitizedPersist()` ya arma `migrate`/`merge` a partir de `sanitize()`
 * — un payload de una versión vieja simplemente pierde las claves muertas
 * y gana las nuevas con su default (`sanitize` ignora cualquier clave que
 * no lea explícitamente).
 */
export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      draft: emptyDraft(),
      setField: (key, value) => set((s) => ({ draft: { ...s.draft, [key]: value } })),
      reset: () => set({ draft: emptyDraft() }),
    }),
    { name: "perze-onboarding", version: 3, ...sanitizedPersist<OnboardingState, { draft: OnboardingDraft }>(sanitize) }
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
