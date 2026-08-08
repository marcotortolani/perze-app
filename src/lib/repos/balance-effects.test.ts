import { describe, expect, it } from "vitest";
import { computeTransactionEffects, mergeEffectsByAccount, reverseEffects } from "./balance-effects";

describe("computeTransactionEffects", () => {
  it("expense baja el saldo de la cuenta", () => {
    expect(
      computeTransactionEffects({
        kind: "expense",
        amount: 1000n,
        accountId: "a1",
        counterAccountId: null,
        counterAmount: null,
      })
    ).toEqual([{ accountId: "a1", delta: -1000n }]);
  });

  it("income sube el saldo de la cuenta", () => {
    expect(
      computeTransactionEffects({
        kind: "income",
        amount: 1000n,
        accountId: "a1",
        counterAccountId: null,
        counterAmount: null,
      })
    ).toEqual([{ accountId: "a1", delta: 1000n }]);
  });

  it("transfer misma moneda: baja origen, sube destino por el mismo monto", () => {
    expect(
      computeTransactionEffects({
        kind: "transfer",
        amount: 500n,
        accountId: "a1",
        counterAccountId: "a2",
        counterAmount: null,
      })
    ).toEqual([
      { accountId: "a1", delta: -500n },
      { accountId: "a2", delta: 500n },
    ]);
  });

  it("transfer entre monedas: el destino usa counterAmount, no amount", () => {
    expect(
      computeTransactionEffects({
        kind: "transfer",
        amount: 1000n, // sale en UYU
        accountId: "a1",
        counterAccountId: "a2",
        counterAmount: 25n, // entra en USD
      })
    ).toEqual([
      { accountId: "a1", delta: -1000n },
      { accountId: "a2", delta: 25n },
    ]);
  });

  it("transfer sin counterAccountId es un error de datos", () => {
    expect(() =>
      computeTransactionEffects({
        kind: "transfer",
        amount: 500n,
        accountId: "a1",
        counterAccountId: null,
        counterAmount: null,
      })
    ).toThrow();
  });

  it("adjustment aplica el delta tal cual, puede ser negativo", () => {
    expect(
      computeTransactionEffects({
        kind: "adjustment",
        amount: -300n,
        accountId: "a1",
        counterAccountId: null,
        counterAmount: null,
      })
    ).toEqual([{ accountId: "a1", delta: -300n }]);
  });

  it("investing aplica el delta tal cual — negativo en una compra, positivo en una venta", () => {
    expect(
      computeTransactionEffects({
        kind: "investing",
        amount: -50000n, // compra
        accountId: "a1",
        counterAccountId: null,
        counterAmount: null,
      })
    ).toEqual([{ accountId: "a1", delta: -50000n }]);

    expect(
      computeTransactionEffects({
        kind: "investing",
        amount: 20000n, // venta
        accountId: "a1",
        counterAccountId: null,
        counterAmount: null,
      })
    ).toEqual([{ accountId: "a1", delta: 20000n }]);
  });
});

describe("reverseEffects", () => {
  it("invierte el signo de cada delta", () => {
    expect(reverseEffects([{ accountId: "a1", delta: 500n }])).toEqual([
      { accountId: "a1", delta: -500n },
    ]);
  });
});

describe("mergeEffectsByAccount", () => {
  it("suma deltas repetidos de la misma cuenta en un solo write", () => {
    const merged = mergeEffectsByAccount([
      { accountId: "a1", delta: -500n },
      { accountId: "a2", delta: 500n },
      { accountId: "a1", delta: -100n },
    ]);
    expect(merged.get("a1")).toBe(-600n);
    expect(merged.get("a2")).toBe(500n);
  });
});
