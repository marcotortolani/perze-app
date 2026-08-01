import { describe, expect, it } from "vitest";
import { splitByPercent, splitEqual, splitExact } from "./split-shares";

describe("splitEqual", () => {
  it("splits evenly with no remainder", () => {
    const result = splitEqual(1000n, [{ memberId: "a" }, { memberId: "b" }]);
    expect(result.get("a")).toBe(500n);
    expect(result.get("b")).toBe(500n);
  });

  it("gives the remainder to the first members, summing exactly to the total", () => {
    const result = splitEqual(1001n, [{ memberId: "a" }, { memberId: "b" }, { memberId: "c" }]);
    const sum = [...result.values()].reduce((s, v) => s + v, 0n);
    expect(sum).toBe(1001n);
    expect(result.get("a")).toBe(334n);
    expect(result.get("b")).toBe(334n);
    expect(result.get("c")).toBe(333n);
  });

  it("returns an empty map with no members", () => {
    expect(splitEqual(1000n, []).size).toBe(0);
  });
});

describe("splitByPercent", () => {
  it("splits 62/38 summing exactly to the total, even with rounding", () => {
    const result = splitByPercent(
      10_001n,
      new Map([
        ["a", 62],
        ["b", 38],
      ])
    );
    const sum = [...result.values()].reduce((s, v) => s + v, 0n);
    expect(sum).toBe(10_001n);
    // "a" gets the rounded 62%, "b" (last) absorbs whatever rounding drift is left.
    expect(result.get("a")).toBe(6_200n);
    expect(result.get("b")).toBe(3_801n);
  });
});

describe("splitExact", () => {
  it("passes amounts through unchanged", () => {
    const input = new Map([
      ["a", 100n],
      ["b", 200n],
    ]);
    expect(splitExact(input)).toEqual(input);
  });
});
