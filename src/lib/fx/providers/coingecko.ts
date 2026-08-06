import { invertRate, parseRate, type ScaledRate } from "../rate";
import type { FxProvider, ProviderQuote } from "./types";

/**
 * Símbolo (como vive en `currencies.code`) → id de CoinGecko — `/simple/price`
 * pide el id, no el símbolo (`BTC` no sirve, hace falta `bitcoin`). Lista
 * corta a propósito: las cryptos más comunes, ampliable sumando una
 * entrada acá cuando alguien agregue una nueva vía `add_currency` y quiera
 * cotización real en vez de override manual.
 */
const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
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

/**
 * Monedas que CoinGecko acepta como `vs_currencies` — de
 * `GET /simple/supported_vs_currencies`, recortado a lo que esta app
 * realmente usa. **UYU no está** en la lista real del proveedor (ni
 * siquiera pasándosela silenciosamente la ignora) — un par crypto↔UYU
 * queda sin cotización acá, igual que hoy sin ningún proveedor.
 */
const SUPPORTED_VS = new Set(["usd", "eur", "ars", "brl", "mxn", "clp", "gbp", "chf", "cny", "jpy"]);

interface CoinGeckoResponse {
  [id: string]: Record<string, number>;
}

/** Cotizaciones de criptomonedas vía CoinGecko (`/simple/price`, sin API key para uso personal). */
export function createCoinGeckoProvider(fetchImpl: typeof fetch = fetch): FxProvider {
  return {
    id: "coingecko",
    supports(base, quote) {
      const cryptoSide = SYMBOL_TO_COINGECKO_ID[base] ? base : SYMBOL_TO_COINGECKO_ID[quote] ? quote : null;
      if (!cryptoSide) return false;
      const fiatSide = cryptoSide === base ? quote : base;
      return SUPPORTED_VS.has(fiatSide.toLowerCase());
    },
    async fetchQuotes(base, quote): Promise<ProviderQuote[]> {
      const cryptoIsBase = !!SYMBOL_TO_COINGECKO_ID[base];
      const cryptoSymbol = cryptoIsBase ? base : quote;
      const fiatSymbol = cryptoIsBase ? quote : base;
      const coinId = SYMBOL_TO_COINGECKO_ID[cryptoSymbol];
      if (!coinId) return [];

      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=${encodeURIComponent(fiatSymbol.toLowerCase())}`;
      const res = await fetchImpl(url);
      if (!res.ok) throw new Error(`coingecko respondió ${res.status}`);
      const data = (await res.json()) as CoinGeckoResponse;

      const price = data[coinId]?.[fiatSymbol.toLowerCase()];
      if (price === undefined) return [];

      // CoinGecko siempre da "1 crypto = X fiat". Si el pedido es al
      // revés (fiat como base), se invierte antes de devolver.
      const cryptoToFiat: ScaledRate = parseRate(price.toString());
      const rate = cryptoIsBase ? cryptoToFiat : invertRate(cryptoToFiat);
      return [
        {
          base,
          quote,
          quoteKind: "default",
          rate,
          // CoinGecko no devuelve fecha en `/simple/price` — es siempre el
          // precio spot actual, así que "hoy" es la única fecha honesta.
          asOf: new Date().toISOString().slice(0, 10),
        },
      ];
    },
  };
}
