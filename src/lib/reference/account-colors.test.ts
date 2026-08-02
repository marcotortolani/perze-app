import { describe, expect, it } from "vitest";
import { ACCOUNT_COLOR_KEYS, accountColorVar } from "./account-colors";

describe("accountColorVar", () => {
  it("resuelve una clave válida a su var CSS", () => {
    expect(accountColorVar("violet")).toBe("var(--account-color-1)");
    expect(accountColorVar("slate")).toBe("var(--account-color-12)");
  });

  it("null/undefined/una clave desconocida caen a undefined — ListRow usa su --surface-2 de siempre", () => {
    expect(accountColorVar(null)).toBeUndefined();
    expect(accountColorVar(undefined)).toBeUndefined();
    expect(accountColorVar("no-existe")).toBeUndefined();
    expect(accountColorVar("")).toBeUndefined();
  });

  it("son exactamente 12 claves, sin repetidos", () => {
    expect(ACCOUNT_COLOR_KEYS.length).toBe(12);
    expect(new Set(ACCOUNT_COLOR_KEYS).size).toBe(12);
  });

  it("cada clave resuelve a un var CSS distinto", () => {
    const resolved = ACCOUNT_COLOR_KEYS.map((k) => accountColorVar(k));
    expect(new Set(resolved).size).toBe(12);
  });
});
