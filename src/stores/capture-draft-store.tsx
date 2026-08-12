"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createStore, useStore, type StoreApi } from "zustand";

export type CaptureKind = "expense" | "income" | "transfer";

export interface CaptureDraft {
  kind: CaptureKind;
  /** Buffer crudo del keypad — "1200+350" — se resuelve recién al confirmar. */
  amountExpression: string;
  currency: string;
  accountId: string | null;
  /** Solo `transfer`. */
  counterAccountId: string | null;
  /**
   * Solo `transfer` entre monedas distintas — override manual del rate
   * sugerido (`fxRepo.resolve`), ajustable con el slider ±5% de `FxEditor`.
   * `null` mientras no se toque: se resuelve el rate del día como siempre.
   */
  counterFxRateOverride: bigint | null;
  /**
   * Override manual de la conversión **de captura**: de `currency` (la
   * moneda en que se tipeó) a la moneda de la cuenta. `null` = se usa el
   * rate resuelto por `fxRepo.resolve` como siempre.
   *
   * Es un campo aparte de `counterFxRateOverride` a propósito, aunque los
   * dos guarden "una tasa que el usuario tocó": son **las dos conversiones
   * distintas** de `CLAUDE.md` § dinero. Esta va de moneda capturada a
   * moneda de cuenta y ocurre en la captura; la otra va de cuenta origen a
   * cuenta destino en una transferencia. Unificarlas en un solo campo es
   * exactamente el defecto V9 que esa sección existe para prevenir — y en
   * una transferencia entre monedas distintas las dos pueden estar vivas a
   * la vez.
   */
  captureFxRateOverride: bigint | null;
  /**
   * Solo `transfer`. A qué cuenta corresponde la moneda del monto tipeado
   * — `"account"` (origen) es el comportamiento de siempre: se tipea en la
   * moneda de origen y el destino se deriva. `"counterAccount"` (destino)
   * es el caso "pagar tarjeta": el monto es un dato fijo del lado del
   * destino (lo que hay que cubrir) y lo que se deriva es cuánto sale del
   * origen, que todavía puede no estar elegido.
   */
  amountPinnedTo: "account" | "counterAccount";
  categoryId: string | null;
  /** ISO datetime. */
  occurredAt: string;
  payeeName: string;
  note: string;
  tagIds: string[];
  /** Modo ráfaga (C8): sigue cargando, mantiene cuenta y fecha. */
  burstMode: boolean;
  burstCount: number;
}

interface CaptureDraftState {
  draft: CaptureDraft;
  setKind: (kind: CaptureKind) => void;
  appendToAmount: (token: string) => void;
  backspaceAmount: () => void;
  clearAmount: () => void;
  setField: <K extends keyof CaptureDraft>(key: K, value: CaptureDraft[K]) => void;
  /** Reinicia todo salvo lo que el modo ráfaga preserva (cuenta, fecha). */
  resetForBurst: () => void;
  reset: () => void;
}

function emptyDraft(): CaptureDraft {
  return {
    kind: "expense",
    amountExpression: "",
    currency: "",
    accountId: null,
    counterAccountId: null,
    counterFxRateOverride: null,
    captureFxRateOverride: null,
    amountPinnedTo: "account",
    categoryId: null,
    occurredAt: new Date().toISOString(),
    payeeName: "",
    note: "",
    tagIds: [],
    burstMode: false,
    burstCount: 0,
  };
}

function createCaptureDraftStateStore(initial?: Partial<CaptureDraft>): StoreApi<CaptureDraftState> {
  return createStore<CaptureDraftState>()((set, get) => ({
    draft: { ...emptyDraft(), ...initial },

    setKind: (kind) => set((s) => ({ draft: { ...s.draft, kind } })),

    appendToAmount: (token) =>
      set((s) => ({ draft: { ...s.draft, amountExpression: s.draft.amountExpression + token } })),

    backspaceAmount: () =>
      set((s) => ({ draft: { ...s.draft, amountExpression: s.draft.amountExpression.slice(0, -1) } })),

    clearAmount: () => set((s) => ({ draft: { ...s.draft, amountExpression: "" } })),

    setField: (key, value) => set((s) => ({ draft: { ...s.draft, [key]: value } })),

    resetForBurst: () => {
      const { accountId, currency, occurredAt } = get().draft;
      set((s) => ({
        draft: {
          ...emptyDraft(),
          accountId,
          currency,
          occurredAt,
          burstMode: true,
          burstCount: s.draft.burstCount + 1,
        },
      }));
    },

    reset: () => set({ draft: emptyDraft() }),
  }));
}

const CaptureDraftStoreContext = createContext<StoreApi<CaptureDraftState> | null>(null);

export interface CaptureDraftProviderProps {
  /** Prefill aplicado UNA sola vez, al crear el store — no reactivo: cambios posteriores en las props no lo vuelven a aplicar. */
  initial?: Partial<CaptureDraft> | undefined;
  children: ReactNode;
}

/**
 * Borrador de la captura en curso (Bloque C) — estado de UI efímero, no
 * dominio: se traduce a un `NewTransactionInput` recién al confirmar,
 * pasando por `lib/money`/`lib/fx`.
 *
 * El store es POR INSTANCIA, no singleton: cada `<CaptureDraftProvider>`
 * crea el suyo en memoria (una vez, con `useRef`), así que dos montajes
 * nunca se pisan. `CaptureFlow` y `EditTransactionFlow` montan cada uno el
 * suyo — cerrar la edición de un movimiento no deja nada para que el
 * próximo "+" herede, y viceversa.
 *
 * Antes era un `create()` global (un solo store para toda la app) y
 * dependía de resetearlo al montar `CaptureFlow` para "empezar limpio".
 * Ese reset corría en el efecto/inicializador de `CaptureFlow`, es decir
 * DESPUÉS de cualquier prefill que se hubiera escrito antes de navegar
 * (la nota del share target en `/add`, el kind sugerido desde
 * onboarding) — así que el reset se pisaba a sí mismo y esos prefills se
 * perdían siempre. La solución no es mover el reset a otro momento del
 * ciclo de vida (cerrar con el backdrop, un swipe-back o un cambio de tab
 * no garantizan que corra un cleanup), es que no haya nada que resetear:
 * un store nuevo por montaje arranca limpio por construcción, y el
 * prefill se pasa por `initial` — computado ANTES de crear el store, vía
 * `draftFromSearchParams` — nunca escrito encima de uno que ya existe.
 */
export function CaptureDraftProvider({ initial, children }: CaptureDraftProviderProps) {
  // `useState` con inicializador perezoso, no `useRef` — un ref no se
  // puede leer durante el render (React Compiler lo marca como error:
  // "Cannot access refs during render"), y el store SÍ se usa durante el
  // render (se pasa como `value` del contexto). El inicializador de
  // `useState` corre una sola vez, igual que un `useRef` lo haría, pero
  // por la vía que React considera segura para leer en render.
  const [store] = useState(() => createCaptureDraftStateStore(initial));
  return <CaptureDraftStoreContext.Provider value={store}>{children}</CaptureDraftStoreContext.Provider>;
}

/** Acceso al store crudo — para lectura no reactiva (`.getState()`), donde antes se usaba `useCaptureDraftStore.getState()` sobre el singleton. */
export function useCaptureDraftStoreApi(): StoreApi<CaptureDraftState> {
  const store = useContext(CaptureDraftStoreContext);
  if (!store) throw new Error("useCaptureDraftStore(Api) solo puede usarse dentro de <CaptureDraftProvider>");
  return store;
}

/** Selector reactivo — mismo uso que el `create()` de zustand de antes: `useCaptureDraftStore((s) => s.draft)`. */
export function useCaptureDraftStore<T>(selector: (state: CaptureDraftState) => T): T {
  return useStore(useCaptureDraftStoreApi(), selector);
}
