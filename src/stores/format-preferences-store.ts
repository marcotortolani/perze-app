import { create } from "zustand";
import { persist } from "zustand/middleware";

/** `"locale"` = derivar del idioma de la app (comportamiento de siempre). Nunca toca cómo se guarda un monto/fecha — solo cómo se muestra. */
export type DecimalSeparatorPref = "locale" | "comma" | "period";
export type DateFormatPref = "locale" | "dmy" | "mdy" | "ymd";
/** Día en que arranca la grilla semanal de cualquier calendario de la app — nunca toca qué día es "hoy", solo el orden de las columnas. */
export type WeekStartPref = "monday" | "sunday";

interface FormatPreferencesState {
  decimalSeparator: DecimalSeparatorPref;
  dateFormat: DateFormatPref;
  weekStart: WeekStartPref;
  setDecimalSeparator: (value: DecimalSeparatorPref) => void;
  setDateFormat: (value: DateFormatPref) => void;
  setWeekStart: (value: WeekStartPref) => void;
}

export const useFormatPreferencesStore = create<FormatPreferencesState>()(
  persist(
    (set) => ({
      decimalSeparator: "locale",
      dateFormat: "locale",
      weekStart: "monday",
      setDecimalSeparator: (value) => set({ decimalSeparator: value }),
      setDateFormat: (value) => set({ dateFormat: value }),
      setWeekStart: (value) => set({ weekStart: value }),
    }),
    { name: "perze-format-preferences" }
  )
);

export function useDateFormatPreference(): DateFormatPref {
  return useFormatPreferencesStore((s) => s.dateFormat);
}

export function useWeekStartPreference(): WeekStartPref {
  return useFormatPreferencesStore((s) => s.weekStart);
}

/** `Date.getDay()` — 0 = domingo, 1 = lunes — para enchufar directo en `monthGrid`/`weekdayAnchors`/`MonthCalendar`. */
export function weekStartsOnFor(pref: WeekStartPref): 0 | 1 {
  return pref === "sunday" ? 0 : 1;
}

export function useWeekStartsOn(): 0 | 1 {
  return weekStartsOnFor(useWeekStartPreference());
}
