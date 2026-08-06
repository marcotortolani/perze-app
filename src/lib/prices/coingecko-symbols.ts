/**
 * Símbolo (lo que el usuario tipea en I7b, `instruments.symbol`) → id de
 * CoinGecko (`instruments.provider_symbol`, lo que de verdad se le pide a
 * `/simple/price`) — mismo mapeo acotado que
 * `src/lib/fx/providers/coingecko.ts` usa para el FX de una moneda cripto,
 * separado acá porque ese archivo mapea CÓDIGOS DE MONEDA (para tasas de
 * cambio) y este mapea SÍMBOLOS DE INSTRUMENTO (para el precio de una
 * posición) — mismo alfabeto, dominios distintos, no vale la pena
 * acoplarlos por ahorrarse una lista corta duplicada.
 */
export const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDT: "tether",
  USDC: "usd-coin",
  BNB: "binancecoin",
  SOL: "solana",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  DOT: "polkadot",
  LTC: "litecoin",
};
