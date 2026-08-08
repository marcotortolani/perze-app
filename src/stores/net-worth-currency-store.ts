import { create } from "zustand";
import { persist } from "zustand/middleware";
import { oneOf, sanitizedPersist } from "@/lib/stores/persist-sanitize";

export type NetWorthDisplayCurrency = "base" | "usd";

/** Preferencia del toggle "ver patrimonio en USD" del home — solo la cifra héroe, nunca el delta ni el sparkline (esos son tendencia diaria en moneda base, no una cifra que se lea como saldo). */
interface NetWorthCurrencyState {
  displayCurrency: NetWorthDisplayCurrency;
  setDisplayCurrency: (value: NetWorthDisplayCurrency) => void;
}

const DISPLAY_CURRENCIES = ["base", "usd"] as const;

function sanitize(persisted: unknown): { displayCurrency: NetWorthDisplayCurrency } {
  const p = (persisted ?? {}) as Record<string, unknown>;
  return { displayCurrency: oneOf(DISPLAY_CURRENCIES, "base")(p.displayCurrency) };
}

export const useNetWorthCurrencyStore = create<NetWorthCurrencyState>()(
  persist(
    (set) => ({
      displayCurrency: "base",
      setDisplayCurrency: (value) => set({ displayCurrency: value }),
    }),
    {
      name: "perze-net-worth-currency",
      version: 1,
      ...sanitizedPersist<NetWorthCurrencyState, { displayCurrency: NetWorthDisplayCurrency }>(sanitize),
    }
  )
);
