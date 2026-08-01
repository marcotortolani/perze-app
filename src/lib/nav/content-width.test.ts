import { describe, expect, it } from "vitest";
import { contentWidthFor } from "./content-width";

describe("contentWidthFor", () => {
  it("es wide en /transactions y sus subrutas", () => {
    expect(contentWidthFor("/transactions")).toBe("wide");
    expect(contentWidthFor("/transactions/tx-1")).toBe("wide");
  });

  it("es wide en /accounts y sus subrutas", () => {
    expect(contentWidthFor("/accounts")).toBe("wide");
    expect(contentWidthFor("/accounts/new")).toBe("wide");
  });

  it("es narrow en cualquier otra ruta", () => {
    expect(contentWidthFor("/")).toBe("narrow");
    expect(contentWidthFor("/analytics")).toBe("narrow");
    expect(contentWidthFor("/more/categories")).toBe("narrow");
  });

  it("no confunde un prefijo parcial con la ruta real", () => {
    expect(contentWidthFor("/transactionsomething")).toBe("narrow");
  });
});
