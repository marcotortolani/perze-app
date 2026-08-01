import { describe, expect, it } from "vitest";
import { applyColumnMapping, guessColumnMapping } from "./column-mapping";

describe("guessColumnMapping", () => {
  it("guesses date, description, and amount from Spanish headers", () => {
    expect(guessColumnMapping(["Fecha", "Detalle", "Importe"])).toEqual({ date: 0, description: 1, amount: 2 });
  });

  it("guesses from English headers", () => {
    expect(guessColumnMapping(["Date", "Description", "Amount"])).toEqual({ date: 0, description: 1, amount: 2 });
  });

  it("leaves a field unresolved when no header matches", () => {
    expect(guessColumnMapping(["Fecha", "Xyz", "Importe"])).toEqual({ date: 0, amount: 2 });
  });
});

describe("applyColumnMapping", () => {
  it("maps rows using the given column indices", () => {
    const rows = [["2026-01-01", "Uber", "-100"]];
    const result = applyColumnMapping(rows, { date: 0, description: 1, amount: 2 });
    expect(result).toEqual([{ date: "2026-01-01", description: "Uber", amount: -100 }]);
  });

  it("parses amounts with thousand separators and currency symbols", () => {
    const rows = [["2026-01-01", "Uber", "$ 1.234,50"]];
    const result = applyColumnMapping(rows, { date: 0, description: 1, amount: 2 });
    expect(result[0]!.amount).toBeCloseTo(1234.5);
  });

  it("returns an empty array when date or amount mapping is missing", () => {
    expect(applyColumnMapping([["a", "b"]], { description: 1 })).toEqual([]);
  });

  it("skips rows with an unparseable amount", () => {
    const rows = [["2026-01-01", "Uber", "not a number"]];
    expect(applyColumnMapping(rows, { date: 0, amount: 2 })).toEqual([]);
  });
});
