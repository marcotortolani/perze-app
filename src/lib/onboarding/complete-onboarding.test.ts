import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, resetDbForTests } from "../db/client";
import { accountsRepo } from "../repos/accounts-repo";
import { householdsRepo } from "../repos/households-repo";
import { completeOnboarding } from "./complete-onboarding";

describe("completeOnboarding (B6)", () => {
  beforeEach(() => {
    resetDbForTests(`perze-test-onboarding-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await getDb().delete();
  });

  it("crea household + member + categorías + cuenta, y activa el household al final", async () => {
    const result = await completeOnboarding({
      userId: "user-1",
      countryCode: "UY",
      currencyCode: "UYU",
      usage: "solo",
      accountName: "Efectivo",
      accountKind: "cash",
    });

    expect(await householdsRepo.get(result.householdId)).toBeDefined();
    expect(await householdsRepo.listMembers(result.householdId)).toHaveLength(1);
    expect(await accountsRepo.get(result.accountId)).toBeDefined();
    expect(await householdsRepo.getCurrentHouseholdId()).toBe(result.householdId);
  });

  it("B6 — si un paso falla a mitad de camino, no queda un household activo a medias (todo o nada)", async () => {
    vi.spyOn(accountsRepo, "create").mockRejectedValue(new Error("fallo simulado"));

    await expect(
      completeOnboarding({
        userId: "user-1",
        countryCode: "UY",
        currencyCode: "UYU",
        usage: "solo",
        accountName: "Efectivo",
        accountKind: "cash",
      })
    ).rejects.toThrow("fallo simulado");

    // Nada de lo anterior (household, member, categorías) debería haber quedado escrito.
    const db = getDb();
    expect(await db.households.count()).toBe(0);
    expect(await db.householdMembers.count()).toBe(0);
    expect(await db.categories.count()).toBe(0);
    expect(await householdsRepo.getCurrentHouseholdId()).toBeUndefined();
  });
});
