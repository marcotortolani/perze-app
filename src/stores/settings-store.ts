import { create } from "zustand"
import { persist } from "zustand/middleware"
import {
  type AccentColor,
  type Country,
  type Currency,
  type Theme,
  DEFAULT_COUNTRIES,
  DEFAULT_CURRENCIES,
} from "@/lib/types"

interface SettingsState {
  displayCurrencyCode: string
  theme: Theme
  accentColor: AccentColor
  currencies: Currency[]
  countries: Country[]
}

interface SettingsActions {
  setDisplayCurrency: (code: string) => void
  setTheme: (theme: Theme) => void
  setAccentColor: (color: AccentColor) => void

  addCurrency: (currency: Currency) => void
  updateCurrency: (code: string, data: Partial<Currency>) => void
  removeCurrency: (code: string) => void

  addCountry: (country: Country) => void
  updateCountry: (code: string, data: Partial<Country>) => void
  removeCountry: (code: string) => void
}

type SettingsStore = SettingsState & SettingsActions

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      // ─── State ────────────────────────────────────────────────────────────
      displayCurrencyCode: "USD",
      theme: "system",
      accentColor: "emerald",
      currencies: DEFAULT_CURRENCIES,
      countries: DEFAULT_COUNTRIES,

      // ─── Actions ──────────────────────────────────────────────────────────
      setDisplayCurrency: (code) => set({ displayCurrencyCode: code }),
      setTheme: (theme) => set({ theme }),
      setAccentColor: (accentColor) => set({ accentColor }),

      addCurrency: (currency) =>
        set((state) => ({
          currencies: [...state.currencies, currency],
        })),

      updateCurrency: (code, data) =>
        set((state) => ({
          currencies: state.currencies.map((c) =>
            c.code === code ? { ...c, ...data } : c
          ),
        })),

      removeCurrency: (code) =>
        set((state) => ({
          currencies: state.currencies.filter((c) => c.code !== code),
        })),

      addCountry: (country) =>
        set((state) => ({
          countries: [...state.countries, country],
        })),

      updateCountry: (code, data) =>
        set((state) => ({
          countries: state.countries.map((c) =>
            c.code === code ? { ...c, ...data } : c
          ),
        })),

      removeCountry: (code) =>
        set((state) => ({
          countries: state.countries.filter((c) => c.code !== code),
        })),
    }),
    { name: "finanzas-settings" }
  )
)
