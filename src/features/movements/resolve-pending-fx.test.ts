import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "@/lib/db/client";
import { accountsRepo } from "@/lib/repos/accounts-repo";
import { rateFromInteger } from "@/lib/fx/rate";
import { saveDraftAsTransaction } from "@/features/capture/save-transaction";
import type { HouseholdRow } from "@/lib/db/schema";
import { resolvePendingFx } from "./resolve-pending-fx";

const HOUSEHOLD_UYU: HouseholdRow = {
  id: "hh-1",
  name: "Casa",
  baseCurrency: "UYU",
  baseCountry: "UY",
  periodStartDay: 1,
  weekStart: 1,
  enabledModules: [],
  settings: {},
  createdBy: "user-1",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
  clientRev: 1,
};

describe("resolvePendingFx (A4)", () => {
  beforeEach(() => {
    resetDbForTests(`perze-test-resolve-fx-${crypto.randomUUID()}`);
  });

  afterEach(async () => {
    await getDb().delete();
  });

  it("resuelve un movimiento pending con el rate dado", async () => {
    const account = await accountsRepo.create({
      householdId: HOUSEHOLD_UYU.id,
      ownerId: "user-1",
      name: "Cuenta ARS",
      kind: "wallet",
      institutionId: null,
      countryCode: "AR",
      currencyCode: "ARS",
      openingBalance: 0n,
      openingDate: "2026-07-01",
      creditLimit: null,
      statementDay: null,
      dueDay: null,
      interestRate: null,
      termMonths: null,
      includeInNetWorth: true,
      visibility: "household",
      color: null,
      icon: null,
      archivedAt: null,
      createdBy: "user-1",
    });

    const tx = await saveDraftAsTransaction({
      draft: {
        kind: "expense",
        amountExpression: "500",
        currency: "",
        accountId: account.id,
        counterAccountId: null,
        counterFxRateOverride: null,
    captureFxRateOverride: null,
        amountPinnedTo: "account",
        categoryId: "cat-1",
        occurredAt: "2026-07-27T12:00:00.000Z",
        payeeName: "",
        note: "",
        tagIds: [],
        burstMode: false,
        burstCount: 0,
      },
      household: HOUSEHOLD_UYU,
      userId: "user-1",
      account,
    });
    expect(tx.fxRate).toBeNull();

    const resolved = await resolvePendingFx({ transactionId: tx.id, baseCurrency: "UYU", rate: rateFromInteger(10) });

    expect(resolved.fxRate).toBe(rateFromInteger(10));
    expect(resolved.fxSource).toBe("manual");
    expect(resolved.amountBase).toBe(500_000n); // 500.00 ARS * 10 = 5000.00 UYU
  });

  it("nunca pisa un rate ya congelado", async () => {
    const account = await accountsRepo.create({
      householdId: HOUSEHOLD_UYU.id,
      ownerId: "user-1",
      name: "Cuenta UYU",
      kind: "wallet",
      institutionId: null,
      countryCode: "UY",
      currencyCode: "UYU",
      openingBalance: 0n,
      openingDate: "2026-07-01",
      creditLimit: null,
      statementDay: null,
      dueDay: null,
      interestRate: null,
      termMonths: null,
      includeInNetWorth: true,
      visibility: "household",
      color: null,
      icon: null,
      archivedAt: null,
      createdBy: "user-1",
    });

    const tx = await saveDraftAsTransaction({
      draft: {
        kind: "expense",
        amountExpression: "500",
        currency: "",
        accountId: account.id,
        counterAccountId: null,
        counterFxRateOverride: null,
    captureFxRateOverride: null,
        amountPinnedTo: "account",
        categoryId: "cat-1",
        occurredAt: "2026-07-27T12:00:00.000Z",
        payeeName: "",
        note: "",
        tagIds: [],
        burstMode: false,
        burstCount: 0,
      },
      household: HOUSEHOLD_UYU,
      userId: "user-1",
      account,
    });
    expect(tx.fxRate).not.toBeNull(); // identity, ya resuelto

    const result = await resolvePendingFx({ transactionId: tx.id, baseCurrency: "UYU", rate: rateFromInteger(999) });
    expect(result.fxRate).toBe(tx.fxRate); // sin cambios
  });
});
