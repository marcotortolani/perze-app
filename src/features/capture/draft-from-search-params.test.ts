import { describe, expect, it } from "vitest";
import { draftFromSearchParams } from "./draft-from-search-params";

describe("draftFromSearchParams", () => {
  it("sin params no genera ningún prefill", () => {
    expect(draftFromSearchParams(new URLSearchParams())).toEqual({});
  });

  it("prefillKind acepta income, expense y transfer", () => {
    expect(draftFromSearchParams(new URLSearchParams("prefillKind=income"))).toEqual({ kind: "income" });
    expect(draftFromSearchParams(new URLSearchParams("prefillKind=expense"))).toEqual({ kind: "expense" });
    expect(draftFromSearchParams(new URLSearchParams("prefillKind=transfer"))).toEqual({ kind: "transfer" });
  });

  it("ignora un prefillKind que no es un CaptureKind válido", () => {
    expect(draftFromSearchParams(new URLSearchParams("prefillKind=bogus"))).toEqual({});
  });

  it("arma el prefill de 'pagar tarjeta': destino fijo + monto anclado al destino", () => {
    const params = new URLSearchParams({
      prefillKind: "transfer",
      prefillCounterAccountId: "card-1",
      prefillAmountExpression: "12000",
      prefillCurrency: "ARS",
      prefillAmountPinnedTo: "counterAccount",
    });
    expect(draftFromSearchParams(params)).toEqual({
      kind: "transfer",
      counterAccountId: "card-1",
      amountExpression: "12000",
      currency: "ARS",
      amountPinnedTo: "counterAccount",
    });
  });

  it("un prefillAmountPinnedTo distinto de counterAccount no se propaga (queda el default 'account')", () => {
    expect(draftFromSearchParams(new URLSearchParams("prefillAmountPinnedTo=account"))).toEqual({});
  });

  it("share target: title + note + url se unen en la nota", () => {
    const params = new URLSearchParams({ title: "Factura", note: "de la luz", url: "https://ejemplo.com" });
    expect(draftFromSearchParams(params)).toEqual({ note: "Factura — de la luz — https://ejemplo.com" });
  });

  it("share target parcial: solo los campos presentes entran a la nota", () => {
    expect(draftFromSearchParams(new URLSearchParams("title=Factura"))).toEqual({ note: "Factura" });
  });

  it("combina prefill de cuenta y share target a la vez", () => {
    const params = new URLSearchParams({ prefillKind: "income", title: "Sueldo" });
    expect(draftFromSearchParams(params)).toEqual({ kind: "income", note: "Sueldo" });
  });
});
