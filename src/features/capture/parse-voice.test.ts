import { describe, expect, it } from "vitest";
import { matchVoiceCategory, matchVoiceTags, parseVoiceCapture } from "./parse-voice";

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

  it("D33 — detecta ingreso en 3ª persona plural ('ingresaron'), no solo 1ª singular", () => {
    // Bug reportado en vivo: "ingresaron 2500 dólares de sueldo" no
    // cambiaba el toggle porque solo estaba "ingresé"/"ingrese" en la lista.
    const result = parseVoiceCapture("ingresaron 2500 dólares de sueldo");
    expect(result.kind).toBe("income");
    expect(result.amountExpression).toBe("2500");
    expect(result.currencyCode).toBe("USD");
    expect(result.payeeName).toBe("sueldo");
  });

  it("D33 — más conjugaciones comunes de gasto/ingreso/transferencia", () => {
    expect(parseVoiceCapture("gastó 500 en el kiosco").kind).toBe("expense");
    expect(parseVoiceCapture("pagaron 1000 de alquiler").kind).toBe("expense");
    expect(parseVoiceCapture("cobraron 800 de un cliente").kind).toBe("income");
    expect(parseVoiceCapture("recibieron 200 de un regalo").kind).toBe("income");
    expect(parseVoiceCapture("transfirieron 300 a ahorros").kind).toBe("transfer");
  });

  it("D33 — moneda: reconoce dólares/euros/reales, nunca adivina 'pesos' a secas sin contexto", () => {
    expect(parseVoiceCapture("gasté 100 dólares en el súper").currencyCode).toBe("USD");
    expect(parseVoiceCapture("gasté 100 euros en el súper").currencyCode).toBe("EUR");
    expect(parseVoiceCapture("gasté 100 reales en el súper").currencyCode).toBe("BRL");
    expect(parseVoiceCapture("gasté 100 pesos uruguayos en el súper").currencyCode).toBe("UYU");
    expect(parseVoiceCapture("gasté 100 pesos argentinos en el súper").currencyCode).toBe("ARS");
    // "pesos" solo, sin calificar y sin moneda base del household, es ambiguo entre
    // UYU/ARS/MXN/CLP — no adivina.
    expect(parseVoiceCapture("gasté 100 pesos en el súper").currencyCode).toBeNull();
    expect(parseVoiceCapture("gasté 100 en el súper").currencyCode).toBeNull();
  });

  it("'pesos' a secas resuelve a la moneda base del household cuando esa moneda es un peso", () => {
    expect(parseVoiceCapture("gasté 1500 pesos en el súper", "UYU").currencyCode).toBe("UYU");
    expect(parseVoiceCapture("gasté 1500 pesos en el súper", "ARS").currencyCode).toBe("ARS");
    // Con household en USD, "pesos" sigue sin adivinar — decir "pesos" ahí no tiene
    // una lectura obvia, así que se mantiene el criterio de no inventar.
    expect(parseVoiceCapture("gasté 1500 pesos en el súper", "USD").currencyCode).toBeNull();
    // Una moneda calificada explícita nunca se pisa con la moneda base local.
    expect(parseVoiceCapture("gasté 100 dólares en el súper", "UYU").currencyCode).toBe("USD");
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

describe("matchVoiceTags", () => {
  const tags = [
    { id: "tag-client", name: "Cliente" },
    { id: "tag-refund", name: "Reembolsable" },
    { id: "tag-personal", name: "Personal" },
  ];

  it("D33 — matchea varios tags a la vez, en cualquier parte de la frase", () => {
    const result = matchVoiceTags("gasté 500 en el súper, es reembolsable y del cliente", tags);
    expect(result.map((m) => m.tagId).sort()).toEqual(["tag-client", "tag-refund"].sort());
  });

  it("sin mención de ningún tag, devuelve vacío", () => {
    expect(matchVoiceTags("gasté 500 en el súper", tags)).toEqual([]);
  });
});
