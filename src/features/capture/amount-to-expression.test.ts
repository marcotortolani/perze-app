import { describe, expect, it } from "vitest";
import { amountToExpression } from "./AmountStep";
import { evaluateKeypadExpression } from "@/lib/money/keypad";

describe("amountToExpression", () => {
  // Sin ceros colgando (`.replace(/0+$/, "")` en la fracción): un monto
  // redondo como "1250,00" quedaba tal cual en `amountExpression`, y
  // seguir tipeando lo CONCATENABA ("1250,000") en vez de extender la
  // parte entera — `parseAmountString` trunca a los decimales de la
  // moneda, así que ese dígito de más no llegaba a ningún lado y el
  // keypad parecía dejar de aceptar entrada después de un "=". Ver
  // `AmountStep.tsx`.
  it("formats a UYU amount (2 decimals) with no trailing zero fraction", () => {
    expect(amountToExpression(125_000n, "UYU")).toBe("1250");
  });

  it("formats a USD amount (2 decimals) with a comma, trimming the trailing zero", () => {
    expect(amountToExpression(4_250n, "USD")).toBe("42,5");
  });

  it("formats a BTC amount (8 decimals), trimming trailing zeros", () => {
    expect(amountToExpression(150_000n, "BTC")).toBe("0,0015");
  });

  it("keeps the sign for a negative amount", () => {
    expect(amountToExpression(-4_250n, "USD")).toBe("-42,5");
  });

  it("keeps a non-zero final decimal digit intact", () => {
    expect(amountToExpression(999_999n, "USD")).toBe("9999,99");
  });

  it("round-trips through evaluateKeypadExpression", () => {
    const expr = amountToExpression(999_999n, "USD");
    const back = evaluateKeypadExpression(expr, "USD");
    expect(back.amount).toBe(999_999n);
  });

  it("appending another digit after collapsing extends the integer part, not a hidden decimal tail", () => {
    const collapsed = amountToExpression(2500n, "UYU"); // "25"
    expect(collapsed + "0").toBe("250");
  });
});
