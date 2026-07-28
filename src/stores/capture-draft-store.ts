import { create } from "zustand";

export type CaptureKind = "expense" | "income" | "transfer";

export interface CaptureDraft {
  kind: CaptureKind;
  /** Buffer crudo del keypad — "1200+350" — se resuelve recién al confirmar. */
  amountExpression: string;
  currency: string;
  accountId: string | null;
  /** Solo `transfer`. */
  counterAccountId: string | null;
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
    categoryId: null,
    occurredAt: new Date().toISOString(),
    payeeName: "",
    note: "",
    tagIds: [],
    burstMode: false,
    burstCount: 0,
  };
}

/**
 * Borrador de la captura en curso (Bloque C) — estado de UI efímero, no
 * dominio: se traduce a un `NewTransactionInput` recién al confirmar,
 * pasando por `lib/money`/`lib/fx`. Persistencia en Dexie para sobrevivir
 * un cierre a mitad de carga se agrega junto con la implementación del
 * Bloque C (`docs/perze-plan-redesign-first-5-blocks.md` § Fase 5).
 */
export const useCaptureDraftStore = create<CaptureDraftState>()((set, get) => ({
  draft: emptyDraft(),

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
