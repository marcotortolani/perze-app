import { create } from "zustand"
import { persist } from "zustand/middleware"
import { type ExchangeRate, DEFAULT_EXCHANGE_RATES } from "@/lib/types"

interface RatesState {
  rates: ExchangeRate[]
}

interface RatesActions {
  setRate: (currencyCode: string, perUSD: number) => void
  removeRate: (currencyCode: string) => void
  setRates: (rates: ExchangeRate[]) => void
  getRateForCurrency: (currencyCode: string) => ExchangeRate | undefined
}

type RatesStore = RatesState & RatesActions

export const useRatesStore = create<RatesStore>()(
  persist(
    (set, get) => ({
      // ─── State ────────────────────────────────────────────────────────────
      rates: DEFAULT_EXCHANGE_RATES,

      // ─── Actions ──────────────────────────────────────────────────────────
      setRate: (currencyCode, perUSD) =>
        set((state) => {
          const exists = state.rates.some((r) => r.currencyCode === currencyCode)
          const updatedAt = new Date().toISOString()

          if (exists) {
            return {
              rates: state.rates.map((r) =>
                r.currencyCode === currencyCode
                  ? { ...r, perUSD, updatedAt }
                  : r
              ),
            }
          }

          return {
            rates: [...state.rates, { currencyCode, perUSD, updatedAt }],
          }
        }),

      removeRate: (currencyCode) =>
        set((state) => ({
          rates: state.rates.filter((r) => r.currencyCode !== currencyCode),
        })),

      setRates: (rates) => set({ rates }),

      getRateForCurrency: (currencyCode) =>
        get().rates.find((r) => r.currencyCode === currencyCode),
    }),
    { name: "finanzas-rates" }
  )
)
