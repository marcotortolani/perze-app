import { describe, expect, it } from "vitest";
import { tradeMovesCash } from "./trade-settlement-policy";

describe("tradeMovesCash", () => {
  it("buy y sell mueven caja", () => {
    expect(tradeMovesCash("buy")).toBe(true);
    expect(tradeMovesCash("sell")).toBe(true);
  });

  it("transfer_in (posición inicial) no mueve caja — es el fix del bug reportado", () => {
    expect(tradeMovesCash("transfer_in")).toBe(false);
  });

  it("el resto de los kinds tampoco mueve caja hoy (sin UI propia todavía)", () => {
    expect(tradeMovesCash("dividend")).toBe(false);
    expect(tradeMovesCash("fee")).toBe(false);
    expect(tradeMovesCash("transfer_out")).toBe(false);
    expect(tradeMovesCash("revaluation")).toBe(false);
  });
});
