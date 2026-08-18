import { decimalsFor } from "../money/decimals";
import { money, type Money, roundHalfEven } from "../money/money";

/** Precisión interna del rate — coincide con `numeric(24,12)` del schema. */
export const RATE_DECIMALS = 12;
export const RATE_SCALE = 10n ** BigInt(RATE_DECIMALS);

/**
 * Un rate "escalado": el valor decimal del tipo de cambio representado
 * como bigint × `RATE_SCALE`. Es el formato interno de `fx_rate`/
 * `counter_fx_rate` — nunca se guarda ni se opera como `number`.
 */
export type ScaledRate = bigint;

/**
 * Parsea un decimal plano ("1234.567890123456", formato interno — no de
 * usuario) a rate escalado. Si el texto trae más dígitos decimales que los
 * que `RATE_DECIMALS` puede guardar, el último dígito que entra se
 * **redondea** (half-even), nunca se trunca — perder el resto en silencio
 * corrompería un valor que el usuario tipeó exacto.
 */
export function parseRate(raw: string): ScaledRate {
  const negative = raw.startsWith("-");
  const s = negative ? raw.slice(1) : raw;
  const [intPartRaw, fracPartRaw = ""] = s.split(".");
  const intPart = intPartRaw || "0";

  if (fracPartRaw.length <= RATE_DECIMALS) {
    const frac = fracPartRaw.padEnd(RATE_DECIMALS, "0");
    const digits = `${intPart}${frac}`.replace(/^0+(?=\d)/, "");
    return BigInt((negative ? "-" : "") + digits);
  }

  const extraDigits = fracPartRaw.length - RATE_DECIMALS;
  const fullDigits = `${intPart}${fracPartRaw}`.replace(/^0+(?=\d)/, "");
  const rounded = roundHalfEven(BigInt(fullDigits || "0"), 10n ** BigInt(extraDigits));
  return negative ? -rounded : rounded;
}

/** Inverso de `parseRate` — para persistir o mostrar el rate crudo. */
export function formatRate(scaled: ScaledRate): string {
  const negative = scaled < 0n;
  const abs = negative ? -scaled : scaled;
  const s = abs.toString().padStart(RATE_DECIMALS + 1, "0");
  const intPart = s.slice(0, -RATE_DECIMALS);
  const fracPart = s.slice(-RATE_DECIMALS);
  return `${negative ? "-" : ""}${intPart}.${fracPart}`;
}

/**
 * `formatRate` sin los ceros finales que no aportan nada — "1560,000000000000"
 * queda "1560", "0,025500000000" queda "0,0255". A diferencia de
 * `formatRateShort`, nunca trunca un dígito significativo: una tasa
 * invertida chica (1 ARS = 0,000641 USD) se sigue leyendo, no se pierde
 * redondeando a 2 decimales.
 */
export function formatRateTrimmed(scaled: ScaledRate): string {
  const [intPart, fracPart] = formatRate(scaled).split(".");
  const trimmed = (fracPart ?? "").replace(/0+$/, "");
  return trimmed === "" ? intPart! : `${intPart}.${trimmed}`;
}

export function rateFromInteger(n: number): ScaledRate {
  return BigInt(n) * RATE_SCALE;
}

/**
 * Redondeo consciente de magnitud, PARA HUMANOS: 2 decimales si el rate
 * vale 1 o más (nadie cotiza ARS/USD a más de 2 decimales — es la
 * convención real de cualquier casa de cambio). Por debajo de 1, en vez de
 * un corte fijo en 6 decimales, escala para conservar ~4 cifras
 * significativas — un corte fijo colapsaba cualquier par con más de 4-5
 * órdenes de magnitud de diferencia (un peso frente a una cripto de precio
 * alto, o simplemente ARS/UYU contra USD sin pasar por la dirección
 * "fuerte → débil" que ya elige `defaultInverted` en `/currencies`) a algo
 * como "0,000003" sin ninguna cifra que decir nada. Invertir un rate cuyo
 * recíproco no termina en decimal es matemáticamente inevitable que no
 * sea "redondo" — sin este redondeo la app mostraba los 12 decimales
 * crudos de `fx_rate`. Nunca toca lo que usa `convert()` para la plata
 * real — eso sigue siendo el rate completo, sin redondear; esto es solo
 * para lo que se MUESTRA/EDITA.
 */
export function roundRateForDisplay(rate: ScaledRate): ScaledRate {
  const abs = rate < 0n ? -rate : rate;
  let decimals = 2;
  if (abs > 0n && abs < RATE_SCALE) {
    // Orden de magnitud vía Number() — solo decide CUÁNTOS decimales
    // mostrar, nunca el valor final (eso lo hace `roundHalfEven` sobre el
    // bigint exacto más abajo, sin pasar la plata por punto flotante).
    const asNumber = Number(abs) / Number(RATE_SCALE);
    const magnitude = Math.floor(Math.log10(asNumber)); // negativo: -1 para 0,1-0,99, -4 para 0,0001-0,00099...
    decimals = Math.min(RATE_DECIMALS, Math.max(6, 3 - magnitude));
  }
  const divisor = 10n ** BigInt(RATE_DECIMALS - decimals);
  return roundHalfEven(rate, divisor) * divisor;
}

/**
 * ¿Conviene invertir este rate para mostrarlo? `rate` va siempre en la
 * convención interna de toda la app ("unidades de `quote` por 1 de
 * `base`"). Cuando esa cifra es menor a 1 — 1 `base` vale menos que 1
 * `quote`, como ARS frente a USD — el número se lee mejor anclado en
 * `quote`: "1 USD = 1547,70 ARS" en vez de "1 ARS = 0,000643 USD".
 *
 * Reemplaza el criterio que había hasta ahora, hardcodeado a "ancla en USD
 * si USD participa" (duplicado en `AmountStep` para la transferencia y la
 * conversión de captura). Ese acierta con pares fiat contra USD porque USD
 * suele valer más, pero se rompe apenas participa una moneda que vale MÁS
 * que USD — BTC, EUR — mostrando "1 USD = 0,86 EUR" en vez de "1 EUR = 1,16
 * USD". El criterio correcto no depende de qué código de moneda es: ancla
 * siempre en la que vale más, sea cual sea.
 */
export function shouldInvertRateForDisplay(rate: ScaledRate): boolean {
  return rate > 0n && rate < RATE_SCALE;
}

/** `1 / rate`, útil cuando un proveedor cotiza el par en la dirección opuesta. */
export function invertRate(rate: ScaledRate): ScaledRate {
  if (rate === 0n) throw new Error("No se puede invertir un rate en cero");
  return roundHalfEven(RATE_SCALE * RATE_SCALE, rate);
}

/**
 * Inverso de `convert()`: dado un monto de origen y el monto de destino
 * que efectivamente resultó, deriva qué rate los conecta — "cuántas
 * unidades de `to.currency` equivalen a 1 unidad de `from.currency`". Sirve
 * para el caso "pagar tarjeta" donde el usuario conoce el monto que le
 * descontaron en su cuenta (no la cotización que usó el banco) y hay que
 * despejar la tasa a partir de eso, en vez de al revés. `null` si
 * `from.amount` es cero — no hay tasa que despejar de una división por 0.
 */
export function rateFromAmounts(from: Money, to: Money): ScaledRate | null {
  if (from.amount === 0n) return null;
  const decimalsDiff = decimalsFor(to.currency) - decimalsFor(from.currency);
  let numerator = to.amount * RATE_SCALE;
  let denominator = from.amount;
  if (decimalsDiff >= 0) {
    denominator *= 10n ** BigInt(decimalsDiff);
  } else {
    numerator *= 10n ** BigInt(-decimalsDiff);
  }
  return roundHalfEven(numerator, denominator);
}

/**
 * Convierte `amount` (en su moneda) a `toCurrency` usando `rate` = cuántas
 * unidades de `toCurrency` equivalen a 1 unidad de `amount.currency`.
 * Fixed-point puro: nunca pasa por `number`. Ajusta por la diferencia de
 * decimales entre las dos monedas (p. ej. ARS 2 decimales → JPY 0).
 */
export function convert(amount: Money, toCurrency: string, rate: ScaledRate): Money {
  if (amount.currency === toCurrency) return amount;

  const fromDecimals = decimalsFor(amount.currency);
  const toDecimals = decimalsFor(toCurrency);
  const decimalsDiff = toDecimals - fromDecimals;

  let numerator = amount.amount * rate;
  let denominator = RATE_SCALE;

  if (decimalsDiff >= 0) {
    numerator *= 10n ** BigInt(decimalsDiff);
  } else {
    denominator *= 10n ** BigInt(-decimalsDiff);
  }

  return money(roundHalfEven(numerator, denominator), toCurrency);
}
