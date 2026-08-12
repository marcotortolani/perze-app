import { describe, expect, it } from "vitest";
import { money } from "@/lib/money/money";
import { computeReconcileDiff } from "./reconcile-diff";

describe("computeReconcileDiff", () => {
  it("sin nada tipeado no hay diferencia, aunque bankBalance evalúe a 0", () => {
    const result = computeReconcileDiff({
      bankBalance: money(0n, "ARS"),
      currentBalance: money(70000n, "ARS"),
      expr: "",
    });
    expect(result.hasDiff).toBe(false);
  });

  it("conciliar contra el mismo saldo que la cuenta ya refleja da diferencia 0 — el caso que antes duplicaba", () => {
    // Antes del fix del trigger de alta, current_balance podía llegar en 0
    // aunque la cuenta tuviera saldo inicial real: acá se prueba la resta
    // en sí, asumiendo que currentBalance ya es el valor correcto.
    const result = computeReconcileDiff({
      bankBalance: money(170000n, "ARS"),
      currentBalance: money(170000n, "ARS"),
      expr: "170000",
    });
    expect(result.hasDiff).toBe(false);
    expect(result.diff.amount).toBe(0n);
  });

  it("detecta una diferencia real y conserva el signo", () => {
    const result = computeReconcileDiff({
      bankBalance: money(150000n, "ARS"),
      currentBalance: money(170000n, "ARS"),
      expr: "150000",
    });
    expect(result.hasDiff).toBe(true);
    expect(result.diff).toEqual(money(-20000n, "ARS"));
  });

  it("un faltante en el keypad (banco tiene más que el registro) da diferencia positiva", () => {
    const result = computeReconcileDiff({
      bankBalance: money(200000n, "ARS"),
      currentBalance: money(170000n, "ARS"),
      expr: "200000",
    });
    expect(result.diff).toEqual(money(30000n, "ARS"));
  });
});
