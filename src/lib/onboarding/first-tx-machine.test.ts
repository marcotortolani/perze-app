import { describe, expect, it } from "vitest";
import { advanceFirstTx, type FirstTxEvent, type FirstTxStep } from "./first-tx-machine";

const SAVED_INCOME: FirstTxEvent = { type: "saved", kind: "income" };
const SAVED_EXPENSE: FirstTxEvent = { type: "saved", kind: "expense" };
const SAVED_TRANSFER: FirstTxEvent = { type: "saved", kind: "transfer" };
const SKIPPED: FirstTxEvent = { type: "skipped" };
const CANCELLED: FirstTxEvent = { type: "cancelled" };

describe("advanceFirstTx", () => {
  it.each<[FirstTxStep | null, FirstTxEvent, FirstTxStep | null, "/onboarding/first-expense" | "/onboarding/complete" | null]>([
    [null, SAVED_INCOME, null, null],
    [null, SKIPPED, null, null],
    [null, CANCELLED, null, null],
    ["income", SAVED_INCOME, "expense", "/onboarding/first-expense"],
    ["income", SAVED_EXPENSE, "install", "/onboarding/complete"],
    ["income", SAVED_TRANSFER, "install", "/onboarding/complete"],
    ["income", SKIPPED, "install", "/onboarding/complete"],
    ["income", CANCELLED, "income", null],
    ["expense", SAVED_INCOME, "install", "/onboarding/complete"],
    ["expense", SAVED_EXPENSE, "install", "/onboarding/complete"],
    ["expense", SKIPPED, "install", "/onboarding/complete"],
    ["expense", CANCELLED, "expense", null],
    ["install", SAVED_EXPENSE, "install", null],
    ["install", SKIPPED, "install", null],
    ["install", CANCELLED, "install", null],
  ])("step=%s, event=%o → next=%s, route=%s", (step, event, expectedNext, expectedRoute) => {
    const { next, route } = advanceFirstTx(step, event);
    expect(next).toBe(expectedNext);
    expect(route).toBe(expectedRoute);
  });

  it("cancelar nunca avanza el paso, sea cual sea", () => {
    for (const step of ["income", "expense", "install"] as const) {
      const { next, route } = advanceFirstTx(step, CANCELLED);
      expect(next).toBe(step);
      expect(route).toBeNull();
    }
  });
});
