import { describe, expect, it, beforeEach } from "vitest";
import { usePinStore } from "./pin-store";

function resetStore() {
  usePinStore.setState({ enabled: false, pinHash: null, failedAttempts: 0, lockedUntil: null });
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
  });
});
