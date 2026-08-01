import { describe, expect, it, beforeEach } from "vitest";
import { hashPinLegacy } from "@/lib/security/pin-hash";
import { usePinStore } from "./pin-store";

function resetStore() {
  usePinStore.setState({ enabled: false, pinHash: null, pinSalt: null, failedAttempts: 0, lockedUntil: null });
}

describe("pin-store", () => {
  beforeEach(resetStore);

  it("setPin enables the lock and verify accepts the right PIN", async () => {
    await usePinStore.getState().setPin("123456");
    expect(usePinStore.getState().enabled).toBe(true);
    await expect(usePinStore.getState().verify("123456")).resolves.toBe(true);
  });

  it("verify rejects a wrong PIN and increments failedAttempts", async () => {
    await usePinStore.getState().setPin("123456");
    await expect(usePinStore.getState().verify("000000")).resolves.toBe(false);
    expect(usePinStore.getState().failedAttempts).toBe(1);
  });

  it("locks out for 30s after 3 wrong attempts, never wiping the PIN", async () => {
    await usePinStore.getState().setPin("123456");
    await usePinStore.getState().verify("000000");
    await usePinStore.getState().verify("000000");
    await usePinStore.getState().verify("000000");
    expect(usePinStore.getState().lockoutSecondsRemaining()).toBeGreaterThan(0);
    expect(usePinStore.getState().pinHash).not.toBeNull();
    // Locked out: even the correct PIN is rejected until the lockout expires.
    await expect(usePinStore.getState().verify("123456")).resolves.toBe(false);
  });

  it("disable clears the PIN and lockout state", async () => {
    await usePinStore.getState().setPin("123456");
    usePinStore.getState().disable();
    expect(usePinStore.getState().enabled).toBe(false);
    expect(usePinStore.getState().pinHash).toBeNull();
    expect(usePinStore.getState().pinSalt).toBeNull();
  });

  it("B12 — setPin uses a per-device salt (PBKDF2), never the bare hash", async () => {
    await usePinStore.getState().setPin("123456");
    expect(usePinStore.getState().pinSalt).not.toBeNull();
    // El hash legacy sin sal de ese mismo PIN nunca debería coincidir con el nuevo.
    const legacy = await hashPinLegacy("123456");
    expect(usePinStore.getState().pinHash).not.toBe(legacy);
  });

  it("B12 — migra en silencio un hash legacy (sin sal) al primer verify correcto", async () => {
    const legacyHash = await hashPinLegacy("123456");
    usePinStore.setState({ enabled: true, pinHash: legacyHash, pinSalt: null, failedAttempts: 0, lockedUntil: null });

    await expect(usePinStore.getState().verify("123456")).resolves.toBe(true);

    // Después del verify exitoso, ya no queda en el esquema viejo.
    expect(usePinStore.getState().pinSalt).not.toBeNull();
    expect(usePinStore.getState().pinHash).not.toBe(legacyHash);
    // Y el PIN sigue funcionando con el hash migrado.
    await expect(usePinStore.getState().verify("123456")).resolves.toBe(true);
  });
});
