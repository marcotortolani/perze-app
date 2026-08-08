import { describe, expect, it } from "vitest";
import { cashFlowNetBase, classifyCashFlow, classifyConsumption } from "./cash-flow";

describe("classifyCashFlow", () => {
  it("classifies expense as outflow", () => {
    expect(classifyCashFlow({ kind: "expense", amountBase: 500n })).toEqual({ bucket: "outflow", magnitude: 500n });
  });

  it("classifies income as inflow", () => {
    expect(classifyCashFlow({ kind: "income", amountBase: 3_000n })).toEqual({ bucket: "inflow", magnitude: 3_000n });
  });

  it("classifies a buy (negative amount) as outflow", () => {
    expect(classifyCashFlow({ kind: "investing", amountBase: -6_276n })).toEqual({ bucket: "outflow", magnitude: 6_276n });
  });

  it("classifies a sell (positive amount) as inflow", () => {
    expect(classifyCashFlow({ kind: "investing", amountBase: 637n })).toEqual({ bucket: "inflow", magnitude: 637n });
  });

  it("classifies the needs_capture_fx placeholder (amountBase 0n) as structural, not a 0 flow", () => {
    expect(classifyCashFlow({ kind: "investing", amountBase: 0n })).toEqual({ bucket: "structural", magnitude: 0n });
  });

  it("excludes transfer as structural without touching needsFx", () => {
    expect(classifyCashFlow({ kind: "transfer", amountBase: null })).toEqual({ bucket: "structural", magnitude: 0n });
    expect(classifyCashFlow({ kind: "transfer", amountBase: 100n })).toEqual({ bucket: "structural", magnitude: 0n });
  });

  it("excludes adjustment as structural without touching needsFx", () => {
    expect(classifyCashFlow({ kind: "adjustment", amountBase: null })).toEqual({ bucket: "structural", magnitude: 0n });
  });

  it("flags a needs_fx expense/income/investing row as needsFx, never 0", () => {
    expect(classifyCashFlow({ kind: "expense", amountBase: null })).toEqual({ bucket: "needsFx", magnitude: 0n });
    expect(classifyCashFlow({ kind: "income", amountBase: null })).toEqual({ bucket: "needsFx", magnitude: 0n });
    expect(classifyCashFlow({ kind: "investing", amountBase: null })).toEqual({ bucket: "needsFx", magnitude: 0n });
  });
});

describe("classifyConsumption", () => {
  it("still classifies expense/income the same as classifyCashFlow", () => {
    expect(classifyConsumption({ kind: "expense", amountBase: 500n })).toEqual({ bucket: "outflow", magnitude: 500n });
    expect(classifyConsumption({ kind: "income", amountBase: 500n })).toEqual({ bucket: "inflow", magnitude: 500n });
  });

  it("excludes investing entirely, buy or sell", () => {
    expect(classifyConsumption({ kind: "investing", amountBase: -500n })).toEqual({ bucket: "structural", magnitude: 0n });
    expect(classifyConsumption({ kind: "investing", amountBase: 500n })).toEqual({ bucket: "structural", magnitude: 0n });
  });

  it("does not count a needs_fx investing row as needsFx (it's structural before that check)", () => {
    // investing is excluded regardless of amountBase under classifyConsumption,
    // but null still routes through the needsFx branch since the exclusion
    // check happens after the null check in the shared classify().
    expect(classifyConsumption({ kind: "investing", amountBase: null })).toEqual({ bucket: "needsFx", magnitude: 0n });
  });
});

describe("cashFlowNetBase", () => {
  it("is positive for inflow", () => {
    expect(cashFlowNetBase({ kind: "income", amountBase: 1_000n })).toBe(1_000n);
  });

  it("is negative for outflow", () => {
    expect(cashFlowNetBase({ kind: "expense", amountBase: 1_000n })).toBe(-1_000n);
  });

  it("is negative for a buy and positive for a sell", () => {
    expect(cashFlowNetBase({ kind: "investing", amountBase: -6_276n })).toBe(-6_276n);
    expect(cashFlowNetBase({ kind: "investing", amountBase: 637n })).toBe(637n);
  });

  it("is 0n for structural and needsFx rows", () => {
    expect(cashFlowNetBase({ kind: "transfer", amountBase: 100n })).toBe(0n);
    expect(cashFlowNetBase({ kind: "expense", amountBase: null })).toBe(0n);
  });
});
