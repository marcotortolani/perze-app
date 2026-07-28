/**
 * Referencia estática de países/monedas para los selectores de E3 — recorte
 * deliberado a los mercados que el household demo y el diseño cubren
 * (Cono Sur + USD como moneda ancla). Sumar un país/moneda nuevo es una
 * entrada acá, nunca un cambio de código en otro lado (mismo criterio que
 * `lib/money/decimals.ts`).
 */
export interface CountryRef {
  code: string;
  name: string;
  flag: string;
  defaultCurrency: string;
}

export const COUNTRIES: CountryRef[] = [
  { code: "UY", name: "Uruguay", flag: "🇺🇾", defaultCurrency: "UYU" },
  { code: "AR", name: "Argentina", flag: "🇦🇷", defaultCurrency: "ARS" },
  { code: "BR", name: "Brasil", flag: "🇧🇷", defaultCurrency: "BRL" },
  { code: "US", name: "Estados Unidos", flag: "🇺🇸", defaultCurrency: "USD" },
  { code: "MX", name: "México", flag: "🇲🇽", defaultCurrency: "MXN" },
  { code: "CL", name: "Chile", flag: "🇨🇱", defaultCurrency: "CLP" },
];

export interface CurrencyRef {
  code: string;
  name: string;
}

export const CURRENCIES: CurrencyRef[] = [
  { code: "UYU", name: "Peso uruguayo" },
  { code: "ARS", name: "Peso argentino" },
  { code: "USD", name: "Dólar estadounidense" },
  { code: "BRL", name: "Real brasileño" },
  { code: "MXN", name: "Peso mexicano" },
  { code: "CLP", name: "Peso chileno" },
  { code: "EUR", name: "Euro" },
];

export function countryFlag(code: string | null | undefined): string {
  return COUNTRIES.find((c) => c.code === code)?.flag ?? "🏳️";
}

/**
 * `CountryRef.code`/`CurrencyRef.code` → clave de `reference.country.*` /
 * `reference.currency.*` — mismo patrón que `ACCOUNT_KIND_MESSAGE_KEY`
 * (ver `account-kind-labels.ts`): objeto literal para tipar contra la
 * unión exacta de claves de next-intl, no un template dinámico.
 */
export const COUNTRY_MESSAGE_KEY = {
  UY: "reference.country.UY",
  AR: "reference.country.AR",
  BR: "reference.country.BR",
  US: "reference.country.US",
  MX: "reference.country.MX",
  CL: "reference.country.CL",
} as const;

export const CURRENCY_MESSAGE_KEY = {
  UYU: "reference.currency.UYU",
  ARS: "reference.currency.ARS",
  USD: "reference.currency.USD",
  BRL: "reference.currency.BRL",
  MXN: "reference.currency.MXN",
  CLP: "reference.currency.CLP",
  EUR: "reference.currency.EUR",
} as const;
