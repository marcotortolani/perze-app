import { describe, expect, it } from "vitest";
import { amountToExpression } from "./AmountStep";
import { evaluateKeypadExpression } from "@/lib/money/keypad";

describe("amountToExpression", () => {
  it("formats a UYU amount (2 decimals)", () => {
    expect(amountToExpression(125_000n, "UYU")).toBe("1250,00");
  });

  it("formats a USD amount (2 decimals) with a comma", () => {
    expect(amountToExpression(4_250n, "USD")).toBe("42,50");
  });

  it("formats a BTC amount (8 decimals)", () => {
    expect(amountToExpression(150_000n, "BTC")).toBe("0,00150000");
  });

  it("keeps the sign for a negative amount", () => {
    expect(amountToExpression(-4_250n, "USD")).toBe("-42,50");
  });

  it("round-trips through evaluateKeypadExpression", () => {
    const expr = amountToExpression(999_999n, "USD");
    const back = evaluateKeypadExpression(expr, "USD");
    expect(back.amount).toBe(999_999n);
  });
});
