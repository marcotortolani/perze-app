import { create } from "zustand";
import { persist } from "zustand/middleware";

/** `"locale"` = derivar del idioma de la app (comportamiento de siempre). Nunca toca cómo se guarda un monto/fecha — solo cómo se muestra. */
export type DecimalSeparatorPref = "locale" | "comma" | "period";
export type DateFormatPref = "locale" | "dmy" | "mdy" | "ymd";

interface FormatPreferencesState {
  decimalSeparator: DecimalSeparatorPref;
  dateFormat: DateFormatPref;
  setDecimalSeparator: (value: DecimalSeparatorPref) => void;
  setDateFormat: (value: DateFormatPref) => void;
}

export const useFormatPreferencesStore = create<FormatPreferencesState>()(
  persist(
    (set) => ({
      decimalSeparator: "locale",
      dateFormat: "locale",
      setDecimalSeparator: (value) => set({ decimalSeparator: value }),
      setDateFormat: (value) => set({ dateFormat: value }),
    }),
    { name: "perze-format-preferences" }
  )
);

export function useDateFormatPreference(): DateFormatPref {
  return useFormatPreferencesStore((s) => s.dateFormat);
}
