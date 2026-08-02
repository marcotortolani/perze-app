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
  KRW: 0,
  BTC: 8,
  ETH: 8,
  USDT: 2,
  USDC: 2,
};

const DEFAULT_FIAT_DECIMALS = 2;

export function decimalsFor(currency: string): number {
  return CURRENCY_DECIMALS[currency.toUpperCase()] ?? DEFAULT_FIAT_DECIMALS;
}

/**
 * Decimales para CANTIDADES de instrumento (`numeric(38,12)`, nunca
 * `bigint`) — dominio distinto de la plata. `docs/contrato-componentes.md`
 * § 0: `decimalsFor()` deriva de la moneda para montos, o del instrumento
 * para cantidades; acá vive esa segunda tabla. No hay default por el
 * mismo motivo que `formatNumber` no lo tiene: redondear mal una cantidad
 * de BTC o de cuotas de FCI es tan silencioso y grave como redondear plata.
 */
export interface QuantityDecimalsInput {
  /** Símbolo del instrumento — cubre crypto conocidas (BTC, ETH, ...). */
  symbol?: string;
  /** Nombre del asset class (semilla de `docs/01-arquitectura-datos.md` § 2.8). */
  assetClass?: string;
  /** Override explícito (ej. `instruments.metadata.quantityDecimals`). */
  decimals?: number;
}

const CRYPTO_QUANTITY_DECIMALS: Record<string, number> = {
  BTC: 8,
  ETH: 8,
  USDT: 2,
  USDC: 2,
};

/** Claves tal como las siembra § 2.8: "Acciones, CEDEARs, Bonos soberanos, ONs, Letras, FCI, Plazo fijo, Crypto, ETFs, Inmuebles, Efectivo, Otros". */
const ASSET_CLASS_QUANTITY_DECIMALS: Record<string, number> = {
  Crypto: 8,
  FCI: 4,
};

/** Acciones, CEDEARs, bonos, ONs, letras, ETFs: unidades enteras salvo que se diga lo contrario. */
const DEFAULT_QUANTITY_DECIMALS = 0;

export function decimalsForQuantity(input: QuantityDecimalsInput): number {
  if (typeof input.decimals === "number") return input.decimals;
  const bySymbol = input.symbol ? CRYPTO_QUANTITY_DECIMALS[input.symbol.toUpperCase()] : undefined;
  if (bySymbol !== undefined) return bySymbol;
  const byAssetClass = input.assetClass ? ASSET_CLASS_QUANTITY_DECIMALS[input.assetClass] : undefined;
  if (byAssetClass !== undefined) return byAssetClass;
  return DEFAULT_QUANTITY_DECIMALS;
}
