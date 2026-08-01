import { describe, expect, it } from "vitest";
import { detectDuplicates } from "./duplicate-detection";

describe("detectDuplicates", () => {
  it("flags a row matching an existing transaction's date and amount", () => {
    const rows = [{ date: "2026-07-10", description: "Uber", amount: -100 }];
    const existing = [{ occurredAt: "2026-07-10T14:00:00.000Z", amount: 10000n }];
    const result = detectDuplicates(rows, existing, 2);
    expect(result[0]!.isDuplicate).toBe(true);
  });

  it("does not flag a row with a different amount", () => {
    const rows = [{ date: "2026-07-10", description: "Uber", amount: -100 }];
    const existing = [{ occurredAt: "2026-07-10T14:00:00.000Z", amount: 5000n }];
    expect(detectDuplicates(rows, existing, 2)[0]!.isDuplicate).toBe(false);
  });

  it("does not flag a row on a different date", () => {
    const rows = [{ date: "2026-07-11", description: "Uber", amount: -100 }];
    const existing = [{ occurredAt: "2026-07-10T14:00:00.000Z", amount: 10000n }];
    expect(detectDuplicates(rows, existing, 2)[0]!.isDuplicate).toBe(false);
  });

  it("respects currency decimals when converting to minor units", () => {
    const rows = [{ date: "2026-07-10", description: "Compra", amount: -1000 }];
    const existing = [{ occurredAt: "2026-07-10T00:00:00.000Z", amount: 1000n }]; // 0-decimal currency
    expect(detectDuplicates(rows, existing, 0)[0]!.isDuplicate).toBe(true);
  });
});
