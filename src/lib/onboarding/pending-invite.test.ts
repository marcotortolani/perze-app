// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearPendingInviteCode, getPendingInviteCode, PENDING_INVITE_KEY, setPendingInviteCode } from "./pending-invite";

describe("pendingInviteCode", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("guarda, lee y limpia", () => {
    expect(getPendingInviteCode()).toBeNull();
    setPendingInviteCode("AB2CD3EFGHJ");
    expect(window.localStorage.getItem(PENDING_INVITE_KEY)).toBe("AB2CD3EFGHJ");
    expect(getPendingInviteCode()).toBe("AB2CD3EFGHJ");
    clearPendingInviteCode();
    expect(getPendingInviteCode()).toBeNull();
  });

  it("trasvasa un código guardado bajo el nombre viejo `perze:pendingInvite`", () => {
    window.localStorage.setItem("perze:pendingInvite", "AB2CD3EFGHJ");

    expect(getPendingInviteCode()).toBe("AB2CD3EFGHJ");
    expect(window.localStorage.getItem(PENDING_INVITE_KEY)).toBe("AB2CD3EFGHJ");
    expect(window.localStorage.getItem("perze:pendingInvite")).toBeNull();
  });
});

describe("resolveOnboardingDestination", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  /** El household local siempre gana: quien ya está adentro no vuelve a canjear. */
  it("manda a la app si ya hay household local, aunque quede un código colgado", async () => {
    vi.doMock("../repos/households-repo", () => ({
      householdsRepo: { getCurrentHouseholdId: async () => "h1", hasRemoteHousehold: async () => true },
    }));
    setPendingInviteCode("AB2CD3EFGHJ");
    const { resolveOnboardingDestination } = await import("./resolve-destination");
    expect(await resolveOnboardingDestination()).toBe("/");
  });

  /** Lo que arregla el bug: sin esto el invitado creaba su propio household en A4. */
  it("manda a /join cuando hay una invitación pendiente y ningún household", async () => {
    vi.doMock("../repos/households-repo", () => ({
      householdsRepo: { getCurrentHouseholdId: async () => null, hasRemoteHousehold: async () => false },
    }));
    setPendingInviteCode("AB2CD3EFGHJ");
    const { resolveOnboardingDestination } = await import("./resolve-destination");
    expect(await resolveOnboardingDestination()).toBe("/join");
  });

  it("sin invitación pendiente sigue el camino de siempre", async () => {
    vi.doMock("../repos/households-repo", () => ({
      householdsRepo: { getCurrentHouseholdId: async () => null, hasRemoteHousehold: async () => false },
    }));
    const { resolveOnboardingDestination } = await import("./resolve-destination");
    expect(await resolveOnboardingDestination()).toBe("/onboarding/country");
  });
});
