import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * El objetivo es contarle al usuario cosas que puede ajustar a su gusto
 * (cumpleaños, moneda, formato, tema, fondo de puntos, instalar la PWA,
 * más módulos) sin volverse ruido — así que hay dos niveles de apagado,
 * no uno:
 *
 * - **`lastDismissedOn`**: cerrar la X de HOY no vuelve a mostrar ningún
 *   recordatorio hasta mañana (se compara contra la fecha local del
 *   dispositivo) — silencio suave, sin decisión permanente.
 * - **`dismissedForever`**: "No mostrar más" — apagado definitivo, un
 *   link de baja jerarquía al lado de la X, nunca el mismo peso visual.
 *   A diferencia de `birthday-banner-store.ts` (que vuelve el año que
 *   viene), acá no hay reapertura automática.
 */
interface ReminderBannerState {
  dismissedForever: boolean;
  dismissForever: () => void;
  lastDismissedOn: string | null;
  dismissForToday: (isoDate: string) => void;
}

export const useReminderBannerStore = create<ReminderBannerState>()(
  persist(
    (set) => ({
      dismissedForever: false,
      dismissForever: () => set({ dismissedForever: true }),
      lastDismissedOn: null,
      dismissForToday: (isoDate) => set({ lastDismissedOn: isoDate }),
    }),
    { name: "perze-reminder-banner" }
  )
);
