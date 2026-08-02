import { create } from "zustand";

/**
 * AC-18 (`docs/auditoria-acceso.md`) — señal de que `DbOwnerSync` ya
 * resolvió QUÉ base Dexie corresponde a esta sesión (la anónima para
 * demo/deslogueado, `perze-<uid>` para una sesión real). Hasta que esto
 * sea `true`, cualquier lectura de household puede estar corriendo contra
 * la base equivocada: en un reload con sesión activa, la query resolvía
 * `null` contra la base anónima vacía, el gate lo leía como "sin
 * household" y mandaba a `/onboarding` — el flash que se veía en cada
 * recarga antes de entrar a la app.
 *
 * Sin `persist` a propósito: es estado de arranque de la pestaña, no una
 * preferencia.
 */
interface DbOwnerState {
  settled: boolean;
  setSettled: (settled: boolean) => void;
}

export const useDbOwnerStore = create<DbOwnerState>()((set) => ({
  settled: false,
  setSettled: (settled) => set({ settled }),
}));
