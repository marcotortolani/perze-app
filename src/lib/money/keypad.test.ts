import { describe, expect, it } from "vitest";
import { money } from "./money";
import { evaluateKeypadExpression, firstOperand, formatKeypadExpressionPreview, hasKeypadOperator, isCompleteKeypadExpression } from "./keypad";

describe("evaluateKeypadExpression", () => {
  it("un solo monto", () => {
    expect(evaluateKeypadExpression("1250", "UYU")).toEqual(money(125000n, "UYU"));
  });

  it("suma dos tickets", () => {
    expect(evaluateKeypadExpression("1200+350", "UYU")).toEqual(money(155000n, "UYU"));
  });

  it("resta", () => {
    expect(evaluateKeypadExpression("1200−350", "UYU")).toEqual(money(85000n, "UYU"));
  });

  it("multiplica por una cantidad plana, no por plata", () => {
    expect(evaluateKeypadExpression("450×3", "UYU")).toEqual(money(135000n, "UYU"));
  });

  it("divide entre una cantidad plana", () => {
    expect(evaluateKeypadExpression("1000÷4", "UYU")).toEqual(money(25000n, "UYU"));
  });

  it("evalúa estrictamente de izquierda a derecha, sin precedencia", () => {
    // (100 + 50) × 2 = 300, no 100 + (50×2) = 200
    expect(evaluateKeypadExpression("100+50×2", "UYU")).toEqual(money(30000n, "UYU"));
  });

  it("acepta alias ASCII de los operadores", () => {
    expect(evaluateKeypadExpression("450x3", "UYU")).toEqual(money(135000n, "UYU"));
    expect(evaluateKeypadExpression("1000/4", "UYU")).toEqual(money(25000n, "UYU"));
  });
});

describe("isCompleteKeypadExpression", () => {
  it("vacío no está completo", () => {
    expect(isCompleteKeypadExpression("")).toBe(false);
  });

  it("terminado en operador no está completo", () => {
    expect(isCompleteKeypadExpression("1200+")).toBe(false);
  });

  it("terminado en dígito está completo", () => {
    expect(isCompleteKeypadExpression("1200+350")).toBe(true);
  });
});

describe("hasKeypadOperator", () => {
  it("sin operador", () => {
    expect(hasKeypadOperator("1200")).toBe(false);
  });

  it("con operador, completo o no", () => {
    expect(hasKeypadOperator("1200+")).toBe(true);
    expect(hasKeypadOperator("1200+350")).toBe(true);
  });
});

describe("firstOperand — el héroe se congela acá hasta el '='", () => {
  it("sin operador, es el monto entero", () => {
    expect(firstOperand("1250", "UYU")).toEqual(money(125000n, "UYU"));
  });

  it("con operador, corta antes del operador — no espera al operando siguiente", () => {
    expect(firstOperand("1200+", "UYU")).toEqual(money(120000n, "UYU"));
    expect(firstOperand("1200+350", "UYU")).toEqual(money(120000n, "UYU"));
  });

  it("expresión vacía cae a cero", () => {
    expect(firstOperand("", "UYU")).toEqual(money(0n, "UYU"));
  });
});

describe("formatKeypadExpressionPreview", () => {
  it("separa los operadores con espacios, para leer la cuenta que se está armando", () => {
    expect(formatKeypadExpressionPreview("1200+350")).toBe("1200 + 350");
    expect(formatKeypadExpressionPreview("450×3")).toBe("450 × 3");
  });

  it("un operador colgando también se separa", () => {
    expect(formatKeypadExpressionPreview("1200+")).toBe("1200 +");
  });

  it("sin operador, queda igual", () => {
    expect(formatKeypadExpressionPreview("1200")).toBe("1200");
  });
});
