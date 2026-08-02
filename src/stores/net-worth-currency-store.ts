import { create } from "zustand";
import { persist } from "zustand/middleware";

export type NetWorthDisplayCurrency = "base" | "usd";

/** Preferencia del toggle "ver patrimonio en USD" del home — solo la cifra héroe, nunca el delta ni el sparkline (esos son tendencia diaria en moneda base, no una cifra que se lea como saldo). */
interface NetWorthCurrencyState {
  displayCurrency: NetWorthDisplayCurrency;
  setDisplayCurrency: (value: NetWorthDisplayCurrency) => void;
}

export const useNetWorthCurrencyStore = create<NetWorthCurrencyState>()(
  persist(
    (set) => ({
      displayCurrency: "base",
      setDisplayCurrency: (value) => set({ displayCurrency: value }),
    }),
    { name: "perze-net-worth-currency" }
  )
);
