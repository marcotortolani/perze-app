import { create } from "zustand";
import { persist } from "zustand/middleware";
import { constantTimeEqual, generateSalt, hashPin, hashPinLegacy } from "@/lib/security/pin-hash";
import { boolOr, nullableNumberOr, nullableStringOr, sanitizedPersist } from "@/lib/stores/persist-sanitize";

/** 3 intentos errados = 30s de espera — nunca borrado de datos (CLAUDE.md § PIN). */
const LOCKOUT_AFTER_ATTEMPTS = 3;
const LOCKOUT_MS = 30_000;

interface PinState {
  enabled: boolean;
  pinHash: string | null;
  /** `null` = hash legacy sin sal (pre-B12), todavía no migrado. */
  pinSalt: string | null;
  failedAttempts: number;
  lockedUntil: number | null;
  setPin: (pin: string) => Promise<void>;
  disable: () => void;
  verify: (pin: string) => Promise<boolean>;
  /** Segundos restantes de bloqueo, 0 si no está bloqueado. */
  lockoutSecondsRemaining: () => number;

  /**
   * §2 — biometría local (WebAuthn), alternativa al PIN para el mismo
   * gate de re-entrada. El PIN sigue siendo obligatorio como fallback: no
   * existe un estado donde solo haya biometría y ningún PIN configurado
   * (`securityPage` no ofrece el toggle hasta que el PIN ya está armado).
   */
  biometricEnabled: boolean;
  biometricCredentialId: string | null;
  enableBiometric: (credentialId: string) => void;
  disableBiometric: () => void;
}

type PersistedPin = Pick<
  PinState,
  "enabled" | "pinHash" | "pinSalt" | "failedAttempts" | "lockedUntil" | "biometricEnabled" | "biometricCredentialId"
>;

/**
 * `pinHash`/`pinSalt` no se regeneran acá — son datos opacos y ya tienen su
 * propia migración legacy (sin sal → con sal) adentro de `verify()`. Este
 * saneamiento solo evita que un valor corrupto (no string, no null) los
 * deje en un tipo que rompa `constantTimeEqual`/`hashPin` más adelante.
 */
function sanitize(persisted: unknown): PersistedPin {
  const p = (persisted ?? {}) as Record<string, unknown>;
  return {
    enabled: boolOr(false)(p.enabled),
    pinHash: nullableStringOr()(p.pinHash),
    pinSalt: nullableStringOr()(p.pinSalt),
    failedAttempts: typeof p.failedAttempts === "number" && Number.isFinite(p.failedAttempts) ? p.failedAttempts : 0,
    lockedUntil: nullableNumberOr()(p.lockedUntil),
    biometricEnabled: boolOr(false)(p.biometricEnabled),
    biometricCredentialId: nullableStringOr()(p.biometricCredentialId),
  };
}

export const usePinStore = create<PinState>()(
  persist(
    (set, get) => ({
      enabled: false,
      pinHash: null,
      pinSalt: null,
      failedAttempts: 0,
      lockedUntil: null,
      biometricEnabled: false,
      biometricCredentialId: null,

      setPin: async (pin) => {
        const salt = generateSalt();
        const pinHash = await hashPin(pin, salt);
        set({ enabled: true, pinHash, pinSalt: salt, failedAttempts: 0, lockedUntil: null });
      },

      disable: () =>
        set({
          enabled: false,
          pinHash: null,
          pinSalt: null,
          failedAttempts: 0,
          lockedUntil: null,
          // Sin PIN no hay fallback — la biometría no puede quedar activa sola.
          biometricEnabled: false,
          biometricCredentialId: null,
        }),

      verify: async (pin) => {
        const { pinHash, pinSalt, lockedUntil } = get();
        if (lockedUntil && Date.now() < lockedUntil) return false;

        let ok: boolean;
        if (pinSalt) {
          ok = constantTimeEqual(await hashPin(pin, pinSalt), pinHash ?? "");
        } else {
          // B12 — migración transparente: el hash legacy (pre-sal) todavía
          // vive acá. Si el PIN tipeado matchea contra el esquema viejo, se
          // re-hashea con PBKDF2 + sal nueva y se reemplaza — nunca se
          // vuelve a escribir un hash sin sal a partir de acá.
          ok = constantTimeEqual(await hashPinLegacy(pin), pinHash ?? "");
          if (ok) {
            const salt = generateSalt();
            const migratedHash = await hashPin(pin, salt);
            set({ pinHash: migratedHash, pinSalt: salt });
          }
        }

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

      enableBiometric: (credentialId) => set({ biometricEnabled: true, biometricCredentialId: credentialId }),
      disableBiometric: () => set({ biometricEnabled: false, biometricCredentialId: null }),
    }),
    {
      name: "perze-pin",
      version: 1,
      // B8 — antes `partialize` solo guardaba `enabled`/`pinHash`:
      // `failedAttempts`/`lockedUntil` vivían solo en memoria y un F5 (o
      // cerrar y volver a abrir la pestaña) anulaba el lockout de 30s a
      // mitad de la espera. Ahora sobreviven al reload.
      partialize: (state) => ({
        enabled: state.enabled,
        pinHash: state.pinHash,
        pinSalt: state.pinSalt,
        failedAttempts: state.failedAttempts,
        lockedUntil: state.lockedUntil,
        biometricEnabled: state.biometricEnabled,
        biometricCredentialId: state.biometricCredentialId,
      }),
      ...sanitizedPersist<PinState, PersistedPin>(sanitize),
    }
  )
);
