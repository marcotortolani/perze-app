import { create } from "zustand";
import { persist } from "zustand/middleware";
import { oneOf, sanitizedPersist } from "@/lib/stores/persist-sanitize";

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

type PersistedFormatPreferences = Pick<FormatPreferencesState, "decimalSeparator" | "dateFormat" | "weekStart">;

const DECIMAL_SEPARATORS = ["locale", "comma", "period"] as const;
const DATE_FORMATS = ["locale", "dmy", "mdy", "ymd"] as const;
const WEEK_STARTS = ["monday", "sunday"] as const;

function sanitize(persisted: unknown): PersistedFormatPreferences {
  const p = (persisted ?? {}) as Record<string, unknown>;
  return {
    decimalSeparator: oneOf(DECIMAL_SEPARATORS, "locale")(p.decimalSeparator),
    dateFormat: oneOf(DATE_FORMATS, "locale")(p.dateFormat),
    weekStart: oneOf(WEEK_STARTS, "monday")(p.weekStart),
  };
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
    {
      name: "perze-format-preferences",
      version: 1,
      ...sanitizedPersist<FormatPreferencesState, PersistedFormatPreferences>(sanitize),
    }
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
