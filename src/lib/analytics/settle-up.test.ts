import { describe, expect, it } from "vitest";
import { computeNetBalances } from "./settle-up";

describe("computeNetBalances", () => {
  it("credits the payer when someone else's share is unsettled", () => {
    const { byMember } = computeNetBalances([{ memberId: "ana", shareAmountBase: 1000n, paidBy: "me" }], "me");
    expect(byMember.get("ana")).toBe(1000n);
  });

  it("debits the current user when they owe a share on someone else's transaction", () => {
    const { byMember } = computeNetBalances([{ memberId: "me", shareAmountBase: 500n, paidBy: "ana" }], "me");
    expect(byMember.get("ana")).toBe(-500n);
  });

  it("nets opposing debts between the same two people", () => {
    const { byMember } = computeNetBalances(
      [
        { memberId: "ana", shareAmountBase: 1000n, paidBy: "me" }, // ana owes me 1000
        { memberId: "me", shareAmountBase: 400n, paidBy: "ana" }, // I owe ana 400
      ],
      "me"
    );
    expect(byMember.get("ana")).toBe(600n); // net: ana owes me 600
  });

  it("ignores the payer's own share of their own transaction", () => {
    const { byMember } = computeNetBalances([{ memberId: "me", shareAmountBase: 1000n, paidBy: "me" }], "me");
    expect(byMember.size).toBe(0);
  });

  it("ignores shares between two other members that don't involve the current user", () => {
    const { byMember } = computeNetBalances([{ memberId: "ana", shareAmountBase: 1000n, paidBy: "beto" }], "me");
    expect(byMember.size).toBe(0);
  });

  it("excludes needs_fx shares from the total and counts them, never treating them as 0", () => {
    const { byMember, excludedCount } = computeNetBalances(
      [
        { memberId: "ana", shareAmountBase: 1000n, paidBy: "me" },
        { memberId: "ana", shareAmountBase: null, paidBy: "me" },
      ],
      "me"
    );
    expect(byMember.get("ana")).toBe(1000n);
    expect(excludedCount).toBe(1);
  });
});
