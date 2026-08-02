import { parseRate, type ScaledRate } from "./rate";

/**
 * Acumula un dígito/backspace/separador decimal del `<Keypad>` en un string
 * crudo para un tipo de cambio — a diferencia de `evaluateKeypadExpression`
 * (que arma montos de `Money` con `decimalsFor(currency)`), acá no hay
 * moneda con decimales fijos: un rate se escribe entero hasta 12 lugares.
 * Los operadores (+/−/×/÷) no aplican a un tipo de cambio — se ignoran.
 */
export function appendKeypadRateDigit(current: string, key: string, decimalSeparator: string, maxLength = 15): string {
  if (key === "backspace") return current.slice(0, -1);
  if (key === decimalSeparator) {
    if (current.includes(decimalSeparator)) return current;
    return current === "" ? `0${decimalSeparator}` : current + decimalSeparator;
  }
  if (!/^\d$/.test(key)) return current;
  if (current.length >= maxLength) return current;
  return current + key;
}

/** `null` mientras la entrada no forma un número positivo válido — nunca se guarda un 0 ni un negativo como tipo de cambio. */
export function parseKeypadRate(raw: string, decimalSeparator: string): ScaledRate | null {
  if (raw === "" || raw === decimalSeparator) return null;
  const normalized = raw.replaceAll(decimalSeparator, ".");
  if (!/^\d*\.?\d*$/.test(normalized)) return null;
  const rate = parseRate(normalized);
  return rate > 0n ? rate : null;
}

/**
 * Para un `<input type="text">` nativo (no el `<Keypad>` propio): acepta
 * "," o "." como separador —el teclado físico/OS decide cuál manda, no la
 * preferencia de la app— y parsea el string tal cual, sin pasar por
 * `Number()`/`toFixed()`. "1500.00" queda 1500 exacto, "0.0023478" queda
 * exactamente eso — nunca se completa, redondea ni modifica lo tipeado.
 */
export function parseTypedRate(raw: string): ScaledRate | null {
  const normalized = raw.trim().replace(",", ".");
  if (normalized === "" || normalized === "." || !/^\d*\.?\d*$/.test(normalized)) return null;
  const rate = parseRate(normalized);
  return rate > 0n ? rate : null;
}
