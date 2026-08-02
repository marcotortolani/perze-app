import { add, type Money, scaleByFraction, subtract } from "./money";
import { type NumberLocale, parseAmountString, parseScalarFraction } from "./parse";

export type KeypadOperator = "+" | "−" | "×" | "÷";

const OPERATOR_ALIASES: Record<string, KeypadOperator> = {
  "+": "+",
  "-": "−",
  "−": "−",
  "×": "×",
  x: "×",
  X: "×",
  "*": "×",
  "÷": "÷",
  "/": "÷",
};

const OPERATOR_PATTERN = /([+\-−×xX*÷/])/;

/**
 * Evalúa una expresión del `<Keypad>` (`docs/02-design-system.md` § 6):
 * `+`/`−` suman o restan otro ticket (misma moneda); `×`/`÷` multiplican o
 * dividen por una cantidad plana (no plata) — "café × 3", nunca al revés.
 * Evaluación estrictamente de izquierda a derecha: es una cinta de
 * calculadora, no una expresión matemática con precedencia.
 */
export function evaluateKeypadExpression(
  raw: string,
  currency: string,
  locale: NumberLocale = "es-UY"
): Money {
  const tokens = raw
    .trim()
    .split(OPERATOR_PATTERN)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  if (tokens.length === 0) return parseAmountString("0", currency, locale);

  const first = tokens[0];
  if (first === undefined) return parseAmountString("0", currency, locale);
  let acc = parseAmountString(first, currency, locale);

  let i = 1;
  while (i < tokens.length - 1) {
    const opToken = tokens[i];
    const operandToken = tokens[i + 1];
    if (opToken === undefined || operandToken === undefined) break;

    const op = OPERATOR_ALIASES[opToken];
    if (op === undefined) {
      i += 1;
      continue;
    }

    switch (op) {
      case "+":
        acc = add(acc, parseAmountString(operandToken, currency, locale));
        break;
      case "−":
        acc = subtract(acc, parseAmountString(operandToken, currency, locale));
        break;
      case "×": {
        const { numerator, denominator } = parseScalarFraction(operandToken, locale);
        acc = scaleByFraction(acc, numerator, denominator);
        break;
      }
      case "÷": {
        const { numerator, denominator } = parseScalarFraction(operandToken, locale);
        if (numerator === 0n) throw new Error("División por cero");
        acc = scaleByFraction(acc, denominator, numerator);
        break;
      }
    }
    i += 2;
  }

  return acc;
}

/**
 * El guardado tolera una expresión con un operador colgando ("12+") —
 * `evaluateKeypadExpression` ya la resuelve al operando anterior, esto
 * solo decide si el CTA de guardar debe estar habilitado.
 */
export function isCompleteKeypadExpression(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return false;
  const lastChar = trimmed.at(-1) ?? "";
  return OPERATOR_ALIASES[lastChar] === undefined;
}

/** ¿La expresión tiene algún operador tipeado, completo o no? Ver `firstOperand`. */
export function hasKeypadOperator(raw: string): boolean {
  return OPERATOR_PATTERN.test(raw);
}

/**
 * El monto antes del primer operador — la cifra en la que el héroe se
 * queda congelado mientras se arma una cuenta con `+`/`−`/`×`/`÷`, hasta
 * que el usuario confirma con "=" (`AmountStep`). Antes de esto, la
 * captura evaluaba y mostraba el resultado parcial en cada tecla ("12+8"
 * pasaba por 12 apenas se tipeaba el operador, sin que el usuario viera
 * la cuenta que estaba armando).
 */
export function firstOperand(raw: string, currency: string, locale: NumberLocale = "es-UY"): Money {
  const first = raw.trim().split(OPERATOR_PATTERN)[0]?.trim() || "0";
  return parseAmountString(first, currency, locale);
}

/** "12+8" → "12 + 8" — solo para la línea de preview, nunca para guardar/parsear. */
export function formatKeypadExpressionPreview(raw: string): string {
  return raw
    .replace(/([+\-−×xX*÷/])/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim();
}
