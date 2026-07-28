import { describe, expect, it } from "vitest";
import { parseVoiceCapture } from "./parse-voice";

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
});
