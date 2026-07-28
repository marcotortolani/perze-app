/**
 * Decimales por moneda — `docs/00-producto.md` § 2.3: 2 para la mayoría de
 * las fiat, 0 para las que no subdividen su unidad menor en la práctica
 * cotidiana, hasta 8 para crypto. Es una tabla, no un supuesto: sumar una
 * moneda nueva es una entrada acá, nunca un cambio de código en otro lado.
 */
const CURRENCY_DECIMALS: Record<string, number> = {
  ARS: 2,
  UYU: 2,
  USD: 2,
  EUR: 2,
  BRL: 2,
  MXN: 2,
  PEN: 2,
  BOB: 2,
  VES: 2,
  CLP: 0,
  COP: 2,
  JPY: 0,
  BTC: 8,
  ETH: 8,
  USDT: 2,
  USDC: 2,
};

const DEFAULT_FIAT_DECIMALS = 2;

export function decimalsFor(currency: string): number {
  return CURRENCY_DECIMALS[currency.toUpperCase()] ?? DEFAULT_FIAT_DECIMALS;
}
