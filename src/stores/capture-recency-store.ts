import { create } from "zustand";

interface CaptureRecencyState {
  lastSavedTxId: string | null;
  lastSavedTxAt: number | null;
  recordSave: (transactionId: string) => void;
}

/**
 * B14 — "la transacción recién guardada se edita durante 60s sin
 * desbloquear" (CLAUDE.md § PIN). Deliberadamente NO persistido: es una
 * ventana de 60 segundos, sobrevivir a un refresh de página no aporta y
 * complicaría namespacear esto por usuario para nada.
 */
export const useCaptureRecencyStore = create<CaptureRecencyState>()((set) => ({
  lastSavedTxId: null,
  lastSavedTxAt: null,
  recordSave: (transactionId) => set({ lastSavedTxId: transactionId, lastSavedTxAt: Date.now() }),
}));
