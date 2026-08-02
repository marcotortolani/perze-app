import { describe, expect, it } from "vitest";
import { matchVoiceCategory, parseVoiceCapture } from "./parse-voice";

describe("parseVoiceCapture", () => {
  it("extrae monto y comercio de una frase simple", () => {
    const result = parseVoiceCapture("gasté 1200 en el súper");
    expect(result.amountExpression).toBe("1200");
    expect(result.payeeName).toBe("súper");
  });

  it("extrae con 'de' en vez de 'en'", () => {
    const result = parseVoiceCapture("pagué 450 de nafta");
    expect(result.amountExpression).toBe("450");
    expect(result.payeeName).toBe("nafta");
  });

  it("sin comercio reconocible, deja el campo en null", () => {
    const result = parseVoiceCapture("mil doscientos");
    expect(result.amountExpression).toBeNull();
    expect(result.payeeName).toBeNull();
  });

  it("detecta gasto por el verbo", () => {
    expect(parseVoiceCapture("gasté 2500 en transporte").kind).toBe("expense");
    expect(parseVoiceCapture("pagué 450 de nafta").kind).toBe("expense");
    expect(parseVoiceCapture("compré 300 en el kiosco").kind).toBe("expense");
  });

  it("detecta ingreso por el verbo", () => {
    expect(parseVoiceCapture("cobré 50000 de sueldo").kind).toBe("income");
    expect(parseVoiceCapture("recibí 1000 de un amigo").kind).toBe("income");
  });

  it("detecta transferencia por el verbo", () => {
    expect(parseVoiceCapture("transferí 2000 a ahorros").kind).toBe("transfer");
  });

  it("sin verbo reconocible, kind queda en null — nunca inventa uno", () => {
    expect(parseVoiceCapture("2500 en transporte").kind).toBeNull();
  });
});

describe("matchVoiceCategory", () => {
  const categories = [
    { id: "cat-transport", name: "Transporte" },
    { id: "cat-groceries", name: "Supermercado" },
    { id: "cat-health", name: "Salud" },
  ];

  it("matchea sin importar mayúsculas ni acentos", () => {
    expect(matchVoiceCategory("transporte", categories)).toEqual({ categoryId: "cat-transport", categoryName: "Transporte" });
    expect(matchVoiceCategory("SUPERMERCADO", categories)).toEqual({ categoryId: "cat-groceries", categoryName: "Supermercado" });
  });

  it("matchea si lo dicho es más específico que el nombre de la categoría", () => {
    expect(matchVoiceCategory("el súper de la esquina", [{ id: "cat-groceries", name: "súper" }])).toEqual({
      categoryId: "cat-groceries",
      categoryName: "súper",
    });
  });

  it("sin texto o sin coincidencia, no matchea nada — nunca bloquea la carga", () => {
    expect(matchVoiceCategory(null, categories)).toBeNull();
    expect(matchVoiceCategory("cine", categories)).toBeNull();
  });
});
