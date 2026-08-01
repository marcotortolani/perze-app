import { create } from "zustand";
import { persist } from "zustand/middleware";
import { hashPin } from "@/lib/security/pin-hash";

/** 3 intentos errados = 30s de espera — nunca borrado de datos (CLAUDE.md § PIN). */
const LOCKOUT_AFTER_ATTEMPTS = 3;
const LOCKOUT_MS = 30_000;

interface PinState {
  enabled: boolean;
  pinHash: string | null;
  failedAttempts: number;
  lockedUntil: number | null;
  setPin: (pin: string) => Promise<void>;
  disable: () => void;
  verify: (pin: string) => Promise<boolean>;
  /** Segundos restantes de bloqueo, 0 si no está bloqueado. */
  lockoutSecondsRemaining: () => number;
}

export const usePinStore = create<PinState>()(
  persist(
    (set, get) => ({
      enabled: false,
      pinHash: null,
      failedAttempts: 0,
      lockedUntil: null,

      setPin: async (pin) => {
        const pinHash = await hashPin(pin);
        set({ enabled: true, pinHash, failedAttempts: 0, lockedUntil: null });
      },

      disable: () => set({ enabled: false, pinHash: null, failedAttempts: 0, lockedUntil: null }),

      verify: async (pin) => {
        const { pinHash, lockedUntil } = get();
        if (lockedUntil && Date.now() < lockedUntil) return false;
        const candidate = await hashPin(pin);
        const ok = candidate === pinHash;
        if (ok) {
          set({ failedAttempts: 0, lockedUntil: null });
          return true;
        }
        const attempts = get().failedAttempts + 1;
        const lockNow = attempts >= LOCKOUT_AFTER_ATTEMPTS;
        set({ failedAttempts: lockNow ? 0 : attempts, lockedUntil: lockNow ? Date.now() + LOCKOUT_MS : null });
        return false;
      },

      lockoutSecondsRemaining: () => {
        const { lockedUntil } = get();
        if (!lockedUntil) return 0;
        return Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      },
    }),
    { name: "perze-pin", partialize: (state) => ({ enabled: state.enabled, pinHash: state.pinHash }) }
  )
);
