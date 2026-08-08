// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { useFormatPreferencesStore } from "./format-preferences-store";
import { useOnboardingStore } from "./onboarding-store";
import { usePinStore } from "./pin-store";

/**
 * Prueba de extremo a extremo del bump a `version: 1`: siembra un envelope
 * `v0` (la forma que ya existe en el navegador de cualquier usuario
 * instalado hoy) directo en `localStorage`, dispara `persist.rehydrate()`
 * y verifica que el campo bueno sobrevive y el corrupto cae a su default
 * — sin que `zustand` tire por el mismatch de versión.
 */
describe("migración de persist v0 → v1", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("format-preferences-store: conserva el campo válido, sanea el corrupto", async () => {
    window.localStorage.setItem(
      "perze-format-preferences",
      JSON.stringify({ state: { decimalSeparator: "comma", dateFormat: "xxx", weekStart: "sunday" }, version: 0 })
    );

    await useFormatPreferencesStore.persist.rehydrate();

    const state = useFormatPreferencesStore.getState();
    expect(state.decimalSeparator).toBe("comma");
    expect(state.dateFormat).toBe("locale");
    expect(state.weekStart).toBe("sunday");

    const raw = window.localStorage.getItem("perze-format-preferences");
    expect(raw && JSON.parse(raw).version).toBe(1);
  });

  it("onboarding-store: conserva el draft válido, sanea `usage` corrupto sin perder el resto", async () => {
    window.localStorage.setItem(
      "perze-onboarding",
      JSON.stringify({
        state: {
          draft: {
            email: "vale.mendez@gmail.com",
            usage: "no-existe",
            countryCode: "AR",
            currencyCode: "ARS",
            accountPreset: "Itaú",
            accountKind: "checking",
            pendingBalanceAccountId: null,
          },
        },
        version: 0,
      })
    );

    await useOnboardingStore.persist.rehydrate();

    const { draft } = useOnboardingStore.getState();
    expect(draft.email).toBe("vale.mendez@gmail.com");
    expect(draft.usage).toBeNull();
    expect(draft.countryCode).toBe("AR");
    expect(draft.accountKind).toBe("checking");
  });

  it("pin-store: un `failedAttempts` corrupto cae a 0 sin tocar el hash/sal opacos", async () => {
    window.localStorage.setItem(
      "perze-pin",
      JSON.stringify({
        state: {
          enabled: true,
          pinHash: "abc",
          pinSalt: "xyz",
          failedAttempts: "not-a-number",
          lockedUntil: null,
          biometricEnabled: false,
          biometricCredentialId: null,
        },
        version: 0,
      })
    );

    await usePinStore.persist.rehydrate();

    const state = usePinStore.getState();
    expect(state.enabled).toBe(true);
    expect(state.pinHash).toBe("abc");
    expect(state.pinSalt).toBe("xyz");
    expect(state.failedAttempts).toBe(0);
  });
});
