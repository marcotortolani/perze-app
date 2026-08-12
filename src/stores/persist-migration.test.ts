// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { useFormatPreferencesStore } from "./format-preferences-store";
import { useOnboardingStore } from "./onboarding-store";
import { usePinStore } from "./pin-store";
import { useHomeLayoutMirrorStore } from "./home-layout-mirror-store";

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

  it("onboarding-store: v1 → v3 — `pendingBalanceAccountId` (A7, eliminada) se descarta y `displayName`/`firstTxStep`/`countryConfirmed` toman su default", async () => {
    window.localStorage.setItem(
      "perze-onboarding",
      JSON.stringify({
        state: {
          draft: {
            email: "vale.mendez@gmail.com",
            usage: "solo",
            countryCode: "UY",
            currencyCode: "UYU",
            accountPreset: "Efectivo",
            accountKind: "cash",
            pendingBalanceAccountId: "acc-123",
          },
        },
        version: 1,
      })
    );

    await useOnboardingStore.persist.rehydrate();

    const { draft } = useOnboardingStore.getState();
    expect(draft.email).toBe("vale.mendez@gmail.com");
    expect(draft.displayName).toBe("");
    expect(draft.firstTxStep).toBeNull();
    expect(draft.countryConfirmed).toBe(false);
    expect(draft).not.toHaveProperty("pendingBalanceAccountId");

    const raw = window.localStorage.getItem("perze-onboarding");
    expect(raw && JSON.parse(raw).version).toBe(3);
  });

  it("onboarding-store: v2 → v3 — un `countryConfirmed` ya guardado en `true` sobrevive la migración", async () => {
    window.localStorage.setItem(
      "perze-onboarding",
      JSON.stringify({
        state: {
          draft: {
            email: "vale.mendez@gmail.com",
            displayName: "Valentina",
            usage: "solo",
            countryCode: "AR",
            currencyCode: "ARS",
            countryConfirmed: true,
            accountPreset: null,
            accountKind: null,
            firstTxStep: null,
          },
        },
        version: 2,
      })
    );

    await useOnboardingStore.persist.rehydrate();

    const { draft } = useOnboardingStore.getState();
    expect(draft.countryCode).toBe("AR");
    expect(draft.currencyCode).toBe("ARS");
    expect(draft.countryConfirmed).toBe(true);
  });

  it("onboarding-store: un `firstTxStep` corrupto cae a null sin perder el resto", async () => {
    window.localStorage.setItem(
      "perze-onboarding",
      JSON.stringify({
        state: { draft: { email: "vale.mendez@gmail.com", displayName: "Valentina", firstTxStep: "no-existe" } },
        version: 2,
      })
    );

    await useOnboardingStore.persist.rehydrate();

    const { draft } = useOnboardingStore.getState();
    expect(draft.displayName).toBe("Valentina");
    expect(draft.firstTxStep).toBeNull();
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

  it("home-layout-mirror-store: un `doc` corrupto (JSON editado a mano, `v` desconocida) cae a null sin tirar", async () => {
    window.localStorage.setItem(
      "perze-home-layout",
      JSON.stringify({ state: { doc: { v: 99, left: "no-es-un-array" } }, version: 1 })
    );

    await useHomeLayoutMirrorStore.persist.rehydrate();

    expect(useHomeLayoutMirrorStore.getState().doc).toBeNull();
  });

  it("home-layout-mirror-store: un doc válido sobrevive la rehidratación", async () => {
    const doc = { v: 1 as const, left: ["b", "a"], right: ["c"], hidden: [] };
    window.localStorage.setItem("perze-home-layout", JSON.stringify({ state: { doc }, version: 1 }));

    await useHomeLayoutMirrorStore.persist.rehydrate();

    expect(useHomeLayoutMirrorStore.getState().doc).toEqual(doc);
  });
});
