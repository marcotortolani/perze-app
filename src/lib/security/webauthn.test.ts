// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isBiometricAvailable, registerBiometric, verifyBiometric } from "./webauthn";

const originalPublicKeyCredential = (window as { PublicKeyCredential?: unknown }).PublicKeyCredential;
const originalCredentials = navigator.credentials;

afterEach(() => {
  (window as { PublicKeyCredential?: unknown }).PublicKeyCredential = originalPublicKeyCredential;
  Object.defineProperty(navigator, "credentials", { value: originalCredentials, configurable: true });
  vi.restoreAllMocks();
});

describe("isBiometricAvailable", () => {
  it("false si el navegador no tiene WebAuthn", async () => {
    (window as { PublicKeyCredential?: unknown }).PublicKeyCredential = undefined;
    expect(await isBiometricAvailable()).toBe(false);
  });

  it("refleja lo que devuelve isUserVerifyingPlatformAuthenticatorAvailable", async () => {
    (window as { PublicKeyCredential?: unknown }).PublicKeyCredential = {
      isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
    };
    expect(await isBiometricAvailable()).toBe(true);
  });

  it("false si la llamada del navegador lanza (en vez de propagar el error)", async () => {
    (window as { PublicKeyCredential?: unknown }).PublicKeyCredential = {
      isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockRejectedValue(new Error("boom")),
    };
    expect(await isBiometricAvailable()).toBe(false);
  });
});

describe("registerBiometric / verifyBiometric", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: {
        create: vi.fn().mockResolvedValue({ rawId: new Uint8Array([1, 2, 3, 4]).buffer }),
        get: vi.fn().mockResolvedValue({}),
      },
    });
  });

  it("enrola y devuelve un id reusable para verificar", async () => {
    const credentialId = await registerBiometric("PERZE device lock");
    expect(typeof credentialId).toBe("string");
    expect(credentialId.length).toBeGreaterThan(0);

    const ok = await verifyBiometric(credentialId);
    expect(ok).toBe(true);
    expect(navigator.credentials.get).toHaveBeenCalledOnce();
  });

  it("una cancelación o falla del sensor se resuelve a false, nunca lanza", async () => {
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: { get: vi.fn().mockRejectedValue(new Error("NotAllowedError")) },
    });
    await expect(verifyBiometric("cred-id")).resolves.toBe(false);
  });
});
